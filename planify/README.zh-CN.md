# Planify

[English](README.md)

Planify 是一个单进程多代理 LLM Agent 框架，提供流式代理循环、静态组装的工具注册表、Anthropic 与 OpenAI 兼容双后端，以及对 prompt 前缀缓存友好的上下文压缩（前缀缓存指复用对话中不变的开头部分，让 Provider 对重复输入少计费）。Planify 以 Python 库形态发布——由宿主应用嵌入并驱动，Provider、工具与配置全部支持从外部注入或扩展。

## 目录

- [功能特性](#功能特性)
- [前置条件](#前置条件)
- [安装](#安装)
- [快速开始（库用法）](#快速开始库用法)
- [配置](#配置)
- [架构](#架构)
- [内置工具](#内置工具)
- [运行时数据目录](#运行时数据目录)
- [宿主应用集成](#宿主应用集成)
- [开发](#开发)
- [更多文档](#更多文档)
- [License](#license)

## 功能特性

**代理执行**

- **流式代理循环**（主力路径）——全异步，消费 Provider 归一化后的流事件。工具执行不阻塞主循环，且支持经中断事件在轮次之间打断生成。
- **同步代理循环**——遗留的整体返回路径，与流式循环共享同一套循环骨架和压缩管道。
- **一次性子代理**——上限 30 轮的临时代理循环：执行一个隔离任务、返回摘要、随即销毁。`agent_type` 裁剪工具集（`Explore` 只读；`general-purpose` 增加文件写入）。
- **持久队友**——每个队友是一个持久代理，在后台 daemon 线程（不阻塞进程退出的线程）里跑自己的循环，经基于文件的消息总线通信。空闲队友自动从任务板认领无阻塞任务。

**上下文管理**

- **microcompact**（截断式）只保留最近 10 个 tool_result，其余清理。它受压缩阈值 80% 的门控：未达门控时完全不动历史，让对话开头保持字节级稳定、对缓存友好。
- **auto_compact**（LLM 摘要式）先把原始对话落盘，再让模型生成一份承接前文的 continuity 摘要替换历史。
- 压缩有四个触发点：两个代理循环内部、模型可自行调用的 `compress` 工具、宿主前端的手动命令。

**LLM Provider 层**

- 唯一入口是一个含三个方法（发送 / 流式 / 数 token）的 Provider 协议——所有调用方都不直接碰 SDK 类型。
- 两个可互换后端：**Anthropic**（在 system prompt、工具表、最后一条 user 消息处设缓存断点）与 **OpenAI 兼容**（走 `/chat/completions`，内置两套 tool-call 格式的翻译层）。
- 带 `retryable` 标志的异常层级，覆盖认证、限流、上下文超长、网络四类失败。

**工具系统**

- 注册表静态组装，一次性返回工具定义与对应 handler；handler 同步、异步皆可。
- 宿主应用可注入自己的工具、用白名单环境变量过滤工具集，并为沙箱化前端启用更严的路径门禁（shell 工具被包装、文件工具被禁止路径逃逸）。
- 内置约 29 个工具开箱即用——见[内置工具](#内置工具)。

**技能系统**

- 技能文件（`SKILL.md`）是两段式 prompt 注入而非可调用工具：轻量清单提前注入（对缓存便宜），完整内容经 `load_skill` 工具按需获取。技能支持热重载——文件变化在下一轮对话开始时自动生效，无需重启。

**任务管理**

- **TodoManager**——内存中的单代理待办清单：最多 20 项、同一时刻恰好一项进行中、3 轮未更新会收到提醒。
- **TaskManager**——文件持久化的任务板，带依赖边（blocked-by / blocks）；任务完成自动解除下游阻塞，任何代理都可认领无主任务。
- **BackgroundManager**——在 daemon 线程上运行长时 shell 命令（Windows 下按 Git Bash → PowerShell → cmd 三级回退），结果以通知形式回流代理循环。

**宿主集成**

- 配置与工具经注册钩子流入；planify 永不 import 宿主应用。
- 可插拔的事件发射器（SSE 队列、控制台、回调路由）让同一个代理驱动不同前端。

## 前置条件

- Python ≥ 3.10（`pyproject.toml` 声明）
- 一个 Anthropic 兼容或 OpenAI 兼容端点的 API Key
- Playwright 的 Chromium 二进制，仅抓取 JS 渲染页面时需要：

```bash
# 一次性下载 webfetch 工具所需的无头浏览器
python -m playwright install chromium --only-shell
```

## 安装

从仓库根目录以可编辑模式安装（开发推荐）：

```bash
# 可编辑安装 planify 包
pip install -e ./planify
```

核心依赖自动拉取：两个 Provider SDK（`anthropic`、`openai`）、`httpx`、`python-dotenv`、`borax`（农历数据）、`trafilatura` + `playwright`（网页抓取）。

## 快速开始（库用法）

Planify 由宿主应用嵌入使用，自身不提供面向用户的入口。最小路径是：注册配置 → 创建运行时 → 驱动流式循环。

```python
import asyncio
from pathlib import Path

from planify.bootstrap import initialize, get_or_create_runtime
from planify.streaming import StreamingAgent
from planify.streaming.emitter import SSEEmitter   # 或你自己的 emitter 实现

# 1. 以该工作目录启动运行时管理器单例
manager = initialize(base_workdir=Path.cwd())

# 2. 按用户创建运行时：装配 Provider、各 Manager、消息总线、工具
runtime = get_or_create_runtime("alice", {
    "api_key": "sk-...",
    "model_id": "claude-sonnet-4-6",
})

# 3. 基于该运行时构建流式代理
agent = StreamingAgent(
    client=runtime.client,          # Provider 实例
    model=runtime.model,
    tools=runtime.tools,
    tool_handlers=runtime.tool_handlers,
    emitter=SSEEmitter(),           # 任意 emitter 实现
    bus=runtime.bus,
    skills_loader=runtime.skills,
    runtime=runtime,
    system_prompt_extra="可选：宿主策略，拼接到 system prompt 末尾。",
)

# 4. 运行循环。注意：messages 会被就地修改。
messages = []
asyncio.run(agent.run_stream(messages, "总结一下这个仓库的目录结构。", session_id="demo-001"))
```

一次性子代理做隔离的只读探索：

```python
from planify.subagent.runner import run_subagent
from planify.tools.basic import run_bash, run_read, run_write, run_edit

summary = run_subagent(
    prompt="列出顶层各包及其职责。",
    agent_type="Explore",                 # 只读工具集
    workdir=Path.cwd(),
    client=runtime.client,
    model=runtime.model,
    run_bash=run_bash, run_read=run_read, run_write=run_write, run_edit=run_edit,
)
```

## 配置

配置解析优先级（最高在前）：

1. 宿主启动时经注册钩子注入
2. 传给 `get_or_create_runtime()` 的按用户配置字典
3. 环境变量
4. 工作目录下的 `.env` 文件（`.planify/.env` → `.env.local` → `.env`）
5. 内置默认值

### 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `PLANIFY_API_KEY` | 是 | LLM Provider 的 API Key |
| `PLANIFY_MODEL_ID` | 是 | 模型 ID，如 `claude-sonnet-4-6`、`glm-4.7`、`deepseek-chat`——完全由配置透传，无预设 |
| `PLANIFY_PROTOCOL` | 否 | `anthropic`（默认，`/v1/messages`）或 `openai_compat`（`/chat/completions`） |
| `PLANIFY_BASE_URL` | 否 | 端点 URL；留空用 Provider SDK 默认。设置后会移除 `ANTHROPIC_AUTH_TOKEN` 防认证冲突 |
| `PLANIFY_ENABLED_TOOLS` | 否 | 逗号分隔的工具白名单；未设置/为空 = 注册全部工具 |
| `PLANIFY_ASK_MODE` | 否 | 代理向用户提问的方式：`interactive`（默认，阻塞式提问）或 `chat`（以下一条用户消息作答）；每次调用重读环境变量 |
| `ASSETS_DIR` | 否 | 资源目录，绝对路径或相对工作目录 |
| `BAIDU_WEATHER_API_URL` / `BAIDU_WEATHER_AK` / `BAIDU_WEATHER_DATA_TYPE` | 否 | 百度地图天气 API 配置（`baidu_weather` 工具用） |

### 切换 LLM 端点

端点由协议加基础 URL 决定——没有 provider 预设。

OpenAI 兼容端点：

```bash
export PLANIFY_PROTOCOL=openai_compat          # 走 /chat/completions
export PLANIFY_BASE_URL=https://api.deepseek.com/v1
export PLANIFY_API_KEY=sk-...
export PLANIFY_MODEL_ID=deepseek-chat
```

Anthropic 原生（默认，无需基础 URL）：

```bash
export PLANIFY_API_KEY=sk-ant-...
export PLANIFY_MODEL_ID=claude-sonnet-4-6
```

## 架构

四层分层，依赖严格单向（上层依赖下层，无循环）：

```
入口层     宿主前端（Web SSE / 控制台 / 回调路由）
              ↓
装配层     bootstrap.py → core/runtime_manager.py → core/runtime.py（组件容器）
              ↓ 工具注册表组装
执行层     streaming/runner.py（异步，主力）  agent/runner.py（同步，遗留）  subagent/runner.py（一次性）
              └─────────── 三者共享 Provider 协议与压缩管道 ───────────┘
支撑层     core/llm/（Provider 抽象）· tools/ · skills/ · managers/ · messaging/ · context/compact.py
```

源码结构：

```
planify/
├── bootstrap.py            # 装配入口：运行时管理器单例 + 宿主依赖注册
├── prompts.py              # System prompt 构建（按代理类型分支；宿主扩展点）
├── agent/
│   └── runner.py           # 同步代理循环（遗留整体返回路径）
├── streaming/
│   ├── runner.py           # StreamingAgent——异步主循环（主力路径）
│   ├── emitter.py          # Emitter 实现（SSE 队列 / 控制台 / 回调路由）
│   ├── waiter.py           # 跨线程「代理提问→用户作答」阻塞等待
│   └── types.py            # 事件类型、协议、流式配置
├── subagent/
│   └── runner.py           # 一次性子代理（≤ 30 轮，按代理类型裁剪工具集）
├── context/
│   └── compact.py          # 两级压缩：截断式与 LLM 摘要式
├── core/
│   ├── runtime.py          # AgentRuntime：进程级组件容器
│   ├── runtime_manager.py  # 运行时生命周期 / 组件装配（线程安全单例）
│   ├── config.py           # 配置（.env 多级加载 + 宿主注入双通路）
│   ├── encoding.py         # Windows GBK/UTF-8 控制台处理
│   ├── logging_config.py   # 日志 + 首启工作区初始化
│   └── llm/                # Provider 协议、工厂、双后端、翻译层、异常层级
├── managers/
│   ├── todo_manager.py     # 内存单代理待办
│   ├── task_manager.py     # 文件持久化任务板（依赖边）
│   ├── background_manager.py  # 后台 shell 命令（线程 + 通知队列）
│   └── teammate_manager.py # 持久队友（每成员一个 daemon 线程 + 独立代理循环）
├── messaging/
│   └── message_bus.py      # 文件级 per-recipient 收件箱
├── skills/
│   ├── skill_loader.py     # SKILL.md 扫描/解析，惰性热重载
│   └── access_state.py     # 按会话的已加载技能状态
└── tools/
    ├── registry.py         # 工具注册表组装 + 外部工具注入 + 白名单
    ├── basic.py            # bash / powershell / read_file / write_file / edit_file（含路径门禁）
    ├── grep.py / glob_tool.py  # 基于 ripgrep 的内容搜索 / glob 文件名匹配
    ├── webfetch.py         # 网页抓取：trafilatura → Playwright 降级，含 SSRF 校验
    ├── user_interaction.py # 用户提问工具（宿主运行时绑 emitter + waiter）
    ├── team_tools.py       # 团队协作工具
    ├── file_tasks.py       # 任务板工具
    ├── protocols.py        # shutdown / plan_approval / idle 协议工具
    ├── weather_tool.py / baidu_weather.py / lunar.py  # 天气 + 农历
    └── guard.py            # 沙箱化前端的路径门禁
```

### 关键概念

- **子代理 vs 队友**——子代理是临时的：执行一个任务、返回摘要、随即销毁。队友是持久的：在后台线程里跑自己的代理循环，经消息总线通信。
- **TodoManager vs TaskManager**——前者是单代理私有的内存待办清单；后者是跨代理共享、文件持久化、带依赖边的任务板。
- **两级压缩**——截断式每轮自动清理旧 tool_result；LLM 摘要式在 token 超阈值时介入。两者都通过上文提到的 0.8 门控保护 prompt 前缀缓存。

更深入的分析（分层、调用链、已知技术债）见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 内置工具

约 29 个，由 `tools/registry.py` 中的工具注册表静态组装。工具定义是 Anthropic 格式的纯字典，handler 同步、异步皆可。宿主可经注册钩子增量注入，用白名单变量过滤。

| 类别 | 工具 | 说明 |
|---|---|---|
| 文件与命令 | `bash`、`powershell`、`read_file`、`write_file`、`edit_file` | 防路径逃逸门禁、危险命令过滤、超时、输出截断；读取带行号并支持 offset/limit 分页；编辑强制唯一匹配或显式全量替换 |
| 搜索 | `grep`、`glob` | 基于 ripgrep 的内容搜索与文件名匹配 |
| 网络 | `webfetch` | trafilatura 提取 + Playwright 降级；含 SSRF（服务端请求伪造）防护 |
| 用户交互 | `ask_user`、`user_confirm`、`ask_user_question` | 注册时不绑 handler；宿主运行时绑 emitter 与应答等待器，同一组工具适配任意前端 |
| 团队协作 | `spawn_teammate`、`list_teammates`、`send_message`、`read_inbox`、`broadcast` | 委托队友管理器与消息总线 |
| 协议 | `shutdown_request`、`plan_approval`、`idle` | 团队生命周期协调 |
| 任务板 | `task_create`、`task_get`、`task_update`、`task_list`、`claim_task` | 转发到持久化任务板 |
| 代理内联 | `TodoWrite`、`task`（一次性子代理）、`load_skill`、`background_run`、`check_background`、`compress` | 循环周边的便捷工具 |
| 天气与日历 | `baidu_weather` | 百度地图 API + borax 农历 |

## 运行时数据目录

所有运行时状态都在工作目录下（`.planify/` 命名空间 + 约定目录）：

```
your-project/
├── .planify/
│   ├── team/              # 团队配置与 per-recipient 收件箱（inbox/）
│   ├── tasks/             # 任务板 JSON 文件
│   ├── transcript.json    # 压缩 transcript 落点
│   └── .env               # 优先级最高的 .env 位置
├── skills/                # SKILL.md 技能文件（递归扫描）
├── .transcripts/          # auto_compact 保存的对话 transcript
└── logs/                  # 日志文件
```

## 宿主应用集成

planify 永不 import 宿主——一切经注册钩子流入：

```python
from planify import bootstrap

# 1. 注入配置（优先级最高，压过环境变量）
bootstrap.register_planify_config(
    api_key="sk-...",
    model_id="claude-sonnet-4-6",
    base_url="",                     # 留空用 SDK 默认
    protocol="anthropic",            # 或 "openai_compat"
)

# 2. 注入宿主工具（如领域检索工具）
bootstrap.register_app_dependencies(
    external_tools=[{"name": "read_document", "description": "...", "input_schema": {...}}],
    external_handlers={"read_document": my_handler},
)
```

用户提问工具在运行时接线：宿主用 `bind_user_interaction_handlers()`（`tools/user_interaction.py` 中）绑定自己的事件发射器与应答等待器——代理的提问到达宿主任意前端，答案异步回流。

完整的集成 walkthrough（SSE 流式、自定义工具开发、配置注入）见 [INTEGRATION.md](INTEGRATION.md) 与 [examples.md](examples.md)。

## 开发

```bash
# 带 dev 附加依赖安装（pytest / pytest-asyncio）
pip install -e "./planify[dev]"

# 运行测试套件
pytest
```

## 更多文档

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) —— 深度架构分析（分层、调用链、技术债）
- [INTEGRATION.md](INTEGRATION.md) —— 宿主应用集成指南（SSE、自定义工具、配置注入）
- [examples.md](examples.md) —— 使用示例代码

## License

Apache-2.0 —— 见仓库根 [LICENSE](../LICENSE)。
