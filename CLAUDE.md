# Cortex CLAUDE.md

Cortex — 结构感知文档检索工具

## 安装

### 开发环境 (虚拟环境)

```bash
# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
& .venv\Scripts\Activate.ps1 

# 在 windows arm64 环境下，需要给cryptography下载预编译包
pip install cryptography --only-binary=:all:

# 以可编辑模式安装 cortex
pip install -e ".[cortex]"
```

**运行 Python 的方式**（Claude Code Bash 工具使用 Git Bash，`activate` 不会将 python 加入 PATH）：

```bash
# 必须直接使用 .venv 中的 python.exe
.venv/Scripts/python.exe -m cortex ...

# 如果在子目录（如 test_work_dir/）执行，用相对路径：
../.venv/Scripts/python.exe -m cortex ...
```

> 人工在终端操作时，PowerShell 用 `& .venv\Scripts\Activate.ps1`，macOS/Linux 用 `source .venv/bin/activate`。

## Cortex 技术栈

### 核心技术
| 技术 | 用途 |
|------|------|
| Textual | TUI 框架（终端用户界面） |
| FastAPI | Web API 框架（Web UI 后端） |
| Lit + Shoelace | 前端 SPA（Web Components） |
| Vite | 前端构建工具 |
| Pydantic + pydantic-settings | 配置管理（.env 环境变量） |
| TreeSearch | 索引引擎（SQLite FTS5 + BM25） |
| Watchdog | 文件监控（后台检测变化） |
| Planify | AI Agent 框架（Anthropic API 集成） |
| Rich | 终端格式化（语法高亮、链接） |
| Jieba | 中日韩分词器 |
| uvicorn | ASGI 服务器 |
| SSE (sse-starlette) | AI 对话流式响应 |

### 依赖服务
| 服务 | 用途 |
|------|------|
| SQLite | FTS5 索引 + 历史会话存储（.cortex/sessions.db） |
| Anthropic API | AI 对话（可替换本地模型） |

## Cortex 架构

### 分层架构
```
┌─────────────────────────────────────────────────────────────┐
│                      TUI 层                            │
│  CortexApp (Textual) + Widgets (ContentArea, InputBox)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    命令处理层                           │
│      CLI 子命令 (search/ai/index/status)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   业务逻辑层                             │
│  IndexManager | CortexAgent | EventBus | Scoring         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  数据访问层                               │
│  TreeSearch (FTS5) | FileWatcher (watchdog)             │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件
| 组件 | 职责 |
|------|------|
| **CortexApp** | TUI 主应用，组合 Widget，处理命令路由 |
| **IndexManager** | 索引生命周期管理，封装 TreeSearch |
| **CortexAgent** | AI 集成，封装 Planify 核心功能 |
| **FileWatcher** | 后台文件监控，自动触发增量索引 |
| **EventBus** | 全局事件总线，发布/订阅机制 |
| **Scoring** | 评分算法（关键词匹配、邻近度、综合评分） |
| **Formatting** | 终端输出格式化（高亮、VSCode 链接） |
| **Ripgrep** | FTS 无结果时的降级搜索 |

### 数据流
```
用户输入 → CortexApp.parse_input() → 命令路由
    ↓
├── 搜索: IndexManager.search() → FTS5 查询 → Scoring → Formatting
├── AI: CortexAgent.run_query() → Planify → Anthropic API
├── 索引: IndexManager.reindex() → TreeSearch.index()
└── 状态: IndexManager.documents → 统计信息
```

### 事件流
```
文件变化 → FileWatcher → EventBus.publish("file_changed")
    ↓
IndexManager.subscribe("file_changed") → 增量 reindex
```

## 项目结构

### cortex/ - 文档检索工具
```
cortex/
├── agent_integration.py      # Agent 集成
├── config.py                # 配置管理 (Pydantic)
├── cortex_cli.py            # CLI 入口（TUI + 子命令）
├── event_bus.py             # 事件总线（发布/订阅）
├── file_watcher.py          # 文件监控 (watchdog)
├── formatting.py            # 格式化输出 (Rich)
├── index_manager.py         # 索引管理 (TreeSearch)
├── kb_tools.py              # 知识库工具
├── ripgrep.py               # ripgrep 降级搜索
├── scoring.py               # 评分算法
├── tui/
│   ├── app.py               # TUI 应用主入口 (Textual)
│   ├── commands.py          # TUI 命令处理
│   ├── theme.py             # 主题配置
│   └── widgets/
│       ├── content_area.py   # 内容显示区域
│       ├── header_bar.py    # 顶部标题栏
│       ├── input_box.py     # 输入框（带历史）
│       └── status_bar.py    # 底部状态栏
```

### cortex/web_v2/ - Web UI（FastAPI + Lit PWA）
```
cortex/web_v2/
├── app.py                    # FastAPI 应用入口（create_app / launch_app）
├── deps.py                   # 依赖注入单例（IndexManager / CortexAgent / Config）
├── api/                      # REST API 路由
│   ├── search.py             # GET /api/search
│   ├── preview.py            # GET /api/preview
│   ├── sessions.py           # CRUD /api/sessions
│   ├── status.py             # GET /api/status
│   ├── chat.py               # POST /api/chat（SSE 流）
│   ├── errors.py             # 全局错误处理器
│   └── _chat_emitter.py      # Chat SSE 事件收集器
├── models/                   # Pydantic 请求/响应模型
├── sessions_store.py         # SQLite 会话持久化
├── frontend/                 # Lit + Vite 前端工程
│   ├── src/
│   │   ├── app.ts            # <cortex-app> 顶层路由
│   │   ├── state/            # 轻量 store（订阅模式）
│   │   ├── api/              # 前端 API client（fetch + SSE）
│   │   ├── components/       # 12 个 Lit Web Components
│   │   ├── views/            # 3 个视图（search / chat / history）
│   │   └── styles/           # CSS tokens + 响应式断点
│   ├── tests/                # Vitest 单元测试 + Playwright E2E
│   ├── public/               # PWA manifest + icons + sw.js
│   └── vite.config.ts        # Vite 构建配置（输出到 ../static/）
└── static/                   # Vite 构建产物（已 git 跟踪）
    ├── index.html
    ├── manifest.webmanifest
    ├── sw.js
    └── assets/               # 带 hash 的 JS/CSS + PWA icons
```

### treesearch/ - 结构感知检索核心库
```
treesearch/
├── cli.py                   # CLI 入口
├── config.py                # 配置
├── fts.py                   # FTS5 索引
├── indexer.py               # 索引构建
├── pathutil.py              # 路径工具
├── ripgrep.py               # ripgrep 集成
├── search.py                # 搜索逻辑
├── tokenizer.py             # 分词
├── tree.py                  # 树结构
├── treesearch.py            # 主入口
├── tree_searcher.py         # 树搜索
└── parsers/
    ├── ast_parser.py        # Python AST 解析
    ├── docx_parser.py      # Word 解析
    ├── excel_parser.py      # Excel 解析
    ├── html_parser.py       # HTML 解析
    ├── pdf_parser.py       # PDF 解析
    └── treesitter_parser.py # TreeSitter 解析
```

### planify/ - AI Agent 框架
```
planify/
├── cli.py                   # CLI 入口
├── cli_history.py           # 命令历史
├── main.py                 # 主入口
├── prompts.py              # Prompt 模板
├── agent/
│   └── runner.py           # Agent 运行器
├── core/
│   ├── client.py           # LLM 客户端
│   ├── config.py           # 配置
│   ├── encoding.py         # 编码处理
│   └── session.py         # 会话管理
├── managers/
│   ├── task_manager.py     # 任务管理
│   ├── teammate_manager.py  # 团队成员管理
│   └── todo_manager.py     # Todo 管理
└── messaging/
    └── message_bus.py      # 消息总线
```

## 启动脚本 start-cortex.ps1

使用 `start-cortex.ps1` 可以方便地启动前后端进行测试和验证，支持从主分支或 worktree 运行。

**测试工作目录固定为 `test_work_dir/`**，脚本会自动切换到该目录。

### 支持的场景

| 场景 | 运行方式 | cortex 代码 | 虚拟环境 |
|------|----------|-------------|----------|
| 主分支 | `~/github/cortex/start-cortex.ps1` | `$PSScriptRoot` | `$PSScriptRoot/.venv` |
| worktree | `~/github/cortex-feat-settings/start-cortex.ps1` | `$PSScriptRoot` | `../cortex/.venv` |

### 三种运行模式

**1. TUI 界面（交互式终端）**
```powershell
./start-cortex.ps1
./start-cortex.ps1 tui
```

**2. Web UI（GUI PWA）**
```powershell
./start-cortex.ps1 gui
```
> 浏览器自动打开。**注意**：端口可能因冲突而变化（7860/7861/7862...），请查看启动日志中的实际地址：
> ```
> INFO: Uvicorn running on http://127.0.0.1:7860 (Press CTRL+C to quit)
> ```

**3. 命令行模式（离线命令）**

| 命令 | 说明 | 示例 |
|------|------|------|
| `./start-cortex.ps1 search <关键词>` | 搜索文档 | `./start-cortex.ps1 search python`<br>`./start-cortex.ps1 search "量子 计算"` |
| `./start-cortex.ps1 search_v2 '<json>'` | 结构化搜索 | `./start-cortex.ps1 search_v2 '{"type":"and","terms":["量子","密码"]}'` |
| `./start-cortex.ps1 read_document --path <路径>` | 读取文档 | `./start-cortex.ps1 read_document --path '科技/doc.md'` |
| `./start-cortex.ps1 ai <问题>` | AI 问答 | `./start-cortex.ps1 ai 你好` |
| `./start-cortex.ps1 index` | 增量索引 | `./start-cortex.ps1 index` |
| `./start-cortex.ps1 index --force` | 强制全量重建 | `./start-cortex.ps1 index --force` |
| `./start-cortex.ps1 status` | 查看状态 | `./start-cortex.ps1 status` |

### 前端开发模式

修改前端代码后需要重新构建：
```bash
cd cortex/web_v2/frontend && npm install && npm run dev   # 开发模式
cd cortex/web_v2/frontend && npm run build                 # 生产构建
```

### 备用方式（直接调用 Python）

如果 `start-cortex.ps1` 不可用，可直接使用 Python：

```bash
# 在 test_work_dir 目录下执行
../.venv/Scripts/python.exe -m cortex <命令>
```
