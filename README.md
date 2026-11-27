# doclens

[English](README.en.md)

结构感知的文档检索工具——基于文档树做 FTS5/BM25 关键词搜索，默认入口是 PWA Web UI，并内置可用于知识库问答与 vibe coding 的 harness agent。

[![PyPI version](https://badge.fury.io/py/doclens.svg)](https://badge.fury.io/py/doclens)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](pyproject.toml)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

**doclens** 把文档解析成树结构（标题、类、函数……），再用 FTS5/BM25 做关键词匹配检索——无需嵌入、无需分块、无需向量数据库，完全离线运行。

---

## 功能特性

| | |
|---|---|
| **结构感知搜索** | 结果锚定在文档标题、代码类或函数定义上——不是孤立的行片段 |
| **多格式** | Markdown、PDF、DOCX、PPTX、Excel、HTML、JSON、CSV、PST 邮件档案、EPUB、图像（视觉解析）、代码（Python AST + tree-sitter） |
| **零嵌入** | 文档树上的 FTS5/BM25——无向量数据库，完全离线 |
| **Web UI** | Lit PWA（Meta 设计系统 + Lucide 图标）——默认界面 |
| **内置 AI 个人助手** | 完整 harness agent（planify）：工具循环、子代理、技能、上下文压缩——同时驱动知识库问答与 vibe coding。[见下文](#vibe-coding) |
| **后台监控** | watchdog 监控文件变化，自动增量重索引 |
| **日记** | 每日片段 → 次日确定性成稿；图片压缩；天气查询 |
| **Web 文件管理** | 上传 / 改名 / 移动 / 预览（带 TOC 抽屉） |

---

## Vibe coding

个人助手页不是简单的「搜索 + LLM」拼装，而是一个构建在 [planify](planify/)（本仓库自研的 AI Agent 框架）上的完整 **harness agent**——用自然语言直接改写知识库（或任意工作目录）。

| 能力 | 作用 |
|---|---|
| **对话即编程** | 说需求就动手——agent 自主规划、调用工具、读取结果、继续迭代，检索、编辑、跑构建、汇报全程可见（可展开每一步轨迹）；不是固定的单趟管道 |
| **工作目录工具箱** | 文件工具 `read_file` / `write_file` / `edit_file`（要求 old_text 唯一，改不会落错地方）；Shell 工具 `bash`（Windows 上是 Git Bash）与 `powershell`，长任务用 `background_run` / `check_background`；索引树上的搜索工具 `grep` / `glob` / `search_kb` / `read_document` |
| **深度代码库理解** | 结构感知索引把结果锚在标题、类、函数定义上，配合 `task` 派生的子代理并发精读大文件——大文档问答不撑爆上下文窗口 |
| **长期记忆** | 偏好、纠错、决策跨对话持久生效：说「记住这个」当场写入，「不用记了」立即退役；记忆库在本机可审计 |
| **任务清单跟踪** | 持久化任务板（`task_create` / `task_update` / `claim_task`）与内存 todo 跨轮存活——多步重构不丢进度 |
| **CLAUDE.md 兼容** | 知识库根的 `CLAUDE.md` / `AGENTS.md` 自动注入每轮 system prompt，团队沉淀的规范一字不改直接用 |
| **MCP 生态** | 内置 MCP 服务器，同时可接入外部 MCP 服务器，工具即插即用 |
| **技能系统** | Markdown 即技能：`load_skill` 按需注入领域操作手册（KB 检索策略、引文规范、忽略规则编辑、README 再生成……）；对话中 `/技能名 问题` 直接调用，内置一批精选技能，用户可加自己的 SKILL.md，改动热重载 |
| **上下文压缩** | 两级自动压缩（microcompact / auto-compact），长会话始终保持在模型上下文窗口内 |
| **Prompt caching** | 完美适配云服务商的 Prompt caching——Anthropic 走显式 ephemeral 断点，OpenAI 兼容端点（MiniMax / 阿里云 / DeepSeek 等）自动识别各家缓存命中字段，system prompt 与工具定义跨轮命中缓存，大幅度节省费用 |
| **询问用户** | `ask_user_question` 在任务中途暂停等待结构化用户输入；对话式提问模式适配无人值守 / 移动端 |
| **改前快照回退** | 轮首快照 + 写前备份让每次 AI 编辑都可撤销——在会话里选一个时间点，把文件恢复成当时的样子 |
| **安全门禁** | 工作目录外读写门禁：按 `PLANIFY_OUTSIDE_WORKDIR` 对目录外路径执行确认 / 放行 / 拦截 |
| **全端可用** | Lit PWA，浏览器打开即用；电脑手机同一应用，手机端完整重排版而非缩窄凑合 |
| **工作接力** | 关掉页面任务照跑（服务端续跑落库），回来自动接管现场；重开浏览器回到上次的目录、文件与会话 |
| **数据不出本机** | 索引、会话、记忆、备份、日志全在本地磁盘；检索完全离线，唯一外联是可替换的模型接口 |
| **可审计可带走** | 每一步留痕；会话可整份导出；系统自动做三份环形备份，数据坏了能找回 |
| **模型随插随换** | Anthropic 与 OpenAI 兼容双协议，国产模型填个地址即用；模型接口可指向内网或自建端点 |

## 知识库问答

| 能力 | 作用 |
|---|---|
| **基于知识库的提问** | 你问什么，它就去**工作目录**里找——Markdown、PDF、Word、PPT、Excel、代码、邮件档案，各种格式统一建索引；检索出相关片段后逐个深读原文，再**综合加工**成一段有出处的答案，而不是把命中片段直接拼给你。查不到就明说查不到，不拿 web 搜索的结果冒充你的文件 |
| **全库搜索** | 搜已索引文档的结构化节点（标题、类、函数、章节），结果锚在具体定义上 |
| **正则 grep** | ripgrep 扫全盘 + 已索引的 PDF / DOCX 正文，尚未建索引的文件也搜得到 |
| **五因子加权排序** | 关键词命中、文件名、FTS 分、标题、邻近度（词距跨度）；命中词挨得近的排前面 |
| **索引自动更新** | watchdog 实时监听文件变化（防抖合并），只重建改动过的文档，节点级比对内容哈希，其余跳过 |
| **启动补扫** | 补上离线期间的改动；重命名走指纹识别，原地改路径不重建 |
| **文档树索引** | 每篇文档存整棵节点树（标题、层级、行号范围、内容哈希），检索能定位到章节或函数 |
| **答案自带出处** | 回答末尾自动附「参考资料」，列出依据来自哪些文件 |

---

## 文件管理

浏览器里就是一个完整的文件管理器——不用切回终端。左侧目录树，右侧文件列表，所有操作就地完成。

| 能力 | 作用 |
|---|---|
| **目录树 + 面包屑** | 左树懒加载展开，点目录切列表；面包屑可一路回到工作目录根、盘符乃至「此电脑」 |
| **列表浏览** | 按名称 / 大小 / 修改时间三键排序（点击切换升降序，目录恒在前）；勾选累积多选、Shift 范围选、表头全选，批量移动与删除、拷贝路径；列宽与预览栏宽度可拖拽调整 |
| **文件操作** | 上传（拖拽到窗口任意处或走系统选择器）、下载、新建目录与空文件、单文件改名、多选移动（禁止移进自身或子目录）、删除（目录递归，禁止删根） |
| **语法高亮** | 预览与编辑都带高亮：编辑器按扩展名挂载语言包，覆盖 100 多种扩展名——Python / JS / TS / Rust / Go / Java / C / C++ / Ruby / Perl / Shell / SQL / HTML / CSS / JSON / YAML / TOML / Markdown 等等；预览页由 Pygments 按文件名自动识别语言，着色与编辑器一致 |
| **多格式预览** | 文本带语法高亮；PDF 原生渲染，可跳页、缩放、适宽并记住滚动位置；Office / rtf / epub / csv / 邮件档案合成 markdown 阅读；图片原图直看，可手动旋转 90° |
| **TOC 抽屉** | md / docx / epub 从标题提取带行号的目录，PDF 取原生书签；点击平滑跳转并高亮当前位置 |
| **md 编辑** | 预览页直接改文件——Markdown 与其它文本类文件都能改，CodeMirror 编辑器带语法高亮与查找，Ctrl+S 保存落盘，保存后自动重建索引；超过 5 MB 只读不编辑 |
| **未提交改动** | Git 仓库根下可看工作区相对 HEAD 的净改动，逐文件 diff 对照新旧 |
| **工作目录** | 工具栏「设为工作目录」可切到任意目录，切换前预检是否已有索引，最近用过的目录可一键回到；工作目录之外仍可浏览整机（盘符 / 家目录），但恒为只读、恒不建索引 |

---

## 安装

### 1. Windows 附加安装（为达到最好效果）

**Git Bash** —— agent 的 `bash` 工具跑在 Git Bash 上（Unix 语法，不是 WSL），装上后代码编辑、构建、git 操作都顺手：

```powershell
winget install -e --id Git.Git
```

装完从开始菜单打开 **Git Bash**，或在终端里执行 `bash` 进入。详见 [git-scm.com/install/windows](https://git-scm.com/install/windows)。

**PowerShell 7** —— 微软新一代跨平台终端，基于 .NET 构建，与 Windows 自带的 PowerShell 5.1 并存互不影响：

- **跨平台**：同一套命令在 Windows / Linux / macOS 上都能跑
- **快**：.NET 运行时，启动快、执行快
- **现代引擎**：更好的对象管道、更强的错误处理，`&&` / `||` 链式命令、`?>` 重定向等 Unix 风格语法原生支持
- **可扩展**：与 VS Code 深度集成，官方文档、终端复用、多标签页开箱即用

```powershell
winget install -e --id Microsoft.PowerShell
```

装完用 `pwsh` 启动（与系统自带的 `powershell` 5.1 共存，互不冲突）。详见 [微软官方安装文档](https://learn.microsoft.com/powershell/scripting/install/install-powershell-on-windows)。

---

### 2. 安装 Python 3.13

要求 Python ≥ 3.10，推荐 **3.13**（新特性与性能更好）。

**Windows**（用 winget，Win10/11 自带）：

```powershell
winget install -e --id Python.Python.3.13
```

或从 [python.org](https://www.python.org/downloads/) 下载安装包——**勾选 "Add python.exe to PATH"**。

**Linux（Ubuntu/Debian）**：

```bash
sudo apt update
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa   # 官方源里还没有 3.13
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3.13-dev
```

装完确认一下：

```bash
python3 --version   # Linux
python --version    # Windows
```

### 3. 安装 Doclens

```bash
pip install doclens
```

这一条命令装的是**整个应用**——不只是主包，索引引擎（treesearch）、AI Agent 框架（planify）、文档解析器、PDF 引擎、视觉模型运行时等依赖会一并装好，不需要再单独装别的东西。

**装完即可启动**——不需要额外的数据库、服务或 Docker。浏览器会自动打开 Web 界面，索引在后台自动构建（首次建索引需要一点时间，取决于文档量）。

### 4. 快速开始

**新开一个终端**（Windows 打开 PowerShell 7，Linux 打开 bash）——当前终端的 PATH 里可能还没有刚装好的 `doclens`，新开的窗口才会生效：

```powershell
# 先切到你想管理的目录（工作目录 = doclens 管理的那份文档和代码）
cd D:\your-project
```

然后启动：

```bash
doclens
# INFO: Uvicorn running on http://127.0.0.1:7860
```

浏览器会自动打开，索引在后台自动构建。

---

## 配置

绝大多数设置在 **设置页**里点鼠标就能改，改完即时生效。设置页有六个分区：**模型 / 搜索 / 网络 / MCP / 技能 / 其它**。

也可以直接编辑 `.env`（从工作目录读）：

```bash
cp doclens/.env.example .env
```

以下是设置页里出现的全部参数（未列出的变量请查 `doclens/.env.example`）。

**模型**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PLANIFY_ASK_MODE` | `interactive` | AI 需要你做决定时的提问形态：`interactive` 交互答题卡 / `chat` 对话式消息（无人值守、移动端适用） |
| `PLANIFY_OUTSIDE_WORKDIR` | `ask` | AI 工具访问工作目录外路径的处置：`ask` 每次确认 / `allow` 直接放行 / `block` 一律拦截 |
| `PLANIFY_THINKING_DEPTH` | `auto` | 推理深度：`auto` 模型默认（不传参，兼容一切端点）/ `off` / `low` / `medium` / `high`；恒思考模型拒绝 `off` |
| `CORTEX_FALLBACK_WINDOW_USED_PCT` | `80` | 兜底模型预检：套餐 5 小时窗口已用 ≥ 此百分比即跳过该候选 |
| `CORTEX_FALLBACK_BALANCE_MIN` | `10` | 兜底模型预检：账户余额低于此值（元）即跳过该候选 |
| `VISION_AUTO_ROTATE` | `false` | 上传图片在后台用视觉模型判断方向，歪斜时自动转正落盘 |
| `BAIDU_WEATHER_AK` | — | 百度地图开放平台 AK，供日记录入时抓取城市天气；留空则日记不带天气 |
| `JIMENG_API_KEY` | — | 火山方舟 API Key。配置后自动挂载即梦文生图工具（对话中可直接生成图片） |
| `JIMENG_MODEL` | `doubao-seedream-4-0` | 即梦默认模型 ID |
| `JIMENG_ACCESS_KEY` / `JIMENG_SECRET_KEY` | — | 火山引擎 AK/SK，仅用于查询账户余额；留空不显示余额 |

模型参数（base URL、模型 ID、API key、上下文窗口、输出上限）由 **模型预设** 管理，见下方各厂商接入参数。

**网络**（改动需重启）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CORTEX_WEB_HOST` | `127.0.0.1` | Web UI 绑定地址；`0.0.0.0` 暴露局域网（无鉴权，慎用） |
| `CORTEX_WEB_PORT` | `7860` | Web UI 端口（1–65535） |
| `CORTEX_MCP_ENABLED` | `false` | 是否启动内置 MCP HTTP server |
| `CORTEX_MCP_HOST` | `127.0.0.1` | MCP server 绑定地址；非环回须在 `.env` 配 `CORTEX_MCP_TOKEN` |
| `CORTEX_MCP_PORT` | `7880` | MCP server 端口（1–65535） |
| `CORTEX_SYNC_ENABLED` | `false` | 工作目录为 git 根时定期 auto-commit → pull → push |
| `CORTEX_WORKDIR` | — | 工作目录（未显式传 `-C` 时生效）；索引 / `.env` / 日志 / AI 工具都切到该目录 |

**其它**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PLANIFY_SHELL_TIMEOUT` | `120` | Shell 命令超时（秒） |
| `PLANIFY_MAX_TOOL_ROUNDS` | `0` | 主对话轮数上限；`0` = 不限 |
| `PLANIFY_MAX_SUBAGENT_ROUNDS` | `30` | 子代理轮数上限 |
| `PLANIFY_LLM_TRACE` | `0` | LLM trace 保留天数；`0` = 关闭 |
| `PLANIFY_INJECTION_ACK` | `false` | 注入通知回执；仅端点强制 user/assistant 严格交替时开启 |
| `CORTEX_MEMORY_DISABLE` | — | 关闭后对话不再注入长期记忆索引（记忆文件保留） |

**搜索**与 **技能** 两个分区不含散填字段：搜索参数（结果数、分数阈值、关键词邻近窗口、五项评分权重）由 **搜索预设** 管理，技能由 **技能管理** 管理。

**各厂商接入参数**（在设置 → 模型管理里建预设，填 base URL 与模型 ID 即可）：

| 厂商 | 协议 | Base URL | 模型 ID 从哪查 |
|---|---|---|---|
| 智谱 GLM | Anthropic | `https://open.bigmodel.cn/api/anthropic` | [模型概览](https://docs.bigmodel.cn/cn/guide/start/model-overview) |
| Kimi | Anthropic | `https://api.kimi.com/coding` | [模型列表](https://platform.kimi.com/docs/models) |
| MiniMax | Anthropic | `https://api.minimaxi.com/anthropic` | [模型总览](https://platform.minimax.io/docs/guides/models-intro) |
| DeepSeek | Anthropic | `https://api.deepseek.com/anthropic` | [模型 & 价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) |
| 阿里百炼（Qwen） | OpenAI 兼容 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | [选择模型](https://help.aliyun.com/zh/model-studio/models) |

---

## 更新

pip 装的直接升：

```bash
pip install -U doclens
```

然后**重启应用**（关掉终端里的进程，重新 `doclens`）——运行中的进程还是旧代码。

看当前版本：Web 界面右上角的用户菜单 →「关于」；或命令行 `pip show doclens`。

**你的配置和文档不会丢**：模型预设、访问密码、技能、MCP 服务器都存在用户目录（`~/.doclens/`）里，不在安装包内，升级不影响。索引也会自动重建。

**源码装的**（从 GitHub 克隆开发）：

```bash
git pull
pip install -e ".[dev]"
```

前端有改动时还要重新构建一次：

```bash
cd doclens/web_v2/frontend
npm install
npm run build      # 产物输出到 doclens/web_v2/static/
```

**升级到新版本后建议检查两件事**：个人助手页能否正常收发消息（模型端点协议可能有变动），以及设置页里的模型预设还在不在（预设存本机，不会丢，但端点若厂商下线需改 base URL）。

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

## License

Apache License 2.0——见 [LICENSE](LICENSE)。

## 联系方式

Lianghao —— zhlhao@163.com
