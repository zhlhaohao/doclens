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
- 发包统一入口 `./publish-pypi.ps1 <treesearch|planify|doclens>`（pwsh 7，--dry-run 预演）；凭据在 repo 根 `.pypirc`（gitignored）；发行版依赖 PyPI 版本——改 `treesearch/**`/`planify/**` 不发版则发行版停旧版。

## 模块边界（红线，AI 编码必须遵守）

分层：`doclens（宿主）→ planify（AI 框架）＋ treesearch（索引引擎）`；planify ↔ treesearch 互不依赖。

1. 底层禁止 `import doclens`、互相禁止 import；通知宿主用回调/注入。
2. 禁止跨模块引用私有成员（`_name`）——先公共化并全仓同步消费方。
3. 配置命名空间隔离：treesearch 只认 `TREESEARCH_*`，planify 只认 `PLANIFY_*`＋`register_config()`；底层不碰 `CORTEX_*`。
4. 数据目录归属：`.cortex/` 是 doclens 的；treesearch 产物在 `.treesearch/`。
5. 引擎/框架代码中性化：不得出现 "doclens"，用「宿主 / host」表述。
6. doclens 内部同样只走公共接口，不 import 对方私有成员。

规则 1、2 由 `tests/test_architecture.py` 守护——任何改动先过它。

## 项目结构

```
doclens/                    # 业务宿主：config / index_manager / kb_tools / scoring(+pipeline) / ripgrep / grep_tools / agent_integration(+agent_prompt) / file_watcher / event_bus / memory / diary(+worker) / git_sync / mcp_client / mcp_server / skills_{config,deploy,installer} / claude_code_skill / tui/
├── web_v2/                 # Web UI：app.py + deps.py + api/（search/preview/grep/chat SSE/sessions/status/config/presets/auth/diary/git/mcp/skills/vision/translate/workdir…）+ sessions_store + session_backup + rewind_tracker + chat_runner + references/refs_* + auth_*（闸门/限流/凭据）+ config_store + presets_store + mcp_servers_store + workdir_store + watch_broker + runtime_vitals + frontend/（Lit+Vite）+ static/（构建产物）
treesearch/                 # 索引引擎：fts.py（FTS5）/ indexer / search / tokenizer / tree / tree_searcher / heuristics / ghost / ripgrep + parsers/（pdf/docx/excel/html/mhtml/markitdown/anydoc/pst/email/ast/treesitter/image_* + registry）
planify/                    # AI 框架：bootstrap / streaming/（runner 主循环）/ core/（config/runtime/runtime_manager/llm Provider 抽象 + timeouts/trace）/ tools/（registry+内置工具）/ managers/（task/background/teammate/todo）/ skills/ / subagent/ / messaging/ / context/（compact 压缩）/ agent/（旧 REPL）——详见 planify/docs/ARCHITECTURE.md
```

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
| 索引/监控（`file_watcher.py`、增量链路） | `pytest tests/test_change_detection.py tests/test_file_watcher_exclude.py tests/test_index_chunking.py -q` |
| 技能系统（`doclens/skills/`、`planify/skills/`） | `pytest tests/test_skill_hot_reload.py tests/test_skills_config.py tests/test_slash_skill_invoke.py -q` |
| 前端搜索 UI（search-view / md-viewer / file-card / preview-pane / pdf-viewer / api） | `npm run test -- tests/search-highlight-units.spec.ts tests/md-viewer.spec.ts tests/file-card.spec.ts tests/preview-pane.spec.ts`（cwd=frontend）＋ `npm run build` |
| 前端其他组件 | 同名 spec |
| 前端定位/滚动/分页/预览（跨前后端旅程） | `npm run test:e2e:search`（自动语料 + 7890 后端） |
| 任何层改完 | `pytest tests/test_architecture.py -q`（红线守卫） |
| 发版前（release / bump / tag / push 主分支） | 全量 `pytest tests/ -q` |

- 最小必要集 = 同名约定 + 表内命令 + `test_architecture.py`；全量归发版前。
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

## 代码改动后重启（由模型自行判断）

- 后端改动（`doclens/`、`treesearch/`、`planify/` 下 `*.py`）→ 需重启；前端改动 → 先 `npm run build` 再重启。
- 不需要重启：纯文档/Markdown、`tests/`、与运行态无关的改动、纯对话。
- 重启用上面的 Start-Process 后台命令（首次与重启用同一条）；判断不准先问用户。
