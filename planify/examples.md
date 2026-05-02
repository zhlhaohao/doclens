# Planify 使用示例

本文档提供 Planify 的各种使用示例代码。

## 目录

- [Session 基础使用](#session-基础使用)
- [FastAPI 集成](#fastapi-集成)

---

## Session 基础使用

### 初始化和创建会话

```python
from pathlib import Path
from planify.bootstrap import initialize, create_session, get_session

# 初始化 SessionManager
manager = initialize(base_workdir=Path.cwd())

# 创建会话
user_config = {
    "model_id": "claude-sonnet-4-6",
    "anthropic_api_key": "sk-...",
    "anthropic_base_url": "https://api.anthropic.com",
    "token_threshold": 100000,
    "poll_interval": 5,
    "idle_timeout": 60,
}
session = create_session("alice", user_config)

# 或指定会话 ID
session = create_session("alice", user_config, session_id="my_session_001")
```

### 获取和使用会话

```python
from planify.bootstrap import get_session

# 获取现有会话
session = get_session("alice", "my_session_001")

if session:
    # 添加消息
    session.append_message({"role": "user", "content": "你好"})

    # 获取消息历史
    messages = session.get_messages()
    print(f"共有 {len(messages)} 条消息")

    # 运行代理（在 bootstrap.py 中定义了便捷函数）
    from planify.bootstrap import run_agent_loop_with_session
    run_agent_loop_with_session(session)
```

### 会话消息操作

```python
# 追加消息
session.append_message({"role": "user", "content": "消息内容"})

# 获取消息（返回副本，线程安全）
messages = session.get_messages()

# 设置消息历史
session.set_messages([
    {"role": "system", "content": "你是助手"},
    {"role": "user", "content": "你好"},
])

# 原地替换消息（用于压缩后）
session.replace_messages_in_place(new_messages)

# 检查会话状态
print(f"用户: {session.user_id}")
print(f"会话: {session.session_id}")
print(f"状态: {session.status}")
print(f"模型: {session.model}")
```

### 列出和管理会话

```python
from planify.bootstrap import (
    list_user_sessions,
    list_all_sessions,
    close_session
)

# 列出指定用户的所有会话
alice_sessions = list_user_sessions("alice")
for s in alice_sessions:
    print(f"{s.session_id}: {s.status}")

# 列出所有会话
all_sessions = list_all_sessions()
print(f"总会话数: {len(all_sessions)}")

# 关闭会话
success = close_session("alice", "my_session_001")
if success:
    print("会话已关闭")
```

---

## FastAPI 集成

### 完整 FastAPI 应用示例

```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from pathlib import Path
from typing import Optional

from planify.bootstrap import (
    initialize,
    create_session,
    get_session,
    close_session,
    list_user_sessions,
)
from planify.agent import run_agent_loop


# FastAPI 应用
app = FastAPI(
    title="Planify API",
    description="多代理 LLM 系统 API",
    version="1.0.0"
)

# 应用启动时初始化 SessionManager
@app.on_event("startup")
async def startup():
    initialize(Path.cwd())


# Pydantic 模型
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class SessionInfo(BaseModel):
    session_id: str
    status: str
    created_at: float


class SessionsResponse(BaseModel):
    user_id: str
    sessions: list[SessionInfo]


# 获取用户配置（示例：从数据库或 Redis）
async def get_user_config(user_id: str) -> dict:
    """
    从数据库获取用户配置
    TODO: 实现从数据库/Redis 获取用户配置
    """
    # 这里应该是从数据库查询用户配置的逻辑
    # 例如：
    # user = await db.users.find_one({"user_id": user_id})
    # return user["config"]

    # 示例配置
    return {
        "model_id": "claude-sonnet-4-6",
        "anthropic_api_key": "sk-...",
        "anthropic_base_url": None,
        "token_threshold": 100000,
        "poll_interval": 5,
        "idle_timeout": 60,
    }


# 依赖注入：获取用户配置
async def get_user_config_dependency(user_id: str) -> dict:
    return await get_user_config(user_id)


# 聊天接口
@app.post("/chat/{user_id}", response_model=ChatResponse)
async def chat(
    user_id: str,
    request: ChatRequest,
    user_config: dict = Depends(get_user_config_dependency),
):
    """
    与代理对话

    - **user_id**: 用户 ID（路径参数）
    - **session_id**: 会话 ID（可选，不提供则自动创建）
    - **message**: 用户消息
    """
    # 获取或创建会话
    session_id = request.session_id or f"web_{user_id}"
    session = get_session(user_id, session_id)

    if not session:
        session = create_session(user_id, user_config, session_id=session_id)

    # 添加用户消息
    session.append_message({"role": "user", "content": request.message})

    # 运行代理
    run_agent_loop(
        messages=session.get_messages(),
        client=session.client,
        model=session.model,
        tools=session.tools,
        tool_handlers=session.tool_handlers,
        todo_manager=session.todo_mgr,
        bg_manager=session.bg_mgr,
        bus=session.bus,
        skills_loader=session.skills,
        config=session.config.__dict__,
        logger=session.logger,
        session=session,
    )

    # 获取响应
    last_message = session.get_messages()[-1]
    response_content = last_message.get("content")

    # 提取文本内容
    if isinstance(response_content, list):
        response_text = "".join(
            block.text if hasattr(block, "text") else str(block)
            for block in response_content
        )
    else:
        response_text = str(response_content)

    return ChatResponse(response=response_text, session_id=session_id)


# 列出会话接口
@app.get("/sessions/{user_id}", response_model=SessionsResponse)
async def list_sessions_endpoint(user_id: str):
    """
    列出用户的所有会话
    """
    sessions = list_user_sessions(user_id)
    return SessionsResponse(
        user_id=user_id,
        sessions=[
            SessionInfo(
                session_id=s.session_id,
                status=s.status,
                created_at=s.created_at,
            )
            for s in sessions
        ]
    )


# 关闭会话接口
@app.delete("/sessions/{user_id}/{session_id}")
async def close_session_endpoint(user_id: str, session_id: str):
    """
    关闭指定会话
    """
    success = close_session(user_id, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": f"Session {session_id} closed"}


# 获取对话历史接口
@app.get("/history/{user_id}/{session_id}")
async def get_history(user_id: str, session_id: str, limit: int = 50):
    """
    获取对话历史

    - **limit**: 返回的消息数量（默认 50）
    """
    session = get_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = session.get_messages()
    return {
        "user_id": user_id,
        "session_id": session_id,
        "messages": messages[-limit:],
    }


# 流式聊天接口（使用 Server-Sent Events）
from fastapi.responses import StreamingResponse


async def chat_stream_generator(session, request: ChatRequest):
    """
    流式生成响应的生成器
    """
    session.append_message({"role": "user", "content": request.message})

    # 这里可以结合 Anthropic API 的流式功能
    # 示例伪代码：
    # async for chunk in client.messages.stream(...):
    #     yield f"data: {chunk}\n\n"

    # 简化示例：返回完整响应
    run_agent_loop(
        messages=session.get_messages(),
        client=session.client,
        model=session.model,
        tools=session.tools,
        tool_handlers=session.tool_handlers,
        todo_manager=session.todo_mgr,
        bg_manager=session.bg_mgr,
        bus=session.bus,
        skills_loader=session.skills,
        config=session.config.__dict__,
        logger=session.logger,
        session=session,
    )

    last_message = session.get_messages()[-1]
    yield f"data: {last_message.get('content')}\n\n"


@app.post("/chat/stream/{user_id}")
async def chat_stream(
    user_id: str,
    request: ChatRequest,
    user_config: dict = Depends(get_user_config_dependency),
):
    """
    流式聊天接口
    """
    session_id = request.session_id or f"stream_{user_id}"
    session = get_session(user_id, session_id)

    if not session:
        session = create_session(user_id, user_config, session_id=session_id)

    return StreamingResponse(
        chat_stream_generator(session, request),
        media_type="text/event-stream",
    )


# 健康检查接口
@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


# 运行应用
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 运行 FastAPI 应用

```bash
# 安装依赖
pip install fastapi uvicorn pydantic

# 运行应用
python examples/fastapi_app.py

# 或使用 uvicorn 直接运行
uvicorn examples.fastapi_app:app --host 0.0.0.0 --port 8000 --reload
```

### API 端点列表

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/chat/{user_id}` | 发送消息并获取响应 |
| POST | `/chat/stream/{user_id}` | 流式聊天接口 |
| GET | `/sessions/{user_id}` | 列出用户的所有会话 |
| DELETE | `/sessions/{user_id}/{session_id}` | 关闭指定会话 |
| GET | `/history/{user_id}/{session_id}` | 获取对话历史 |
| GET | `/health` | 健康检查 |

---

## 更多示例

如有需要更多示例，请参考：
- `tests/run_tests.py` - 基础测试示例
- `tests/test_session.py` - Session 使用测试
- `tests/test_session_manager.py` - SessionManager 使用测试
