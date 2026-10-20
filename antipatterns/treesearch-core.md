# treesearch 核心模块 反模式审计台账

> 审计日期：2026-10-20｜点名范围：`treesearch/` 核心（16 个 `.py`，约 6,019 行；**不含 `treesearch/parsers/`**——该目录已有独立台账 `antipatterns/treesearch-parsers.md`）｜机械扫描：全仓（treesearch→doclens/planify 反向 import、跨文件私有成员 import、行数 top、裸 except、可变默认参数、模块级可变状态、print/logger 混用、同名/同值常量重复、`async def` 内同步重活）

## 一、判据声明

- **栈清单**：`references/backend.md`（复检日期 2026-10-20）。本次装载小节：Python 语言层、SQLite / FTS5；Web 框架层与 Pydantic 节未命中（scope 内无路由/模型代码）。复检检索词：`Python asyncio blocking event loop anti-patterns`、`SQLite FTS5 common mistakes performance pitfalls`——结果为既有共识文章（sqlite.org/fts5、refactoring.guru、asyncio 阻塞循环讨论），无需要新增的判据，附件未更新。
- **通用兜底**：`references/general.md` 系统架构层 + 后端模块层（按 SKILL.md 硬约束，该域两节原样装载不裁剪）。
- **仓库纪律附加判据**：根 `CLAUDE.md`「模块边界规则」——treesearch 不得 import doclens/planify（机械扫描：**零命中**，合规）；跨文件不得 import 下划线私有成员（core 内 3 处，见 AP-10）；treesearch 只认 `TREESEARCH_*` env（机械扫描：core 直接读环境变量仅 `config.py`，全部 `TREESEARCH_*`，合规）；产物归属 `.treesearch/`（CLI/watch 默认值有张力，见 AP-16）。
- **架构守卫**：`../cortex/.venv/Scripts/python.exe -m pytest tests/test_architecture.py -q` → **5 passed**。
- **探测到的栈**：Python 3 + SQLite/FTS5 + asyncio + subprocess(rg) + watchdog；纯后端库，无前端域，未启动前端分析。

## 二、发现条目

### AP-1 abatch_search 把 `(changed, has_orphans)` 元组当列表用，batch 搜索的正常增量路径必然走错 [P1] [status: pending]
- **形态**：Shotgun Surgery（复制漂移）+ 真实 bug（`asearch` 的正确实现被手工抄成另一份时漏掉解包）
- **证据**：
  - 正确版 `treesearch/treesearch.py:244`：`changed, has_orphans = self._get_changed_files(stored_meta=stored_meta)`。
  - 漂移版 `treesearch/treesearch.py:404-410`：`changed = self._get_changed_files(...)`（漏解包）→ `if not changed:` 对非空元组恒为假；`len(changed)` 恒为 2；`await self.aindex(*changed)` 把 `(list, bool)` 展开成 `aindex(paths=[...], force=True/False)` 之外的错位实参（第二位置参数是 `force`，bool 恰好顶替，但第一参数变成“list 的 list”）。
  - `_get_changed_files` 的返回契约明写在 `treesearch.py:123-128`（tuple）。
- **风险**：任何 `TreeSearch(paths, db_path=...)` 之后直接 `batch_search()`（库 docstring 演示的典型用法）在“DB 已存在且有待索引文件”时：缓存命中分支永不生效，总会触发一次以嵌套 list 为路径的 reindex，最轻是空转 + 丢弃缓存，最重是 `resolve_paths` 抛异常使整次 batch 搜索失败。doclens 当前走 lazy 路径（`_lazy_search=True`）未踩中，但 `treesearchlib` 已作为公开包发布，属对外契约缺陷。
- **修复方案**：把 `asearch` 与 `abatch_search` 的“加载缓存 → 校验变更 → 增量重建 → 清 pending”抽成单一私有协程 `_ensure_documents_loaded()`，两处调用（顺带消除 AP-5）；在 `abatch_search` 中按 `changed, has_orphans = ...` 解包并复用 orphan 分支语义。契约变更：无（行为向 `asearch` 对齐）。
- **回归验证**：新增单测覆盖“已有 DB + pending_paths + 一个文件被修改”的 `batch_search`；`../cortex/.venv/Scripts/python.exe -m pytest tests/test_lazy_search.py tests/test_index_chunking.py tests/test_architecture.py -q`。

### AP-2 TreeSearch 构造就地改写全局配置，叠加全局 FTS 单例 → 多实例串库/连接互关 [P2] [status: pending]
- **形态**：全局可变单例当传参通道（Action at a Distance）
- **证据**：
  - `treesearch/treesearch.py:96` 实例直接持有全局 `get_config()` 对象；`:102-103` 在构造时**就地写** `self.config.fts_db_path = db_path`——改的是进程级单例。
  - 打分路径全部从全局配置取 DB：`treesearch/search.py:587/613/641/1012` 用 `cfg.fts_db_path`；`tree_searcher.py:154` 同。
  - `treesearch/fts.py:2645-2660` 的 `get_fts_index()` 在 `db_path` 变化时 `close()` 当前全局实例再重建——若另一实例/线程仍持有旧连接，直接被关（`sqlite3.ProgrammingError` 或空结果）。
  - `config.py:71-72` 注释自证该单例是宿主注入通道（`set_config()`）。
- **风险**：同一进程内 `TreeSearch(db_path=A)` + `TreeSearch(db_path=B)` 时，B 的 search 的打分阶段读 A 的 FTS 库（且 A 的路径先写入后 B 不会覆盖，因为 `not self.config.fts_db_path` 守卫）；并发搜索不同库时会互相关闭连接。现有测试靠每例 `set_config(TreeSearchConfig())` 重置规避（`tests/test_lazy_search.py:46`、`tests/test_web_search_api_matrix.py:27`），说明契约本身脆弱。
- **修复方案**：`TreeSearch.__init__` 不再写全局 config；把实际 db_path 作为实例字段显式传给 `search()`/`TreeSearcher`/`score_nodes_batch` 的调用链（或引入 per-instance config 副本）。`get_fts_index` 改为按 `db_path` 键控的 registry，且引用计数 >0 时不 close。契约变更：是（评分链新增显式 db_path 参数，内部接口）。
- **回归验证**：新增“同进程两个不同 db_path 实例交替搜索”单测；`tests/test_lazy_search.py tests/test_web_search_api_matrix.py tests/test_index_chunking.py tests/test_architecture.py`。

### AP-3 FTS5Index God Object（2,320 行、71 个方法、6 类职责） [P2] [status: pending]
- **形态**：God Object + Divergent Change（Fowler Bloaters）
- **证据**：`treesearch/fts.py:280-2603` 的 `FTS5Index` 同时承担：① FTS5 文档/节点索引与检索（`index_document`/`search`）；② 失败文件台账（`fts.py:512` 起 `upsert_failed_file` 等）；③ 视觉解析队列（`fts.py:565` 起 `vision_*`）；④ 邮件元数据（`fts.py:2149` 起 `upsert_email_meta` 等）；⑤ 增量指纹 `index_meta`（`fts.py:2237` 起）；⑥ 索引校验/修复（`verify_index`/`repair_index`）。`grep -cE '^    def ' fts.py` = **71**。每组方法对应独立的变更原因。
- **风险**：改失败台账、视觉队列、邮件表或 FTS 检索都要 touch 同一文件；单测难以按职责隔离；并发/事务边界被混在一起（如队列方法有的 commit 有的不 commit，见“灰色项”）。
- **修复方案**：按职责提取协作者（同一连接对象注入，不拆 DB）：`FailedFileStore`、`VisionQueue`、`EmailMetaStore`、`IndexMetaStore`、`IndexMaintenance`；`FTS5Index` 保留 schema/连接与文档节点检索。不动外部 API 的公开方法名（先转委托）。
- **回归验证**：`tests/test_pdf_native_preview_api.py tests/test_web_search_api_matrix.py tests/test_lazy_search.py tests/test_architecture.py`。

### AP-4 build_index 680 行 God Function（内含两层嵌套协程） [P2] [status: pending]
- **形态**：Long Method + God Object（函数级）
- **证据**：`treesearch/indexer.py:1460-2139`。内含可独立命名的阶段：路径展开、prune 决策、move 检测、增量比对、并发解析（嵌套 `_index_one`）、分块提交（嵌套 `_commit_chunk`，`:1880-1900`）、ghost 注册、统计汇总。`_commit_chunk` 内部再嵌套提交循环。
- **风险**：任何索引策略调整（分块、重试、进度、失败台账、ghost）都要在 680 行上下文里定位；异常路径（`failed_files`/`pruned_paths`）难以单测。
- **修复方案**：提取 `_expand_and_plan()`、`_detect_moves()`、`_parse_chunk()`、`_commit_chunk()`、`_finalize_stats()` 为模块级/类内私有函数，`build_index` 只做编排。契约不变。
- **回归验证**：`tests/test_index_chunking.py tests/test_lazy_search.py tests/test_max_dir_files.py tests/test_architecture.py`。

### AP-5 asearch 与 abatch_search 的“加载缓存→增量重建”逻辑双份复制且已漂移 [P2] [status: pending]
- **形态**：Shotgun Surgery / Copy-and-Paste Programming
- **证据**：`treesearch/treesearch.py:236-260` 与 `:397-416`；差异除 AP-1 的解包缺陷外，abatch 版还缺少 orphan 分支（`:249-252` vs 无）。两份都以 `self._pending_paths.clear()` 结尾。
- **风险**：AP-1 的直接根因；后续任何缓存/增量策略修正都要双处同步。
- **修复方案**：与 AP-1 同一提交——抽 `_ensure_documents_loaded()`，两处调用。
- **回归验证**：同 AP-1。

### AP-6 tree/flat 两条搜索管线的 flat_nodes 装配与字符预算逐行重复 [P2] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`treesearch/search.py:841-879`（tree mode）与 `:959-988`（flat mode）的 `all_candidates` 收集、排序键 `(-score, node_id)`、按 `remaining_budget // (n-i)` 逐节点截断完全同构；`:960` 注释 “See _search_tree_mode for strategy rationale” 自证复制关系。
- **风险**：输出字段/排序/预算策略改动需双处同步，已具备漂移条件（AP-1 是同类前例）。
- **修复方案**：抽 `_build_flat_nodes(merged, max_result_chars)` 供两模式共用。契约不变。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py tests/test_architecture.py`。

### AP-7 TreeSearcher._build_flat_nodes 约 400 行 7 阶段 God Method，且就地改写入参 [P2] [status: pending]
- **形态**：Long Method + 隐式输出参数
- **证据**：`treesearch/tree_searcher.py:603-1006`（docstring 自述 “7 stages”）；`:653-656` 就地 `fts_score_map[doc_id] = dict(top_items)` 截断调用方传入的 dict；`:476` `reasons=state.reasons  # share reference, don't copy` 共享可变列表。
- **风险**：调整任一打分阶段（父子提升、密度、子树证据）必须通读 400 行；调用方传入的 score map 被静默改写，二次使用会看到被截断后的结果。
- **修复方案**：按 7 阶段提取 `_base_scores`、`_title_prefix_propagation`、`_walk_boost`、`_parent_context`、`_term_density`、`_subtree_evidence`、`_title_match`；入口改为对入参做局部浅拷贝，或在 docstring 明确“会就地截断”的契约。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py tests/test_architecture.py`。

### AP-8 评分/降级搜索 SQL 失败静默返回空结果，错误被伪装成“无命中” [P2] [status: pending]
- **形态**：Error Hiding
- **证据**：
  - `treesearch/fts.py:1459-1461` `score_nodes_batch`：`except Exception: return {}`，**无日志**。
  - `treesearch/fts.py:1266-1268` `like_search` phase-2：`except Exception: return []`，无日志。
  - 对照：同文件 `fts.py:1007` 的主搜索只捕 `sqlite3.OperationalError` 且 `logger.warning`。
- **风险**：DB 损坏/锁超时/schema 变更时，搜索链表现为“0 结果”，上层无法区分“确实没有”与“查询失败”；批量评测会把故障误记成召回率下降。
- **修复方案**：至少 `logger.warning("FTS scoring failed ...", exc_info=True)`；更彻底：返回 `(scores, error)` 或抛 `FTSSearchError` 由 `search()` 决定降级策略。契约变更：是（若要区分失败）。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py tests/test_architecture.py`。

### AP-9 async API 外壳内全是同步 I/O/CPU，`gather` 不产生并发且会阻塞调用方事件循环 [P2] [status: pending]
- **形态**：Blocking the Event Loop（库 API 层）/ 假异步
- **证据**：
  - `treesearch/indexer.py:432/611/753/849/951/1008` 六个 `async def *_to_tree`：函数体内同步 `open().read()`（`:456`）与纯 CPU 树构建，全程无 `await`。
  - `treesearch/indexer.py:1887` `await asyncio.gather(*(_index_one(fp) ...))`：对同步协程 gather，只有 parser 内部自带 await 时才有切换点，docstring 宣称的 “processes multiple files concurrently” 对 md/text/json 等不成立。
  - `treesearch/search.py:954` 对纯同步的 `_search_doc` 做 `asyncio.gather`。
  - 宿主侧证据：`doclens/web_v2/api/search.py:103` 用 `asyncio.to_thread` 包同步 `idx.search`，等于承认该链路必须靠外部线程兜底。
- **风险**：库消费者在自身事件循环里 `await build_index(...)`/`await search(...)` 会整段冻结循环；并发声明误导调用方。当前 doclens 未踩中（索引在专用线程/独立 loop，搜索经 to_thread），但属公开 API 的健壮性缺陷。
- **修复方案**：明确两套 API——同步实现 + `async` 版本内部 `await asyncio.to_thread(...)`；或把 CPU/IO 段显式丢进线程池。文档同步修正“concurrently”措辞。
- **回归验证**：`tests/test_index_chunking.py tests/test_lazy_search.py tests/test_web_search_api_matrix.py tests/test_architecture.py`。

### AP-10 核心包内跨文件 import 下划线私有成员 [P3] [status: pending]
- **形态**：封装泄漏（仓库纪律违规）
- **证据**：
  - `treesearch/ghost.py:86` `from .pathutil import _get_default_extensions`
  - `treesearch/heuristics.py:94` `from .tokenizer import tokenize, _RE_HAS_CJK`
  - `treesearch/fts.py:165` `from .tokenizer import _RE_HAS_CJK`
- **风险**：`_RE_HAS_CJK` / `_get_default_extensions` 改名或改语义即运行时断裂，且 `tests/test_architecture.py` 只守 doclens 侧，core 内这类引用无守卫。与 `antipatterns/treesearch-parsers.md` AP-9 同源。
- **修复方案**：公共化：`tokenizer.RE_HAS_CJK`（或提供 `has_cjk(text)` 谓词）、`pathutil.get_default_extensions`；全仓同步消费方（含 tests monkeypatch 目标字符串）。
- **回归验证**：`tests/test_architecture.py` + tokenizer/pathutil 相关测试（若无同名测试，补最小单测）。

### AP-11 tree ↔ fts 循环依赖靠函数内 import 掩盖（源码注释自证） [P3] [status: pending]
- **形态**：Circular Dependency（延迟 import 掩盖）
- **证据**：`treesearch/fts.py:1629` 注释 “局部导入避免循环依赖”，同文件 `:718/1279/1576/1602/1825` 均函数内 `from .tree import ...`；反向 `treesearch/tree.py:312/340/362` 函数内 `from .fts import FTS5Index`。
- **风险**：模块环仍然存在，只是藏在运行时；静态分析/打包工具与初始化顺序推理失效；新代码容易在顶层 import 时踩环。
- **修复方案**：将 `Document` 数据模型与纯树工具下沉到无依赖的 `treesearch/types.py`（或 `model.py`），`fts` 只依赖它；`tree.py` 的持久化函数迁到 `fts`/`store` 层，断开 tree→fts。
- **回归验证**：`tests/test_architecture.py` + 全量导入冒烟（`python -c "import treesearch"`）。

### AP-12 评分系数与结果上限裸字面量散布（同一数值承载不同语义） [P3] [status: pending]
- **形态**：Magic Numbers / Magic Strings
- **证据**：
  - `treesearch/tree_searcher.py:232` `_MAX_DOCS_TO_WALK = 20`；`:260` `0.3 * state.score + 0.7 * fts_s`；`:652` `max(50, min(500, 2000 // n_docs))`；`:721-974` 七阶段系数 `0.70/1.08/0.15/0.005/0.30/0.40/0.25/0.20/0.06/0.50/0.10/1.5` 等。
  - `treesearch/heuristics.py:220-231/272-296/330-361` 三组打分权重；`0.08` 在 279 与 294 行分别是 title bonus 与 redundancy penalty。
  - `treesearch/fts.py:962/967` `LIMIT 50`；`:1439/1454` `LIMIT 5000`；`:1330` `top_k=200`。
  - `ancestor_decay=0.6` 在 `search.py:588`、`search.py:1040` 默认值、`search.py:544` docstring 三处手工同步。
- **风险**：调参需全仓 grep；同值不同义导致“改一个全变”；文档与代码默认值漂移。
- **修复方案**：`ScoringWeights` dataclass（tree_searcher/heuristics 共用）+ 命名常量（`SCORE_BATCH_LIMIT`、`PHRASE_BOOST_LIMIT` 等）；`ancestor_decay` 收口为单一默认常量。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py tests/test_architecture.py`。

### AP-13 Index/Search 参数表膨胀（primitive obsession + 新选项穿透六处签名） [P3] [status: pending]
- **形态**：Long Parameter List / Shotgun Surgery
- **证据**：`treesearch/indexer.py:1460-1480` `build_index` 18 个参数（7 个 `Optional[bool]` + 3 个 callback）；`:432-449` `md_to_tree` 9 个参数（7 个 bool），`text_to_tree`/`code_to_tree`/`json_to_tree`/`jsonl_to_tree`/`csv_to_tree` 同构；`treesearch/search.py:483-496` `search()` 12 个参数并在 tree/flat 两模式间原样透传。
- **风险**：新增一个索引开关要同时改六个 `*_to_tree` 签名 + `build_index` + config + `TreeSearch.index`；漏一处即静默不生效。
- **修复方案**：`IndexOptions` / `SearchOptions` dataclass（含默认值），保留 `**kwargs` 兼容旧调用。
- **回归验证**：`tests/test_index_chunking.py tests/test_web_search_api_matrix.py tests/test_lazy_search.py`。

### AP-14 持久化辅助函数每次调用新建短命 FTS5Index（连接 + PRAGMA 重放） [P3] [status: pending]
- **形态**：每请求开关连接（SQLite 栈清单）
- **证据**：`treesearch/tree.py:324/341/363`（`save_index`/`load_index`/`load_documents`）各自 `FTS5Index(db_path=...)` + `close()`；搜索自愈路径在 `treesearch/treesearch.py:256/264/412/420` 调用 `load_documents`。
- **风险**：每次加载重开连接并重放 `journal_mode=WAL`/`synchronous`；大索引或高频自愈搜索时成本直接叠加，且与 AP-2 的全局单例形成两套连接生命期。
- **修复方案**：复用调用方已有的索引实例（参数注入），或引入按 db_path 缓存的 registry（与 AP-2 一并设计）；保留函数式 API 作为薄包装。
- **回归验证**：`tests/test_lazy_search.py tests/test_web_search_api_matrix.py`。

### AP-15 事件循环检测靠异常消息字符串匹配，三处复制 [P3] [status: pending]
- **形态**：Magic String + Shotgun Surgery
- **证据**：`treesearch/treesearch.py:198-205`、`:344-351`、`:459-468` 完全相同：`except RuntimeError as e: if "Event loop is already running" in str(e): raise; pass`。
- **风险**：该字符串是自己抛出的（`:201`），但同处也接住 `asyncio.get_running_loop()` 的官方 RuntimeError；Python 改消息或本地化即误判/误吞，三处需同步维护。
- **修复方案**：抽 `_ensure_no_running_loop()` 并改用哨兵异常类型（自定义 `RuntimeError` 子类）或直接判断 `asyncio.get_running_loop()` 成功即抛。
- **回归验证**：补 sync/async 双路径单测；`tests/test_architecture.py`。

### AP-16 杂项卫生打包（类型注解无效 / CLI 与 watch 默认值落 cwd / 三方 logger 黑名单硬编码） [P4] [status: pending]
- **形态**：Lava Flow + Magic Strings + 配置默认值与数据目录纪律张力
- **证据**：
  - `treesearch/tree.py:266` `def remove_fields(...) -> any`——返回内置函数 `any` 而非 `typing.Any`，注解实际无效。
  - `treesearch/treesearch.py:114` `stored_meta: dict = None` 注解与默认值不一致。
  - `treesearch/cli.py:60` `db_path = args.db or "./index.db"`、`treesearch/watch.py:125` 默认 `"./index.db"`——在任意 cwd 运行会在当前目录生成索引，与「产物归属 `.treesearch/`」纪律有张力（作为独立库默认值可理解，但缺文档提示）。
  - `treesearch/cli.py:34` 三方库 logger 黑名单 `("pdfminer", "pdfplumber", "markitdown", "urllib3", "PIL")` 硬编码，新增重日志依赖需手改。
- **风险**：注解型问题误导静态检查；默认路径造成脏产物；黑名单遗漏导致 CLI 输出被三方日志淹没。
- **修复方案**：`Any`/`Optional[dict]` 修正；默认 db_path 改由 config 提供并在 `--help` 标注 cwd 语义；黑名单提取为模块常量并加注释。
- **回归验证**：`tests/test_architecture.py`（无行为变更，CLI 冒烟可选）。

### AP-17 treesearch/watch 与 doclens/file_watcher 同仓双实现，且失败仅日志后继续 [P4] [status: pending]
- **形态**：Stovepipe System（同能力双实现）+ Error Hiding（守护进程容错形态）
- **证据**：`treesearch/watch.py`（315 行，watchdog + 防抖）与 `doclens/file_watcher.py` 并立；`treesearch/watch.py:110-113` 批回调异常仅 `logger.exception` 后继续，`:239-242` 单批 `build_index` 失败仅日志后 `return`，索引与磁盘漂移无对外信号。
- **风险**：两套 watcher 语义各自演化（前作 `antipatterns/file-watcher.md` AP-9 已记录同源）；CLI 用户看不到索引已落后。
- **修复方案**：这是既有台账 AP-9 的延伸——短期在 watch 失败路径上设置可查询的“last_error/last_success”状态（或回调 `on_error`）；中期评估让 doclens 复用 treesearch/watch 或反之。
- **回归验证**：watch 相关测试（`tests/test_file_watcher_exclude.py tests/test_change_detection.py`）+ `tests/test_architecture.py`。

## 三、新型态

无新增形态。AP-1 是 “Copy-and-Paste Programming 漂移后产生真实 bug” 的教科书实例，仍归通用兜底既有形态；AP-9 的“async 外壳无 await”可视为 Blocking the Event Loop 在库 API 层的变体，暂不晋升。

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| — | — | — | — |
