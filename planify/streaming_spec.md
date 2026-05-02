# Planify 流式输出改造方案

## 实现状态

**状态**: ✅ 已完成基础实现

**已实现的文件**:
- ✅ `backend/app/schemas/planify.py` - SSE 事件 Schema
- ✅ `backend/app/planify/streaming/types.py` - 流式类型定义
- ✅ `backend/app/planify/streaming/emitter.py` - SSE 事件发射器
- ✅ `backend/app/planify/streaming/waiter.py` - 用户响应等待器
- ✅ `backend/app/planify/streaming/user_tools.py` - 用户交互工具
- ✅ `backend/app/planify/streaming/runner.py` - StreamingAgent 流式代理
- ✅ `backend/app/planify/streaming/__init__.py` - 模块导出
- ✅ `backend/app/api/v1/planify.py` - FastAPI 端点
- ✅ `backend/app/api/v1/router.py` - 路由注册

**API 端点**:
- ✅ `GET /api/planify/stream` - SSE 流式对话
- ✅ `POST /api/planify/respond` - 提交用户响应
- ✅ `GET /api/planify/sessions` - 列出用户会话
- ✅ `DELETE /api/planify/sessions/{session_id}` - 关闭会话

---

## 一、设计目标

1. **流式输出**: 支持 FastAPI Web SSE endpoint，将 Planify 代理的推理过程实时输出到 Web 前端
2. **全流程流式**: 包括 LLM 文本生成、tool call、tool result 都要支持流式输出
3. **用户交互**: 支持在推理过程中通过 Web 进行 ask_user_question 和 user_confirm
4. **会话管理**: 复用现有的多用户多会话架构

## 二、SSE 事件类型设计

### 2.1 事件类型

| 事件类型 | 说明 | 关键字段 |
|---------|------|---------|
| `text` | LLM 增量文本 | `content`, `is_end` |
| `tool_call` | 工具调用开始/增量 | `tool_use_id`, `name`, `input`, `is_complete` |
| `tool_result` | 工具执行结果 | `tool_use_id`, `name`, `output`, `is_error` |
| `ask_user` | 请求用户输入 | `request_id`, `question`, `input_type` |
| `done` | 完成事件 | `session_id`, `summary` |
| `error` | 错误事件 | `error`, `code` |
| `heartbeat` | 心跳事件 | - |

### 2.2 事件流示例

```
用户输入: "帮我分析一下项目的代码质量"

SSE 事件流:
→ text: "好的，我来分析项目的代码质量..."
→ tool_call: {"name": "bash", "input": {"command": "find . -name '*.py'"}, "is_complete": true}
→ tool_result: {"name": "bash", "output": "file1.py\nfile2.py..."}
→ tool_call: {"name": "read_file", "input": {"path": "file1.py"}, "is_complete": true}
→ tool_result: {"name": "read_file", "output": "file content..."}
→ text: "根据分析结果，我发现以下问题..."
→ done: {"session_id": "sess_xxx", "summary": "代码质量分析完成"}

用户交互场景:

SSE 事件流:
→ ask_user: {"request_id": "req_001", "question": "这个操作可能会修改文件，确认继续？", "input_type": "confirm"}
→ (用户点击确认，前端调用 POST /api/planify/respond)
→ tool_result: {"name": "ask_user", "output": "用户确认: 是"}
→ tool_call: {"name": "edit_file", ...}
→ tool_result: {"name": "edit_file", "output": "File updated successfully"}
→ done: {"session_id": "sess_xxx"}
```

## 三、文件结构

```
backend/app/planify/streaming/     # 流式模块
├── __init__.py                    # 模块导出
├── types.py                       # StreamEvent, EventEmitter 协议, StreamingConfig
├── emitter.py                     # SSEEmitter, QueueEmitter
├── waiter.py                      # GlobalResponseWaiter, SessionWaiter
├── user_tools.py                  # ask_user, user_confirm 工具定义
└── runner.py                      # StreamingAgent 流式代理

backend/app/schemas/planify.py     # SSE 事件 Pydantic Schema
backend/app/api/v1/planify.py      # FastAPI 端点
backend/app/api/v1/router.py       # 路由注册
```

## 四、核心流程图

```
用户输入 → FastAPI /api/planify/stream
              │
              ▼
         SSE Event Generator
              │
              ▼
    ┌─────────────────────────────────┐
    │     StreamingAgent.run_stream() │
    │                                 │
    │  while stop_reason == tool_use: │
    │    1. 微压缩 / 自动压缩         │
    │    2. 后台通知 / 收件箱检查     │
    │    3. LLM 流式调用              │
    │       → yield TEXT 事件         │
    │       → yield TOOL_CALL 事件    │
    │    4. 工具执行                  │
    │       → ask_user: 等待响应      │
    │       → yield TOOL_RESULT 事件  │
    │    5. 添加工具结果到消息        │
    │                                 │
    │  yield DONE 事件                │
    └─────────────────────────────────┘
              │
              ▼
         Web Frontend
         (EventSource)
```

## 五、API 使用说明

### 5.1 SSE 流式对话

```bash
# 连接 SSE 流
curl -N "http://localhost:8000/api/planify/stream?message=hello&token=YOUR_TOKEN"
```

响应示例：
```
data: {"type":"text","content":"好的，我来帮你...","is_end":false}

data: {"type":"tool_call","tool_use_id":"toolu_01","name":"bash","input":{"command":"ls"},"is_complete":true}

data: {"type":"tool_result","tool_use_id":"toolu_01","name":"bash","output":"file1.py\nfile2.py","is_error":false}

data: {"type":"done","session_id":"sess_abc123","summary":"任务完成"}
```

### 5.2 提交用户响应

```bash
# 文本响应
curl -X POST "http://localhost:8000/api/planify/respond" \
  -H "Content-Type: application/json" \
  -d '{"request_id": "req_001", "response": "用户的输入"}'

# 确认响应
curl -X POST "http://localhost:8000/api/planify/respond" \
  -H "Content-Type: application/json" \
  -d '{"request_id": "req_001", "confirmed": true}'
```

### 5.3 会话管理

```bash
# 列出会话
curl "http://localhost:8000/api/planify/sessions?token=YOUR_TOKEN"

# 关闭会话
curl -X DELETE "http://localhost:8000/api/planify/sessions/sess_abc123?token=YOUR_TOKEN"
```

## 六、前端集成示例

```typescript
// frontend/src/composables/usePlanifySSE.ts

interface PlanifyEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'ask_user' | 'done' | 'error';
  [key: string]: any;
}

export function usePlanifySSE() {
  const messages = ref<Message[]>([]);
  const pendingAskUser = ref<AskUserRequest | null>(null);

  function connect(message: string, sessionId?: string) {
    const params = new URLSearchParams({ message, token: getToken() });
    if (sessionId) params.set('session_id', sessionId);

    const eventSource = new EventSource(`/api/planify/stream?${params}`);

    eventSource.onmessage = (event) => {
      const data: PlanifyEvent = JSON.parse(event.data);

      switch (data.type) {
        case 'text':
          appendText(data.content, data.is_end);
          break;
        case 'tool_call':
          showToolCall(data.name, data.input);
          break;
        case 'tool_result':
          showToolResult(data.name, data.output);
          break;
        case 'ask_user':
          pendingAskUser.value = {
            requestId: data.request_id,
            question: data.question,
            inputType: data.input_type,
          };
          break;
        case 'done':
          finalizeSession(data.session_id);
          eventSource.close();
          break;
        case 'error':
          showError(data.error);
          eventSource.close();
          break;
      }
    };
  }

  async function submitResponse(requestId: string, response: string, confirmed?: boolean) {
    await fetch('/api/planify/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, response, confirmed }),
    });
    pendingAskUser.value = null;
  }

  return { messages, pendingAskUser, connect, submitResponse };
}
```

## 七、后续优化

1. **错误恢复**: 增加断线重连机制
2. **进度显示**: 添加任务进度百分比
3. **批量工具**: 支持批量工具调用的事件合并
4. **性能优化**: 工具结果压缩和摘要
5. **测试覆盖**: 添加单元测试和端到端测试

---

## 原始设计文档

以下为原始设计文档内容，保留作为参考：

### 核心接口定义

```python
# backend/app/planify/streaming/types.py

class StreamEventType(Enum):
    TEXT = "text"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    ASK_USER = "ask_user"
    DONE = "done"
    ERROR = "error"
    HEARTBEAT = "heartbeat"

@dataclass
class StreamEvent:
    """流式事件"""
    event_type: StreamEventType
    data: Dict[str, Any]

class EventEmitter(Protocol):
    """事件发射器协议"""
    async def emit(self, event: StreamEvent) -> None: ...

class UserResponseWaiter(Protocol):
    """用户响应等待器协议"""
    async def wait_for_response(self, request_id: str, timeout: float = 300.0) -> Dict[str, Any]: ...
```

### 用户交互工具定义

```python
# backend/app/planify/streaming/user_tools.py

def get_user_interaction_tools() -> List[Dict]:
    """获取用户交互工具定义"""
    return [
        {
            "name": "ask_user",
            "description": "向用户提问并等待响应",
            "input_schema": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "input_type": {"enum": ["text", "confirm", "select"]},
                    "options": {"type": "array"},
                    "default": {"type": "string"},
                },
                "required": ["question"]
            }
        },
        {
            "name": "user_confirm",
            "description": "请求用户确认某个操作",
            "input_schema": {
                "type": "object",
                "properties": {
                    "message": {"type": "string"},
                    "default_yes": {"type": "boolean"},
                },
                "required": ["message"]
            }
        }
    ]
```
