# doclens 配置参数说明

> 生成日期：2026-10-24 · 对应代码：`doclens/config.py`（CortexConfig）、`doclens/.env.example`、planify/treesearch 各自的 env 消费点。
>
> **配置加载链**：进程环境变量 > 启动目录 `<数据目录>/.env`（local）> 全局 `~/.cortex/.env`（开发）或 `~/.doclens/.env`（发行版）。首次运行自动从包内 `.env.example` 引导创建全局 `.env`。
>
> **前缀约定**：`CORTEX_*` 归 doclens 宿主；`PLANIFY_*` 归 planify（AI 框架层）；`TREESEARCH_*` 归 treesearch（索引引擎层）；`VISION_*` 视觉模型；`BAIDU_*` 天气 API。doclens 的 `.env` 对非 CORTEX_ 前缀键兼容共存（extra=ignore）。
>
> **单位口径**（2026-10-24 统一）：当量词 = 非 CJK 词计 1、CJK 字计 0.5（1 英文词 ≈ 2 汉字）；标注「字符」的参数是物理保险丝或显示用途。

---

## 目录

1. [Web / MCP 监听](#1-web--mcp-监听)
2. [日志](#2-日志)
3. [AI 对话（LLM）](#3-ai-对话llm)
4. [AI 工具与 Agent 行为](#4-ai-工具与-agent-行为)
5. [视觉模型（图像解析）](#5-视觉模型图像解析)
6. [PDF 翻译](#6-pdf-翻译)
7. [搜索与 KB 工具预算](#7-搜索与-kb-工具预算)
8. [评分权重](#8-评分权重)
9. [索引与解析](#9-索引与解析)
10. [文件监控 / Git 同步](#10-文件监控--git-同步)
11. [TUI 终端显示](#11-tui-终端显示)
12. [运行目录与模式](#12-运行目录与模式)
13. [其他宿主键](#13-其他宿主键)

---

## 1. Web / MCP 监听

GUI（FastAPI + uvicorn）与 MCP server 的网络监听。**改 host/port 需重启 gui 才生效**。

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_WEB_HOST` | `127.0.0.1` | Web UI 绑定地址。`0.0.0.0` 暴露局域网；**非环回地址将启用密码登录闸门**（需先在设置页设密码） | `web_v2/app.py`、`web_v2/deps.py` |
| `CORTEX_WEB_PORT` | `7860` | Web UI 端口（1-65535）。CLI 优先级：`--port` 参数 > 本 env > `.env` | `web_v2/app.py`、`start-app.ps1`（按 worktree 目录名尾缀 +N 分配多实例端口） |
| `CORTEX_WEB_PASSWORD_HASH` | 空 | Web UI 访问密码哈希（格式 `iterations$salt_hex$hash_hex`）。**勿手工编辑**——由设置页 `/api/auth/password` 或 `cortex auth reset` 维护；空 = 未设密码 | `web_v2/api/auth.py` |
| `CORTEX_MCP_ENABLED` | `false` | TUI/GUI 启动时自动拉起进程内 MCP HTTP server（Streamable HTTP），可在设置页开启 | `mcp_server.py`、`web_v2/deps.py` |
| `CORTEX_MCP_HOST` | `127.0.0.1` | MCP server 绑定地址；非环回地址时**必须**配 `CORTEX_MCP_TOKEN` | `mcp_server.py` |
| `CORTEX_MCP_PORT` | `7880` | MCP server 端口 | `mcp_server.py` |
| `CORTEX_MCP_TOKEN` | 空 | MCP bearer token；host 非环回时必填 | `mcp_server.py` |

## 2. 日志

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_LOG_LEVEL` | `INFO` | 文件日志级别：`INFO` / `DEBUG`（全量，排障临时开）/ `WARNING` / `ERROR` / `CRITICAL`。非法值回落 INFO；改后需重启 | `planify/core/logging_config.py`（宿主注入） |
| `CORTEX_LOG_DIR` | 空（默认 `{工作目录}/<数据目录>/logs`） | 日志目录覆盖。移出被监控的知识库目录可让日志写入不产生文件事件（运维项） | `planify/core/logging_config.py` |

日志文件名 `debug_YYYYMMDD.log`，日期为**应用启动日**（跨天常驻进程继续写启动日文件）。

## 3. AI 对话（LLM）

主对话模型的连接与行为。设置页「模型」tab 可视化配置；预设（preset）激活会物化覆盖这些键。

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_ACTIVE_LLM_PRESET` | 空 | 当前激活的 LLM 预设名（设置页一键切换时写入；激活预设会物化覆盖下面四个连接键） | `web_v2/api/presets.py`、`presets_store.py` |
| `PLANIFY_PROTOCOL` | 空 | LLM 协议：留空/`openai_compat` = OpenAI 兼容端点；`anthropic` = Anthropic 格式（含 prompt caching） | `planify/core/llm/factory.py`、`presets.py` |
| `PLANIFY_BASE_URL` | 空 | LLM API 端点 URL | `planify/core/llm/presets.py` |
| `PLANIFY_MODEL_ID` | 空 | 模型 ID（如 `glm-5.3`、`deepseek-chat`） | 同上 |
| `PLANIFY_API_KEY` | 空 | API Key（**凭据，GET 接口脱敏返回**） | 同上 |
| `PLANIFY_CONTEXT_WINDOW` | `200000` | LLM 上下文窗口（tokens）。**自动压缩阈值 = 该值 × 0.8** | `planify/context/compact.py` |
| `PLANIFY_MAX_TOKENS` | `8000` | LLM 单次响应最大输出 tokens，主代理与子代理共用。模型支持更长输出（32k/64k）时建议调大，否则子代理摘要易截断 | `planify/streaming/runner.py`、`subagent/runner.py` |
| `PLANIFY_THINKING_DEPTH` | `auto` | 思考深度档位：`auto`（不发思考参数，兼容一切端点）/ `off` / `low` / `medium` / `high`。OpenAI 端映射 `reasoning_effort`；Anthropic 端映射 `thinking{budget_tokens}`。**保存即热生效**（重建 Provider）；恒思考模型会拒绝 `off` | `planify/core/llm/{anthropic,openai_compat}_provider.py` |
| `CORTEX_LLM_VISION` | `false` | 当前对话 LLM 是否支持视觉（能力位，ADR-0034）。由 LLM 预设 activate 物化；false 时带图消息前端拦截引导切换 | `doclens/config.py`、前端 chat 视图 |
| `CORTEX_CHAT_DISCONNECT_CONTINUE` | `true` | SSE 断开续跑（ADR-0028）：true = 消费端断开（关页/断网）后台继续跑完本轮并落库；false = 断开即停（省 token）。主动点停止不受影响 | `web_v2/chat_runner.py`、`api/chat.py` |

## 4. AI 工具与 Agent 行为

Agent 工具集与交互行为的开关（planify 层）。

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `PLANIFY_SHELL_TIMEOUT` | `120` | bash/powershell/background_run 前台命令超时（秒，上限 3600）。**调用期现读 → 保存即热生效**。长命令的正道是 `background_run` + `check_background`，而非调大本值 | `planify/tools/basic.py`、`background_manager.py` |
| `PLANIFY_MAX_TOOL_ROUNDS` | `0`（不限） | 单轮问答工具调用轮数上限：软阈值 = 本值 70%（超过后每轮注入停止提醒）；达到后强制终答。0 = 不限（默认，仅保留同参死循环提醒） | `planify/streaming/runner.py` |
| `PLANIFY_MAX_SUBAGENT_ROUNDS` | `30` | task 子代理轮次预算：将尽（剩约 1/6）注入收尾提醒，跑满未收尾则摘要带 `[round-limit-reached]` 截断标记；连续 3 轮同参调用注入死循环提醒 | `planify/subagent/runner.py` |
| `PLANIFY_INJECTION_ACK` | `false` | 后台结果/收件箱通知插入后是否补合成 assistant 回执（用于强制 user/assistant 严格交替的端点）。**thinking 模式端点（DeepSeek/GLM 等）必须保持 false**——请求以 assistant 结尾会返回 400 | `planify/streaming/runner.py`、`messaging/` |
| `PLANIFY_ENABLED_TOOLS` | 空（全部注册） | 工具白名单（逗号分隔）。GUI 模式下 `ask_user_question` 是唯一用户交互通道，即使漏列也会强制保留 | `planify/tools/registry.py` |
| `PLANIFY_DISABLED_TOOLS` | 空（不屏蔽） | 工具黑名单（逗号分隔）。与白名单同时设置时黑名单优先（先按白名单保留再剔除） | `planify/tools/registry.py` |
| `PLANIFY_OUTSIDE_WORKDIR` | `ask` | 外部访问门禁（ADR-0021，仅 GUI 链路）：AI 工具读写工作目录以外路径的处置。`ask` = 弹安全确认卡片（本会话按目录授权，读/写分账）；`allow` = 直接放行；`block` = 直接拦截。子代理/后台线程无交互渠道，未授权一律 block（fail-closed） | `planify/tools/guard.py`、`guard_pipeline.py` |
| `PLANIFY_ASK_MODE` | `interactive` | 提问模式（ADR-0033）：`interactive` = 弹交互答题卡阻塞等待（300s 超时）；`chat` = 对话式提问（问题作为普通消息送达并结束回合，适合无人值守/移动端）。每次调用重读 env，保存即生效 | `planify/tools/user_interaction.py` |
| `PLANIFY_LLM_TRACE` | `0`（关） | LLM 追踪落盘（调试/算缓存命中率）：>0 = 保留天数。每次 LLM 调用的实发请求体与实收原生响应追加到 `{工作目录}/.planify/llm_trace/<日期>-<会话id>.md`。改后需重启 | `planify/core/llm/`（tracer） |
| `PLANIFY_LLM_TRACE_DIR` | 空（默认 `.planify/llm_trace/`） | LLM trace 输出目录覆盖 | 同上 |
| `CORTEX_MEMORY_DISABLE` | 空（启用） | 长期记忆整体关停（ADR-0042）：`1`/`true` = 不注入记忆索引、不建库。每次构造 agent 现读，保存即热生效 | `doclens/memory.py` |

## 5. 视觉模型（图像解析）

图像文件解析索引用的独立模型配置（OpenAI-compat / Anthropic 格式），与 AI 对话的 `PLANIFY_*` 互不影响。

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_ACTIVE_VISION_PRESET` | 空 | 当前激活的视觉预设名 | `presets_store.py`、`api/presets.py` |
| `VISION_PROTOCOL` | 空（OpenAI-compat） | 视觉模型协议：留空 = `/chat/completions` + image_url；`anthropic` = `/v1/messages` + image source | `image_orienter.py`、视觉 worker |
| `VISION_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 视觉模型端点（默认阿里百炼） | 同上 |
| `VISION_MODEL` | `qwen-vl-max` | 视觉模型 ID | 同上 |
| `VISION_API_KEY` | 空 | 视觉模型 API Key；为空时图像只进占位节点（文件名可搜索）（**凭据，脱敏返回**） | 同上 |
| `VISION_AUTO_ROTATE` | `false` | 上传图片后台视觉判向自动转正（ADR-0017）。opt-in：每张上传图消耗一次视觉 API 调用，且要求已配 `VISION_API_KEY` | `image_orienter.py`、`diary_worker.py` |

## 6. PDF 翻译

PDF 翻译预设体系（ADR-0039），设置页「翻译」tab 配置。

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_ACTIVE_TRANSLATE_PRESET` | 空 | 激活的翻译预设名（按名匹配 presets_store） | `translate_service.py` |
| `CORTEX_TRANSLATE_SERVICE` | `google` | 翻译服务（google / openai 兼容等） | `translate_service.py` |
| `CORTEX_TRANSLATE_MODEL` | 空 | 翻译模型 ID | 同上 |
| `CORTEX_TRANSLATE_ENVS` | 空 | 服务凭证 envs JSON（**凭据，脱敏返回**） | 同上 |
| `CORTEX_TRANSLATE_LANG_OUT` | 空 | 默认目标语言 | 同上 |

## 7. 搜索与 KB 工具预算

search_kb / kb_grep / read_document 及 rg 降级链路的预算体系。除标注外均为**当量词**口径（非 CJK 词 1、CJK 字 0.5）。预设（search preset）可整体覆盖本节参数。

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_ACTIVE_SEARCH_PRESET` | 空 | 激活的搜索预设名 | `presets_store.py` |
| `CORTEX_MAX_RESULTS` | `50` | search_kb 单次显示的最大结果条数 | `kb_tools.py`（`_format_kb_results`） |
| `CORTEX_TOP_K_DOCS` | `100` | 参与评分的候选文档池上限（路由阶段最多选多少文档；命中池外的文档不进结果） | `index_manager.py` → treesearch 引擎 |
| `CORTEX_MAX_NODES_PER_DOC` | `1000` | 单文档参与评分的节点数上限 | `index_manager.py` → treesearch |
| `CORTEX_MIN_SCORE_THRESHOLD` | `0.3` | 综合评分阈值，低于此值的搜索结果被过滤（全库候选为空时兜底放宽为命中≥1 词） | `kb_tools.py`、`scoring.py` |
| `CORTEX_MAX_SPAN` | `50` 当量词 | 关键词紧密度（proximity）判定半径：词间距离超过此值不算紧邻。= 中文 100 字 / 英文 50 词 | `scoring.py` |
| `CORTEX_SEARCH_CONTEXT_BEFORE` | `200` 当量词 | 搜索结果片段窗口·锚点前宽度。**全链路统一窗口**（search_kb / kb_grep / rg 降级 / TUI，2026-10-24 收敛） | `kb_tools.py`、`grep_tools.py`、`ripgrep.py` |
| `CORTEX_SEARCH_CONTEXT_AFTER` | `600` 当量词 | 片段窗口·锚点后宽度（后窗大：命中点后常是答案所在） | 同上 |
| `CORTEX_MAX_TOTAL_WORDS` | `10000` 当量词 | search_kb 结果总预算（所有显示条目的当量词累计上限）。约可显示 10-15 条满窗口结果 | `kb_tools.py` |
| `CORTEX_GREP_MAX_TOTAL_WORDS` | `10000` 当量词 | kb_grep 结果总预算（同上口径） | `grep_tools.py` |
| `CORTEX_MAX_CONTEXT_CHARS_PER_RESULT` | `6400` **字符** | 单条结果摘录的字符兜底（保险丝）：防超长无空白段（URL/minified 代码按切词规则是一个词）炸穿词窗口。默认 (200+600)×8 与词窗口同量级 | `kb_tools.py`（`_extract_keyword_window`） |
| `CORTEX_GREP_MATCH_MAX_CHARS` | `2000` **字符** | grep 正则匹配体硬上限（保险丝）：防贪婪正则（如 `[\s\S]*`）把整篇文档灌进单条结果。高级项，仅 env 可调 | `grep_tools.py`、treesearch `fts.py`（`SNIPPET_MATCH_MAX_CHARS`） |
| `CORTEX_GREP_MAX_RESULTS` | `50` | kb_grep 最大返回结果条数 | `grep_tools.py` |
| `CORTEX_GREP_SCORE_THRESHOLD` | `0.0` | grep 结果分数下限（0 = 不过滤） | `grep_tools.py` |
| `CORTEX_MAX_READ_WORDS` | `4000` 当量词 | read_document 单次输出预算（= 中文 8000 字 / 英文 4000 词）；超出截断并提示用 `file_info`/`start_word`/`end_word` 续读。离散词序号 API 语义不变 | `kb_tools.py`（read_document） |
| `CORTEX_READ_DOC_SHOW_TOC` | `false` | read_document 是否输出文档目录结构（默认关，省 token） | `kb_tools.py` |
| `CORTEX_MIN_KEYWORDS_PER_LINE` | `2` | grep 行摘要：行内最少命中词数（低于此值的行不作为锚点行） | `grep_tools.py` |

> 注：编程用 `grep` 工具（planify/tools/grep.py）是 rg 原生行口径（`-B/-A/-C`），不消费以上任何参数；旧 `CORTEX_RG_CONTEXT_BEFORE/AFTER` 已于 2026-10-24 删除（降级链路统一词窗口）。

## 8. 评分权重

五因子加权平均（只有相对比例起作用，0 = 禁用该因子）。搜索预设可覆盖。

| 参数 | 默认值 | 因子 | 涉及模块 |
|---|---|---|---|
| `CORTEX_WEIGHT_KEYWORD_MATCH` | `4.0` | 关键词命中率（节点文本命中的 query 词占比）——主导因子 | `scoring.py`（`compute_composite_score`） |
| `CORTEX_WEIGHT_FILE_NAME_MATCH` | `2.0` | 文件名匹配 | 同上 |
| `CORTEX_WEIGHT_FTS_SCORE` | `2.0` | FTS/BM25 引擎分（五因子里唯一带 IDF 感知；2026-10-23 由 1.0 提至 2.0 并卸 sigmoid 直传全局 max 归一分） | `scoring.py`、treesearch `fts.py` |
| `CORTEX_WEIGHT_TITLE_MATCH` | `2.0` | 节点标题匹配 | `scoring.py` |
| `CORTEX_WEIGHT_PROXIMITY_MATCH` | `1.0` | 关键词紧密度（词间距离 ≤ `MAX_SPAN` 的命中对比例） | `scoring.py` |

## 9. 索引与解析

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_ALLOWED_SOURCE_TYPES` | `markdown,text,csv,pdf,doc,docx,rtf,pptx,ppt,excel,html,image,pst,epub` | 允许索引的文件类型（逗号分隔；**空 = 全部允许**）。`html` 含 .mhtml/.mht；`pst` 经 sidecar 解包；`ppt/rtf/epub` 走 anydoc | `config.py`（透传 TreeSearchConfig） |
| `CORTEX_CJK_TOKENIZER` | `jieba` | 中日韩分词器：`jieba` / `bigram` / `char` / `auto`。注意 doclens 链路只认 `CORTEX_` 前缀（treesearch 原生 `TREESEARCH_CJK_TOKENIZER` 在 doclens 内不生效，索引配置由宿主统一注入） | `treesearch/tokenizer.py` |
| `CORTEX_MAX_INDEX_FAIL_COUNT` | `3` | 同一文件连续解析失败 N 次后永久跳过 | `index_manager.py` |
| `TREESEARCH_ENABLE_SHADOW_MD` | `false` | 二进制文件影子 Markdown：为 PDF/DOCX 等生成隐藏 `.md` 副本供 rg 降级搜索命中。doclens 默认关闭（提速索引）；treesearch 独立 CLI 原生默认开启 | `treesearch/indexer.py` |
| `TREESEARCH_MAX_DIR_FILES` | `0`（不设限） | 单目录遍历文件数上限（防误扫巨型目录）。**⚠️ 0 = 不设限**；设限后 >上限 的目录启动索引报 ValueError | `treesearch/pathutil.py` |
| `TREESEARCH_INDEX_CHUNK_SIZE` | `500` | 分块索引块大小（文件数）：每块「解析→落库→释放」循环，百万级语料内存峰值 = 单块（ADR-0018）。**⚠️ 0 = 不分块（旧行为全量攒内存）——与上一条 0=不设限有意相反** | `treesearch/indexer.py` |
| `TREESEARCH_XLSX_MAX_ROWS_PER_SHEET` | `10000` | Excel 每 sheet 最多索引行数（超出即停） | `treesearch/parsers/excel_parser.py` |
| `TREESEARCH_XLSX_MAX_CONSECUTIVE_EMPTY_ROWS` | `100` | Excel 连续空行容忍数（超出即停） | 同上 |
| `TREESEARCH_PST_EXTRACT` | 空（包内 `_bin/`） | PST 邮件解析 sidecar（pst-extract）可执行文件路径覆盖 | `treesearch/parsers/pst_parser.py` |

## 10. 文件监控 / Git 同步

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_WATCH_ENABLED` | `true` | 文件监控（watchdog）开关：检测知识库目录变化自动增量索引 | `file_watcher.py` |
| `CORTEX_WATCH_DEBOUNCE` | `5.0` 秒 | 文件事件防抖间隔 | `file_watcher.py` |
| `CORTEX_SYNC_ENABLED` | `false` | 知识库 Git 自动同步（ADR-0006，opt-in）：开启后每轮自动 commit → pull → merge(偏向本地) → push，并自动写 `.gitignore`/`.gitattributes`。仅 GUI 进程运行，且要求工作目录是 git 根 + 有 remote。**改后需重启 gui** | `git_sync.py` |
| `CORTEX_SYNC_INTERVAL_MINUTES` | `5.0` 分钟 | Git 同步轮询间隔（>0） | `git_sync.py` |

## 11. TUI 终端显示

仅命令行/TUI 模式生效，GUI 不受影响。

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_TITLE_WIDTH` | `55` | 标题截断宽度（字符） | `formatting.py` |
| `CORTEX_LINE_WIDTH` | `78` | 终端行宽（字符） | `formatting.py` |
| `CORTEX_MAX_CONTEXT_LINES` | `5` | 搜索结果片段最多显示行数 | `formatting.py` |
| `CORTEX_MAX_ANCHOR_LINES` | `3` | 锚点行数 | `formatting.py` |
| `CORTEX_CONTEXT_EXPAND_RANGE` | `5` | 上下文扩展行数 | `formatting.py` |

## 12. 运行目录与模式

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `CORTEX_WORKDIR` | 空（按启动目录） | 工作目录覆盖（次优先级，仅在未显式传 `-C` 时生效）：进程启动时切换到该目录，索引/.env/日志/门禁基准全部跟随。读取顺序：进程 env > 启动目录 `<数据目录>/.env` > 全局 `.env`；只跳转一次。**改后需重启；目录不存在会启动失败** | `config.py`（`resolve_workdir_override`）、`cortex_cli.py` |
| `CORTEX_DATA_DIRNAME` | 自动判定 | 数据目录名强制覆盖（高级用户）：默认开发模式 `.cortex`、发行模式 `.doclens`（按 venv/site-packages 判定）。外部残留值会打 stderr 警告 | `config.py`（`data_dirname`） |
| `CORTEX_LOG_LEVEL` | `INFO` | 见第 2 节 | — |

## 13. 其他宿主键

| 参数 | 默认值 | 用途 | 涉及模块 |
|---|---|---|---|
| `BAIDU_WEATHER_API_URL` | `https://api.map.baidu.com/weather/v1/` | 百度天气 API 端点（日记天气） | `planify/tools/baidu_weather.py` |
| `BAIDU_WEATHER_DATA_TYPE` | `fc` | 天气数据类型（预报） | 同上 |
| `BAIDU_WEATHER_AK` | 空 | 百度地图 API Key（**凭据，脱敏返回**；空 = 日记不带天气，不阻断） | 同上 |

---

## 附：配置文件位置与生效方式速查

| 位置 | 路径 | 说明 |
|---|---|---|
| 全局配置（开发） | `~/.cortex/.env` | 所有项目共享 |
| 全局配置（发行版） | `~/.doclens/.env` | wheel 安装模式 |
| 项目级配置 | `{工作目录}/.cortex/.env`（开发）/ `.doclens/.env`（发行） | 覆盖全局（local > global） |
| 进程环境变量 | — | 最高优先级 |
| 设置页 | Web UI「设置」 | 写回 .env（经 config_store 进程级锁安全写入） |

**热生效**（保存即生效，无需重启）：`PLANIFY_SHELL_TIMEOUT`、`PLANIFY_MAX_TOOL_ROUNDS`、`PLANIFY_MAX_SUBAGENT_ROUNDS`、`PLANIFY_THINKING_DEPTH`、`PLANIFY_ASK_MODE`、`CORTEX_MEMORY_DISABLE`。
**需重启**：Web/MCP 监听、`CORTEX_LOG_LEVEL`、`CORTEX_WORKDIR`、`CORTEX_SYNC_ENABLED`、`PLANIFY_LLM_TRACE` 及其余未标注项。

**凭据类**（GET 接口脱敏 `***`，PUT 占位符跳过）：`PLANIFY_API_KEY`、`VISION_API_KEY`、`BAIDU_WEATHER_AK`、`CORTEX_TRANSLATE_ENVS`、`CORTEX_WEB_PASSWORD_HASH`（不进设置页白名单）。
