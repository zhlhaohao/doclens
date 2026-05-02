# Planify

基于 Claude API 的多代理 LLM 系统，提供交互式 REPL 命令行界面和单用户 CLI。

## 项目概述

Planify 是一个模块化的多代理 LLM 系统，支持：

- **单用户 CLI** - 适合个人开发、本地使用
- **多用户多会话** - 支持 Web 应用后端、多用户服务
- **子代理委派** - 临时执行特定任务后返回
- **队友协作** - 持久化独立代理，通过消息总线通信
- **上下文压缩** - 自动压缩对话历史，支持长对话
- **技能加载** - 从文件系统加载专业技能
- **任务管理** - 持久化任务系统，支持依赖关系

## 快速开始

### 单用户 CLI

#### Unix/Linux/macOS (Git Bash)

```bash
# cd 到你的工作目录
cd /path/to/your/project

# 执行脚本（绝对路径）
bash ~/github/learn-claude-code/backend/app/planify/planify.sh
```

#### Windows (CMD)

```cmd
cd C:\path\to\your\project
C:\Users\lianghao\github\learn-claude-code\backend\app\planify\planify.cmd
```

#### 直接调用 Python（通用）

```bash
cd /path/to/your/project
python ~/github/learn-claude-code/backend/app/planify/cli.py
```

## 环境配置

在当前工作目录创建 `.env` 文件，配置以下变量：

### 必需配置

```bash
# Planify API 密钥（必需）
PLANIFY_API_KEY=your-planify-api-key

# 模型 ID（必需）
PLANIFY_MODEL_ID=glm-4.7
# 或 PLANIFY_MODEL_ID=claude-sonnet-4-6
```

### 可选配置

```bash
# 自定义 API 端点（可选）
PLANIFY_BASE_URL=https://api.anthropic.com

# ZhipuAI API 密钥（可选，用于 web_search 工具）
# 如果不配置，web_search 工具将不可用，但不影响其他功能
# ZHIPUAI_API_KEY=your-zhipuai-api-key
```

## 目录结构

### 单用户模式

所有数据存储在当前工作目录：

```
your-project/
├── .team/          # 团队配置和收件箱
│   ├── config.json
│   └── inbox/
├── .tasks/         # 任务文件存储
│   ├── task_001.json
│   └── task_002.json
├── .transcripts/   # 对话记录
│   ├── compact_001.jsonl
│   └── compact_002.jsonl
├── skills/         # 技能文件
├── logs/           # 日志文件
└── .env            # 配置文件
```

### 多用户模式

数据存储在 `.sessions/` 目录下，每个用户有独立的隔离空间：

```
project/
├── .sessions/
│   ├── alice/              # 用户 alice 的所有会话数据
│   │   ├── .team/
│   │   ├── .tasks/
│   │   └── .transcripts/
│   │       ├── sess_001/   # 会话 1 的对话记录
│   │       └── sess_002/   # 会话 2 的对话记录
│   └── bob/
├── skills/                 # 共享技能目录
└── logs/                   # 日志文件
```

## CLI 命令

- `/compact` - 手动压缩对话上下文
- `/tasks` - 列出任务
- `/team` - 列出队友
- `/inbox` - 读取收件箱
- `/exit` - 退出 REPL

### 多用户 REPL 专属命令

- `/user` - 切换用户
- `/session` - 切换会话
- `/new-session` - 创建新会话
- `/sessions` - 列出当前用户的所有会话
- `/close-session` - 关闭当前会话

## 架构说明

### 核心模块

```
planify/
├── cli.py              # 单用户 CLI 入口
├── main.py             # 多用户 REPL 入口
├── bootstrap.py        # 应用初始化，会话管理
├── agent/runner.py     # 核心代理循环
├── subagent/runner.py  # 子代理运行器
├── context/           # 上下文压缩机制
├── messaging/          # 消息传递系统
├── managers/          # 各种管理器
│   ├── todo_manager.py   # 内存待办列表
│   ├── task_manager.py   # 持久化任务管理
│   ├── background_manager.py  # 后台任务管理
│   └── teammate_manager.py  # 队友管理
├── tools/             # 工具注册中心
├── skills/            # 技能加载器
└── core/
    ├── session.py          # Session 和 SessionConfig
    ├── session_manager.py  # 会话管理器
    ├── context.py          # 线程本地会话上下文
    ├── config.py           # 配置管理
    ├── encoding.py         # UTF-8 编码设置
    └── logging_config.py  # 日志配置
```

### 关键概念

**子代理 vs 队友：**
- **子代理** - 临时执行特定任务后返回摘要并销毁
- **队友** - 持久化的独立代理，在独立线程中运行，通过消息总线通信

**TodoManager vs TaskManager：**
- **TodoManager** - 内存中的短期待办列表
- **TaskManager** - 文件持久化的长期任务系统，支持依赖关系

**上下文压缩：**
- **微压缩** - 每次循环自动清理旧的 tool_result
- **自动压缩** - 超过 token 阈值时使用 LLM 生成摘要

## 配置文件优先级

1. `.env.local`（最高优先级）- 用于本地开发，不提交到版本控制
2. `.env` - 标准配置文件
3. 环境变量

## 模式对比

| 特性 | 单用户 CLI | 多用户 REPL |
|------|-----------|------------|
| 用户数 | 单用户 | 多用户 |
| 会话数 | 单会话 | 多会话 |
| 数据目录 | 当前工作目录 | `.sessions/{user_id}/` |
| 适用场景 | 个人开发、本地使用 | Web 应用后端、多用户服务 |

## 常见问题

### ZhipuAI 客户端初始化失败

如果看到警告：
```
警告: 无法初始化 ZhipuAI 客户端: 未提供api_key，请通过参数或环境变量提供
web_search 工具可能不可用
```

这表示 `ZHIPUAI_API_KEY` 未配置。这不影响其他功能，只是 `web_search` 工具不可用。

如果需要 `web_search` 功能，请在 `.env` 文件中添加：
```bash
ZHIPUAI_API_KEY=your-zhipuai-api-key
```

### 路径错误

如果看到 `cli.py not found`，请确保：
1. 脚本路径正确
2. planify.sh 和 cli.py 在同一目录下

### Python 找不到

如果看到 `Error: Python or python3 not found`，请确保：
1. Python 已安装
2. 在 PATH 中可用

## 更多文档

- [CLAUDE.md](./CLAUDE.md) - Claude Code 开发指南
- [examples.md](./examples.md) - 代码示例和 API 集成
