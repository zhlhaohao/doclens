# AI 对话「工具调用过程」展示 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 doclens GUI 的 AI 对话页面展示 agent 的工具调用步骤（工具名/参数/结果/状态），流式中可见进度、完成后自动折叠、历史会话回看也保留。

**Architecture:** 后端 `chat.py` 扩展 `_feed()` 轮询，把 emitter 已采集的工具事件结构化透传成 SSE（`tool_call`/`tool_result` 事件）；前端新增 `ToolStep` 数据模型与 `chat-tool-trace` 子组件，chat-view 用不可变更新消费事件，完成后组件自治折叠。

**Tech Stack:** Python(FastAPI/sse-starlette) · TypeScript(Lit 3 / Vitest / jsdom) · Anthropic SDK(planify StreamingAgent)

## Global Constraints

- **Python 运行方式**：Bash 工具用 `.venv/Scripts/python.exe -m ...`（Git Bash 下 activate 不入 PATH）。
- **前端测试命令**：`cd doclens/web_v2/frontend && npm test -- <spec路径>`（vitest run，jsdom 环境）。
- **后端测试命令**：`.venv/Scripts/python.exe -m pytest tests/web_v2/<file>.py -v`。
- **前端生效**：改完前端代码必须 `cd doclens/web_v2/frontend && npm install && npm run build`，再重启后端（`pwsh -File ./start-app.ps1 gui`）。
- **不可变更新**：所有 state 变更用 spread 返回新对象/数组，禁止原地修改（项目硬规则）。
- **Git 规则（用户全局）**：未经用户明确授权，禁止 `git commit` / `git push`。每个 Task 末尾的 commit 步骤需暂停等待用户确认后再执行。
- **配色 token**：主色 `#0D9488`、primary-soft `#F0FDFA`、success `#10B981`、danger `#DC2626`、border `#E4E4E7`、text-muted `#64748B`、text-subtle `#94A3B8`、bg `#F5F5F7`、font-mono `var(--cortex-font-mono)`、radius-md `8px`、radius-sm `4px`、fs-sm `13px`、fs-xs `12px`。
- **设计依据**：`docs/superpowers/specs/2026-07-08-chat-tool-trace-design.md`。

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `doclens/web_v2/api/_chat_emitter.py` | 修改 | tool_calls 每项补 `tool_use_id`/`is_error`/`duration_ms` |
| `doclens/web_v2/api/chat.py` | 修改 | `_stream_agent_response` yield 结构化事件；`_feed` 轮询工具事件；`event_stream` 分发 SSE event 名 |
| `tests/web_v2/test_chat_emitter.py` | 新建 | emitter 工具事件收集单测 |
| `tests/web_v2/test_chat_api.py` | 修改 | 新增工具事件 SSE 测试 + 更新现有 mock 契约 |
| `doclens/web_v2/frontend/src/state/types.ts` | 修改 | 新增 `ToolStep` / `ToolStepStatus`；`ChatMessage` 加 `tool_steps` |
| `doclens/web_v2/frontend/src/api/chat.ts` | 修改 | 新增 `ChatStreamEvent` 类型 + `tool_call`/`tool_result` yield |
| `doclens/web_v2/frontend/tests/chat.spec.ts` | 新建 | chatStream 解析测试 |
| `doclens/web_v2/frontend/src/components/chat-tool-trace.ts` | 新建 | 折叠/展开 + 步骤渲染 + 进行中 spinner + 错误标红 + 结果截断 |
| `doclens/web_v2/frontend/src/app.ts` | 修改 | 注册 `chat-tool-trace` side-effect import |
| `doclens/web_v2/frontend/tests/chat-tool-trace.spec.ts` | 新建 | 组件渲染测试 |
| `doclens/web_v2/frontend/src/views/chat-view.ts` | 修改 | `applyStreamEvent` 纯函数 + `_submit` 消费事件 + `_loadSession` 映射 + `appendSession` 带 tool_calls |
| `doclens/web_v2/frontend/src/components/chat-message.ts` | 修改 | 挂载 `<chat-tool-trace>` + 分隔线 |
| `doclens/web_v2/frontend/tests/chat-view-stream.spec.ts` | 新建 | applyStreamEvent 不可变更新测试 |
| `doclens/web_v2/frontend/tests/chat-view-session.spec.ts` | 新建 | mapSessionItemsToMessages + 向后兼容测试 |
| `tests/web_v2/test_sessions_store.py` | 修改 | message_ai payload 含 tool_calls 的往返透传测试 |
| `doclens/web_v2/frontend/tests/e2e/chat-tool-trace.spec.ts` | 新建 | E2E：mock SSE 验证渲染 |

---

## Task 1: 后端 emitter 工具事件元数据

**Files:**
- Modify: `doclens/web_v2/api/_chat_emitter.py`
- Test: `tests/web_v2/test_chat_emitter.py`

**Interfaces:**
- Produces: `GradioEventEmitter.tool_calls` 每项结构变为
  `{tool_use_id, name, input, output?, is_error?, duration_ms?}`（内部临时字段 `_t0` 在 result 回填时 pop 掉）。

- [ ] **Step 1: 写失败测试**

创建 `tests/web_v2/test_chat_emitter.py`：

```python
"""GradioEventEmitter 工具事件收集测试。"""
import pytest

from planify.streaming.types import StreamEvent, StreamEventType
from doclens.web_v2.api._chat_emitter import GradioEventEmitter


@pytest.mark.asyncio
async def test_tool_call_and_result_collected_with_id_and_duration():
    emitter = GradioEventEmitter()
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_CALL,
        data={"tool_use_id": "t1", "name": "search", "input": {"query": "x"}, "is_complete": True},
    ))
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_RESULT,
        data={"tool_use_id": "t1", "name": "search", "output": "found 1", "is_error": False},
    ))
    assert len(emitter.tool_calls) == 1
    tc = emitter.tool_calls[0]
    assert tc["tool_use_id"] == "t1"
    assert tc["name"] == "search"
    assert tc["input"] == {"query": "x"}
    assert tc["output"] == "found 1"
    assert tc["is_error"] is False
    assert isinstance(tc["duration_ms"], int)
    assert "_t0" not in tc  # 内部字段不应残留


@pytest.mark.asyncio
async def test_tool_result_error_marked():
    emitter = GradioEventEmitter()
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_CALL,
        data={"tool_use_id": "t2", "name": "read_document", "input": {}, "is_complete": True},
    ))
    await emitter.emit(StreamEvent(
        event_type=StreamEventType.TOOL_RESULT,
        data={"tool_use_id": "t2", "name": "read_document", "output": "Error: boom", "is_error": True},
    ))
    assert emitter.tool_calls[0]["is_error"] is True
```

- [ ] **Step 2: 跑测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_emitter.py -v`
Expected: FAIL —— `KeyError: 'tool_use_id'`（当前 tool_calls 不存 tool_use_id / duration_ms）。

- [ ] **Step 3: 改 emitter**

在 `doclens/web_v2/api/_chat_emitter.py` 顶部 import 区加 `time`：

```python
import logging
import time
from typing import Any, Dict, List, Optional
```

把 `emit()` 方法的 `TOOL_CALL` 分支（当前 `elif event.event_type == StreamEventType.TOOL_CALL:` 整段）替换为：

```python
        elif event.event_type == StreamEventType.TOOL_CALL:
            if event.data.get("is_complete", False):
                self.tool_calls.append({
                    "tool_use_id": event.data.get("tool_use_id", ""),
                    "name": event.data.get("name", ""),
                    "input": event.data.get("input", {}),
                    "_t0": time.monotonic(),
                })
```

把 `emit()` 方法的 `TOOL_RESULT` 分支（当前 `elif event.event_type == StreamEventType.TOOL_RESULT:` 整段）替换为：

```python
        elif event.event_type == StreamEventType.TOOL_RESULT:
            tool_use_id = event.data.get("tool_use_id", "")
            name = event.data.get("name", "")
            output = event.data.get("output", "")
            is_error = event.data.get("is_error", False)

            def _fill(tc: dict) -> None:
                duration_ms = int((time.monotonic() - tc.pop("_t0", time.monotonic())) * 1000)
                tc["tool_use_id"] = tool_use_id
                tc["output"] = output
                tc["is_error"] = is_error
                tc["duration_ms"] = duration_ms

            # 优先按 tool_use_id 匹配未回填的调用
            matched = False
            for tc in reversed(self.tool_calls):
                if tc.get("tool_use_id") == tool_use_id and tool_use_id and "output" not in tc:
                    _fill(tc)
                    matched = True
                    break
            if not matched:
                # 降级：按 name 匹配未回填的调用
                for tc in reversed(self.tool_calls):
                    if tc.get("name") == name and "output" not in tc:
                        _fill(tc)
                        matched = True
                        break
            if not matched:
                # 没找到对应调用，单独记录
                self.tool_calls.append({
                    "tool_use_id": tool_use_id, "name": name,
                    "output": output, "is_error": is_error,
                })
```

- [ ] **Step 4: 跑测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_emitter.py -v`
Expected: PASS（2 个测试全绿）。

- [ ] **Step 5: Commit（等待用户授权）**

```bash
git add doclens/web_v2/api/_chat_emitter.py tests/web_v2/test_chat_emitter.py
git commit -m "feat(web): emitter 收集 tool_use_id/duration_ms/is_error 元数据"
```

---

## Task 2: 后端 chat.py SSE 结构化透传

**Files:**
- Modify: `doclens/web_v2/api/chat.py`
- Test: `tests/web_v2/test_chat_api.py`

**Interfaces:**
- Consumes: Task 1 的 `GradioEventEmitter.tool_calls`（含 tool_use_id/duration_ms）。
- Produces: `_stream_agent_response(message, session_id)` 的 yield 由纯字符串改为 dict：
  `{type:"token",text}` / `{type:"tool_call",tool_use_id,name,input}` / `{type:"tool_result",tool_use_id,name,output,is_error,duration_ms?}` / `{type:"error",detail}`。
- Produces: SSE 新增 `event: tool_call` / `event: tool_result`。

- [ ] **Step 1: 写失败测试（新增工具事件 SSE 测试）**

在 `tests/web_v2/test_chat_api.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_chat_emits_tool_call_and_result_events(env_cortex_config, temp_workdir, monkeypatch):
    """验证 chat.py 把结构化事件转成 tool_call/tool_result SSE。"""
    from doclens.web_v2 import deps

    class _FakeAgent:
        def __init__(self):
            self.session = type("S", (), {"session_id": "test"})()

    async def _fake_stream(message, session_id):
        yield {"type": "tool_call", "tool_use_id": "t1", "name": "search", "input": {"query": "x"}}
        yield {"type": "tool_result", "tool_use_id": "t1", "name": "search",
               "output": "found 1", "is_error": False, "duration_ms": 120}
        yield {"type": "token", "text": "answer"}

    monkeypatch.setattr(deps, "get_agent", lambda: _FakeAgent())
    import doclens.web_v2.api.chat as chat_mod
    monkeypatch.setattr(chat_mod, "_stream_agent_response", _fake_stream)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/chat", json={"message": "hi", "session_id": "test"})

    assert res.status_code == 200
    # 解析 SSE：按空行切块，提取 event/data
    events = []
    for block in res.text.split("\n\n"):
        ev_type, data = None, ""
        for line in block.split("\n"):
            if line.startswith("event:"):
                ev_type = line[6:].strip()
            elif line.startswith("data:"):
                data += line[5:].strip()
        if ev_type:
            events.append((ev_type, json.loads(data) if data else {}))

    types = [e[0] for e in events]
    assert "tool_call" in types
    assert "tool_result" in types

    call_ev = next(e[1] for e in events if e[0] == "tool_call")
    assert call_ev["name"] == "search"
    assert call_ev["input"] == {"query": "x"}
    assert call_ev["is_complete"] is True

    result_ev = next(e[1] for e in events if e[0] == "tool_result")
    assert result_ev["output"] == "found 1"
    assert result_ev["is_error"] is False
    assert result_ev["duration_ms"] == 120
```

- [ ] **Step 2: 跑测试确认失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py::test_chat_emits_tool_call_and_result_events -v`
Expected: FAIL —— `KeyError: 'type'`（现有 `_stream_agent_response` yield 字符串，dict 取 `ev["type"]` 会出错）。

- [ ] **Step 3: 改 `_stream_agent_response` 与 `_feed`**

在 `doclens/web_v2/api/chat.py` 中，把整个 `_stream_agent_response` 函数替换为（保留所有 StreamingAgent 构造参数不变，仅 `_feed` 与 queue 投递改为结构化事件）：

```python
async def _stream_agent_response(message: str, session_id: Optional[str]) -> AsyncIterator[dict]:
    """流式产生结构化事件 dict 供 SSE 消费。

    事件类型：
    - {"type":"token","text":...}
    - {"type":"tool_call","tool_use_id":...,"name":...,"input":...}
    - {"type":"tool_result","tool_use_id":...,"name":...,"output":...,"is_error":...,"duration_ms":...}
    - {"type":"error","detail":...}
    """
    agent = get_agent()
    session = agent.session

    history: list[dict] = []
    if session_id:
        try:
            from doclens.web_v2.deps import get_sessions_store
            history = get_sessions_store().get_chat_history(session_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("load chat history failed for %s: %s", session_id, e)

    queue: asyncio.Queue = asyncio.Queue()
    done_event = threading.Event()

    def _run_in_thread():
        try:
            from doclens.web_v2.api._chat_emitter import GradioEventEmitter
            from planify.streaming.runner import StreamingAgent
            from planify.streaming.types import StreamingConfig
            from planify.streaming.waiter import get_global_waiter
            from planify.tools import bind_user_interaction_handlers

            emitter = GradioEventEmitter()
            interrupt = threading.Event()

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def _feed():
                last_seen_text = 0
                delivered_calls: set[int] = set()
                delivered_results: set[int] = set()
                while True:
                    # 文本增量
                    cur = emitter.get_full_text()
                    if len(cur) > last_seen_text:
                        await queue.put({"type": "token", "text": cur[last_seen_text:]})
                        last_seen_text = len(cur)
                    # 工具事件（用游标检测新增 / 新回填）
                    for i, tc in enumerate(emitter.tool_calls):
                        if i not in delivered_calls:
                            await queue.put({
                                "type": "tool_call",
                                "tool_use_id": tc.get("tool_use_id", ""),
                                "name": tc.get("name", ""),
                                "input": tc.get("input", {}),
                            })
                            delivered_calls.add(i)
                        if "output" in tc and i not in delivered_results:
                            await queue.put({
                                "type": "tool_result",
                                "tool_use_id": tc.get("tool_use_id", ""),
                                "name": tc.get("name", ""),
                                "output": tc.get("output", ""),
                                "is_error": tc.get("is_error", False),
                                "duration_ms": tc.get("duration_ms"),
                            })
                            delivered_results.add(i)
                    if emitter.done:
                        break
                    await asyncio.sleep(0.05)
                await queue.put(None)  # sentinel

            sa = StreamingAgent(
                client=session.client,
                model=session.model,
                tools=session.tools,
                tool_handlers=session.tool_handlers,
                emitter=emitter,
                config=StreamingConfig(),
                waiter=get_global_waiter(),
                todo_manager=session.todo_mgr,
                bg_manager=session.bg_mgr,
                bus=session.bus,
                skills_loader=session.skills,
                logger_instance=session.logger,
                session=session,
                interrupt_event=interrupt,
            )
            bind_user_interaction_handlers(session.tool_handlers, emitter, get_global_waiter())

            loop.run_until_complete(asyncio.gather(
                sa.run_stream(history, message, session_id or session.session_id),
                _feed(),
            ))
        except Exception as e:
            logger.exception("chat thread error: %s", e)
            asyncio.run(queue.put({"type": "error", "detail": str(e)}))
            asyncio.run(queue.put(None))
        finally:
            done_event.set()

    t = threading.Thread(target=_run_in_thread, daemon=True)
    t.start()

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        yield chunk
```

- [ ] **Step 4: 改 `chat()` 路由的 `event_stream`**

把 `chat.py` 里的 `@router.post("/chat")` 整段替换为：

```python
@router.post("/chat")
async def chat(req: ChatRequest):
    async def event_stream() -> AsyncIterator[dict]:
        try:
            async for ev in _stream_agent_response(req.message, req.session_id):
                t = ev.get("type")
                if t == "token":
                    yield {"event": "token", "data": json.dumps({"text": ev["text"]}, ensure_ascii=False)}
                elif t == "tool_call":
                    yield {"event": "tool_call", "data": json.dumps({
                        "tool_use_id": ev["tool_use_id"],
                        "name": ev["name"],
                        "input": ev["input"],
                        "is_complete": True,
                    }, ensure_ascii=False)}
                elif t == "tool_result":
                    yield {"event": "tool_result", "data": json.dumps({
                        "tool_use_id": ev["tool_use_id"],
                        "name": ev["name"],
                        "output": ev["output"],
                        "is_error": ev.get("is_error", False),
                        "duration_ms": ev.get("duration_ms"),
                    }, ensure_ascii=False)}
                elif t == "error":
                    yield {"event": "error", "data": json.dumps({"detail": ev.get("detail", "")})}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            logger.exception("chat stream error: %s", e)
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_stream())
```

- [ ] **Step 5: 更新现有测试的 mock 契约**

`_stream_agent_response` 现在 yield dict，现有 `test_chat_returns_sse_stream` 的 `_fake_stream` 也要跟着改。把该测试里的 `_fake_stream` 替换为：

```python
    async def _fake_stream(message, session_id):
        for text in ["Hello", " ", "world"]:
            yield {"type": "token", "text": text}
```

（该测试其余断言不变——它断言第一个 payload 含 `text`，仍成立。）

- [ ] **Step 6: 跑全部 chat 测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py tests/web_v2/test_chat_emitter.py -v`
Expected: PASS（3 个测试全绿）。

- [ ] **Step 7: Commit（等待用户授权）**

```bash
git add doclens/web_v2/api/chat.py tests/web_v2/test_chat_api.py
git commit -m "feat(web): chat SSE 透传 tool_call/tool_result 事件"
```

---

## Task 3: 前端数据模型 + SSE client

**Files:**
- Modify: `doclens/web_v2/frontend/src/state/types.ts`
- Modify: `doclens/web_v2/frontend/src/api/chat.ts`
- Test: `doclens/web_v2/frontend/tests/chat.spec.ts`

**Interfaces:**
- Produces: `ToolStep` / `ToolStepStatus` 类型（types.ts）；`ChatStreamEvent` 联合类型与 `chatStream` 生成器（chat.ts）。

- [ ] **Step 1: 写失败测试**

创建 `doclens/web_v2/frontend/tests/chat.spec.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { chatStream } from "../src/api/chat";

function sseChunks(events: Array<[string, string]>): Uint8Array[] {
  return [new TextEncoder().encode(
    events.map(([e, d]) => `event: ${e}\r\ndata: ${d}\r\n\r\n`).join("")
  )];
}

describe("chatStream", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("parses tool_call / tool_result / token / done", async () => {
    const chunks = sseChunks([
      ["tool_call", JSON.stringify({ tool_use_id: "t1", name: "search", input: { query: "x" }, is_complete: true })],
      ["tool_result", JSON.stringify({ tool_use_id: "t1", name: "search", output: "found 1", is_error: false, duration_ms: 120 })],
      ["token", JSON.stringify({ text: "answer" })],
      ["done", "{}"],
    ]);
    let call = 0;
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({
        read: async () => call < chunks.length
          ? { value: chunks[call++], done: false }
          : { value: undefined, done: true },
      }) },
    });

    const out = [];
    for await (const ev of chatStream({ message: "hi" })) out.push(ev);

    expect(out).toEqual([
      { type: "tool_call", tool_use_id: "t1", name: "search", input: { query: "x" } },
      { type: "tool_result", tool_use_id: "t1", name: "search", output: "found 1", is_error: false, duration_ms: 120 },
      { type: "token", text: "answer" },
      { type: "done" },
    ]);
  });

  it("parses error event", async () => {
    const chunks = sseChunks([["error", JSON.stringify({ detail: "boom" })]]);
    let call = 0;
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({
        read: async () => call < chunks.length
          ? { value: chunks[call++], done: false }
          : { value: undefined, done: true },
      }) },
    });
    const out = [];
    for await (const ev of chatStream({ message: "hi" })) out.push(ev);
    expect(out).toEqual([{ type: "error", detail: "boom" }]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat.spec.ts`
Expected: FAIL —— `chatStream` 当前只 yield token/done/error，不产出 tool_call/tool_result。

- [ ] **Step 3: 扩展数据模型**

在 `doclens/web_v2/frontend/src/state/types.ts` 的 `ChatMessage` 定义**之前**插入：

```ts
export type ToolStepStatus = "running" | "done" | "error";

export interface ToolStep {
  tool_use_id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  is_error?: boolean;
  duration_ms?: number;
  status: ToolStepStatus;
}
```

把现有 `ChatMessage` 接口替换为：

```ts
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_steps?: ToolStep[];
}
```

- [ ] **Step 4: 扩展 chat.ts**

把 `doclens/web_v2/frontend/src/api/chat.ts` 整文件替换为：

```ts
import { streamSSE } from "./client";

export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_call"; tool_use_id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; name: string; output: string; is_error: boolean; duration_ms?: number }
  | { type: "done" }
  | { type: "error"; detail: string };

export async function* chatStream(req: { message: string; session_id?: string }): AsyncGenerator<ChatStreamEvent> {
  for await (const ev of streamSSE("/api/chat", req)) {
    if (ev.event === "token") {
      try { yield { type: "token", text: JSON.parse(ev.data).text }; } catch { /* skip */ }
    } else if (ev.event === "tool_call") {
      try {
        const d = JSON.parse(ev.data);
        yield { type: "tool_call", tool_use_id: d.tool_use_id, name: d.name, input: d.input ?? {} };
      } catch { /* skip */ }
    } else if (ev.event === "tool_result") {
      try {
        const d = JSON.parse(ev.data);
        yield {
          type: "tool_result", tool_use_id: d.tool_use_id, name: d.name,
          output: d.output ?? "", is_error: !!d.is_error, duration_ms: d.duration_ms,
        };
      } catch { /* skip */ }
    } else if (ev.event === "done") {
      yield { type: "done" };
    } else if (ev.event === "error") {
      try { yield { type: "error", detail: JSON.parse(ev.data).detail }; }
      catch { yield { type: "error", detail: "未知错误" }; }
    }
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat.spec.ts`
Expected: PASS。

- [ ] **Step 6: Commit（等待用户授权）**

```bash
git add doclens/web_v2/frontend/src/state/types.ts doclens/web_v2/frontend/src/api/chat.ts doclens/web_v2/frontend/tests/chat.spec.ts
git commit -m "feat(web): ToolStep 数据模型 + chatStream 解析工具事件"
```

---

## Task 4: chat-tool-trace 子组件

**Files:**
- Create: `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`
- Modify: `doclens/web_v2/frontend/src/app.ts`（加 import）
- Test: `doclens/web_v2/frontend/tests/chat-tool-trace.spec.ts`

**Interfaces:**
- Consumes: `ToolStep[]`（Task 3）。
- Produces: `<chat-tool-trace .steps=${ToolStep[]}>` 自定义元素，自治折叠（检测到全部步骤完成时自动收起）。

- [ ] **Step 1: 写失败测试**

创建 `doclens/web_v2/frontend/tests/chat-tool-trace.spec.ts`：

```ts
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-tool-trace";
import type { ChatToolTrace } from "../src/components/chat-tool-trace";
import type { ToolStep } from "../src/state/types";

const running: ToolStep = { tool_use_id: "t1", name: "search", input: { query: "x" }, status: "running" };
const done: ToolStep = { tool_use_id: "t1", name: "search", input: { query: "x" }, output: "found 1", is_error: false, duration_ms: 120, status: "done" };

async function trace(steps: ToolStep[]): Promise<ChatToolTrace> {
  const el = await fixture(html`<chat-tool-trace .steps=${steps}></chat-tool-trace>`) as ChatToolTrace;
  await el.updateComplete;
  return el;
}

describe("<chat-tool-trace>", () => {
  it("expands and shows spinner while a step is running", async () => {
    const el = await trace([running]);
    expect(el.shadowRoot!.querySelector(".spin")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".summary")!.textContent).toContain("进行中");
  });

  it("auto-collapses when all steps finish", async () => {
    const el = await trace([running]);
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
    el.steps = [done];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
    expect(el.shadowRoot!.querySelector(".summary")!.textContent).toContain("1 步");
  });

  it("toggles expand on summary click", async () => {
    const el = await trace([done]);
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
  });

  it("marks error step with danger styling", async () => {
    const err: ToolStep = { tool_use_id: "t1", name: "search", input: {}, output: "Error: boom", is_error: true, status: "error" };
    const el = await trace([err]);
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".step.error")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".err")).toBeTruthy();
  });

  it("truncates long output with expand-all toggle", async () => {
    const long: ToolStep = {
      tool_use_id: "t1", name: "read_document", input: {},
      output: Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n"),
      status: "done",
    };
    const el = await trace([long]);
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    const more = el.shadowRoot!.querySelector(".more");
    expect(more).toBeTruthy();
    expect(more!.textContent).toContain("展开全部");
    // 点击展开全部后，.more 消失
    (more as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more")).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat-tool-trace.spec.ts`
Expected: FAIL —— 模块找不到（组件还没创建）。

- [ ] **Step 3: 创建组件**

创建 `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`：

```ts
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ToolStep } from "../state/types";

const TOOL_ICON: Record<string, string> = {
  search: "🔍",
  read_document: "📄",
  grep: "🔎",
};

const TOOL_ACTION: Record<string, string> = {
  search: "正在搜索",
  read_document: "正在读取",
  grep: "正在检索",
};

@customElement("chat-tool-trace")
export class ChatToolTrace extends LitElement {
  static styles = css`
    :host { display: block; }
    .summary {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted);
      cursor: pointer; user-select: none; padding: 2px 0;
    }
    .summary .arrow { color: var(--cortex-primary); font-weight: 700; }
    .summary .count { color: var(--cortex-text); font-weight: 600; }
    .steps { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .step {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 7px 9px;
    }
    .step.running { border-color: var(--cortex-primary); background: var(--cortex-primary-soft); }
    .step.error { border-color: var(--cortex-danger); }
    .head { display: flex; align-items: center; gap: 7px; font-size: var(--cortex-fs-sm); color: var(--cortex-text); }
    .head .name { font-weight: 600; font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); }
    .head .meta { margin-left: auto; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-xs); }
    .head .ok { color: var(--cortex-success); }
    .head .err { color: var(--cortex-danger); }
    .arg {
      color: var(--cortex-text-muted); margin-top: 3px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      white-space: pre-wrap; word-break: break-word;
    }
    .res {
      margin-top: 5px; background: var(--cortex-bg);
      border-radius: var(--cortex-radius-sm); padding: 5px 7px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: pre-wrap; word-break: break-word;
      max-height: 96px; overflow-y: auto;
    }
    .res .more { color: var(--cortex-primary); cursor: pointer; display: inline-block; margin-top: 3px; }
    .spin {
      width: 12px; height: 12px;
      border: 2px solid var(--cortex-primary);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin .8s infinite linear;
      display: inline-block;
    }
    .running-text { color: var(--cortex-primary-hover); font-size: var(--cortex-fs-xs); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  `;

  @property({ attribute: false }) steps: ToolStep[] = [];
  @state() private _expanded = false;
  @state() private _fullResultIds = new Set<string>();

  updated(changed: Map<string, unknown>) {
    if (changed.has("steps")) {
      const oldSteps = (changed.get("steps") as ToolStep[] | undefined) ?? [];
      const wasRunning = oldSteps.some((s) => s.status === "running");
      const nowRunning = this.steps.some((s) => s.status === "running");
      if (!wasRunning && nowRunning) this._expanded = true;
      else if (wasRunning && !nowRunning) this._expanded = false;
    }
  }

  private _toggle() {
    this._expanded = !this._expanded;
  }

  private _toggleResult(id: string) {
    const next = new Set(this._fullResultIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    this._fullResultIds = next;
  }

  private _renderArgs(input: Record<string, unknown>): string {
    return Object.entries(input)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
  }

  private _renderStep(s: ToolStep) {
    const running = s.status === "running";
    const error = s.status === "error";
    const icon = TOOL_ICON[s.name] ?? "🔧";
    const showFull = this._fullResultIds.has(s.tool_use_id);
    const outputLines = (s.output ?? "").split("\n");
    const truncated = !showFull && outputLines.length > 5;
    const visible = truncated ? outputLines.slice(0, 5).join("\n") : (s.output ?? "");
    const hasOutput = s.output != null && s.output !== "";
    return html`
      <div class="step ${running ? "running" : ""} ${error ? "error" : ""}">
        <div class="head">
          ${running ? html`<span class="spin"></span>` : html`<span>${icon}</span>`}
          <span class="name">${s.name}</span>
          ${running ? html`<span class="running-text">${TOOL_ACTION[s.name] ?? "正在调用"}...</span>` : null}
          <span class="meta">
            ${!running ? (error ? html`<span class="err">✗</span>` : html`<span class="ok">✓</span>`) : null}
            ${s.duration_ms != null ? html` ${Math.round(s.duration_ms)}ms` : null}
          </span>
        </div>
        ${Object.keys(s.input).length ? html`<div class="arg">${this._renderArgs(s.input)}</div>` : null}
        ${hasOutput
          ? html`<div class="res">${visible}${truncated
              ? html`<span class="more" @click=${() => this._toggleResult(s.tool_use_id)}>展开全部 (${outputLines.length} 行) ⌄</span>`
              : null}</div>`
          : (running ? null : html`<div class="arg">（无输出）</div>`)}
      </div>
    `;
  }

  render() {
    if (!this.steps.length) return null;
    const running = this.steps.some((s) => s.status === "running");
    return html`
      <div class="summary" @click=${this._toggle}>
        <span class="arrow">${this._expanded ? "▾" : "▸"}</span>
        🧠 思考过程 · <span class="count">${this.steps.length} 步</span>
        ${running ? " · 进行中" : ""}
      </div>
      ${this._expanded ? html`<div class="steps">${this.steps.map((s) => this._renderStep(s))}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-tool-trace": ChatToolTrace;
  }
}
```

- [ ] **Step 4: 在 app.ts 注册组件**

在 `doclens/web_v2/frontend/src/app.ts` 的组件 import 区（`import "./components/chat-message";` 那一行之后）加：

```ts
import "./components/chat-tool-trace";
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat-tool-trace.spec.ts`
Expected: PASS（5 个测试全绿）。

- [ ] **Step 6: Commit（等待用户授权）**

```bash
git add doclens/web_v2/frontend/src/components/chat-tool-trace.ts doclens/web_v2/frontend/src/app.ts doclens/web_v2/frontend/tests/chat-tool-trace.spec.ts
git commit -m "feat(web): chat-tool-trace 组件（折叠/进行中/错误/截断）"
```

---

## Task 5: chat-view 流式集成 + chat-message 挂载

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/chat-view.ts`
- Modify: `doclens/web_v2/frontend/src/components/chat-message.ts`
- Test: `doclens/web_v2/frontend/tests/chat-view-stream.spec.ts`

**Interfaces:**
- Consumes: `ChatStreamEvent`（Task 3）、`<chat-tool-trace>`（Task 4）。
- Produces: `applyStreamEvent(messages, ev)` 纯函数（export，供单测与 `_submit` 使用）。

- [ ] **Step 1: 写失败测试**

创建 `doclens/web_v2/frontend/tests/chat-view-stream.spec.ts`：

```ts
import { describe, it, expect } from "vitest";
import { applyStreamEvent, finalizeInterruptedMessages } from "../src/views/chat-view";
import type { ChatMessage } from "../src/state/types";

const base: ChatMessage[] = [
  { role: "user", content: "q" },
  { role: "assistant", content: "" },
];

describe("applyStreamEvent", () => {
  it("appends token to last assistant content immutably", () => {
    const next = applyStreamEvent(base, { type: "token", text: "Hi" });
    expect(next[1].content).toBe("Hi");
    expect(base[1].content).toBe("");
    expect(next).not.toBe(base);
    expect(next[1]).not.toBe(base[1]);
  });

  it("adds a running tool step on tool_call", () => {
    const next = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: { q: "x" } });
    expect(next[1].tool_steps).toEqual([
      { tool_use_id: "t1", name: "search", input: { q: "x" }, status: "running" },
    ]);
  });

  it("fills output and status=done on tool_result", () => {
    const s1 = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: {} });
    const next = applyStreamEvent(s1, { type: "tool_result", tool_use_id: "t1", name: "search", output: "ok", is_error: false, duration_ms: 10 });
    expect(next[1].tool_steps![0].output).toBe("ok");
    expect(next[1].tool_steps![0].status).toBe("done");
    expect(next[1].tool_steps![0].duration_ms).toBe(10);
  });

  it("marks status=error when is_error true", () => {
    const s1 = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: {} });
    const next = applyStreamEvent(s1, { type: "tool_result", tool_use_id: "t1", name: "search", output: "boom", is_error: true });
    expect(next[1].tool_steps![0].status).toBe("error");
    expect(next[1].tool_steps![0].is_error).toBe(true);
  });

  it("does not mutate original tool_steps array", () => {
    const s1 = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: {} });
    const origSteps = s1[1].tool_steps!;
    applyStreamEvent(s1, { type: "tool_result", tool_use_id: "t1", name: "search", output: "ok", is_error: false });
    expect(origSteps[0].output).toBeUndefined();
  });

  it("ignores events when last message is not assistant", () => {
    const onlyUser: ChatMessage[] = [{ role: "user", content: "q" }];
    expect(applyStreamEvent(onlyUser, { type: "token", text: "x" })).toBe(onlyUser);
  });
});

describe("finalizeInterruptedMessages", () => {
  it("marks running steps as error on interrupt (immutably)", () => {
    const msgs: ChatMessage[] = [
      { role: "assistant", content: "", tool_steps: [
        { tool_use_id: "t1", name: "search", input: {}, status: "running" },
      ] },
    ];
    const fixed = finalizeInterruptedMessages(msgs);
    expect(fixed).not.toBe(msgs);
    expect(fixed[0].tool_steps![0].status).toBe("error");
    expect(fixed[0].tool_steps![0].output).toBe("（已中断）");
    expect(msgs[0].tool_steps![0].status).toBe("running"); // 原 messages 未 mutate
  });

  it("returns same reference when nothing is running", () => {
    const msgs: ChatMessage[] = [
      { role: "assistant", content: "ok", tool_steps: [
        { tool_use_id: "t1", name: "search", input: {}, output: "x", status: "done" },
      ] },
    ];
    expect(finalizeInterruptedMessages(msgs)).toBe(msgs);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat-view-stream.spec.ts`
Expected: FAIL —— `applyStreamEvent` 未导出。

- [ ] **Step 3: 在 chat-view.ts 加纯函数与 import**

在 `doclens/web_v2/frontend/src/views/chat-view.ts` 顶部 import 区，把现有：

```ts
import { chatStream } from "../api/chat";
```

改为：

```ts
import { chatStream } from "../api/chat";
import type { ChatStreamEvent } from "../api/chat";
import type { ChatMessage, ToolStep } from "../state/types";
```

（原文件已 `import type { Session } from "../state/types";`，保留它；上面这行追加 ChatMessage/ToolStep。若已 import 则合并，不要重复声明 `Session`。）

在 `@customElement("chat-view")` 装饰器**之前**（class 外部）加纯函数：

```ts
/** 将一个流式事件不可变地应用到 messages，返回新数组；非 assistant 末条则原样返回。 */
export function applyStreamEvent(messages: ChatMessage[], ev: ChatStreamEvent): ChatMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return messages;
  const head = messages.slice(0, -1);

  if (ev.type === "token") {
    return [...head, { ...last, content: last.content + ev.text }];
  }
  if (ev.type === "tool_call") {
    const step: ToolStep = { tool_use_id: ev.tool_use_id, name: ev.name, input: ev.input, status: "running" };
    return [...head, { ...last, tool_steps: [...(last.tool_steps ?? []), step] }];
  }
  if (ev.type === "tool_result") {
    const tool_steps = (last.tool_steps ?? []).map((s) =>
      s.tool_use_id === ev.tool_use_id
        ? { ...s, output: ev.output, is_error: ev.is_error, duration_ms: ev.duration_ms,
            status: (ev.is_error ? "error" : "done") as ToolStep["status"] }
        : s
    );
    return [...head, { ...last, tool_steps }];
  }
  return messages;
}

/** 流式中断（连接断开 / 异常）时调用：把残留 running 步骤标记为 error（output「（已中断）」）。
 *  无 running 步骤则原样返回同一引用。 */
export function finalizeInterruptedMessages(messages: ChatMessage[]): ChatMessage[] {
  const hasRunning = messages.some(
    (m) => m.role === "assistant" && (m.tool_steps ?? []).some((s) => s.status === "running"),
  );
  if (!hasRunning) return messages;
  return messages.map((m) => {
    if (m.role !== "assistant" || !m.tool_steps) return m;
    return {
      ...m,
      tool_steps: m.tool_steps.map((s) =>
        s.status === "running"
          ? { ...s, status: "error" as const, is_error: true, output: s.output ?? "（已中断）" }
          : s,
      ),
    };
  });
}
```

- [ ] **Step 4: 改 `_submit` 消费事件**

把 `chat-view.ts` 里 `_submit` 方法中「添加 assistant 占位」到 `_loadHistory()` 之间的整段（即现有 `const sessionId = ...` 到 `this._loadHistory();` 含 try/catch/finally）替换为：

```ts
    const sessionId = store.getState().chat.currentSession!.id;

    // assistant 占位 + 起始 messages（不可变）
    const placeholder: ChatMessage = { role: "assistant", content: "" };
    let messages = [...store.getState().chat.messages, placeholder];
    actions.setChatState({ messages });

    try {
      for await (const ev of chatStream({ message, session_id: sessionId })) {
        if (ev.type === "error") {
          messages = applyStreamEvent(messages, { type: "token", text: `\n\n⚠️ ${ev.detail}` });
          actions.setChatState({ messages });
        } else if (ev.type !== "done") {
          messages = applyStreamEvent(messages, ev);
          actions.setChatState({ messages });
        }
      }

      const aiMsg = messages[messages.length - 1];
      await appendSession(
        sessionId,
        [
          { kind: "message_user", payload: JSON.stringify({ content: message }) },
          { kind: "message_ai", payload: JSON.stringify({ content: aiMsg.content, tool_calls: aiMsg.tool_steps ?? [] }) },
        ],
        messages.length,
      );
      this._loadHistory();
    } catch (err) {
      // 连接中断 / 异常：保留已收到内容，把残留 running 步骤标记为中断
      messages = finalizeInterruptedMessages(messages);
      actions.setChatState({ messages });
      actions.setError(`对话失败: ${(err as Error).message}`);
    } finally {
      actions.setChatState({ streaming: false });
    }
```

- [ ] **Step 5: 挂载 chat-tool-trace 到 chat-message**

在 `doclens/web_v2/frontend/src/components/chat-message.ts` 的 static styles 里加（放在 `.thinking` 规则附近）：

```css
    .trace-sep { border-top: 1px dashed var(--cortex-border); margin: 7px 0; }
```

把该文件的 `render()` 方法替换为：

```ts
  render() {
    if (!this.message) return null;
    const steps = this.message.tool_steps;
    const showTrace = this.role === "assistant" && steps && steps.length > 0;
    return html`
      <div class="bubble">
        ${showTrace
          ? html`<chat-tool-trace .steps=${steps}></chat-tool-trace><div class="trace-sep"></div>`
          : null}
        ${this.renderBubble(this.message.content)}
        ${this.error ? html`<div class="error">⚠️ ${this.error}</div>` : null}
      </div>
    `;
  }
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat-view-stream.spec.ts`
Expected: PASS（6 个测试全绿）。

- [ ] **Step 7: 跑前端全量测试确认无回归**

Run: `cd doclens/web_v2/frontend && npm test`
Expected: 全部 PASS（含已有的 chat-message/chat-stream 相关，若存在）。

- [ ] **Step 8: Commit（等待用户授权）**

```bash
git add doclens/web_v2/frontend/src/views/chat-view.ts doclens/web_v2/frontend/src/components/chat-message.ts doclens/web_v2/frontend/tests/chat-view-stream.spec.ts
git commit -m "feat(web): chat-view 消费工具事件 + chat-message 挂载 trace"
```

---

## Task 6: 持久化往返 + 历史回看

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/chat-view.ts`（`_loadSession`）
- Test: `doclens/web_v2/frontend/tests/chat-view-session.spec.ts`
- Test: `tests/web_v2/test_sessions_store.py`（追加后端往返）

**Interfaces:**
- Produces: `mapSessionItemsToMessages(items)` 纯函数（export），把后端 `session_items` 映射为 `ChatMessage[]`，含 `tool_calls → tool_steps` 转换与老数据向后兼容。

- [ ] **Step 1: 写失败测试（前端映射 + 向后兼容）**

创建 `doclens/web_v2/frontend/tests/chat-view-session.spec.ts`：

```ts
import { describe, it, expect } from "vitest";
import { mapSessionItemsToMessages } from "../src/views/chat-view";

describe("mapSessionItemsToMessages", () => {
  it("maps tool_calls to tool_steps for assistant messages", () => {
    const items = [
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
      { kind: "message_ai", payload: JSON.stringify({
        content: "a",
        tool_calls: [{ tool_use_id: "t1", name: "search", input: { q: "x" }, output: "ok", is_error: false, duration_ms: 50 }],
      }) },
    ];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toBe("a");
    expect(msgs[1].tool_steps).toEqual([
      { tool_use_id: "t1", name: "search", input: { q: "x" }, output: "ok", is_error: false, duration_ms: 50, status: "done" },
    ]);
  });

  it("marks error status from is_error", () => {
    const items = [{ kind: "message_ai", payload: JSON.stringify({
      content: "a",
      tool_calls: [{ tool_use_id: "t1", name: "x", input: {}, output: "boom", is_error: true }],
    }) }];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[0].tool_steps![0].status).toBe("error");
  });

  it("backward compatible: old payload without tool_calls", () => {
    const items = [{ kind: "message_ai", payload: JSON.stringify({ content: "old answer" }) }];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[0].content).toBe("old answer");
    expect(msgs[0].tool_steps).toBeUndefined();
  });

  it("skips non-message kinds", () => {
    const items = [
      { kind: "result", payload: JSON.stringify({ x: 1 }) },
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
    ];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs.length).toBe(1);
    expect(msgs[0].role).toBe("user");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat-view-session.spec.ts`
Expected: FAIL —— `mapSessionItemsToMessages` 未导出。

- [ ] **Step 3: 在 chat-view.ts 加映射函数**

在 `chat-view.ts` 的 `applyStreamEvent` 函数**之后**（仍 在 class 外）加：

```ts
/** 把后端 session_items 映射为 ChatMessage[]；tool_calls → tool_steps，老数据向后兼容。 */
export function mapSessionItemsToMessages(
  items: Array<{ kind: string; payload: string }>,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const it of items) {
    let payload: any;
    try {
      payload = JSON.parse(it.payload);
    } catch {
      continue;
    }
    if (it.kind === "message_user") {
      messages.push({ role: "user", content: payload.content ?? "" });
    } else if (it.kind === "message_ai") {
      const tool_steps: ToolStep[] = (payload.tool_calls ?? []).map((tc: any) => ({
        tool_use_id: tc.tool_use_id ?? "",
        name: tc.name ?? "",
        input: tc.input ?? {},
        output: tc.output,
        is_error: tc.is_error,
        duration_ms: tc.duration_ms,
        status: tc.is_error ? ("error" as const) : ("done" as const),
      }));
      const msg: ChatMessage = { role: "assistant", content: payload.content ?? "" };
      if (tool_steps.length) msg.tool_steps = tool_steps;
      messages.push(msg);
    }
  }
  return messages;
}
```

- [ ] **Step 4: 改 `_loadSession` 使用映射函数**

把 `chat-view.ts` 里 `_loadSession` 方法替换为：

```ts
  private async _loadSession(s: Session) {
    actions.setChatState({ state: "focus", currentSession: s, messages: [] });
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (res.ok) {
        const body = await res.json();
        const messages = mapSessionItemsToMessages(body.items || []);
        actions.setChatState({ messages });
      }
    } catch (e) {
      console.warn("load session failed", e);
    }
  }
```

- [ ] **Step 5: 跑前端测试确认通过**

Run: `cd doclens/web_v2/frontend && npm test -- tests/chat-view-session.spec.ts`
Expected: PASS（4 个测试全绿）。

- [ ] **Step 6: 写后端往返测试**

在 `tests/web_v2/test_sessions_store.py` 末尾追加（确认 payload 含 tool_calls 时透传存储与读取无损）：

```python
def test_message_ai_payload_with_tool_calls_roundtrips(temp_workdir):
    """message_ai 的 payload 含 tool_calls 时，append_item + get_detail 透传无损。"""
    from datetime import datetime
    from doclens.web_v2.sessions_store import SessionsStore, SessionItem, SessionSummary, SessionType
    import json

    store = SessionsStore(temp_workdir / "s.db")
    summary = SessionSummary(
        id="s1", type=SessionType.CHAT, title="t", preview="p",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(), message_count=0,
    )
    store.create(summary)
    payload = json.dumps({
        "content": "answer",
        "tool_calls": [
            {"tool_use_id": "t1", "name": "search", "input": {"q": "x"},
             "output": "ok", "is_error": False, "duration_ms": 50},
        ],
    })
    store.append_item(SessionItem(session_id="s1", seq=1, kind="message_ai", payload=payload))

    items = store.get_detail("s1")
    assert len(items) == 1
    parsed = json.loads(items[0].payload)
    assert parsed["content"] == "answer"
    assert parsed["tool_calls"][0]["name"] == "search"
    assert parsed["tool_calls"][0]["duration_ms"] == 50

    # get_chat_history 只取 content，不崩、不丢
    history = store.get_chat_history("s1")
    assert history == [{"role": "assistant", "content": "answer"}]
```

- [ ] **Step 7: 跑后端测试确认通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_sessions_store.py -v`
Expected: PASS（含新往返测试）。

- [ ] **Step 8: Commit（等待用户授权）**

```bash
git add doclens/web_v2/frontend/src/views/chat-view.ts doclens/web_v2/frontend/tests/chat-view-session.spec.ts tests/web_v2/test_sessions_store.py
git commit -m "feat(web): 历史会话回看工具步骤 + 持久化往返"
```

---

## Task 7: E2E 验证

> 使用 `playwright-cli` skill 执行（遵循用户全局规则：E2E 用 playwright-cli，不直接用 playwright）。

**Files:**
- Create: `doclens/web_v2/frontend/tests/e2e/chat-tool-trace.spec.ts`

**Interfaces:**
- 验证端到端：mock `/api/chat` 返回含工具事件的 SSE → 前端渲染思考过程块 → 完成后折叠 → 历史回看保留。

- [ ] **Step 1: 构建前端**

Run: `cd doclens/web_v2/frontend && npm install && npm run build`
Expected: 构建成功，输出到 `doclens/web_v2/static/`。

- [ ] **Step 2: 写 E2E 测试**

创建 `doclens/web_v2/frontend/tests/e2e/chat-tool-trace.spec.ts`：

```ts
import { test, expect } from "@playwright/test";

const SSE = [
  'event: tool_call\r\ndata: {"tool_use_id":"t1","name":"search","input":{"query":"python"},"is_complete":true}\r\n\r\n',
  'event: tool_result\r\ndata: {"tool_use_id":"t1","name":"search","output":"line 1\\nline 2","is_error":false,"duration_ms":80}\r\n\r\n',
  'event: token\r\ndata: {"text":"答案"}\r\n\r\n',
  'event: done\r\ndata: {}\r\n\r\n',
].join("");

test("chat renders tool trace, then collapses on completion", async ({ page }) => {
  await page.route("**/api/sessions**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      await route.fulfill({ status: 200, json: { id: "s1", type: "chat", title: "t", preview: "p" } });
    } else if (req.method() === "PATCH") {
      await route.fulfill({ status: 200, json: { ok: true, message_count: 2 } });
    } else {
      await route.fulfill({ status: 200, json: { sessions: [], total: 0 } });
    }
  });
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: SSE });
  });

  await page.goto("#/chat");
  await page.locator("input-box").locator("textarea, input").first().fill("python");
  await page.keyboard.press("Enter");

  // 完成后摘要行出现且折叠（.steps 不可见）
  await expect(page.locator("chat-message").last()).toContainText("思考过程");
  await expect(page.locator("chat-tool-trace").shadowRootLocator(".summary")).toBeVisible();
  // 点击展开
  await page.locator("chat-tool-trace").shadowRootLocator(".summary").click();
  await expect(page.locator("chat-tool-trace").shadowRootLocator(".steps")).toBeVisible();
  await expect(page.locator("chat-tool-trace").shadowRootLocator(".name")).toContainText("search");
});
```

- [ ] **Step 3: 启动后端并用 playwright-cli 跑 E2E**

后端启动（在 start-app.ps1 所在目录，由用户执行或用 `run_in_background`）：

```bash
pwsh -File ./start-app.ps1 gui
```

> 实际执行时调用 `playwright-cli` skill 运行：
> `cd doclens/web_v2/frontend && npx playwright test tests/e2e/chat-tool-trace.spec.ts`

Expected: PASS。

- [ ] **Step 4: Commit（等待用户授权）**

```bash
git add doclens/web_v2/frontend/tests/e2e/chat-tool-trace.spec.ts
git commit -m "test(web): chat 工具调用过程 E2E"
```

---

## Definition of Done

- [ ] 后端 SSE 产出 `token` / `tool_call` / `tool_result` 三类事件，字段正确（Task 1-2 单测绿）。
- [ ] 前端流式中可见进行中步骤（主色 spinner + 文案），完成后自动折叠（Task 3-5 单测绿）。
- [ ] 历史会话回看可展开查看工具步骤，老数据不崩（Task 6 单测绿）。
- [ ] E2E 通过（Task 7）。
- [ ] 前端已 `npm run build`，重启后端验证真实页面。
