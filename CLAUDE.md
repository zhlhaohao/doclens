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
| Pydantic + pydantic-settings | 配置管理（.env 环境变量） |
| TreeSearch | 索引引擎（SQLite FTS5 + BM25） |
| Watchdog | 文件监控（后台检测变化） |
| Planify | AI Agent 框架（Anthropic API 集成） |
| Rich | 终端格式化（语法高亮、链接） |
| Jieba | 中日韩分词器 |

### 依赖服务
| 服务 | 用途 |
|------|------|
| SQLite | 存储 FTS5 索引 |
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

## 正常使用

### TUI 界面（交互式）

```bash
.venv/Scripts/python.exe -m cortex
```

## CORTEX-CLI 测试命令

> **测试工作目录必须为 `test_work_dir/`**，所有测试命令必须在该目录下执行。
> 以下命令中 `python` 均指 `.venv/Scripts/python.exe`（在 `test_work_dir/` 下执行时为 `../.venv/Scripts/python.exe`）。

| 命令 | 说明 | 参数 | 示例 |
|------|------|------|------|
| `python -m cortex search <query>` | 在已索引的文档中搜索关键词 | `<query>`: 搜索关键词，支持多个词 | `python -m cortex search python`<br>`python -m cortex search "token limit"` |
| `python -m cortex search_v2 '<json>'` | 结构化搜索（AND/OR/NOT/PHRASE） | JSON 查询语法 | `python -m cortex search_v2 '{"type": "and", "terms": ["量子", "密码"]}'` |
| `python -m cortex read_document --path '<path>'` | 文档阅读 | `--section`, `--start-line`, `--end-line` | `python -m cortex read_document --path '科技/doc.md' --section '摘要'` |
| `python -m cortex ai <message>` | AI问答 | `<message>`: 发送的消息内容 | `python -m cortex ai 你好` |
| `python -m cortex index [--force]` | 创建或增量同步更新文档索引 | `--force`, `-f`: 强制全量重建（删除旧索引） | `python -m cortex index`<br>`python -m cortex index --force` |
| `python -m cortex status` | 显示系统状态 | 无 | `python -m cortex status` |
