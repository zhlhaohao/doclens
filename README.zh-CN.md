# doclens

[English](README.md)

结构感知的文档检索工具——基于文档树做 FTS5/BM25 关键词搜索，默认入口是 PWA Web UI，并内置可用于知识库问答与 vibe coding 的 harness agent。

[![PyPI version](https://badge.fury.io/py/doclens.svg)](https://badge.fury.io/py/doclens)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](pyproject.toml)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

**doclens** 把文档解析成树结构（标题、类、函数……），再用 FTS5/BM25 做关键词匹配检索——无需嵌入、无需分块、无需向量数据库，完全离线运行。

---

## 功能特性

**核心**

| | |
|---|---|
| **结构感知搜索** | 结果锚定在文档标题、代码类或函数定义上——不是孤立的行片段 |
| **多格式** | Markdown、PDF、DOCX、PPTX、Excel、HTML、JSON、CSV、PST 邮件档案、EPUB、图像（视觉解析）、代码（Python AST + tree-sitter） |
| **零嵌入** | 文档树上的 FTS5/BM25——无向量数据库，完全离线 |
| **中日韩支持** | jieba 分词 |
| **Web UI** | Lit + Shoelace PWA——默认界面 |
| **结构化查询** | AND / OR / NOT / PHRASE 运算符（`search_v2`） |
| **正则降级** | ripgrep 风格的正则 `grep`；FTS 无结果时自动降级到 ripgrep |

**附加**

| | |
|---|---|
| **内置 AI Agent** | 完整 harness agent（planify）：工具循环、子代理、teammate、技能、上下文压缩——同时驱动知识库问答与 vibe coding。[见下文](#ai-agent知识库问答--vibe-coding) |
| **改前快照回退** | 每轮对话对已追踪文件拍快照、每次写入前先备份——可从会话历史恢复任意早先状态 |
| **斜杠技能** | 对话中直接 `/技能名 问题` 调用技能，UI 提供引导式下拉 |
| **后台监控** | watchdog 监控文件变化，自动增量重索引 |
| **Git 同步** | 知识库目录自动 commit → pull → merge → push（日记目录用 `union` 合并） |
| **日记** | 每日片段 → 次日确定性成稿；图片压缩；天气查询 |
| **Web 文件管理** | 上传 / 改名 / 移动 / 预览（带 TOC 抽屉） |
| **访问密码** | 非环回访问的 6 位数字密码门禁；`doclens auth reset` 清除 |
| **网页抓取** | 公开网页抓取并转写为 markdown 后参与搜索 |

---

## AI Agent：知识库问答 + Vibe Coding

对话页不是简单的「搜索 + LLM」拼装，而是一个构建在 [planify](planify/)（本仓库自研的 AI Agent 框架）上的完整 **harness agent**。同一个 agent 循环服务两种彼此交融的模式：**基于知识库的有据问答**，以及 **vibe coding**——用自然语言直接改写知识库（或任意工作目录）。

### 为什么是 harness agent

| 能力 | 作用 |
|---|---|
| **工具循环** | agent 自主规划、调用工具、读取结果、继续迭代——多轮检索与代码编辑在循环内自动完成，不是固定的单趟管道 |
| **子代理** | `task` 派生一次性子代理（如 `Explore`），并行精读大文件并返回浓缩摘要——大文档问答不撑爆上下文窗口 |
| **Teammate** | `spawn_teammate` 启动持久的自主队友（各自独立 agent 循环），经 `send_message` / `read_inbox` / 文件级消息总线协作 |
| **技能** | `load_skill` 按需注入领域操作手册（KB 检索策略、引文规范、忽略规则编辑、README 再生成……）；对话中 `/技能名 问题` 直接调用。用户可添加自己的 SKILL.md；技能改动热重载 |
| **上下文压缩** | 两级自动压缩（microcompact / auto-compact），长会话始终保持在模型上下文窗口内 |
| **Prompt caching** | Anthropic prompt caching（ephemeral 断点）——system prompt 与工具定义跨轮命中缓存 |
| **询问用户** | `ask_user_question` 在任务中途暂停等待结构化用户输入；对话式提问模式适配无人值守 / 移动端 |
| **改前快照回退** | 轮首快照 + 写前备份让每次 AI 编辑都可撤销——在会话里选一个时间点，把文件恢复成当时的样子 |
| **安全门禁** | 工作目录外读写门禁：按 `PLANIFY_OUTSIDE_WORKDIR` 对目录外路径执行确认 / 放行 / 拦截 |

### 知识库问答模式

System prompt 强制 **知识库优先** 策略：事实性提问必须先走 `load_skill("knowledge-base")` → `search_kb`（多组关键词、同义词、中英互换）；只有知识库确实无结果才允许降级 web 搜索——且必须向用户言明。引文由机器校验（路径必须在 workdir 下真实存在），答案引用的都是你真正有的东西。

知识库根的指导文件（`CLAUDE.md` 或 `AGENTS.md`，上限 32 KB）会自动注入每轮 system prompt——你为编码工具写的指导同样驱动本 agent。

### Vibe coding 模式

同一个 agent 携带面向工作目录的完整编辑工具箱：

- **文件工具** —— `read_file` / `write_file` / `edit_file`（edit_file 要求 old_text 唯一，改不会落错地方）
- **Shell 工具** —— `bash`（Windows 上是 Git Bash）与 `powershell`；长任务用 `background_run` / `check_background`
- **搜索工具** —— 索引树上的 `grep` / `glob` / `search_kb` / `read_document`
- **项目跟踪** —— 持久化任务板（`task_create` / `task_update` / `claim_task`）、内存 todo、后台 shell——多步重构跨轮存活

打开对话页，描述你要的改动（「给 X 加个设置开关」「把这三个文件总结成一个」），agent 就会检索、编辑、跑构建、汇报——你的知识库就是它工作的仓库。改坏了？回退功能可把文件恢复到该会话中任意早先的状态。

### 模型预设

无需手改 `.env` 即可切换 LLM：命名预设打包协议 + base URL + 模型 ID + API key（+ 上下文窗口），在设置 → 模型管理，切换即时热生效（免重启）。Anthropic 与 OpenAI 兼容端点都支持；视觉（图像解析）与搜索调优另有独立预设。

---

## 安装

```bash
pip install doclens
```

要求 Python ≥ 3.10。

---

## 快速开始

```bash
# 1. 索引你的文档（当前目录）
doclens index --force
# ……或指定目录
doclens index --workdir /path/to/kb

# 2. 命令行搜索
doclens search "authentication flow"
doclens search "量子 计算"          # 中文经 jieba 分词
doclens search_v2 '{"type": "and", "terms": ["auth", "token"]}'  # 结构化查询

# 3. 启动 Web UI（自动打开浏览器）
doclens gui
# INFO: Uvicorn running on http://127.0.0.1:7860

# 4. 向 AI 提一个有依据的问题
doclens ai "How does the authentication system work?"
```

doclens 自动发现受支持的文件（`.md`、`.py`、`.pdf`、`.docx`、`.xlsx`……），并跳过常见忽略模式（`.git`、`node_modules`、`__pycache__`、`.venv`）。知识库根目录的 `.gitignore` 也可以承载忽略规则。

---

## CLI 参考

```
doclens <command> [--workdir DIR]
```

| 命令 | 说明 |
|------|------|
| `doclens search <query…>` | 跨已索引文档的关键词搜索 |
| `doclens search_v2 '<json>'` | 结构化搜索：AND / OR / NOT / PHRASE 运算符 |
| `doclens ai <message…>` | 向 AI agent 发送消息 |
| `doclens index [--force]` | 构建或更新文档索引 |
| `doclens status` | 显示索引统计与系统状态 |
| `doclens gui [--port PORT]` | 启动 Web UI（PWA） |
| `doclens read_document --path <path>` | 读取文档（带结构信息） |
| `doclens search_kb <query…>` | AI 工具输出格式的 KB 搜索（与 `search` 同引擎） |
| `doclens webfetch <url>` | 抓取网页并转写为 markdown |
| `doclens grep <pattern>` | ripgrep 风格正则搜索 |
| `doclens auth reset` | 清除 Web UI 访问密码 |

裸命令 `doclens` 默认启动 Web GUI。

---

## Web UI

默认界面是 Lit + Shoelace 构建的 PWA，由 FastAPI 服务在 `http://127.0.0.1:7860`（端口冲突时自动递增——以启动日志为准）。

- **搜索** — 关键词搜索，结果卡片与片段
- **对话** — harness agent：SSE 流式输出、工具调用轨迹、会话历史（见 [AI Agent](#ai-agent知识库问答--vibe-coding)）
- **文件** — 知识库文件树，支持上传 / 改名 / 移动 / 预览（Markdown、PDF、DOCX、PPTX、Excel、图像、PST 邮件列表），长文档有 TOC 抽屉
- **日记** — 每日片段（图片 + 天气），次日总结为成品日记
- **设置** — 模型预设（LLM / 视觉 / 搜索）、访问密码、技能、MCP 服务器、Git 同步

访问控制：环回（`127.0.0.1`）访问永远免登录。可在设置 → 网络设置 6 位数字密码；此后非环回请求需要密码。忘记密码？运行 `doclens auth reset`。

---

## Claude Code 集成（MCP 知识库问答）

doclens 在 GUI 进程内自启 **MCP 服务器**（Streamable HTTP），把知识库暴露为 `search_kb` 和 `read_document` 两个 MCP 工具。任何 MCP 兼容客户端（Claude Code、Cursor、Cline……）都能接入，基于你的已索引文档回答问题——零嵌入 / 向量数据库。

- MCP HTTP 服务器在**进程内**后台线程运行，与 GUI 共享同一个 `IndexManager`——文件监控触发的实时重索引对 MCP 查询同样生效。
- 监听 `http://<host>:<port>/mcp`，URL 每次启动都打印在启动日志里。
- 默认环回（`127.0.0.1`）无认证。绑定非环回地址**必须**设置 bearer token（`CORTEX_MCP_TOKEN`）——否则服务器拒绝启动。

### 配置步骤

**1. 启动 doclens**（同时启动 MCP 服务器）：

```bash
doclens gui
```

从启动日志读取 MCP URL：

```
MCP server: http://127.0.0.1:7880/mcp
```

**2. 在 Claude Code 注册**（每个项目一次）：

```bash
claude mcp add --transport http doclens http://127.0.0.1:7880/mcp --scope local
claude mcp list      # 期望：doclens: ... ✔ Connected
```

作用域：`local`（默认——本项目 + 本人，不入库）、`user`（全局）、`project`（`.mcp.json`，随仓库提交）。

**3. 若 Claude Code 会话已在运行，重启会话**——MCP 服务器只在会话启动时加载。

**4. 提问。** 在 Claude Code 里问任何与已索引文档相关的问题，它会自动调用 `search_kb` / `read_document`。想要纯 KB 回答，把会话限制到这两个工具：

```bash
claude -p "量子密钥分发 QKD 的基本原理是什么？" \
  --allowedTools "mcp__doclens__search_kb" "mcp__doclens__read_document"
```

### 内置技能：`kb-ask`

doclens 附带一个 Claude Code 技能（[源码：`doclens/claude_code_skills/kb-ask/skill.md`](doclens/claude_code_skills/kb-ask/skill.md)），固化了完整的 KB 问答工作流：MCP 连接前提检查、FTS 多查询策略、`read_document` 深读、来源引用规则、禁止编造约束。

GUI 启动时会检查 `~/.claude/skills/kb-ask/`，技能缺失或过时则提示安装/覆盖（非交互终端静默跳过）。首次安装后重启 Claude Code 会话，即可随处调用：

```
/kb-ask 新能源汽车技术有哪些
```

### 配置

MCP 行为由以下环境变量控制（与 doclens 其余配置共用 `.env`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORTEX_MCP_ENABLED` | `false` | GUI 启动时自启 MCP 服务器；设 `true` 开启 |
| `CORTEX_MCP_PORT` | `7880` | MCP HTTP 端口 |
| `CORTEX_MCP_HOST` | `127.0.0.1` | 绑定地址；非环回**必须**配 `CORTEX_MCP_TOKEN` |
| `CORTEX_MCP_TOKEN` | — | host 非环回时强制使用的 bearer token |

---

## 配置

doclens 从项目根读取 `.env`。复制并定制模板：

```bash
cp doclens/.env.example .env
```

核心变量（完整注释清单见 `doclens/.env.example`）：

**Web / MCP**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORTEX_WEB_HOST` | `127.0.0.1` | Web UI 绑定地址 |
| `CORTEX_WEB_PORT` | `7860` | Web UI 端口 |
| `CORTEX_WEB_PASSWORD_HASH` | — | 访问密码哈希（设置页自动写入；留空 = 未设密码） |
| `CORTEX_MCP_*` | — | MCP 服务器开关 / host / port / token（见上） |
| `CORTEX_CHAT_DISCONNECT_CONTINUE` | `true` | SSE 断开续跑：断开不终止生成，重连可续看 |

**LLM（AI 对话）**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORTEX_ACTIVE_LLM_PRESET` | — | 激活的模型预设名 |
| `PLANIFY_PROTOCOL` | — | `anthropic` 或留空（OpenAI 兼容） |
| `PLANIFY_BASE_URL` / `PLANIFY_MODEL_ID` / `PLANIFY_API_KEY` | — | LLM 端点、模型与密钥 |
| `PLANIFY_CONTEXT_WINDOW` | `200000` | 上下文窗口（tokens）；0.8× 处自动压缩 |
| `PLANIFY_MAX_TOKENS` | `8000` | 单次响应最大输出 tokens |
| `PLANIFY_ASK_MODE` | `interactive` | `ask_user_question` 的提问形态：交互答题卡或对话消息 |

**视觉（图像解析）**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORTEX_ACTIVE_VISION_PRESET` | — | 激活的视觉预设名 |
| `VISION_BASE_URL` | dashscope compatible-mode | OpenAI 兼容视觉端点 |
| `VISION_MODEL` | `qwen-vl-max` | 视觉模型 |
| `VISION_API_KEY` | — | 图像解析必需 |
| `VISION_AUTO_ROTATE` | `false` | 上传图片经视觉自动判向转正 |

**搜索调优**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORTEX_MAX_RESULTS` | `50` | 搜索返回结果数上限 |
| `CORTEX_MIN_SCORE_THRESHOLD` | `0.3` | 低于该分数的结果被过滤 |
| `CORTEX_MAX_SPAN` | `50` | 关键词集中度窗口（字符） |
| `CORTEX_WEIGHT_*` | 4.0 / 2.0 / 1.0 / 2.0 / 1.0 | 评分权重：关键词 / 文件名 / FTS / 标题 / 邻近度 |
| `CORTEX_GREP_MAX_RESULTS` | `50` | grep 结果数上限 |

**索引 / 监控 / Git 同步**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORTEX_WATCH_ENABLED` | `true` | 后台文件监控 |
| `CORTEX_WATCH_DEBOUNCE` | `5.0` | 监控防抖（秒） |
| `CORTEX_SYNC_ENABLED` | `false` | Git 自动同步（commit → pull → merge → push） |
| `CORTEX_SYNC_INTERVAL_MINUTES` | `5.0` | 同步间隔（分钟） |
| `CORTEX_CJK_TOKENIZER` | `jieba` | 中日韩分词器：jieba / bigram / char / auto |
| `TREESEARCH_INDEX_CHUNK_SIZE` | `500` | 分块索引块大小（文件数） |

---

## 开发

```bash
# 1. 创建虚拟环境
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows（用 pwsh 7）
# source .venv/bin/activate       # macOS / Linux

# 2. 以可编辑模式安装 doclens 及 dev 依赖
pip install -e ".[dev]"

# 3. 用本地源码覆盖 treesearch / planify（可编辑安装，改源码即生效）
pip install -e ./treesearch
pip install -e ./planify

# 4. webfetch 的 JS 渲染降级与 E2E 测试需要 Playwright 浏览器
python -m playwright install chromium --only-shell
```

日常开发（仓库根，PowerShell 7）：

```powershell
./start-app.ps1 gui              # 后端 + 已构建前端
./start-app.ps1 gui -C D:\kb     # 指定知识库目录
./start-app.ps1 search "量子 计算"
```

前端（`doclens/web_v2/frontend`）：

```bash
npm install
npm run build      # tsc --noEmit && vite build → 输出到 doclens/web_v2/static/
npm test           # vitest 单元测试
```

后端测试：

```bash
.venv/Scripts/python.exe -m pytest
```

---

## 架构

```
┌─────────────────────────────────────────────────┐
│            Web UI (Lit + Shoelace PWA)          │
│           FastAPI + SSE streaming               │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│                 CLI (argparse)                  │
│   search / index / status / gui / ai / …        │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│      IndexManager │ CortexAgent │ EventBus      │
│         Scoring │ FileWatcher │ MCP server      │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│   treesearch/  —  parsers, indexer, FTS5/BM25  │
│   planify/     —  AI agent runner + tools       │
└─────────────────────────────────────────────────┘
```

- **doclens** —— 业务宿主：CLI、Web UI、MCP 服务器、事件总线、文件监控、日记、Git 同步
- **treesearch** —— 索引与检索引擎（文档树上的 FTS5/BM25；经 PyPI 的 `treesearchlib` 分发）
- **planify** —— AI Agent 框架：LLM Provider（Anthropic / OpenAI 兼容）、流式 runner、工具注册表、技能、teammate（经 PyPI 的 `planify` 分发）

分层规则：`doclens` 依赖 `planify` 与 `treesearch`；两个库互相不 import、也不 import 宿主；跨模块禁止引用下划线私有成员。

---

## License

Apache License 2.0——见 [LICENSE](LICENSE)。

## 联系方式

Lianghao —— zhlhao@163.com
