# 档位 B 改造方案：全 async 化，消除双 loop 桥接

> 日期：2026-08-31 · worktree：0828-1 · 前置分析：`planify/docs/ARCHITECTURE.md`、`doclens/web_v2/docs/ARCHITECTURE-sse.md`、`ARCHITECTURE-ask-loopback.md`

## 一、背景与目标

Web SSE 链路（`doclens/web_v2/api/chat.py`）当前为「**生成线程私有 loop + ASGI 主 loop**」双 loop 架构：agent 在子线程跑，事件经 `call_soon_threadsafe` 搬运 + `_feed` 50ms 轮询 diff 运输。根因是 `LLMProvider.stream()` 是**同步迭代器**，会阻塞事件循环。

本改造消除该根因：Provider 层提供真 async 接口 → agent 直接跑在 ASGI 主 loop → 桥接层全部删除。同时修复两个已确认缺口：

1. **中断缺口**：`interrupt_event` 检查点仅在 LLM 流循环（`streaming/runner.py:512`），ask 挂起期间点「停止」无效，生成线程干等 300s；
2. **waiter 理论竞态**：`submit_response` 跨线程 `event.set()` 靠 GIL 兜底（`waiter.py:123-124` 注释自述）。

### 现状关键事实（改造依据）

| 事实 | 位置 |
|---|---|
| 两个 Provider 均为同步 SDK 客户端（`Anthropic(...)` / `OpenAI(...)`） | `anthropic_provider.py:31`、`openai_compat_provider.py:33` |
| `stream()` 同步迭代器，runner 同步 `for` 消费 | `provider.py:25`、`streaming/runner.py:505` |
| `auto_compact` 在 runner 主循环内同步调 `provider.chat()` | `streaming/runner.py:294`、`context/compact.py:155` |
| 事件发射 fire-and-forget `asyncio.create_task`（任务引用未持有，有 GC 隐患） | `runner.py:534,552,571,612` |
| `await asyncio.sleep(0.1)` 排空时序 hack | `runner.py:342` |
| SDK 版本已具备 async 能力：anthropic 0.112.0（`AsyncAnthropic`/`AsyncMessageStream`）、openai 2.44.0（`AsyncOpenAI`） | 已验证 |

## 二、B1：Provider 层新增 `achat` / `astream`

**原则：协议只增不改**——同步 `chat()`/`stream()` 原样保留，服务旧 REPL、teammate、subagent、CLI/TUI 兼容路径。async 客户端**惰性初始化**（首次调用 `a*` 方法时创建），同步-only 场景零开销。

### 协议（`core/llm/provider.py`）

```python
class LLMProvider(Protocol):
    def chat(...) -> LLMResponse: ...
    def stream(...) -> Iterator[StreamEvent]: ...
    async def achat(...) -> LLMResponse: ...          # 新增
    def astream(...) -> AsyncIterator[StreamEvent]: ...  # 新增（async generator）
    def count_tokens(text: str) -> int: ...
```

### AnthropicProvider

- `_ensure_async_client()`：惰性建 `AsyncAnthropic(api_key=..., http_client=httpx.AsyncClient(verify=False), base_url=...)`——参数与同步版一致（自签名证书兼容）。
- `achat`：`await aclient.messages.create(**kwargs)`；保留 "Streaming is required" ValueError 降级（`async with aclient.messages.stream(...) as s: response = await s.get_final_message()`）。kwargs 组装与同步版共享——抽 `_chat_kwargs(messages, system, tools, max_tokens)` 私有方法。
- `astream`（async generator）：`async with aclient.messages.stream(**kwargs) as s: async for event in s: normalized = self._event_from_anthropic(event); ...`——事件转换完全复用现有静态方法。

### OpenAICompatProvider

- 同样惰性 `AsyncOpenAI`。
- `achat`：`await aclient.chat.completions.create(**kwargs)`，响应归一化与同步版共享。
- `astream`：**抽共享翻译核心**——同步 `stream()` 里的 chunk→StreamEvent 状态机（json_deltas 累积、block_index=idx+1 映射、finish_reason 处理，`openai_compat_provider.py:112-183`）提取为 `_StreamTranslator` 类（`feed(chunk) -> list[StreamEvent]` + `finish() -> list[StreamEvent]`），同步壳 `for chunk in ...: yield from t.feed(chunk)`，异步壳 `async for chunk in await create(...): for ev in t.feed(chunk): yield ev`。**一份状态机两处壳**，避免双维护漂移。

## 三、B2：StreamingAgent 与 compact async 化

### `streaming/runner.py`

1. `_stream_llm_call`：`for event in self.provider.stream(...)` → `async for event in self.provider.astream(...)`。中断检查（:512）保留在循环内——`async for` 每个 await 点让出，中断响应性反而更好。
2. **事件发射改直接 `await`**：`asyncio.create_task(self.emitter.emit_text(...))` → `await self.emitter.emit_text(...)`。理由：改造后 emitter 的 emit 是 `queue.put_nowait` 级轻操作（见 B3），直接 await 不阻塞且**天然保证事件顺序**；同时消灭未持有引用的 task 被 GC 隐患与 `:342` 的 `sleep(0.1)` 排空 hack。
3. `auto_compact` 调用点（:294）：同步版会阻塞主 loop 数秒~数十秒，改调 async 版。

### `context/compact.py`

新增 `async def aauto_compact(messages, provider, transcript_dir)`：落盘 transcript 逻辑不变，摘要调用 `await provider.achat(...)`。同步 `auto_compact` 保留（服务 `agent/runner.py:137` 与 CLI `/compact` 命令）。两函数共享 transcript 落盘与 prompt 组装（抽 `_prepare_compaction`）。

## 四、B4：waiter Future 化 + 中断传播

### `streaming/waiter.py`

```python
@dataclass
class PendingRequest:
    request_id: str
    future: asyncio.Future          # 替代 event + response 两字段（Deferred：唤醒与传值一步完成）
    loop: asyncio.AbstractEventLoop # 属主 loop（submit 跨线程时用）
    created_at: float = ...
```

- `create_request`：在当前 running loop 上 `loop.create_future()`。
- `wait_for_response`：`await asyncio.wait_for(pending.future, timeout)`；醒来后 `pending.future.result()`（submit 侧已写入）。超时路径 pop 清理不变。
- `submit_response`（**保持同步签名**，CLI 输入线程仍可直接调）：

```python
def submit_response(self, request_id, response) -> bool:
    pending = self._pending.pop(request_id, None)   # 一次性消费：先摘除
    if pending is None:
        return False
    pending.loop.call_soon_threadsafe(self._resolve, pending, response)
    return True

@staticmethod
def _resolve(pending, response):
    if not pending.future.done():
        pending.future.set_result(response)
```

  「event 已 set、response 未写」窗口消失；跨线程经 `call_soon_threadsafe`（同 loop 调用等价排队，行为一致且安全）。GIL 兜底注释删除。
- **新增 `interrupt(request_id) -> bool`**：摘除 pending 并 threadsafe `_resolve(pending, {"interrupted": True})`；ask handler 醒来检查 `response.get("interrupted")` → 返回 `{"error": "interrupted"}` 给模型，agent 循环在下一个中断检查点退出。
- `has_pending_request` / `cleanup_expired` 相应适配。

### `doclens/web_v2/chat_interrupt.py`：中断 hook 注册表

```python
_interrupt_hooks: dict[str, set[Callable[[], None]]] = {}

def register_interrupt_hook(session_id, hook) / unregister_interrupt_hook(...)
def request_stop(session_id) -> bool:
    ... ev.set()
    for hook in hooks: hook()   # 唤醒该 session 挂起的 ask 等一切等待
```

chat.py 在请求开始时注册 hook = `lambda: [waiter.interrupt(a["request_id"]) for a in emitter.pending_asks]`，结束注销。`/chat/stop` 与 SSE 断开两条路径都经 `request_stop` 走到 hook——**中断缺口修复**。

### `planify/tools/user_interaction.py`

`handle_ask_user_question` / `handle_ask_user` 的响应处理加 interrupted 分支（超时分支旁）：返回 `{"error": "interrupted", "request_id": ...}`。

## 五、B3：chat.py 删桥接，agent 回主 loop

### `_chat_emitter.py`：ChatEventEmitter 直推化

构造参数加 `queue: asyncio.Queue`（属主 = ASGI 主 loop）。`emit()` 各分支在**现有积累逻辑不变**的基础上，同步 `queue.put_nowait(...)`：

- TEXT → 仅积累（token 整体推送的策展取舍**不变**，正文仍 done 后整体推——本次只改运输，不改展示策略；实时推 token 成为后续可选）；
- TOOL_CALL（is_complete）/ TOOL_RESULT / ASK（questions）→ 积累 + 直接入队；
- DONE/ERROR → 置标志 + 入队。

`_feed` 轮询 diff 与 `delivered_*` 集合全部删除。

### `chat.py` 新结构（约 130 行 → 60 行）

```python
@router.post("/chat")
async def chat(req: ChatRequest):
    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()
        emitter = ChatEventEmitter(queue)
        interrupt = register_interrupt(session_key)
        register_interrupt_hook(session_key, hook)   # B4
        agent_task = asyncio.create_task(sa.run_stream(history, message, sid))
        try:
            while True:
                ev = await queue.get()
                if ev is None: break                 # DONE/ERROR 后 emitter 投哨兵
                yield sse(ev)                        # 现有 7 种事件映射不变
        finally:
            register/unregister 清理；agent_task 未完成则 cancel + request_stop
        # agent_task 完成后：策展（skill/普通两路不变）→ error/token/toast → append_chat_turn_raw 落库
    return EventSourceResponse(event_stream())
```

- **删除**：`_run_in_thread`、`asyncio.new_event_loop()`、`_put`/`call_soon_threadsafe`、`_feed` 协程、`asyncio.gather` 双协程。
- **取消语义**：客户端断开 → 生成器 `CancelledError` → finally 里 `agent_task.cancel()` + `request_stop`——`CancelledError` 沿 await 链传播到 `astream`/工具 await，比线程方案干净（线程方案里断开后线程照跑）。
- 策展、落库、`history` 弹出防重复、技能会话判定逻辑**全部保留**（只是执行位置从线程尾部挪到主 loop 顺序代码）。
- DONE 哨兵顺序：emitter 收到 DONE 先推完队列内事件再投 `None`——直推模式下事件天然有序（emit 即入队），无 `_feed` 的乱序窗口。

## 六、兼容性论证

| 链路 | 影响 | 论证 |
|---|---|---|
| Web SSE（chat.py） | 本改造主体 | 全部路径重写 + 回归 |
| CLI（planify/cli.py） | 无行为变化 | `run_until_complete(agent.run_stream(...))` 主线程跑，astream 在其中正常工作；CLIEventEmitter 的 ask 用 `input()` 后同步 `submit_response`——经 `call_soon_threadsafe` 排回同 loop，兼容 |
| TUI / agent_integration | 无行为变化 | 同 CLI 模式（TUIEventEmitter 回调路由） |
| teammate | 无变化 | 只用同步 `provider.chat()`，async 客户端不初始化 |
| subagent / 旧 Agent（main.py REPL） | 无变化 | 同步 `chat()` 原样保留 |
| 同一 Provider 实例被同步+异步混用 | 安全 | 同步/异步是两个独立 client 对象，连接池互不干扰；anthropic/openai SDK 的 async client 并发安全 |
| 国产 OpenAI 兼容端点 | 需实测 | AsyncOpenAI 走 httpx.AsyncClient，协议层与同步一致；`verify=False`/`base_url` 配置对齐 |

## 七、实施顺序（每步可独立提交）

1. **B1** Provider：协议 + AnthropicProvider + OpenAICompatProvider（含 `_StreamTranslator` 抽取）
2. **B2** runner + compact：`astream` 消费、事件直 await、`aauto_compact`
3. **B4** waiter + chat_interrupt + user_interaction：Future 化、interrupt、hook
4. **B3** `_chat_emitter` + `chat.py`：直推化、删桥接（依赖 B1-B4 全部就位）
5. **回归**：见下

## 八、回归验证计划

1. **静态**：改动文件 `python -m py_compile` + `python -c "import ..."`；
2. **单元级**：`_StreamTranslator` 同步/异步壳产出事件序列一致性（同 chunk 序列喂两壳，断言事件一致）；
3. **CLI 冒烟**：`planify/cli.py` 路径流式问答一轮（真实 key）；
4. **Web SSE**：`start-app gui` 后验证——普通问答（token/tool_call/done 事件序）、工具调用 trace 实时性、ask 回环（卡片渲染→作答→对话继续）、**中断**（生成中点停、ask 挂起中点停——后者是新修复能力）、断开（关页后后端不再挂着）；
5. **落库**：`append_chat_turn_raw` 照常、`message_ai_raw` 回放正常。
