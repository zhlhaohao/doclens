# Bootstrap.py API 变更说明

## 新增的简化 API

### 1. get_or_create_session(user_id, user_config, **overrides)

这是新的主要 API，用于获取或创建用户的默认会话。

**参数：**
- `user_id` (str): 用户 ID
- `user_config` (dict): 用户配置字典
- `**overrides`: 可选的配置覆盖参数

**返回：**
- Session 实例

**特点：**
- 每个用户只有一个默认会话
- 如果会话不存在会自动创建
- 会话 ID 自动生成格式为 `default_{user_id}`

### 2. 简化的便捷函数

#### get_session_simple(user_id)
获取用户的默认会话（如果不存在返回 None）

#### close_session_simple(user_id)
关闭并移除用户的默认会话

## 已修改的兼容性 API

以下函数现在支持新旧两种调用方式：

### 1. create_session(user_id, user_config, session_id=None, **overrides)

**新的行为：**
- 如果 `session_id` 为 `None` 或 `"default"`，使用新 API 创建默认会话
- 否则使用旧 API 创建特定会话

### 2. get_session(user_id, session_id="default")

**新的行为：**
- 如果 `session_id` 为 `None` 或 `"default"`，使用新 API 获取默认会话
- 否则使用旧 API 获取特定会话

### 3. close_session(user_id, session_id="default")

**新的行为：**
- 如果 `session_id` 为 `None` 或 `"default"`，使用新 API 关闭默认会话
- 否则使用旧 API 关闭特定会话

### 4. list_user_sessions(user_id)

**新的行为：**
- 返回用户的默认会话列表（最多一个）
- 保持向后兼容，但不推荐用于多会话场景

### 5. init_legacy_session(user_id="default", session_id="default")

**新的行为：**
- 现在使用新的 `get_or_create_session` API
- 自动创建用户的默认会话

## 已废弃的 API

以下函数已标记为 `@deprecated`：

- `create_session`（建议使用 `get_or_create_session`）
- `get_session`（建议使用 `get_session_simple`）
- `close_session`（建议使用 `close_session_simple`）
- `list_user_sessions`（建议直接使用 `get_session_simple`）

## 使用示例

### 新的简化 API（推荐）

```python
# 初始化
from app.planify.bootstrap import initialize, get_or_create_session
initialize()

# 创建或获取用户默认会话
session = get_or_create_session(
    user_id="alice",
    user_config={
        "model_id": "claude-opus-4-6",
        "anthropic_api_key": "your-api-key"
    }
)

# 获取默认会话
session = get_session_simple("alice")

# 关闭默认会话
closed = close_session_simple("alice")
```

### 兼容性 API

```python
# 使用新 API（默认会话）
session = create_session("alice", user_config, session_id=None)

# 使用旧 API（特定会话）
session = create_session("alice", user_config, session_id="custom_123")

# 获取会话
default_session = get_session("alice", "default")
custom_session = get_session("alice", "custom_123")

# 关闭会话
close_session("alice", "default")
close_session("alice", "custom_123")
```

## 架构变化

1. **单会话模型**：每个用户现在只有一个默认会话，简化了管理
2. **自动创建**：获取会话时会自动创建不存在的会话
3. **向后兼容**：保留了旧 API 的兼容性，但添加了废弃警告
4. **一致的接口**：简化的 API 提供了更一致的使用体验