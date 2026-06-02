# TUI AI 流式输出设计

## 背景

当前 Cortex TUI 中 AI 查询的体验问题：
1. 用户发送 AI 问题后，只看到 ThinkingIndicator 旋转动画和状态栏 "Agent 思考中"
2. AI 的思考过程、工具调用、文本回复全部完成后才一次性显示
3. 底层 `StreamingAgent` 已使用流式 API，但 TUI 层通过 `sys.stdout` 重定向到 `StringIO`，将流式输出"压平"为一次性输出

## 目标

- AI 文本回复实时流式显示到 ContentArea
- 工具调用时在状态栏显示工具名摘要
- 工具结果折叠为一行摘要显示
- 保持 ESC 取消机制正常工作

## 方案

### 1. 新增 TUIEventEmitter

**文件**: `planify/streaming/emitter.py`

新建 `TUIEventEmitter` 类，构造时接收回调字典：

```
事件类型:
- text_delta(text)        → AI 回复文本增量
- tool_call(name, input)  → 工具调用开始
- tool_result(name, text) → 工具调用结果
- thinking_start()        → 开始思考（不额外处理，已有动画）
- thinking_end()          → 思考结束
- done()                  → 查询完成
```

继承 `CLIEventEmitter` 或独立实现，将每个事件路由到对应的回调函数。回调由 `app.py` 提供，内部通过 `call_from_thread` 安全更新 UI。

### 2. agent_integration.py 改动

**文件**: `cortex/agent_integration.py`

`run_query` 方法新增可选参数 `emitter_callbacks`：
- 如果传入回调，构造 `TUIEventEmitter` 传给 `StreamingAgent`
- 如果不传（CLI 模式），保持原有 `CLIEventEmitter` 行为

### 3. app.py 改动

**文件**: `cortex/tui/app.py`

**`_do_ai_query`**：去掉 stdout 重定向，改为通过 emitter_callbacks 实时更新 UI：

- `on_text_delta`: 调用 `content.write_streaming(text)`
- `on_tool_call`: 调用 `status.set_tool_status(name)`
- `on_tool_result`: 调用 `content.write_tool_summary(name, text)`
- `on_done`: 停止动画，恢复 UI 状态

**`_on_ai_done`**：大幅简化，仅处理错误场景和最终状态恢复。

**`_cmd_ai`**：基本不变，仍启动 ThinkingIndicator 和后台 worker。

### 4. ContentArea 改动

**文件**: `cortex/tui/widgets/content_area.py`

新增方法：

- **`write_streaming(text)`**：增量追加文本。维护一个 "当前流式块" 的 `Text` 对象，每次 delta 到来时追加。通过 `call_from_thread` 保证线程安全。
- **`finish_streaming()`**：结束流式状态，写入换行，清空当前流式块引用。
- **`write_tool_summary(name, text)`**：显示一行折叠的工具结果摘要，格式 `⚙ name → summary`，灰色 `#565f89` 样式，文本截断到 100 字符。

### 5. StatusBar 改动

**文件**: `cortex/tui/widgets/status_bar.py`

新增方法：

- **`set_tool_status(tool_name)`**：状态栏显示 `Agent: 调用 {tool_name}...`。工具完成后调用 `set_agent_status("思考中")` 恢复。

## 不改动的部分

- `planify/streaming/runner.py`：StreamingAgent 不需要改，emitter 接口不变
- `event_bus.py`：不使用 EventBus，改用直接回调（更简单直接）
- ESC 取消机制：保持现有的 `_interrupt_event` + `_kill_ai_thread` 不变
- CLI 模式：`CLIEventEmitter` 保持不变，不影响 CLI 使用

## 调用链（改动后）

```
用户输入 → _cmd_ai(arg)
  → ThinkingIndicator.start()
  → run_worker(_do_ai_query)

  [后台线程]
  → _do_ai_query(arg):
    → agent.run_query(query, history, emitter_callbacks={...})
      → TUIEventEmitter 接收回调
      → StreamingAgent.run_stream()
        → _stream_llm_call():
          → text_delta 回调 → call_from_thread(content.write_streaming)
          → tool_call 回调  → call_from_thread(status.set_tool_status)
          → tool_result 回调 → call_from_thread(content.write_tool_summary)
        → done 回调 → call_from_thread(清理 UI)

  [主线程]
  → ContentArea 实时显示流式文本和工具摘要
  → StatusBar 实时显示当前工具名
```

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `planify/streaming/emitter.py` | 新增 `TUIEventEmitter` 类 |
| `cortex/agent_integration.py` | `run_query` 新增 `emitter_callbacks` 参数 |
| `cortex/tui/app.py` | `_do_ai_query` 去掉 stdout 重定向，改用回调 |
| `cortex/tui/widgets/content_area.py` | 新增 `write_streaming`、`finish_streaming`、`write_tool_summary` |
| `cortex/tui/widgets/status_bar.py` | 新增 `set_tool_status` |
