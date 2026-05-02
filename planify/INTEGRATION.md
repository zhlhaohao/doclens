# Planify 模块集成指南

本文档指导主应用（backend/app）如何集成 planify 模块，包括 SSE 流式对话和自定义工具开发。

---

## 目录

1. [架构概览](#1-架构概览)
2. [SSE 流式对话](#2-sse-流式对话)
3. [开发自定义工具](#3-开发自定义工具)
4. [注册外部工具](#4-注册外部工具)
5. [配置注入](#5-配置注入)
6. [完整示例](#6-完整示例)

---

## 1. 架构概览

```
backend/app                    backend/third_party/planify
┌──────────────────────┐      ┌──────────────────────────┐
│   main.py             │      │   bootstrap.py            │
│   lifespan:           │      │   ├─ register_planify_config()     │
│   ├─ register_*()    │──────│─→ ├─ register_app_dependencies() │
│   └─ register_*()    │      │   └─ SessionManager            │
├──────────────────────┤      ├──────────────────────────┤
│   agent/chitchat.py   │      │   streaming/runner.py      │
│   ├─ build_session() │──────│─→ ├─ build_tool_registry() │
│   └─ StreamingAgent  │      │   └─ StreamingAgent.run_stream() │
├──────────────────────┤      ├──────────────────────────┤
│   api/v1/planify.py  │      │   tools/registry.py        │
│   └─ submit_response()│──────│─→ └─ GlobalResponseWaiter │
├──────────────────────┤      ├──────────────────────────┤
│   tools/schedule_query│      │   tools/                   │
│   (自定义工具)        │──────│─→ └─ register_external_tools() │
└──────────────────────┘      └──────────────────────────┘
```

**关键原则**：
- planify 不直接 import 主应用模块
- 配置和工具通过注册机制注入
- LLM 客户端由主应用提供，planify 调用

---

## 2. SSE 流式对话

### 2.1 启动时注册

在 `backend/app/main.py` 的 `lifespan` 中注册配置和工具：

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. 注册 Planify 配置
    from app.third_party.planify.bootstrap import register_planify_config
    register_planify_config(
        zhipuai_api_key=settings.ZHIPUAI_API_KEY or "",
        zhipuai_model_id=settings.ZHIPUAI_MODEL_ID or "glm-4",
        zhipuai_base_url=settings.ZHIPUAI_BASE_URL or "",
        planify_api_key=settings.PLANIFY_API_KEY or "",
        planify_model_id=settings.PLANIFY_MODEL_ID or "claude-opus-4-6",
        planify_base_url=settings.PLANIFY_BASE_URL or "",
        baidu_weather_api_url=settings.BAIDU_WEATHER_API_URL or "",
        baidu_weather_ak=settings.BAIDU_WEATHER_AK or "",
        baidu_weather_data_type=settings.BAIDU_WEATHER_DATA_TYPE or "fc",
    )

    # 2. 注册外部工具（见第 4 节）

    yield
    # shutdown...
```

### 2.2 构建 Session 和 StreamingAgent

在 `backend/app/agent/chitchat.py`（或其他聊天逻辑文件）中：

```python
import asyncio
from pathlib import Path

async def planify_chat_stream(query: str, user_id: int, phone: str):
    """
    使用 Planify StreamingAgent 进行流式对话。

    Args:
        query: 用户输入
        user_id: 用户 ID
        phone: 用户手机号

    Yields:
        str: 流式文本块
        dict: 工具调用事件 {"type": "tool_call", ...}
    """
    from app.third_party.planify.streaming.runner import StreamingAgent
    from app.third_party.planify.streaming.emitter import QueueEmitter
    from app.third_party.planify.streaming.types import StreamEventType
    from app.third_party.planify.core.session_manager import SessionManager

    # 1. 获取 LLM 客户端
    client, model_id = SessionManager.get_anthropic_client()
    if client is None:
        raise RuntimeError("Anthropic 客户端不可用")

    # 2. 构建 Session（包含工具注册）
    session, tools, tool_handlers = await build_planify_session(
        client, model_id, user_id, phone
    )

    # 3. 创建事件发射器
    emitter = QueueEmitter()

    # 4. 创建 StreamingAgent
    agent = StreamingAgent(
        client=client,
        model=model_id,
        tools=tools,
        tool_handlers=tool_handlers,
        emitter=emitter,
        skills_loader=None,  # 可传入 SkillLoader 实例
        session=session,
    )

    # 5. 构建消息历史
    messages = [
        {"role": "user", "content": query}
    ]

    # 6. 启动流式执行
    session_id = f"user_{user_id}"
    task = asyncio.create_task(agent.run_stream(messages, query, session_id))

    # 7. 消费事件
    try:
        while True:
            event = await emitter._queue.get()
            if event.event_type == StreamEventType.TEXT:
                content = event.data.get("content", "")
                if content:
                    yield content
            elif event.event_type == StreamEventType.TOOL_CALL:
                yield {"type": "tool_call", **event.data}
            elif event.event_type == StreamEventType.TOOL_RESULT:
                yield {"type": "tool_result", **event.data}
            elif event.event_type == StreamEventType.DONE:
                break
            elif event.event_type == StreamEventType.ERROR:
                raise RuntimeError(f"StreamingAgent 错误: {event.data.get('error')}")
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


async def build_planify_session(client, model_id: str, user_id: int, phone: str):
    """
    构建 Planify Session 和工具注册表。

    Returns:
        (session, tools, tool_handlers) 元组
    """
    from app.third_party.planify.core.session import Session, SessionConfig
    from app.third_party.planify.tools.registry import build_tool_registry
    from app.third_party.planify.managers import TodoManager, TaskManager, BackgroundManager
    from app.third_party.planify.messaging import MessageBus
    from app.core.config import settings

    # 工作目录（每个用户一个独立目录）
    workdir_base = Path(settings.PLANIFY_WORKDIR_BASE)
    if not workdir_base.is_absolute():
        workdir_base = Path(__file__).parent.parent.parent / workdir_base

    workdir = workdir_base / (phone or str(user_id))

    # 获取 ZhipuAI 客户端（供 web_search 等工具使用）
    from app.third_party.planify.core.session_manager import SessionManager
    zhipu_client, zhipu_model_id = SessionManager.get_zhipu_client()

    # 初始化管理器
    todo_mgr = TodoManager()
    task_mgr = TaskManager(workdir / ".planify" / "tasks")
    bg_mgr = BackgroundManager(workdir)
    bus = MessageBus(workdir / ".planify" / "team" / "inbox")

    # 构建 SessionConfig
    session_config = SessionConfig(
        workdir=workdir,
        model_id=model_id,
        anthropic_api_key=settings.PLANIFY_API_KEY,
        anthropic_base_url=settings.PLANIFY_BASE_URL,
        token_threshold=settings.PLANIFY_TOKEN_THRESHOLD,
    )

    # 创建 Session
    session = Session(
        user_id=str(user_id),
        phone=phone,
        config=session_config,
    )
    session.client = client
    session.zhipu_client = zhipu_client
    session.todo_mgr = todo_mgr
    session.task_mgr = task_mgr
    session.bg_mgr = bg_mgr
    session.bus = bus
    session.ensure_dirs()

    # 构建工具注册表（包含外部工具）
    tools_registry, tool_handlers_registry = build_tool_registry(
        workdir=workdir,
        zhipu_client=zhipu_client,
        zhipu_model_id=zhipu_model_id,
        todo_mgr=todo_mgr,
        task_mgr=task_mgr,
        bg_mgr=bg_mgr,
        bus=bus,
        team_mgr=None,
        skills_loader=None,
        run_subagent=None,
        model=model_id,
        client=client,
        transcript_dir=None,
        session=session,
    )

    # 过滤只加载配置中启用的工具（可选）
    enabled_tools = settings.CHITCHAT_TOOLS  # e.g. ["bash", "read_file", "rccx_tool"]
    tools = [t for t in tools_registry if t["name"] in enabled_tools]
    tool_handlers = {
        k: v for k, v in tool_handlers_registry.items()
        if k in [t["name"] for t in tools]
    }

    session.tools = tools
    session.tool_handlers = tool_handlers

    return session, tools, tool_handlers
```

### 2.3 处理 ask_user 事件

当 agent 需要用户输入时，会通过 `GlobalResponseWaiter` 等待。前端通过 API 提交响应：

```python
# backend/app/api/v1/planify.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.third_party.planify.streaming import get_global_waiter

router = APIRouter()

class PlanifyRespondRequest(BaseModel):
    request_id: str
    response: str | None = None
    confirmed: bool | None = None
    selected: list | None = None

@router.post("/planify/respond")
async def submit_user_response(request: PlanifyRespondRequest):
    waiter = get_global_waiter()
    response_data = {}
    if request.response is not None:
        response_data["response"] = request.response
    if request.confirmed is not None:
        response_data["confirmed"] = request.confirmed
    if request.selected is not None:
        response_data["selected"] = request.selected

    success = waiter.submit_response(request.request_id, response_data)
    if not success:
        raise HTTPException(status_code=404, detail="请求不存在或已过期")
    return {"success": True}
```

---

## 3. 开发自定义工具

### 3.1 工具结构

每个工具包含两部分：

| 部分 | 作用 | 示例 |
|------|------|------|
| **工具定义** (tool definition) | 告诉 LLM 工具的名称、描述、参数 schema | `{"name": "my_tool", "input_schema": {...}}` |
| **工具处理器** (tool handler) | 实际执行逻辑 | `async def my_tool(**kwargs): ...` |

### 3.2 工具定义格式

```python
MY_TOOL = {
    "name": "my_tool",           # 唯一名称，LLM 用此调用
    "description": "工具描述",   # 告诉 LLM 工具用途
    "input_schema": {
        "type": "object",
        "properties": {
            "arg1": {
                "type": "string",
                "description": "参数描述",
            },
            "arg2": {
                "type": "integer",
                "description": "另一个参数",
            }
        },
        "required": ["arg1"],     # 必需参数
    },
}
```

### 3.3 工具处理器签名

```python
async def handle_my_tool(arg1: str, arg2: int = 0, session=None) -> str:
    """
    处理工具调用。

    Args:
        arg1: 字符串参数
        arg2: 整数参数（可选，默认 0）
        session: Session 实例，可从中获取用户信息

    Returns:
        str: 返回给 LLM 的结果（必须是字符串）
    """
    # 工具逻辑
    result = f"处理了 {arg1}, {arg2}"
    return result
```

### 3.4 完整工具文件示例

在 `backend/app/tools/my_tool.py` 中创建自定义工具：

```python
"""
My Custom Tool

主应用为 Planify 提供的自定义工具示例。
"""

import json
import logging
from typing import TYPE_CHECKING, Any, Dict, List, Tuple

if TYPE_CHECKING:
    from app.third_party.planify.core.session import Session

logger = logging.getLogger(__name__)

# ==================== 工具定义 ====================
MY_TOOL = {
    "name": "my_tool",
    "description": "执行自定义操作并返回结果",
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "description": "操作类型：get_info / do_something",
            },
            "param": {
                "type": "string",
                "description": "操作参数",
            }
        },
        "required": ["action"],
    },
}


# ==================== 处理器 ====================
async def handle_my_tool(
    action: str,
    param: str = "",
    session: "Session | None" = None,
) -> str:
    """
    处理 my_tool 调用。
    """
    logger.info(f"my_tool 被调用: action={action}, param={param}")

    # 从 session 获取用户信息
    user_id = session.user_id if session else "unknown"

    result_data: Dict[str, Any] = {
        "success": True,
        "action": action,
        "param": param,
        "user_id": user_id,
    }

    try:
        if action == "get_info":
            result_data["data"] = f"用户 {user_id} 的信息"
        elif action == "do_something":
            result_data["data"] = f"为用户 {user_id} 执行了操作"
        else:
            result_data["success"] = False
            result_data["error"] = f"未知操作: {action}"

        return json.dumps(result_data, ensure_ascii=False, default=str)

    except Exception as e:
        logger.exception(f"my_tool 执行失败: {e}")
        result_data["success"] = False
        result_data["error"] = str(e)
        return json.dumps(result_data, ensure_ascii=False, default=str)


# ==================== 工厂函数 ====================
def make_my_tool_tools(
    session: "Session | None" = None,
) -> Tuple[List[Dict], Dict[str, Any]]:
    """
    创建工具定义和处理器。

    Args:
        session: Session 实例（可选）

    Returns:
        (工具定义列表, 处理器字典) 元组
    """

    async def _handle_my_tool(action: str, param: str = "") -> str:
        return await handle_my_tool(action, param, session=session)

    tools = [MY_TOOL]
    handlers = {
        "my_tool": _handle_my_tool,
    }

    return tools, handlers
```

---

## 4. 注册外部工具

### 4.1 在工具文件中实现工厂函数

```python
def make_my_tool_tools(session=None) -> Tuple[List[Dict], Dict[str, Any]]:
    """返回 (tools, handlers)"""
    tools = [MY_TOOL]
    handlers = {"my_tool": async def(action, param=""): ...}
    return tools, handlers
```

### 4.2 在 main.py 启动时注册

```python
# backend/app/main.py - lifespan 中

# 1. 注册外部工具
from app.tools.my_tool import make_my_tool_tools
from app.third_party.planify.bootstrap import register_app_dependencies

external_tools, external_handlers = make_my_tool_tools()
register_app_dependencies(
    external_tools=external_tools,
    external_handlers=external_handlers,
)
```

### 4.3 工具注册流程

```
make_my_tool_tools()                      # 返回 (tools, handlers)
    ↓
register_app_dependencies(tools, handlers) # 注入到 planify
    ↓
register_external_tools(tools, handlers)  # 存储到 registry
    ↓
build_tool_registry(session=session)      # Session 初始化时
    ↓
get_external_tools()                       # 获取已注册工具
    ↓
tools.extend(external_tools)              # 合并到完整列表
handlers.update(external_handlers)
    ↓
StreamingAgent.run_stream()               # 运行时代替 tool_handlers
```

---

## 5. 配置注入

### 5.1 register_planify_config 参数

```python
register_planify_config(
    zhipuai_api_key="",        # 智谱AI API Key
    zhipuai_model_id="glm-4",  # 智谱AI 模型
    zhipuai_base_url="",       # 智谱AI 端点
    planify_api_key="",         # Anthropic API Key
    planify_model_id="claude-opus-4-6",  # Anthropic 模型
    planify_base_url="",        # Anthropic API 端点
    baidu_weather_api_url="",   # 百度天气 API URL
    baidu_weather_ak="",        # 百度天气 AK
    baidu_weather_data_type="fc",
    **extra,                   # 其他自定义配置
)
```

### 5.2 配置优先级

```
register_planify_config() 注册的值（最高）
    ↓
环境变量（如 ZHIPUAI_API_KEY）
    ↓
默认值
```

---

## 6. 完整示例

### 6.1 主应用启动（main.py）

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.third_party.planify.bootstrap import register_planify_config, register_app_dependencies
    from app.tools.schedule_query import make_schedule_query_tools

    # 注册配置
    register_planify_config(
        planify_api_key=settings.PLANIFY_API_KEY,
        planify_model_id=settings.PLANIFY_MODEL_ID,
        planify_base_url=settings.PLANIFY_BASE_URL,
    )

    # 注册工具
    external_tools, external_handlers = make_schedule_query_tools()
    register_app_dependencies(
        external_tools=external_tools,
        external_handlers=external_handlers,
    )

    yield
```

### 6.2 SSE 流式对话端点

```python
# backend/app/api/v1/chat.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.get("/chat/stream")
async def chat_stream(query: str, current_user = Depends(get_current_user)):
    async def event_generator():
        from app.agent.chitchat import planify_chat_stream

        async for chunk in planify_chat_stream(
            query=query,
            user_id=current_user.id,
            phone=current_user.phone,
        ):
            if isinstance(chunk, str):
                yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
            else:
                yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
```

---

## 附：StreamEventType 事件类型

| 事件类型 | 说明 | data 字段 |
|----------|------|----------|
| `TEXT` | 流式文本块 | `{"content": "..."}` |
| `TOOL_CALL` | 工具调用 | `{"name": "...", "input": {...}}` |
| `TOOL_RESULT` | 工具结果 | `{"tool_use_id": "...", "content": "..."}` |
| `DONE` | 完成 | `{}` |
| `ERROR` | 错误 | `{"error": "..."}` |
