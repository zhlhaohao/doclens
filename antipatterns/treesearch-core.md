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

---

# 复审分册：M1 存储层（fts.py）· 2026-10-25 新判据重审

> 审计日期：2026-10-25｜点名范围：`treesearch/fts.py`（2,965 行）——用户切分方案的 M1 存储层。
> 判据基线：`references/backend.md` 2026-10-25 增补版（「数据通路与规模」「外部调用与背压」两节 + SQLite 节扩充 4 条）+ `references/general.md`「数据与契约层」「横切判读」节。判据增补来源即本文件历史实证（47376778 批量回查 / 3529d23e GLOB / 644ec39b 全局 max / 0e291824 覆盖索引 / 3cbf46bf 连接锁）。
> 方法：机械扫描（SQL 全量盘点 / except 盘点 / 方法清单）→ 旧账核对 → 2 组子代理并行清查（1-1100 连接与写入路径 / 1100-2965 查询与单例区）→ 主代理调用链交叉核实。

## 旧账核对（10-20 台账 vs 当前代码）

| 旧条目 | 现状 |
|---|---|
| AP-3 FTS5Index God Object | **仍在且加剧**：2965 行 / 89 方法（旧账记 2320 行 / 71 方法），新增 vision 队列 10 方法 + probe/ghost 6 方法 + PST meta 5 方法——待 M4 后按域拆分统一处置 |
| AP-8 SQL 失败静默空结果 | **部分残留**：`like_search` Phase2 `fts.py:1479`、`score_nodes_batch` `fts.py:1672` 两处 `except Exception: return 空` 仍在（升级见 RM-7） |
| AP-12 评分系数字面量 | 已收敛至 heuristics/search 层（fts.py 内 grep 无 sigmoid/系数残留）——**可标 done（随 2b6e2784 评分治理）** |
| AP-14 短命 FTS5Index | 已收敛：fts.py 内仅 `get_fts_index` 单例构造 1 处，请求级消费方已走 index_probe——残留形态转 RM-6（全局单例生命周期） |
| AP-16 杂项（类型注解等） | 未核（M4 范围） |

## 新发现条目（RM = re-audit M1）

### RM-1 PST 前缀四方法 instr() 谓词全表扫 [P1] [status: pending]
- **形态**：索引列上包函数（栈清单）+ 成本与整库成正比的「小查询」（新节）
- **证据**：`fts.py:2403/2411/2419/2427` 四方法全部 `WHERE instr(source_path, ?) = 1`——instr 谓词必然全表扫。同文件 `:1998-2010` `indexed_children_of` 已写明 GLOB 走 BINARY 索引、LIKE/instr 阻止 planner 用索引的性能注记（3529d23e 修复），**同款修复未覆盖此四处**。调用链实证：`indexer.py:1668/1718/1920`（PST 级联删除/替换，每次 PST 重索引必走）+ `doclens/web_v2/api/preview_synth.py:86-87`（PST 预览页 API）。
- **风险**：28.5 万文档库上每次 PST 文档变更/预览触发整库扫（数百 ms 级 × 四方法连发）；规模盲区判读——demo 库不可见，生产库每次 PST 操作可感知卡顿。
- **修复方案**：四方法改 `source_path GLOB '<prefix>*'`（prefix 经 `_glob_escape`，同 `:2037` 既有模式）；`has_docs_with_source_prefix` 对照 `:1927` `has_docs_under` 的 LIMIT 1 形态。
- **回归验证**：`tests/test_pst_parser.py` + 新增四方法索引利用断言（EXPLAIN QUERY PLAN 无 SCAN）；`tests/test_lazy_search.py tests/test_architecture.py`。

### RM-2 like_search Phase 2 structure_json blob 全库扫描无护栏 [P2] [status: pending]
- **形态**：成本与整库成正比的「小查询」——大 blob 列进扫描
- **证据**：`fts.py:1457-1462` 正则分支 `WHERE structure_json REGEXP ?`（Python UDF 逐行扫 MB 级 blob）；`:1473-1477` 非正则分支 `structure_json LIKE '%q%'` 同样整库 blob 扫。`_phase2_rescan_allowed`（`:1515-1525`）护栏只覆盖「无命中后的兜底 rescan」，**首查本身不设防**。对照 `:1410-1422` Phase 1 已做 LIMIT 下推+子集临时表。
- **风险**：降级搜索路径（FTS5 查询语法错时）在大库退化为整库反序列化级成本；Phase 2 本就是异常兜底路径，叠加 blob 扫描使降级比主路径慢几个量级。
- **修复方案**：Phase 2 首查前置 `_phase2_rescan_allowed` 同款节点数护栏（超限直接返回空+warning，宁可漏配不可卡死——沿用 `:1518-1519` 既有决策口径）；或 blob 扫描改子查询先收窄 doc_id 集。
- **回归验证**：`tests/test_lazy_search.py tests/test_search_preset_params.py tests/test_grep_corpus_bypass.py`。

### RM-3 search_with_aggregation 循环内逐 doc 点查 doc_name（N+1） [P2] [status: pending]
- **形态**：N+1 查询
- **证据**：`fts.py:1551-1553` 对每个新 doc_id 逐条 `SELECT doc_name ... fetchone()`，top_k_docs=200 时最多 200 次往返。**同款问题主链路已修**（`:1216-1235` 批量 `IN (VALUES ...)`，47376778），此处未跟进。调用链实证：`search.py:709` flat 搜索模式热路径（tree 模式有 fast path 跳过）。
- **风险**：flat/auto 模式每次搜索多 200 次往返（叠加连接锁 = 200 次锁获取，与 AP-2 修复前的形态同构）。
- **修复方案**：照 `:1216-1235` 批量回查模式改写（行值 IN 分批 ≤100 对）。
- **回归验证**：`tests/test_lazy_search.py` + `tests/test_search_preset_params.py`；对照 47376778 的 `test_fts_search_batch_meta.py` 模式补 execute 次数断言。

### RM-4 load_all_documents 整库 blob 反序列化（O(库) 内存）双消费方 [P2] [status: pending]
- **形态**：全量拉取无 LIMIT + 分页前全量加工
- **证据**：`fts.py:2114-2116` 整表拉 `structure_json`（MB 级 blob/行）逐行 json.loads 重建 Document。消费方实证：① `indexer.py:2053` `return_documents=True` 时把全库文档回载进内存只为 echo 已入库文档；② `tree.py:345/364` 无 doc_id 时取 `docs[0]`——**拉全库只为取第一条**（全量搬运给小消费方的教科书形态）。
- **风险**：28.5 万文档库 return_documents 索引调用 O(库) blob 内存+反序列化分钟级；tree.py 单文档读取同样整库代价。
- **修复方案**：`load_all_documents` 增加分页/流式变体（keyset，参照 `iter_index_meta` `:2562-2593` 治理样板）；`tree.py:345` 改 `LIMIT 1` 单行读取；`indexer.py:2053` 改按 skipped 的 source_path 点查批量回载（IN 分批）。
- **回归验证**：`tests/test_index_chunking.py tests/test_lazy_search.py`；tree.py 行为等价（doc_id 缺省时选库内首文档的口径不变）。

### RM-5 like_search Phase 2 全量提取 snippet 后裁剪 top_k [P3] [status: pending]
- **形态**：分页前全量加工——99% 计算花在丢弃数据上
- **证据**：`fts.py:1482-1513` 对全部命中节点逐条 `_extract_match_snippet` 后 `results[:top_k]`（`:1513`）；top_k=20 时绝大多数 snippet 提取白做。`_search_like`（`:1317-1359`，FTS5 缺席路径）同构。
- **风险**：降级路径上命中多时 CPU 纯耗；与 RM-2 叠加放大。
- **修复方案**：先按既有排序键裁剪到 top_k 再提取 snippet（排序与提取解耦）。
- **回归验证**：`tests/test_lazy_search.py`；降级路径结果集等价断言。

### RM-6 全局 FTS 单例三生命周期并存，close 时他人断连 [P2] [status: pending]
- **形态**：同库多套连接生命周期并存（SQLite 节新条目）；旧 AP-14 的残留半边 + treesearch-core 旧账 AP-2 的单例半边在此合流
- **证据**：`fts.py:2943-2948` `get_fts_index` db_path 变更即 `close()` 全局实例——任何仍持旧引用的调用方随后 execute 即 `ProgrammingError`（`close()` 置 `_conn=None`）；`:2960-2965` `reset_fts_index` 无条件 close 连外部注入实例（`set_fts_index`）一并收走。doclens 侧已治理（AP-10，f8af7691），**treesearch 包内单例区自身无所有权契约**。
- **风险**：treesearchlib 公开包的多实例用法（db_path 切换）仍可复现串库/断连；库发布形态下无人守护。
- **修复方案**：单例区加所有权文档+断连防护（close 前 close 消费方或引用计数）；或窄化为「仅供 CLI/演示，宿主请自持实例」并 docstring 警示。
- **回归验证**：`tests/test_lazy_search.py tests/test_architecture.py`；新增 db_path 切换不断连断言。

### RM-7 两处 SQL 失败伪装空结果（旧 AP-8 残留，升级） [P2] [status: pending]
- **形态**：失败伪装成空结果（Python 层新条目）+ Error Hiding
- **证据**：`fts.py:1479-1480` `like_search` Phase 2 `except Exception: return []`（吞一切含编程错误，发生在 Phase 1 空结果之后——上层无法区分「无命中」与「查询崩了」）；`:1672-1673` `score_nodes_batch` `except Exception: return {}` 无日志。对照 `:1211-1213` 主 search 窄异常 + warning 的正确口径。
- **风险**：DB 锁死/schema 漂移伪装成「0 结果/无评分」，rag-bench 类评测把故障误记成召回率下降（横切判读③：观测口径先于功能怀疑的实证反面）。
- **修复方案**：收窄异常类型（sqlite3.OperationalError/Error）+ `logger.warning(exc_info=True)`；`score_nodes_batch` 同律。
- **回归验证**：`tests/test_lazy_search.py tests/test_web_search_api_matrix.py`。

### RM-8 propagate_scores 祖先链二次归一压平跨文档区分度 [P3] [status: pending]
- **形态**：归一化抵消（数据与契约层）
- **证据**：`fts.py:1749-1754` 祖先加成致 final_max>1 时按「该文档自身 max」除回——条件触发的 per-doc 重归一，带强祖先链的文档整体被压回 1.0 顶格，与 `:1703-1710`（644ec39b）「全局 max 恢复文档间区分度」的修复意图部分相悖。
- **风险**：树搜索场景（祖先加成常见）下 fts 因子区分度部分回落；trace 上表现为高分段堆积。
- **修复方案**：重归一基准改「本次 query 全局 final_max」（与 644ec39b 同思路），需 trace 实证带祖先链文档的分布后再动。
- **回归验证**：`tests/test_lazy_search.py`；slack 语料 trace 对照（改前/改后 fts_score 分布）。

### RM-9 隐式事务边界敞开：failed_files/vision 裸 execute 无事务收口 [P2] [status: pending]
- **形态**：写路径无事务包裹（变体：语句散布 + commit 时点外部化）
- **证据**：`fts.py:717/731/763/822` `upsert_failed_file`/`clear_failed_file`/`vision_enqueue`/`vision_remove` 均裸 execute 后无 commit——写挂在连接级隐式事务上，直到别处某个 commit（`:794/807/818/1083`）连带提交/回滚。`_LockedConnection` docstring（`:165-167`）自述要防「两线程交错 execute/commit 互相提交对方半截事务」——**语句级锁修不掉事务级敞口**（3cbf46bf 的连接锁修复覆盖了语句交叉，未覆盖事务边界）。灰色项：宿主调用方可能在批末统一 commit（doclens 侧 vision_worker 每批有 commit 纪律），treesearch 包内 `indexer.py` 消费时序未核（M2 范围）。
- **风险**：并发场景下 vision 队列/failed_files 半截事务被搜索线程的 rollback 连带丢弃；崩溃时未 commit 写全部蒸发。
- **修复方案**：四方法各自 `with self._conn:` 收口（单语句事务，锁语义既有）；或明确「由调用方批末 commit」契约并 docstring 声明。
- **回归验证**：`tests/test_fts_concurrent_connection.py` + vision 队列测试；并发写入后重启进程数据完整断言。

### RM-10 魔法下标取列遍布读写路径（schema 变更即错位） [P3] [status: pending]
- **形态**：忽略 row factory（SQLite 节既有条目，本文件密度实证）
- **证据**：`fts.py:711/797/864/907/1024` 等手工 `row[0]/row[1]/row[3] or ""`——列序变更需同步改同函数两处，无编译期保护；`fts.py:936` 的 `for (nid, chash) in ...` 元组解包是本文件内自文档形式的对照样板。
- **风险**：纯演进风险（P3）；每次 schema 调整的静默错位面。
- **修复方案**：热点区域（vision/failed_files/PST meta）改 `row_factory=sqlite3.Row` 或命名解包；不必全文件一次性替换。
- **回归验证**：触及方法同名测试；`tests/test_fts_concurrent_connection.py`。

## 反证归档（清查判「有意设计」，不立案）

- `with self._conn:` 在本文件是**持锁隐式事务**语义（`_LockedConnection.__enter__` 注释明示），连接生命周期由显式 close+`__del__`+init 失败清理三路管理——「with conn 只 commit 不 close」判据对本文件不成立。
- `index_document` 主写入路径已单事务包裹（crash 全回滚注释自证）；`auto_commit=False` 是给批量调用方的开关。
- vision 队列为 SQLite 持久化表非内存队列，「无界缓冲」不适用；`vision_next_pending` 的 SELECT+UPDATE 带 rowcount 判抢占是标准乐观锁。
- `_phase2_rescan_allowed` 的 `except: return False` 是「护栏保守失败」有意设计（注释自证）。
- Phase 1 LIMIT 下推+子集临时表、`iter_index_meta` keyset 分页、`filter_known_source_paths` 分批 IN 均为已治理样板。
- 灰色项：`_LockedCursor.__del__` 兜底在 CPython refcount 下可靠（无循环引用）；`cursor()` 返回裸游标是潜伏缺口但当前零调用方——记入 RM-6 修复时顺带封口，不单独立案。

---

# 复审分册：M3 搜索管线 · 2026-10-25 新判据重审

> 审计日期：2026-10-25｜点名范围：`treesearch/search.py`(1066) + `tree_searcher.py`(1006) + `heuristics.py`(425) + `tree.py`(397) + `tokenizer.py`(176) + `ghost.py`(115)，共 3,185 行。
> 判据基线：同 M1 分册（backend.md 2026-10-25 增补版 + general.md 数据契约层/横切判读）。
> 方法：机械扫描（归一化点/排序点/模块级状态盘点）→ 旧账核对 → 2 组子代理并行（search+heuristics / tree_searcher+tree+tokenizer+ghost）→ 主代理交叉核实（正则双语义、死代码、route 消费链）。

## 旧账核对

| 旧条目 | 现状 |
|---|---|
| AP-6 tree/flat flat_nodes 双份复制 | 仍在（search.py:859/975 同构 sort+预算循环，注释自证复制关系）——不重复立案，待修 |
| AP-7 _build_flat_nodes 400 行 God Method + 就地改写入参 | 仍在且补充证据：tree_searcher.py:672 局部下标常量 `_TITLE=0...` 12+ 处消费、:745 裸 x[2]——并入新条 RS-3 |
| AP-9 async 外壳内全同步 | 未核（需跨 indexer/watch 联动验证，归 M2） |

## 新发现条目（RS = re-audit M3）

### RS-1 GrepFilter 命中行数 per-doc max 归一压平文档间区分度 [P2] [status: pending]
- **形态**：归一化抵消（数据与契约层；与已修的 fts per-doc max 同病）
- **证据**：`search.py:258-262` `_lines_to_nodes` 把 rg 命中行数按 (query,doc) 内 max 归一——命中 2 行与 200 行的节点同为 1.0。消费链实证：`search.py:156` `route_documents_db` 取 `max(nscores.values())` 做 doc 级路由排序 + `search.py:658` 同款——**doc 间比较拿到的全是 1.0，路由只剩「有无命中」二值信息**。与 644ec39b 修复的「单节点文档恒 1.0 丢失文档间强弱」完全同构。
- **风险**：regex-contains 通配查询（GrepFilter 路由）的 top_k_docs 路由质量退化——命中密度信息在归一时全部丢失，规模盲区判读：demo 小库命中数差异小不可见，大库多命中文档排序失真。
- **修复方案**：归一基准改「本次 query 全部命中 doc 的全局 max」（与 fts.py:1703-1710 修复同思路），doc 内相对序不变。
- **回归验证**：`tests/test_lazy_search.py` + `tests/test_web_search_api_matrix.py`；构造命中 2 行 vs 200 行双文档断言路由序。

### RS-2 同一非法正则双路径语义相反：主入口 raise、GrepFilter 降级字面匹配 [P2] [status: pending]
- **形态**：口径分裂（同概念两套行为契约）+ 失败伪装（降级无信号）
- **证据**：`search.py:555-559` 主入口对 `re.error` → `raise ValueError`（用户立即看到错误）；`search.py:274-275` GrepFilter 对同样 `re.error` → `logger.warning` 后 `regex=None` 落入字面子串扫描（:288-290）——**返回字面匹配结果，上层无从区分「用户要的正则语义」与「退化后的 literal 语义」**。同一 query 两路径一抛一吞。
- **风险**：regex 路由路径上用户的正则意图被静默替换（如 `foo.*bar` 退化成查字面 `foo.*bar` 字符串），结果集完全错误但表现为「正常搜索」；warning 埋日志用户不可见。
- **修复方案**：GrepFilter 与主入口对齐——`re.error` 上抛（构造方 route_documents_db 透传）；或降级时在返回结构带 `regex_degraded` 标志。契约变更：是（GrepFilter 构造异常语义）。
- **回归验证**：`tests/test_lazy_search.py`；新增双路径同非法正则行为一致断言。

### RS-3 rerank 段 ~15 个裸系数散布 + 局部下标常量伪命名 [P3] [status: pending]
- **形态**：Magic Numbers（裸系数）+ 魔法下标变体（局部常量未覆盖消费面）
- **证据**：`tree_searcher.py:260` `0.3*state.score + 0.7*fts_s`、`:773` `*0.30`、`:782` `*0.15`、`:807-808` `0.15*(hop-1)` + `min(0.25*..., 0.20)`、`:891/905` `0.50/0.25`、`:919` `0.12`、`:955` `0.30`、`:974` `0.15`——约 15 个未命名系数无注释；`:672` `_TITLE=0.._OVERLAP=4` 局部常量在 12+ 处消费但 `:745` `sort(key=lambda x: -x[2])` 裸下标绕过——伪命名。对照合格样板：`:813-814` `_TOP_N_RERANK` 有动机注释。
- **风险**：调参需逐处考古；AP-7 拆分 God Method 时这些系数是主要障碍。
- **修复方案**：系数收进模块级 NamedTuple/dataclass（`RerankWeights`），随 AP-7 拆分一并做；`:745` 改用 `_FULL` 常量。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py`。

### RS-4 tokenizer 两套 CJK 正则并存，宽版零消费死代码 [P3] [status: pending]
- **形态**：死代码 + 口径分裂隐患（同根注入点散布的潜伏形态）
- **证据**：`tokenizer.py:20` `_RE_CJK_CHAR`（宽：含 3000-303f 全角标点、ff00-ffef 全角 ASCII）定义后**全文件零消费**；:21 `_RE_HAS_CJK`（窄：仅汉字区）承担全部判定。一旦误用宽版做「含中文」判定，全角逗号/全角字母会触发 CJK 分词路径。另 `:76` jieba 分支与 `:151` auto 分支两条独立路径各自调 `_ensure_jieba`，同一意图（auto=jieba）实现两份。
- **风险**：纯潜伏（P3）——但与本仓「口径分裂」家族史（字符/词/当量词三口径并存事故）同型。
- **修复方案**：删 `_RE_CJK_CHAR` 死代码；auto 分支收敛走 `_tokenize_cjk_jieba` 单点。
- **回归验证**：`tests/test_lazy_search.py`；tokenizer 相关既有测试。

### RS-5 ghost fail-closed 判定零信号，临时性 OSError 不可审计 [P3] [status: pending]
- **形态**：失败伪装的轻形态（有意 fail-closed 但无日志）
- **证据**：`ghost.py:74-75` `except OSError: return False`——docstring :66 明文 fail-closed 契约（有意设计成立），但 Windows 文件占用等**临时性**权限错误与真二进制不可区分，且判定结果直接写入 documents 表 ghost 决策，事后无从审计；logger :21 已创建却此分支未用。
- **风险**：低概率但定位成本高——某文本文件「莫名没注册 ghost」需源码考古。
- **修复方案**：except 分支补一行 `logger.debug/warning`（带路径与异常摘要），契约不变。
- **回归验证**：ghost 相关测试；`tests/test_lazy_search.py`。

### RS-6 _states_to_paths 就地排序输入列表，顺序耦合未声明 [P3] [status: pending]
- **形态**：就地改写共享可变结构（AP-7 就地截断的同族新点）
- **证据**：`tree_searcher.py:537` `states.sort(...)` 对传入列表就地排序——该列表来自 `_tree_walk` 返回值，`search()` 主流程 :254-261 先按原始入队序遍历生成 `all_walked_nodes`（hop 语义依赖遍历序）再调 `_states_to_paths`(:487)。当前调用序恰好安全，**顺序耦合无注释声明**——交换两段顺序则 hop 序列静默变化。
- **风险**：潜伏（当前正确）；AP-7 拆分时是雷。
- **修复方案**：`sorted(states, ...)` 非就地 + 调用点注释声明顺序依赖；随 AP-7 拆分处理。
- **回归验证**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py`。

## 灰色项（证据不足，挂账待证）

- **heuristics 压缩链恒同值嫌疑**：`heuristics.py:220/289/360`（depth/hop/path_length 惩罚）若真实语料树普遍浅（depth≈1、hop 恒 0）则惩罚项恒 0——需 trace 实证分布，无静态实锤。M6 后跑 rag-bench trace 复核。
- **`tokenizer.py:171` 二次 CJK 检测**：对同一 text 重复 `_RE_HAS_CJK.search`（:139 已测过）——纯重复计算，量级小，修 RS-4 时顺带。
- **`max_result_chars` 字符口径残留**：`search.py:845/961` 全链路仍按字符计量，与 10-24 词口径统一运动并存——但这是「结果预算」非「内容计量」，两种口径语义上确可并存（前端按字符渲染）。判灰色：需与 kb_tools 的 max_total_words 口径对齐决策后再定。

## 反证归档（M3 清查判「有意设计」，不立案）

- `estimate_idf` 双层循环：调用方 tree_searcher.py:240-242 有 20 节点/5 doc 守卫，corpus 是单文档节点文本——复杂度已控。
- `_PrescoredScorer` 全量打分：docstring :1023-1027 明示「IN filter 不缩小 posting walk，重打分与全语料同价」——性能优化非浪费。
- tree_searcher.py:227-233 全排后切 20：注释给出召回依据（60+ doc 后半 max<0.1）——有意权衡。
- `search.py:870` `text=""` 是「truncate rather than drop」占位策略（注释明示），非丢弃。
- `tokenizer.py:67-68` `_STEMMER=False` sentinel 是「ImportError 后不重试」的防抖设计。
- `ghost.py:29-34` `_SNIFF_BYTES=8192` 命名+动机注释齐备。

---

# 复审分册：M2 索引构建 · 2026-10-25 新判据重审

> 审计日期：2026-10-25｜点名范围：`treesearch/indexer.py`(2139) + `watch.py`(315) + `pathutil.py`(333)，共 2,787 行。
> 判据基线：同 M1 分册。方法：机械扫描（commit 点/async 形态/锁形态盘点）→ 旧账核对 → 2 组子代理并行（build_index+watch / pathutil+to_tree 装配层）→ 主代理交叉核实（全失败 chunk 提交门禁、watch 撞锁链路）。

## 旧账核对

| 旧条目 | 现状 |
|---|---|
| AP-4 build_index 680 行 God Function | 仍在；新增拆分障碍证据（嵌套协程闭包共享 `_pending_commits` 等非局部状态） |
| AP-17 watch 双实现 + 失败仅日志 | 仍在；本审计新发现其更严重的丢批形态（RI-4），AP-17 并入 RI-4 处置 |
| AP-9 async 外壳内全同步 | **新增三处实锤**（RI-2），旧账仅 treesearch.py 门面层 |

## 新发现条目（RI = re-audit M2）

### RI-1 全失败 chunk 的 failed_files 记录必丢：commit 门禁只数文档写入 [P1] [status: pending]
- **形态**：事务边界跨对象散布（M1 RM-9 的消费侧恶化点）+ 失败伪装
- **证据**：`indexer.py:1990` `if _pending_commits > 0: fts.commit()` 的门禁只被 `index_document` 成功路径递增（:1969）；`_index_one` 失败路径的 `upsert_failed_file`（:1851）与 `vision_enqueue`（:1829）发生在 gather 阶段、不递增计数。**某 chunk 全部文件解析失败时 `result_map` 为空 → 写循环零次进入 → `_pending_commits==0` → commit 跳过 → 整批失败记录挂在隐式事务上，直到 `finally: fts.close()`（:2138）回滚蒸发**。后果链：`max_index_fail_count` 熔断（:1739）拿不到输入 → 坏文件每次全量重试 → 失败台账永远空。
- **风险**：正确性已受损（P1）：损坏文件群（如一批加密 PDF）索引后 failed_files 表为空，宿主「索引失败」面板零显示，静默重试烧 CPU；与 RM-9（fts 侧裸 execute）同根——两侧合起来才是完整事务缺口。
- **修复方案**：`upsert_failed_file`/`vision_enqueue` 后也递增 `_pending_commits`（或失败记录独立小事务立即 commit）；与 RM-9 联动修（fts 侧四方法收事务 + indexer 侧门禁修正）。
- **回归验证**：新增「全失败 chunk 后 failed_files 可读」断言；`tests/test_index_chunking.py tests/test_lazy_search.py`。

### RI-2 async 解析外壳三处同步重活，信号量并发度退化为 1 [P2] [status: pending]
- **形态**：Blocking the Event Loop（async 外壳内同步重活；旧账 AP-9 的 indexer 层实锤）
- **证据**：① `indexer.py:611-655` `text_to_tree` async def 全程零 await（open+read+split+正则全是同步），经 `:1821` 未知扩展回落调用——每文件解析期间事件循环完全空转，`asyncio.gather` 退化为串行；② `:1836` `_generate_shadow_md`（markitdown 转换，普通 def）协程内直调；③ `:1795-1798` image_store/pst_att_store purge 同步文件删除。信号量形同虚设。
- **风险**：索引吞吐直接受损（并发度 1）；asyncio.run 的宿主（lazy 路径）索引期间事件循环被钉死。
- **修复方案**：同步重活包 `asyncio.to_thread`（text_to_tree 的 IO 段、shadow md、purge）；或 to_tree 系列去 async 壳改同步函数由线程池并发——与 AP-4 拆分联动定案。
- **回归验证**：`tests/test_index_chunking.py`；新增并发度不退化断言（多文件索引 wall time < 串行和）。

### RI-3 增量跳过路径逐文件 2 次 SQL 点查（常态热路径 N+1） [P2] [status: pending]
- **形态**：N+1 点查（每未变更文件 get_doc_id_by_source_path + has_docs_with_source_prefix）
- **证据**：`indexer.py:1711-1718` 对每个未变更文件执行 2 次独立 SQL。与 `:1621` 注释「Batch fetch all stored hashes in one query」的目标相悖——指纹比对批量化了，存在性校验仍逐条。大库常态运行绝大多数文件 unchanged，**这是稳态索引的主热点**；叠加 RM-1（instr 全表扫），has_docs_with_source_prefix 每次还是整库扫。
- **风险**：28.5 万文档库每次增量索引 57 万次 SQL 往返中此路径占大半；规模盲区判读 P2。
- **修复方案**：与 RM-1 联动——存在性校验批量化（一次 IN 查询）+ GLOB 化。
- **回归验证**：`tests/test_lazy_search.py tests/test_index_chunking.py`；大库增量索引 SQL 次数断言。

### RI-4 watch 撞锁静默丢批：build_index 撞 _NullLock 返回 [] 被记为成功 [P2] [status: pending]
- **形态**：失败伪装成空结果（空列表双语义：无变更 vs 被跳过）+ 竞态丢批
- **证据**：链路实证：`watch.py:106` `_flush` 先换出 pending 集合再调 on_batch → 上一批 build_index 执行中（大文件慢解析常见），新 Timer 线程并发进 `_do_reindex`（`:230-237`）→ 第二次 `build_index` 撞 `_NullLock` → `indexer.py:1601-1603` `logger.warning` 后 **`return []`** → `watch.py:237` 以 INFO「reindexed 0 file(s)」记成功。该批事件已从 pending 消费，**永久丢失**——文件在下一次变更前不再被索引，且 `watch.py:239-242` except 分支根本走不到（返回 [] 不抛异常）。旧账 AP-17「失败仅日志」只是其轻形态。
- **风险**：长解析场景（PST/大 PDF）下文件变更静默失索引，索引与磁盘漂移无信号——对 watch 守护场景是正确性问题。
- **修复方案**：build_index 撞锁时抛 `IndexLockedError`（或返回哨兵）而非 []；watch 侧撞锁批重新入 pending + 退避重试。
- **回归验证**：新增「撞锁批不丢失」并发测试；`tests/test_file_watcher_exclude.py tests/test_change_detection.py`。

### RI-5 解析降级三连：json/jsonl/csv 失败伪装成合法空结果 [P2] [status: pending]
- **形态**：失败伪装成空结果（M5 parsers 台账 AP-1 的 indexer 装配层同族）
- **证据**：① `indexer.py:866-880` `json_to_tree` 解析失败降级 text_to_tree，返回值与合法 JSON 结果不可区分（仅 debug 日志）；② `:983-984` `jsonl_to_tree` 全行失败返回空文本单节点树，与「文件真空」不可区分；③ `:1026-1027` `csv_to_tree` 空文件同款。对照同文件 `:1847-1857` per-file except 有完整信号（failed_paths + upsert）——正确范式就在旁边。
- **风险**：损坏 JSON 被静默索引为「文本结构」，检索质量下降且无失败面板痕迹；批量场景不可追溯。
- **修复方案**：三处降级在返回结构带 `degraded`/`parse_error` 标志，装配层记 failed_files 或统计；与 M5 AP-1（PDF 吞异常）同批治理。
- **回归验证**：`tests/test_anydoc_parser.py`；新增降级可观测断言。

### RI-6 派生路径 `#`/`__` 分隔符契约跨文件手抄 4+ 处 [P3] [status: pending]
- **形态**：手抄跨文件契约字面量（Duplicated Source of Truth）
- **证据**：`indexer.py:1907/1668/1718/1920/2069` 多文档源 `"<file>#<entry_id>"` 的 `#` 分隔符在 indexer 内手抄 4 处（各附注释重新解释）；派生 doc_id `__` 连接/`rsplit("__",1)`（:1909/1928）同理。该前缀同时是 fts.py `get_doc_ids_by_source_prefix` 的查询契约——双文件各写各的。另 `:1317` 图像指纹扩展名元组硬编码，注释自认「与 image_metadata.INTERSEPTED_IMAGE_EXTS 一致」靠注释维持；`:1797` `.pst` 魔法串特判。
- **风险**：纯演进风险；改分隔符契约需 6+ 处同步，漏一处即派生文档孤儿化。
- **修复方案**：`derive_entry_path(base, entry_id)` / `split_entry_path()` 单一真源入 pathutil；图像扩展名 import image_metadata 常量。
- **回归验证**：`tests/test_pst_parser.py tests/test_lazy_search.py`。

### RI-7 Windows 锁分支窄缝 + `_file_hash_with_salts` 裸 pass [P3] [status: pending]
- **形态**：异常路径资源泄漏（窄缝）+ Error Hiding（裸 pass）
- **证据**：① `indexer.py:1217` Windows 分支 open 后至首次 locking 前，非 OSError 异常路径 f 不 close（Unix 分支 :1185-1188 有兜底，Windows 缺）；② `:1322-1323` 图像指纹 `except Exception: pass` 回退 stat——吞掉所有异常类型含逻辑错误，零日志。
- **风险**：低概率泄漏 + 调试盲区；Windows 是本仓主平台。
- **修复方案**：Windows 分支补 try/finally；裸 pass 收窄为预期异常 + debug 日志。
- **回归验证**：`tests/test_lazy_search.py`；锁相关既有测试。

## 灰色项（证据不足，挂账待证）

- `_detect_and_apply_moves`（:1345-1450）逐文件 hash/stat：move 检测需内容指纹属设计意图，实测占比缺 trace——与 bc878c03（AP-11 已修主路径）对照后若仍显著再立案。
- `_should_ignore_dir` fnmatch 逐 pattern：CPython `_compile_pattern` 有 lru_cache，热缓存下成本≈0——维持灰色。
- `collect_known_text_extensions` 每 run 重建（无缓存）：单 run 一次，成本可忽略——维持 M3 灰色结论。
- `pathutil.py:180` gitignore 逐条 match_file：为消除 copy-drift 的有意设计换来的代价（docstring 自证），pathspec 有 match_files 批量接口——若 profile 显示热点再优化。

## 反证归档（M2 清查判「有意设计」，不立案）

- 指纹 mtime 短路：`file_hash` docstring 明示 stat 模式 `(mtime_ns:size)`——增量比对非全量重算。
- `_index_one` 失败记录动作完整（warning+upsert+timings+stats）——缺陷在 RI-1 的事务门禁，非记录缺失。
- watchdog 派发线程不被阻塞：notify 仅持锁 set-add + Timer 重启，重活在 Timer 线程。
- `is_gitignored` 单一匹配谓词（1.2.8 起 public）：为消除 indexer/宿主双实现漂移的有意治理。
- `_find_gitignore` 只查根目录一层：避免父 .gitignore 全灭子目录索引，行为契约。
- shadow MD 失败仅 debug：辅助产物不中断主索引流，返回值无污染——与 RI-5 的伪装形态不同。
- 扩展名→source_type 映射单一持有于 registry.SOURCE_TYPE_MAP，pathutil 只 import 不复制。

---

# 复审分册：M4 门面与配置 · 2026-10-25 新判据重审

> 审计日期：2026-10-25｜点名范围：`treesearch/treesearch.py`(661) + `cli.py`(554) + `config.py`(218) + `ripgrep.py`(158) + `__init__`/`__main__`(59)，共 1,650 行。
> 判据基线：同 M1 分册。方法：机械扫描（timeout/except/get_config 盘点）→ 2 组子代理并行（treesearch+config / cli+ripgrep+init）→ 主代理合并。

## 旧账核对（全部未修，两条恶化）

| 旧条目 | 现状 |
|---|---|
| AP-1 abatch 元组 bug | **未修**：`treesearch.py:404` 仍漏解包，`:410` bool 被当路径传入 build_index |
| AP-2 构造改写全局配置 | **未修且恶化**：守卫 `not self.config.fts_db_path` 造成跨实例顺序依赖——首实例写脏全局后，后续不同 db_path 实例读到残留值不再覆写，FTS 库路径取决于构造顺序 |
| AP-5 asearch/abatch 复制漂移 | **未修且漂移加深**：abatch 完全缺失 `has_orphans` 分支（asearch :244/:249-252 有）——文件删除/移动场景 abatch 永不清理孤儿 |
| AP-13 参数表膨胀 | 未收敛：`__init__` kwargs + aindex/asearch/abatch 各自 kwargs 双层叠加 |
| AP-16 杂项 | 未核细节（M4 范围内 cli 默认目录落 cwd 项与 RC-4 合并观察） |

## 新发现条目（RC = re-audit M4）

### RC-1 rg 降级三态失败（超时/rg 缺失/零命中）返回同形 `{}` [P2] [status: pending]
- **形态**：失败伪装成空结果（口径分裂家族：同一返回值三语义）
- **证据**：`ripgrep.py:129-134` TimeoutExpired 与 OSError/FileNotFoundError（含 rg 未安装）均 `return {}`；:136-137 真实零命中同形。下游 grep 过滤器把「rg 缺失/超时」静默降级为「该过滤器无命中」——doclens 侧 grep 链路（AP-46 四态枚举修复 c7d1a1d0）已治理**宿主侧**，treesearch 包内降级层仍是三态混一。
- **风险**：宿主 grep 显示「0 命中」实为 rg 未安装时用户被误导；批量评测把 rg 缺失记成召回率 0（横切判读③实证反面）。
- **修复方案**：`_run_rg` 失败上抛 `RgUnavailable/RgTimeout`（或返回哨兵），调用方决定降级策略并透传给宿主四态枚举。
- **回归验证**：`tests/test_grep_corpus_bypass.py` + rg 缺失场景断言。

### RC-2 门面层全部重操作零超时，首次 search 可无限期阻塞 [P2] [status: pending]
- **形态**：无墙钟上限的外部调用（e8acbc9d 同族——LLM 超时修复的库层缺口）
- **证据**：`treesearch.py:173-184`（await build_index）、`:252-259`（search 内嵌 aindex）、`:271/:327`（await search）、`:432`（gather）——全文件零 `asyncio.wait_for`（grep 确认）。首次 search 触发全量索引（默认 1 万文件量级）调用方无任何墙钟保护；cli.py 侧同样无 `--timeout`。
- **风险**：宿主 lazy 路径（`_lazy_search=True`）由 doclens 侧治理，但 treesearchlib 公开包的多实例/CLI 用法裸奔；挂死即 RI-2 的同步重活 × 无超时双重叠加。
- **修复方案**：门面层提供可选 `index_timeout_s`/`search_timeout_s`（默认不限保持兼容，宿主传入）；cli 加 `--timeout`。
- **回归验证**：新增超时触发返回明确错误断言；`tests/test_lazy_search.py`。

### RC-3 `get_indexed_files` 全量树解析只取 4 个元数据字段 [P2] [status: pending]
- **形态**：全量拉取给小消费方（RM-4 门面层消费形态）
- **证据**：`treesearch.py:507` `load_documents(self.db_path)` 全量解析所有文档树，仅提取 source_path/doc_id/doc_name/source_type 返回（:509-515）——纯元数据需求应有轻量 SQL（对照 fts.py:1878 `load_doc_id_source_paths` 已存在两列版）。另 `:240-241`/`:401-402` 缓存路径 `load_all_documents` 全量解析后，变更场景（else 分支）结果直接丢弃重 load——白做一次且 cached_docs 驻内存到函数返回。
- **风险**：28.5 万库上 get_indexed_files/首次带变更 search 都是 O(库) blob 反序列化分钟级（RM-4 的放大器）。
- **修复方案**：get_indexed_files 改元数据 SQL 直查（documents 表四列）；缓存路径变更判定只需 stored_meta，docs 加载延后到确认无变更分支。
- **回归验证**：`tests/test_lazy_search.py`；get_indexed_files 行为等价断言。

### RC-4 cli.py 手抄默认值已漂移：两处 search-mode 缺省不一致 [P3] [status: pending]
- **形态**：手抄跨文件契约字面量（同值多处定义已现行为分裂——横切判读④指纹）
- **证据**：`"index.db"` 字面量 cli.py 内 ≥4 处（:60/:199/:250/:399）；`"./indexes"` 默认目录 :157/:217 两份；`max_nodes=5` :447 与 :237 两份；**已漂移实锤**：默认模式 `--search-mode` 缺省 `"tree"`（:449）vs `search` 子命令缺省 `"auto"`（:239）——同语义两默认值分叉。
- **风险**：CLI 用户两种入口得到不同搜索行为；继续演化加剧。
- **修复方案**：cli 默认值统一引用 config.py 单源（`from .config import get_config`）；search-mode 分叉需用户决策哪个是意图（tree 还是 auto）。
- **回归验证**：cli 冒烟测试；两入口行为一致断言。

### RC-5 sync 包装 loop 探测块逐字复制 ×3 [P3] [status: pending]
- **形态**：硬编码散布同根注入点（AP-15 三处复制的残留——旧账记 :1469 等，现为 :198-205/:344-351/:459-468）
- **证据**：同段「get_running_loop → RuntimeError 字符串匹配」逐字三份；字符串匹配 `"Event loop is already running"` 是对 CPython 异常消息的隐式契约，三处需同步改。AP-15 旧账已立案但 10-20 后未修，行号漂移，本条确认仍在。
- **风险**：纯演进风险（P3）；AP-1/5 的复制漂移前科证明本仓复制块必漂移。
- **修复方案**：抽 `_run_sync(coro)` 单点（AP-15 方案），三处调用。
- **回归验证**：`tests/test_lazy_search.py`。

### RC-6 lazy 路径文档加载失败静默过滤为空结果 [P3] [status: pending]
- **形态**：失败伪装成空结果（轻形态）
- **证据**：`treesearch.py:318-321` `fts.load_document(did)` 返回 None 的文档被列表推导静默丢弃；全 None 时 `:322-323` 返回 `_empty_result()`——「无匹配」与「索引元数据在但文档树损坏」不可区分（对照 RM-7/RI-5 家族）。
- **风险**：DB 半损坏（结构在树损坏）时搜索静默空，排障无信号。
- **修复方案**：加载失败计入 warning + 结果附 `degraded_doc_ids`；与 RM-7 统一口径。
- **回归验证**：`tests/test_lazy_search.py`；半损坏库场景断言。

### RC-7 `_env_int` 非法环境变量静默回退默认值 [P4] [status: pending]
- **形态**：Error Hiding（配置层轻形态）
- **证据**：`config.py:56-57` `except ValueError: pass`——TREESEARCH_* 整型值非法时无日志退回默认，运维设错值无告警线索。
- **风险**：低（P4 记录）：配置调优失败静默，用户以为生效。
- **修复方案**：补 `logger.warning` 一行。
- **回归验证**：config 既有测试。

### RC-8 config 可变单例 reset 后新旧并存 [P4] [status: pending]
- **形态**：全局可变单例当传参通道（AP-2 家族的配置层半边）
- **证据**：`config.py:64-65` TreeSearchConfig 非 frozen；`reset_config`（:215-218）仅置 None——已持旧引用的实例（treesearch.py:96 `self.config` 捕获）与全局脱钩，同进程新旧配置并存。
- **风险**：低（P4）：宿主测试/reset 场景行为不可预期；与 AP-2 联动时放大。
- **修复方案**：frozen dataclass + `get_config` 每次读全局；或 reset 时广播失效。
- **回归验证**：config 既有测试。

## 灰色项（证据不足，挂账待证）

- 门面 `_get_changed_files`（:114-155）与 indexer 内部变更检测是否双份实现——需读 indexer 侧比对（M2 审计未覆盖该函数本体），挂账。
- `save_index`（:631-634）对已有 DB 逐 doc index_document 的幂等性——取决于 fts.py 行为，RM 系列修复时顺带验证。
- cli 无 progress_callback（仅首尾两行日志）——判据 3 在 cli 层无嫌疑；indexer 侧回调频率 M2 已确认有锁保护。

## 反证归档（M4 清查判「有意设计」，不立案）

- lazy 路径信任 DB 不自愈：构造 docstring :81-88 与 `_asearch_lazy` :276-2778 双重显式声明「宿主拥有索引新鲜度」契约——契约臆测判据不成立。
- sync 包装 `except RuntimeError: pass`：探测型惯用法（无 loop 时抛 RuntimeError 是预期分支），运行中错误被 re-raise，异常分流正确——RC-5 只立案复制不立案吞错。
- rg `--max-count 100` 每文件限流、Windows 命令行长度切批常量带注释——rg 层有有意限流。
- `cli.py:379` verify 输出 `items[:5]` 截断——部分路径有 LIMIT 意识（反衬 :202 全量 TOC 打印更像遗漏，入 RC-4 附注）。
- `ripgrep.py:145` JSONDecodeError continue——rg --json 输出非 match 行的解析设计。

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-10-22 | AP-3 令 | AP-3 共享连接加锁串行化 | done(3cbf46bf) |
| 2026-10-22 | AP-2 令 | AP-2 fts.search() 批量回查 | done(47376778) |
| 2026-10-25 | M1 复审 | 旧账核对：AP-12 随评分治理收敛标 done；AP-14 转入 RM-6 | 见复审分册 |
| 2026-10-25 | M1 复审 | 新立 RM-1~RM-10（P1×1 / P2×5 / P3×3 + 旧账升级 RM-7） | pending |
| 2026-10-25 | M3 复审 | 新立 RS-1~RS-6（P2×2 / P3×4）；AP-6 仍在、AP-7 补充证据并入 RS-3；AP-9 归 M2 | pending |
| 2026-10-25 | M2 复审 | 新立 RI-1~RI-7（P1×1 / P2×4 / P3×2）；AP-9 三处实锤归 RI-2；AP-17 并入 RI-4 处置 | pending |
| 2026-10-25 | M4 复审 | 新立 RC-1~RC-8（P2×3 / P3×3 / P4×2）；旧账 AP-1/2/5 未修且 AP-2/5 恶化（新证据入台账） | pending |
