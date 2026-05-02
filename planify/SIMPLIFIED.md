# Planify 简化版使用指南

## 概述

Planify 已简化架构，移除了复杂的会话管理，每个用户只有一个默认会话。这使得系统更易于理解和使用。

## 主要变化

### 架构简化
- **之前**：每个用户可以有多个独立会话
- **现在**：每个用户只有一个默认会话
- **优势**：更简单、更高效、更易维护

### 目录结构变化

#### 简化前
```
.sessions/
└── user_id/
    ├── .sessions/
    │   └── session_id/
    │       ├── transcript.json
    │       └── ...（工作文件）
    ├── .transcripts/
    │   └── session_id/
    │       └── transcript.json
    ├── .team/
    └── .tasks/
```

#### 简化后
```
.sessions/
└── user_id/                    # 用户目录
    ├── .team/                 # 团队配置
    │   ├── config.json
    │   └── inbox/
    ├── .tasks/                # 任务文件
    │   ├── task_001.json
    │   └── task_002.json
    ├── transcript.json        # 对话历史（合并所有会话）
    └── temp/                  # 临时文件
```

## 使用方法

### 1. 多用户 REPL（简化版）

```bash
python backend/app/planify/main.py
```

支持的命令：
- `/user <id>` - 切换用户（自动创建/获取默认会话）
- `/compact` - 手动压缩对话上下文
- `/tasks` - 列出所有任务
- `/team` - 列出所有队友及其状态
- `/inbox` - 读取收件箱消息
- `/exit` - 退出

**示例**：
```
default >> /user alice
alice >> 你好，我需要查询日程
alice >> /user bob
bob >> 帮我创建一个任务
```

### 2. 单用户 CLI（推荐）

```bash
python backend/app/planify/cli.py
```

单用户模式更简单，直接使用当前工作目录作为用户目录。

### 3. API 使用

```python
from app.planify.bootstrap import get_or_create_session

# 创建或获取用户会话
session = get_or_create_session("alice", user_config)

# 使用会话
session.append_message({"role": "user", "content": "Hello"})
```

## 数据迁移

系统在初始化时会自动检查并迁移旧数据：

1. **检测多会话**：发现用户有多个会话时自动迁移
2. **合并数据**：将所有转录文件合并到单一文件
3. **创建备份**：在 `.sessions_backup/` 中保留原始数据
4. **清理旧结构**：删除复杂的会话目录结构

## 迁移示例

假设用户 "alice" 有两个会话：

**迁移前**：
```
.sessions/alice/.transcripts/
├── session1/
│   └── transcript.json
└── session2/
    └── transcript.json
```

**迁移后**：
```
.sessions/alice/
├── transcript.json      # 合并了 session1 和 session2
├── .team/
└── .tasks/
```

## 向后兼容性

旧代码仍然可以工作，但会收到迁移提示：

```python
# 旧方式仍然有效，但会显示警告
session = create_session("alice", config, "session_id")
# 警告: create_session 已废弃，请使用 get_or_create_session
```

## 最佳实践

1. **使用单用户 CLI**：个人开发使用 `cli.py` 更简单
2. **多用户场景**：使用 `main.py` 并切换用户
3. **Web 集成**：使用 `get_or_create_session()` API
4. **数据备份**：迁移会自动备份，但重要数据仍建议手动备份

## 故障排除

### 问题：迁移失败
- 检查 `.sessions_backup/` 目录中的备份
- 手动恢复数据
- 查看日志了解详细错误

### 问题：权限错误
- 确保工作目录有读写权限
- 检查磁盘空间是否足够

### 问题：找不到会话
- 确认用户 ID 正确
- 检查 `.sessions/` 目录是否存在
- 使用 `/user <id>` 创建新用户

## 性能优化

1. **内存使用**：简化后每个用户只有一个会话，内存占用更低
2. **启动速度**：无需加载多个会话状态，启动更快
3. **文件系统**：减少了目录层级，文件操作更高效

## 下一步

1. **更新代码**：将旧代码迁移到新的 API
2. **更新文档**：更新所有使用示例和文档
3. **测试验证**：在环境中测试简化后的功能
4. **监控迁移**：观察首次启动时的迁移过程

## 总结

简化后的 Planify 保留了所有核心功能，同时大大降低了复杂度：
- ✅ 多用户支持
- ✅ 数据隔离
- ✅ 会话持久化
- ✅ 工具系统
- ✅ 队友协作
- ✅ 上下文压缩
- ✅ 自动数据迁移

系统现在更易于理解、部署和维护。