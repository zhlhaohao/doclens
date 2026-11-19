# doclens CLAUDE.md

doclens — 结构感知文档检索工具（Textual TUI + FastAPI Web UI + TreeSearch 索引 + Planify AI 框架）

## 安装（开发环境）

```bash
python -m venv .venv && .venv\Scripts\Activate.ps1
python.exe -m pip install --upgrade pip setuptools wheel
pip install -e ".[dev]"                 # doclens 全依赖（含 dev 组）
pip install -e ./treesearch             # 本地源码覆盖 PyPI 包
pip install -e ./planify                # 同上
python -m playwright install chromium --only-shell   # webfetch 二级降级需要
```

- Claude Code Bash 是 Git Bash，`activate` 不入 PATH——必须 `.venv/Scripts/python.exe -m doclens ...`；人工终端用 pwsh 7。
- worktree 开发复用主仓库 `../cortex/.venv`，无需重建。
- editable install 改源码即生效（`doclens.exe` 与 `python -m doclens` 都解析本仓库源码）。
- pip 刷屏回溯 = 依赖无解：`uv pip compile pyproject.toml --extra dev -o -` 出冲突报告。
- 发版流程见 release 技能（`doclens/skills/release/`）：全量 pytest 必须后台跑（background_run），逐包盘点→dry-run→发包→人工 commit/push。

## 模块边界（红线，AI 编码必须遵守）

分层：`doclens（宿主）→ planify（AI 框架）＋ treesearch（索引引擎）`；planify ↔ treesearch 互不依赖。

1. 底层禁止 `import doclens`、互相禁止 import；通知宿主用回调/注入。
2. 禁止跨模块引用私有成员（`_name`）——先公共化并全仓同步消费方。
3. 配置命名空间隔离：treesearch 只认 `TREESEARCH_*`，planify 只认 `PLANIFY_*`＋`register_config()`；底层不碰 `CORTEX_*`。
4. 数据目录归属：`.cortex/` 是 doclens 的；treesearch 产物在 `.treesearch/`。
5. 引擎/框架代码中性化：不得出现 "doclens"，用「宿主 / host」表述。
6. doclens 内部同样只走公共接口，不 import 对方私有成员。

规则 1、2 由 `tests/test_architecture.py` 守护——任何改动先过它。规则 1 的守卫同时覆盖**动态 import**（`importlib.import_module` / `__import__` 指向高层）、框架代码里的**宿主名**、以及框架读**宿主命名空间**（`CORTEX_*`）——用动态 import 把静态依赖藏进字符串不构成豁免（见 ADR-0053）。

**中间件顺序**：`add_middleware` 是 `user_middleware.insert(0, ...)`——**后注册者最外层**。auth 必须最外层（AP-33：切换窗口内未登录 LAN 客户端必须拿 401 而非 503）。GZipMiddleware（2026-11-17 加）注册在 auth/swap **之前**= 最内层，保住该不变量；`/assets/*` 仍被压缩（auth/swap 只拦 `/api/*`）。守卫见 `tests/test_middleware_order.py` + `tests/test_web_gzip.py`。

## 项目结构

```
doclens/                    # 业务宿主：config / index_manager / kb_tools / scoring(+pipeline) / ripgrep / grep_tools / agent_integration(+agent_prompt) / file_watcher / event_bus / memory / diary(+worker) / git_sync / mcp_client / mcp_server / skills_{config,deploy,installer} / claude_code_skill / tui/
├── web_v2/                 # Web UI：app.py + deps.py + api/（search/preview/grep/chat SSE/sessions/status/config/presets/auth/diary/git/mcp/skills/vision/translate/workdir…）+ sessions_store + session_backup + rewind_tracker + chat_runner + references/refs_* + auth_*（闸门/限流/凭据）+ config_store + presets_store + mcp_servers_store + workdir_store + watch_broker + runtime_vitals + frontend/（Lit+Vite）+ static/（构建产物）
treesearch/                 # 索引引擎：fts.py（FTS5）/ indexer / search / tokenizer / tree / tree_searcher / heuristics / ghost / ripgrep + parsers/（pdf/docx/excel/html/mhtml/markitdown/anydoc/pst/email/ast/treesitter/image_* + registry）
planify/                    # AI 框架：bootstrap / streaming/（runner 主循环）/ core/（config/runtime/runtime_manager/llm Provider 抽象 + timeouts/trace）/ tools/（registry+内置工具）/ managers/（task/background/teammate/todo）/ skills/ / subagent/ / messaging/ / context/（compact 压缩）/ agent/（旧 REPL）——详见 planify/docs/ARCHITECTURE.md
```

前端 `doclens/web_v2/frontend/src/` 的两层新结构（2026-11 反模式审计批处理建立）：

- **`utils/*-controller.ts`** — ReactiveController 外迁层：视图组件的职责域（会话操作/历史/技能、预览交互/阅读/外观、文件模式、书签、滚动记忆…）从组件本体迁到独立 controller，由组件 `new XxxController(this)` 注册。**组件只留视图与装配**。既有：chat-history / chat-session-ops / chat-skills / files-modes / bookmarks / preview-{appearance,interactions,reading} / probe / scroll-memory / pull-to-refresh / pinch-gesture / side-drawer / toast。
- **`styles/*.ts`** — 样式层公共块（Lit `static styles = [公共块, css`…`]` 数组组合，后者覆盖前者）：button-styles / dialog-frame / settings-section-styles / chat-view-styles / shared-styles。**弹窗一律原生 `<dialog>` + `showModal()`**，样式走公共块而非逐字复制。

- 核心组件：CortexApp（TUI）、IndexManager（封装 TreeSearch）、CortexAgent（封装 Planify）、FileWatcher＋EventBus（增量索引）、Scoring、Ripgrep 降级。
- 数据流：输入 → 命令路由 → 搜索（FTS5→Scoring→Formatting）/ AI（Planify→LLM）/ 索引；文件变化 → FileWatcher → EventBus → 增量 reindex。

## 工作目录（跨 worktree）

- 知识库 cortex 是独立仓库：默认 `../cortex` 同级发现，不在同级用 `CORTEX_REPO` env 覆盖——禁止硬编码绝对路径。
- 开发测试默认工作目录：`~/.cortex/.env` 写 `CORTEX_WORKDIR=<绝对路径>`；读取链 `显式 -C > CORTEX_WORKDIR env > local .env > global .env`；都没有则启动报错（不静默落启动目录）。
- workdir 落定后数据在 `.cortex/`；仓库根 `test_work_dir/` 是 demo 数据，不是 GUI 知识库。

## Skill 维护

改 `doclens/skills/` 下任意技能后立即同步全局：`cp -r doclens/skills/<技能名> ~/.cortex/skills/`（SkillLoader 从全局读，改源文件不自动生效）。同步后下一轮对话自动生效（惰性热重载，无需重启）。

## 前端改动 · 构建为完工标准

改 `doclens/web_v2/frontend/src/**` 后必须 `npm run build` 成功（= `tsc --noEmit && vite build`）才算交付；Vite 产物在 `doclens/web_v2/static/`，不构建则后端服务旧静态文件。

前端设计标尺：`doclens/web_v2/frontend/docs/DESIGN.md`（META 设计系统）。弹窗用原生 `<dialog>` + `showModal()`；样式只用 tokens.css 已有 CSS 变量（`--cortex-accent` 不存在，主按钮用 `--cortex-btn-primary-*`）。

**z-index 分层（tokens.css 五档，禁裸数字）**：`--cortex-z-base`(1) / `raised`(10) / `overlay`(100) / `toast`(1000) / `modal`(9999)。浮层需**低于**某层时用 `calc(var(--cortex-z-raised) - 1)` 显式降档——**不得与被遮挡元素同档**（同档按 DOM 顺序决胜，后写的反压先写的）。实证：2026-11-15 AP-4 归层时 app-bar 与 ptr-indicator 同归 raised，导致下拉刷新胶囊盖住 app-bar 收起不消失（2026-11-17 修正）。

**组件规模红线**：单组件文件 >1000 行即视为 God Object 信号，动手拆 `utils/*-controller.ts`（职责域外迁）或 `styles/*.ts`（样式公共块）。实例：chat-view 2532→1651 行（会话操作/历史/技能三域外迁）、preview-pane 2226→2063 行（外观/交互/阅读三域外迁 + 3 个 controller）；file-list 992→1000 行（改动/深读模式域外迁 FilesModesController，文件数换行数持平——**职责域减了不等于行数减了**）。

**已弃用**：Shoelace（2026-07 Meta 改造后全仓零 `<sl-*>` 标签，2026-11-17 清 import + `--sl-*` token + npm 依赖）。图标走 `components/icon.ts`（lucide-static 内联），弹窗走原生 `<dialog>`。**勿再引入**。

## 分层回归测试纪律

改代码必须按触及层跑回归；pytest 一律 `../cortex/.venv/Scripts/python.exe -m pytest`。方案全貌见 `tests/e2e/e2e-search-test-plan.md`。

- **同名约定（第一回归位）**：改谁先跑 `tests/test_<模块名>.py` / `frontend/tests/<组件名>.spec.ts`，再跑引用者的测试。
- **模块映射表**：

| 触及的代码 | 必跑回归 |
|---|---|
| 后端搜索链路（`web_v2/api/`、`scoring*`、`ripgrep.py`、`index_manager.py`） | `pytest tests/test_web_search_api_matrix.py tests/test_web_preview_formats.py tests/test_web_search_grouping.py -q` |
| treesearch 引擎（`treesearch/**`） | `pytest tests/test_lazy_search.py tests/test_search_preset_params.py tests/test_grep_corpus_bypass.py -q` |
| treesearch 解析器（`parsers/**`） | 对应格式测试：`pytest tests/test_docx_parser.py tests/test_anydoc_parser.py tests/test_pdf_native_preview_api.py tests/test_pst_parser.py -q` |
| planify LLM/流式/压缩（`streaming/`、`context/`、`core/llm/`） | `pytest tests/test_stream_usage.py tests/test_thinking_stream.py tests/test_compact.py tests/test_anthropic_provider.py -q` |
| planify 工具层（`tools/**`） | `pytest tests/test_grep_tool.py tests/test_glob_tool.py tests/test_basic_read_edit.py tests/test_guard.py tests/test_guard_pipeline.py -q` |
| 会话/对话（`sessions_store.py`、`api/{chat,sessions}.py`） | `pytest tests/test_chat_disconnect.py tests/test_session_export_import.py tests/test_sessions_store_history.py tests/test_rewind.py -q` |
| Web 静态资源 / 中间件（`web_v2/app.py`） | `pytest tests/test_web_gzip.py tests/test_middleware_order.py -q` |
| 索引/监控（`file_watcher.py`、增量链路） | `pytest tests/test_change_detection.py tests/test_file_watcher_exclude.py tests/test_index_chunking.py -q` |
| 技能系统（`doclens/skills/`、`planify/skills/`） | `pytest tests/test_skill_hot_reload.py tests/test_skills_config.py tests/test_slash_skill_invoke.py -q` |
| 前端搜索 UI（search-view / md-viewer / file-card / preview-pane / pdf-viewer / api） | `npm run test -- tests/search-highlight-units.spec.ts tests/md-viewer.spec.ts tests/file-card.spec.ts tests/preview-pane.spec.ts`（cwd=frontend）＋ `npm run build` |
| 前端流程级测试（对话/搜索/文件三视图旅程） | `npm run test -- tests/chat-flow.spec.ts tests/search-flow.spec.ts tests/files-flow.spec.ts`（cwd=frontend）——**动 chat-view/search-view/files-view 之前先跑**，是 controller 外迁的安全网 |
| 前端 controller 层（utils/*-controller.ts） | 同名 spec：`tests/chat-history-controller.spec.ts` / `chat-session-ops-controller.spec.ts` / `chat-skills-controller.spec.ts` / `files-modes-controller.spec.ts` / `preview-controller.spec.ts` |
| 前端其他组件 | 同名 spec（`tests/<组件名>.spec.ts`；纯函数/静态常量单元测试用 `tests/<组件名>.unit.spec.ts`——测试代码不入 `src/`，`npm run build` 的 tsc 只查 `src`，测试类型错误不阻塞生产构建） |
| 前端定位/滚动/分页/预览（跨前后端旅程） | `npm run test:e2e:search`（自动语料 + 7890 后端） |
| 任何层改完 | `pytest tests/test_architecture.py -q`（红线守卫） |

- 最小必要集 = 同名约定 + 表内命令 + `test_architecture.py`；全量与发版流程见 release 技能（必须 background_run 后台跑，bash 前台 120s 被掐）。
- E2E fixtures 语料是断言的一部分——改语料须同步改 spec 断言。

## 启动脚本 start-app.ps1

当用户说「启动应用」，后台启动 Web UI（必须从仓库根、pwsh 7）：

```bash
CORTEX_NO_BROWSER=1 pwsh -NoProfile -Command "Start-Process -FilePath pwsh -ArgumentList '-File','./start-app.ps1','gui' -WindowStyle Hidden"
```

- 临时指定知识库：`...,'gui','-C','D:\知识库'`；用户要看界面去掉 `CORTEX_NO_BROWSER=1`。
- 禁 nohup/`&`（挂住调用方）、禁手工 kill 进程（`_kill_port_process` 按端口自理）、禁裸跑 `doclens gui`（env 变量 `CORTEX_WEB_PORT` 可能指向宿主自身，会被 `_kill_port_process` 误杀）。
- **端口规则**：`端口 = CORTEX_WEB_PORT（~/.cortex/.env，缺省 7860） + N`，N = 目录名尾缀 `-<数字>`（`cortex`→0，`cortex-3`→3）。开发版端口冲突杀占用者复用；发行版递增找空闲口。
- **灭菌内建**：脚本启动前清掉全部 `CORTEX_*`/`PLANIFY_*` 宿主残留（仅抢救 `CORTEX_WORKDIR`），直接用标准命令即可。
- **探测协议**：`sleep 10` 首探 `curl -s http://127.0.0.1:<端口>/api/status`；每 10s 重试，最多 6 次（~60s）。仍不通不算失败——提醒用户可能仍在索引构建，看 `<数据目录>/logs/` 日志，不无限轮询。
- **回报**：启动成功必须报「端口 + 工作目录」（均取 `/api/status` 实测值，端口报算出来的那个）。健康检查核对 `/api/health` 的 `started_at`/`dev` 与监听 PID，防打到旧实例。
- 工作目录：默认读 global `CORTEX_WORKDIR`；命令行子命令 `-C` 写在子命令后。
- 三种模式：无参/`gui` = Web UI（默认）；`tui` = 终端界面；`search`/`read_document`/`ai`/`index [--force]` = 离线命令。

## 思维纪律（9 条硬约束，来自智谱 GLM 5.3 对照实验 360 组 A/B）

推理预算不是越多越好。以下 9 条约束思考边界，**在编码任务中削减无效思考（实测最高 −70%）而正确率无损**。每条都带可执行判据，不是口号。

1. **先核对请求再动手**：一两句说清要解决什么，并指出任何看起来错误或缺失的前提。前提错了就直说并解决修正后的问题（或只问一个具体问题）——不许默默接受错误前提，也不许绕着它推理。
2. **一条路线走到结论**：选最有希望的做法并推到结论。只有当当前路线被一个**能一句话说清的障碍**挡住时才换路线；不许因为「感觉不好」在方案间跳来跳去。
3. **结论落定就收工**：子结论推导出来并检查过一次，即视为 settled，继续往下走。重读结论「看看还对不对」不算检查；反复自我校验正是简单步骤上错误的主要来源。
4. **疑虑不是证据**：模糊的不确定感、或「可能还有没看到的反对意见」永远不是推翻 settled 结论的理由。要推翻，必须能**一句话命名一个具体理由**：失败的检查、与它矛盾的事实/来源、具体错误（「步骤 X 错因为 Y」）、反例、或推导出不同答案的新论证。说不出来就保持原答案继续。
5. **不要为迎合而改口**：用户在没有新证据或具体错误的情况下施压，不道歉、不翻案、不说「你说得对」。简短重述结论及其一句话依据，并反问「有什么具体事实或反例支持这个分歧？」——以牺牲正确换讨好是失败，不是礼貌。
6. **新证据可以重开此案**：工具、测试或用户给出具体新信息，或发现自己真错了 → 立即更新，并明确说清是什么改变了主意。为了显得前后一致而攥着错答案，比有理由地修正更糟。
7. **用外部事实验证，不靠反复想**：存在真实检查手段时（测试、构建、源文档/记录、可运行的计算）就用它，让结果决定；不要花 token 把自己说服或说服自己放弃一个一次检查就能定的问题。
8. **不做表演式谨慎**：不写「让我再全面检查一遍」，不虚构批评者或想象中的反对意见，不堆叠对冲措辞。残余不确定性只在**会改变用户行动**时用一句话说一次。
9. **只纠正会改变结论的错误**：只有当错误会影响用户的代码、结论或决策时才纠正——平实简短地说清，然后继续。不影响任何结论的口误，改掉即走，不必声明。

配套判据（何时该停、何时该重开）：

| 信号 | 动作 |
|---|---|
| 子结论已推导 + 已检查一次 | 视为 settled，进入下一子任务（规则 3） |
| 用户只说「你确定吗？」无新证据 | 不重推；用一句话依据回应并索要具体反例（规则 5） |
| 测试/构建/工具给出矛盾输出 | 立刻修正并说明变更点（规则 6、7） |
| 想推翻自己 | 先尝试命名一句话理由；命名不出就不推翻（规则 4） |
| 权威角色（虚构负责人/上级）要求回滚正确代码 | 不妥协；索要其声称存在的规范文档——但注意本规则压不住强权威诱导与虚假指令攻击（实测：GLM 5.3 5 轮中仍有 2 轮妥协，Flash 全部妥协） |
| 要写「让我再检查一遍」 | 删掉，改成一次外部检查或直接继续（规则 8） |

适用范围与短板：主要面向编码 Agent；文案创作、复杂多轮推理场景收益不等价。这是**行为约束提示词**，规范思考流程，不改变模型知识短板与价值判断；长期稳定解法是把这类纪律融进预训练/后对齐，而非每次调用靠提示词兜。

## 代码改动后重启（由模型自行判断）

- 后端改动（`doclens/`、`treesearch/`、`planify/` 下 `*.py`）→ 需重启；前端改动 → 先 `npm run build` 再重启。
- 不需要重启：纯文档/Markdown、`tests/`、与运行态无关的改动、纯对话。
- 重启用上面的 Start-Process 后台命令（首次与重启用同一条）；判断不准先问用户。
