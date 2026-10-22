# 知识库搜索与评分链路（doclens + treesearch） 反模式审计台账

> 审计日期：2026-10-22｜点名范围：知识库搜索 + 评分两模块——treesearch（fts.py、indexer.py、search.py、tree_searcher.py、treesearch.py、heuristics.py、tokenizer.py、tree.py、ripgrep.py、pathutil.py）+ doclens（scoring.py、scoring_pipeline.py、ripgrep.py、index_manager.py、file_watcher.py、search_targets.py、kb_tools.py、web_v2/api/{search,grep,_grouping,_pathutil}.py），18 文件约 12.7k 行｜机械扫描：全仓（跨文件私有成员 import、行数 top、同值常量重复定义、架构守卫测试）
>
> **与既有台账的关系**：`treesearch-core.md`（2026-10-20，treesearch 16 文件）与 `doclens-backend.md`（doclens 全域）已覆盖部分重叠发现。本台账**不重复收录**，只收：① 本轮新发现；② 既有条目未覆盖的新证据维度。查重对照表见附录。

## 一、判据声明

- **栈清单**：`references/backend.md`（复检日期 2026-10-22，检索词 `SQLite FTS5 common mistakes anti-patterns bm25 rank performance` / `Python search engine code common anti-patterns sqlite connection management`——bm25 rank 性能、连接管理均为现行共识，无新增判据，附件未更新）。本次装载小节：Python 语言层、SQLite/FTS5、Web 框架层（仅 api 组）。
- **通用兜底**：`references/general.md` 系统架构层 + 后端模块层（全节装载不裁剪）。
- **仓库纪律附加判据**：根 `CLAUDE.md` 模块边界规则（treesearch/planify 禁 import doclens；禁跨模块私有成员 import；配置命名空间隔离）。机械扫描零命中违例。
- **架构守卫**：`tests/test_architecture.py` → **6 passed**。
- **探测到的栈**：Python 3 + SQLite/FTS5（treesearch）+ FastAPI/asyncio（doclens web_v2）+ subprocess(rg)。纯后端，无前端域。

## 二、发现条目

### AP-1 评分三轨制：scoring_pipeline / kb_tools / cortex_cli 各持一份「评分→过滤→降级→排序」编排，且已行为分叉 [P2] [status: pending]
- **形态**：Duplicated Source of Truth + Copy-and-Paste Programming（伴生 Shotgun Surgery）
- **证据**：
  - `doclens/scoring_pipeline.py:41-63`（score_and_rank）与 `doclens/kb_tools.py:1048-1103` 同构编排；`doclens/cortex_cli.py:253-263` 调 score_and_rank 后又做第三份阈值过滤。
  - **分叉实证**：`scoring_pipeline.py:103` 给 `compute_composite_score` 传文档级 `doc_fts_best.get(doc_id)`；而 `kb_tools.py:1048-1052` 注释明言「原实现误用文档级分数，节点间无区分度」并改为节点级分——**管线版保留了 kb_tools 已修复的缺陷**（同一文档全部节点拿同一 fts 分，节点排序退化为 title/proximity 因子）。
  - kb_tools 偏离管线有 2026-10-19 注释决策（候选改用引擎已精排节点），但「编排重复」仍在：一条评分规则改动需散改 scoring.py / scoring_pipeline.py / kb_tools.py / cortex_cli.py 四处。
- **风险**：AI 侧（kb_tools）与 Web/CLI 侧（scoring_pipeline）对同一查询给出不同排序——用户在搜索页看到的名次与 AI 引用的名次不一致，且随时间继续漂移。
- **修复方案**：以 scoring_pipeline 为唯一编排点，kb_tools 改为调 `score_and_rank` 并把节点级 fts 分的修复（kb_tools 现行口径）回灌管线（契约变更：score_and_rank 的 fts_score 取数口径从 doc 级改为 node 级，需同步 web 侧断言）；cortex_cli 的第三份过滤并入管线可选参数。
- **回归验证**：`tests/test_web_search_api_matrix.py`（web 侧排序断言）+ kb_tools 相关搜索测试；评分口径变化需先在两入口对拍同一查询的排序快照。

### AP-2 search() 结果去重 O(n²) 内层扫描 + 逐 nid fetchone 回查 [P2] [status: pending]
- **形态**：N+1 查询（后端栈清单）
- **证据**：`treesearch/fts.py:1030-1042`——对每个 unique nid：内层再扫全 rows 找 doc_id（O(n²)），随后逐条 `fetchone` 回查 nodes 表（O(n) 次 SQL 往返）。结果集数百节点时即数百次单行查询。
- **风险**：搜索热路径延迟随结果集规模平方增长；doclens 默认 top_k 50 时已有 50+ 次额外查询，大语料宽查询（如高频词）结果集可达 LIMIT 5000 档位。
- **修复方案**：① rows 本身携带 doc_id 时建 nid→doc 索引 dict 消掉内层扫描；② 批量回查 nodes（`WHERE nid IN (...)` 分批）或让首查直接 JOIN 出所需列。
- **回归验证**：`tests/test_lazy_search.py tests/test_search_preset_params.py`；加结果集 ≥500 的延迟对照断言（可选）。

### AP-3 单 SQLite 连接 `check_same_thread=False` 跨线程共享、全模块零锁 [P2] [status: pending]
- **形态**：Race Hazard（功能层兜底）+ SQLite 栈清单「每请求开关连接」的反面陷阱
- **证据**：`treesearch/fts.py:330` `sqlite3.connect(..., check_same_thread=False)`；`grep threading|Lock|_lock` 全文件零命中。宿主线程模型坐实并发面：`doclens/index_manager.py` 后台 reindex 线程（`:608` 置 `_needs_reload`）与 uvicorn 工作线程（`api/search.py:109` `asyncio.to_thread`）**共用同一全局单例连接**（`get_fts_index`，fts.py:2659-2676）。
- **风险**：sqlite3 连接非线程安全（Python 官方：跨线程使用需外部串行化）。搜索线程执行 MATCH 查询期间后台线程 commit 建索引 → `sqlite3.ProgrammingError` / 游标失效 / 偶发空结果。现有「未炸」依赖时序运气：watcher 防抖使 reindex 突发概率低。treesearch-core 台账 AP-2 已记录单例互关面，但**零锁共享**这一并发维度是本轮新证据。
- **修复方案**：`FTS5Index` 内建 `threading.RLock` 串行化全部 execute/commit 路径（粗锁即可，SQLite 本身串行）；或改 per-thread 连接 + WAL（多读单写天然合拍）。与 treesearch-core AP-2 的 registry 方案协同设计。
- **回归验证**：新增「搜索与建索引并发」压力测试（线程池交替 search/index_document 断言无异常）；`tests/test_lazy_search.py tests/test_web_search_api_matrix.py tests/test_architecture.py`。

### AP-4 护栏被异常路径静默绕过：REGEXP 腿节点计数失败按 0 处理 → 分钟级全表 UDF 扫描放行 [P2] [status: pending]
- **形态**：Error Hiding + 护栏语义失效
- **证据**：`doclens/ripgrep.py:397-410` `_binary_doc_profile` 二进制子集节点计数失败「按 0 处理」（注释自述）；`execute_grep_search:801/818` 护栏判断 `nodes > REGEXP_SKIP_NODES_THRESHOLD`（100_000）——计数为 0 时护栏**恒假**。文件 `:30` 行注释明示该护栏要防「分钟级全表 UDF 扫描」。
- **风险**：恰好计数腿异常的大库 regex 查询被放行走 REGEXP 全表扫描，AI 工具（kb_grep）一次调用挂起分钟级；失败与「小库」不可区分。
- **修复方案**：计数失败时按 `math.inf`/哨兵大值处理（fail-closed：宁可拒绝 regex 降级 rg，不放行全表扫），并在结果 notes 标注计数失败原因。
- **回归验证**：`tests/test_grep_tool.py tests/test_grep_corpus_bypass.py`；新增「计数失败 → regex 被拒并带 note」单测。

### AP-5 REGEXP 腿异常静默返回空，与 rg 腿治理口径不一致 [P3] [status: pending]
- **形态**：Error Hiding
- **证据**：`doclens/ripgrep.py:677-686` `_regexp_search_subset` 两处 `except Exception → return []`；调用方 `execute_grep_search:807/824/839` 无法区分「扫描失败」与「无命中」，不加 note。对照：同文件 AP-46 修复（`:12-19、765-775`）已为 rg 腿建立「失败 ≠ 无结果」口径。
- **风险**：regex 语法错/超时被报告为「无匹配」，AI 据此输出错误结论（与 AP-45「索引不可读 ≠ 没有匹配」的既有决议精神相悖）。
- **修复方案**：异常上抛或返回 `(results, error_note)`；调用方按 AP-46 口径填 notes。
- **回归验证**：`tests/test_grep_tool.py tests/test_grep_regex_snippet.py`。

### AP-6 /api/search 后处理在事件循环内同步执行（对照 grep 端点已入线程的不对称） [P2] [status: done]
- **形态**：Blocking the Event Loop（Web 框架栈清单）
- **证据**：`doclens/web_v2/api/search.py:133-137`——仅 `_do_search` 进了 `asyncio.to_thread`，随后 `_scored_to_group_items`（`:75-100` 对全部命中节点文本逐条 `extract_match_rows` 子串扫描）与 `group_and_paginate` 在事件循环线程同步执行。对照 `grep.py:36-58` 把同类 `extract_match_rows` 扫描放进了线程内 `_do_grep`——**同文件族内两端点处理口径不一致**，证明该扫描被公认可感知。
- **风险**：宽查询（数千节点 × 多 matcher）期间整个 uvicorn 事件循环冻结：所有并发请求（含 SSE chat 流）卡顿，P95 延迟毛刺。
- **修复方案**：把 matchers 构建 + `_scored_to_group_items` + `group_and_paginate` 一并移入 `to_thread` 的 `_do_search`（或第二个 to_thread 调用）。
- **回归验证**：`tests/test_web_search_api_matrix.py`；前端无涉（纯后端编排），无需 build。
- **实际修复（2026-10-22）**：后处理抽为 `_group_results(result, query_words, idx, offset, limit)`（matchers 构建 + 命中行提取 + 分组分页一体），端点内第二次 `asyncio.to_thread(_group_results, ...)` 调用——对齐 /api/grep 口径。不动 `_do_search` 契约（tests 用 monkeypatch 打模块属性并断言 3 元组返回，零改动兼容）。文件内 `build_substring_matchers`/`group_and_paginate` 的直接 import 因 `_group_results` 仍在同文件消费而保留。
- **回归结果**：`tests/test_web_search_api_matrix.py tests/test_index_availability.py tests/test_search_candidate_pool.py` → 51 passed；`tests/test_web_search_grouping.py tests/test_architecture.py` → 25 passed。

### AP-7 kb_tools 自管事件循环跑同步壳（sync-async 倒置）[P2] [status: done]
- **形态**：事件循环管理反模式（Web 框架栈清单「sync SDK 直调」的变体）
- **证据**：`doclens/kb_tools.py:555-564` `_get_or_create_event_loop` + `:584-585` `loop.run_until_complete(parser_fn(...))`：每次调用可能新建事件循环且**从不关闭**；宿主线程已有 running loop 时直接 RuntimeError。
- **风险**：① kb_tools 由 AI agent 调用，宿主（planify）若在异步上下文内同步调 handler 即崩；② 反复 new loop + 不关闭 = 资源泄漏（watcher/selector 句柄）；③ `asyncio.get_event_loop` 在 3.12+ 无运行循环时已 DeprecationWarning，3.14 起报错——升级即断。
- **修复方案**：解析器调用改 `asyncio.run()`（每调用干净起停），或给 parser 层提供同步入口/线程池包装；与 planify 侧调用方式（`to_thread` 或直调）对齐后定案。
- **回归验证**：`tests/test_docx_parser.py tests/test_anydoc_parser.py`（解析链路）+ kb_tools 相关测试；补「已有 running loop 时调用不崩」单测。
- **实际修复（2026-10-22）**：调用链核实——planify `StreamingAgent._run_handler` 对同步 handler 统一 `asyncio.to_thread`（`planify/streaming/runner.py:1155`），CLI（`cortex_cli.py:1046`）/MCP（`mcp_server.py:106`）为纯同步上下文，**无 running loop 内调用场景**，`asyncio.run()` 为最小正解。`_get_or_create_event_loop` 删除，替换为 `_run_async_parser(parser_fn, file_path)`（docstring 写明调用方契约：不得在 running loop 线程内调用 + 三类消费方安全性依据）。
- **回归结果**：新增 `tests/test_kb_tools_async_parser.py`（2 例：线程池形态解析成功 + 循环零残留）；`tests/test_anydoc_parser.py tests/test_docx_parser.py` → 13 passed 1 skipped；`tests/test_architecture.py` → 6 passed（首版测试因模块级私有 import 被守卫拦下，改为函数内 import——守卫白名单惯例）。

### AP-8 kb_tools 三处吞异常改变行为分支（Error Hiding 实害版）[P2] [status: pending]
- **形态**：Error Hiding（失败被转译成行为漂移）
- **证据**：
  - `doclens/kb_tools.py:644-646` `_load_doc_by_source_path` 裸 `except Exception → logger.debug + return None`：DB 损坏/锁死被伪装成「未入索引」，ghost 闸门与索引优先加载据此走错分支；
  - `:1213-1215` `_is_ghost_registered` 同款 `→ return False`：索引读失败时 ghost 闸门静默放行，`read_document` 改走现场解析——路径漂移不可察觉；
  - `:463-466` `_kb_stats` 中 `except OSError: pass`：文件总大小静默少算。
  - 对照反证：`:990-1005` 空库与索引不可读的区分（AP-45 决议）证明本文件已有「失败要可见」的治理标准，这三处是漏网点。
- **风险**：AI 工具在索引异常时输出「文档不存在」类幻觉结论，用户无从分辨是索引坏了还是真没有。
- **修复方案**：三处改上抛或返回带错误注记的结果（对齐 AP-45 口径：错误信息进工具输出，让 AI 自己声明降级）。
- **回归验证**：kb_tools 搜索/读取相关测试 + `tests/test_web_search_api_matrix.py`（若共享口径）。

### AP-9 tokenize_query + 空回退两字不差复制于 API 层与工具层 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming / Duplicated Source of Truth
- **证据**：`doclens/kb_tools.py:1018-1025` 与 `doclens/web_v2/api/search.py:54-56`——`tokenize_query` 调用 + 空结果回退 `[w.strip() for w in query.split()]` 完全相同。词切分契约（CJK 处理、回退语义）无单一真相源。
- **风险**：回退语义调整（如加标点剥离）只改一处 → Web 高亮词与 AI 检索词口径分裂，高亮缺失/多亮。
- **修复方案**：抽 `doclens/query_words.py`（或并入 scoring_pipeline 旁的公共模块）单一 `tokenize_query_with_fallback(query)`。
- **回归验证**：`tests/test_web_search_api_matrix.py` + kb_tools 搜索测试。

### AP-10 评分结果裸 tuple 多处流转、元数不一、位置下标取值 [P3] [status: pending]
- **形态**：Primitive Obsession
- **证据**：候选结果为 6~8 元位置元组：`scoring_pipeline.py:108/113/120`（6 元）、`kb_tools.py:1071/1094`（8 元，`item[:8]` 解包）、`ripgrep.py:199/251/457`（6 元）；消费侧靠 `item[2]/item[5]` 位置索引（`scoring_pipeline.py:49/126`、`kb_tools.py:1082`），`web_v2/api/search.py:93` 还需注释「rg 结果为 6 元（尾元=matched 词列表）」对齐口径。weights 亦为字符串键裸 dict（`scoring.py:92-127` 八次 `weights.get("…")`）。
- **风险**：任何一轨增删字段（见 AP-1 三轨制）即位置错位静默取错值——编译期无保护，测试靠巧合覆盖。
- **修复方案**：`ScoredCandidate` NamedTuple/dataclass 统一三轨（与 AP-1 一并做收益最大）；weights 升级 `ScoringWeights` dataclass（与 treesearch-core AP-12 协同）。
- **回归验证**：AP-1 同套 + `tests/test_web_search_grouping.py`。

### AP-11 「空 GroupedSearchResponse + error」构造三份跨两端点复制 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`doclens/web_v2/api/search.py:116-122/125-131` 与 `grep.py:81-86`——同构三段（groups=[]、error、notes、elapsed_ms），仅文案不同。
- **风险**：响应模型加字段（如 severity）需三处同步；漏一处则前端两入口错误呈现不一致。
- **修复方案**：抽 `_empty_response_with_error(query, error, notes, start)` 共享构造（放 api/_common 或直接复用 GroupedSearchResponse 工厂）。
- **回归验证**：`tests/test_web_search_api_matrix.py`（error 路径断言已覆盖两入口）。

### AP-12 index_manager ↔ ripgrep 模块环靠函数内 import 掩盖 [P3] [status: pending]
- **形态**：Circular Dependency（延迟 import 掩盖）——违反仓库纪律「分层单向」精神（doclens 内部同守规矩条款）
- **证据**：`doclens/index_manager.py:759` 函数内 `from doclens.ripgrep import invalidate_binary_doc_profile` ↔ `doclens/ripgrep.py:560` 函数内 `from doclens.index_manager import SUPPORTED_FORMATS`。环上共享常量 SUPPORTED_FORMATS。
- **风险**：任一引用提顶即 ImportError；SUPPORTED_FORMATS 语义变更需双模块同步（test_architecture 未守此环——它只守 treesearch/planify 边界）。
- **修复方案**：SUPPORTED_FORMATS 下沉到无依赖模块（如 `doclens/formats.py` 或并入 search_targets.py），两模块改为依赖它，环断开。
- **回归验证**：`tests/test_architecture.py` + `tests/test_grep_tool.py`；可考虑给 test_architecture 加 doclens 内部环检测（另立条目不扩本条）。

### AP-13 load_or_build_index 的 check-then-act 无锁清位（_needs_reload 丢失窗口）[P2] [status: pending]
- **形态**：Race Hazard
- **证据**：`doclens/index_manager.py:687-691`——无锁下 `if self._ts is not None and not self._needs_reload: return True` 早退，随后 `self._needs_reload = False` 清位；后台 reindex 线程 `:608` 置 `_needs_reload = True`。若清位与置位交错（两搜索线程并发、或搜索线程与 reindex 完成交错），标记被覆盖丢失——**本次搜索用旧索引且永不补审计**（该标记是 `doclens-backend.md` AP-11 修复后唯一的 reload 触发源）。`_ts` 句柄读换写（`:687/694`）同样无锁。
- **风险**：reindex 完成后的首搜索可能拿旧 path_map/旧树（用户改完文件搜不到新内容），且无自愈——直到下次文件变化。低频但属正确性受损。
- **修复方案**：`_needs_reload` 检查+清位移入既有 `_build_cond`/`_reindex_lock` 保护域，或改用标志+版本号（读时快照版本，reindex 递增版本）；`_ts` 换柄同样加锁。
- **回归验证**：新增「reindex 完成与并发搜索交错」单测（monkeypatch 时序）；`tests/test_lazy_search.py tests/test_change_detection.py`。

### AP-14 后台 reindex 统计失败静默归零，/api/status 呈假 0 [P2] [status: pending]
- **形态**：Error Hiding / Caching Failure
- **证据**：`doclens/index_manager.py:584-585` 后台 reindex 后取失败文件统计抛错仅 `logger.debug`，`failed_count` 保持 0，`:621` 写入 `_last_failed_count` 经 `/api/status` 暴露；`:624` `on_complete(True, ...)` 仍报 success。与 `:62-65` 注释「前端只能靠此字段看到失败数」直接冲突。
- **风险**：批量索引失败（如 PST 解析集体挂）在状态页显示 0 失败——用户以为索引完整，实际缺文档；搜索结果静默缺失。
- **修复方案**：统计失败时置 `failed_count=None`（前端显示「未知」）或沿用上次值 + warning 日志；不与 on_complete 的 success 语义混叠。
- **回归验证**：`tests/test_web_status.py`（若存在）或 status 端点测试；`tests/test_change_detection.py`。

### AP-15 reindex 期间 monkey-patch 实例方法做进度追踪 [P3] [status: pending]
- **形态**：Action at a Distance（隐式契约）
- **证据**：`doclens/index_manager.py:807` `self._ts.index_document = wrapped_index_doc` 运行时替换依赖对象方法，`:837` finally 恢复。reindex 期间其他线程经同一 `_ts` 调用看到的也是被包裹方法（叠加 AP-3 的共享连接，交错面更大）。
- **风险**：包裹版行为（进度计数副作用）泄漏给并发搜索触发的 lazy 补录路径；未来 `_ts` 换实现（如 AP-12/core-AP-2 的 registry）此 patch 静默失效。
- **修复方案**：进度追踪改回调注入（index_document 已有 callback 参数体系，indexer.py 三份 commit 循环同用）或独立计数器装饰，不打补丁。
- **回归验证**：`tests/test_change_detection.py tests/test_index_chunking.py`。

### AP-16 进度发布 payload 两份手写、EventBus 契约无共享构造点 [P3] [status: pending]
- **形态**：Duplicated Source of Truth / Divergent Change 苗头
- **证据**：`doclens/index_manager.py:545-556`（_bg_work）与 `:813-822`（_reindex_internal）两份几乎相同的 `publish_progress`，payload 字段（event_type/current_file/indexed_count/timestamp）手写隐式契约；消费方 tui/status_bar 与 watch_broker 按字段名取值。
- **风险**：进度展示需求（加字段如 failed_count）改两处漏一处 → TUI 静默丢字段。
- **修复方案**：抽 `_publish_progress(event, current_file, indexed_count)` 单点（dataclass/TypedDict 定契约）。
- **回归验证**：`tests/test_change_detection.py`；TUI 侧无自动化则人工冒烟。

### AP-17 fts.py 60+ 处 row[N] 魔法下标取列 [P3] [status: pending]
- **形态**：忽略 row factory（SQLite 栈清单）/ Magic Numbers 变体
- **证据**：`treesearch/fts.py` 全文件无一处 `row_factory`；`row[0]…row[6]` 解包与 SELECT 列序相距 5~20 行：`:521、:602-607、:1042、:1106、:1228-1240、:1623-1631、:1845-1853、:2209-2213`；`:1887` `row[0] or ""` 同源。ADR-0031 加列（`:403-410`）正是该形态的风险实证路径。
- **风险**：任何 SELECT 增删列/调序 → 解包静默错位取错值（不抛错、数据串列），排查成本极高。
- **修复方案**：连接建立即 `self._conn.row_factory = sqlite3.Row`，热点查询逐步迁移 `row["col"]`（可分批，不必一次全改）。
- **回归验证**：`tests/test_lazy_search.py tests/test_grep_corpus_bypass.py`（索引+查询全链路）。

### AP-18 indexer 三份同构 commit-batch 循环各自演化 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming（伴生 Shotgun Surgery）
- **证据**：`treesearch/indexer.py:1933-1941 / 1973-1983 / 2034-2041`——三份「index_document(auto_commit=False) → `_pending_commits ≥ 500` → fts.commit() → 清零」循环，仅常量名（`_COMMIT_BATCH` / `_COMMIT_BATCH_GHOST`）与上下文不同；批大小 500 在 `:1765/:1874` 两处独立硬编码。
- **风险**：调批大小/加 flush 时机只改一份 → 三条索引路径（主/ghost/repair）fsync 行为分裂，性能与崩溃恢复语义不一致。
- **修复方案**：抽 `_BatchCommitter` 上下文管理器（构造收 fts + batch_size，`add()` 内计数满即 commit）；与 treesearch-core AP-6（build_index 拆分）协同。
- **回归验证**：`tests/test_index_chunking.py tests/test_change_detection.py`。

### AP-19 级联删除逻辑三份复制（delete_document / delete_documents / repair_index）[P3] [status: pending]
- **形态**：Copy-and-Paste Programming + Shotgun Surgery 实证
- **证据**：`treesearch/fts.py:1857-1926`（delete_document）/ `:2043-2101`（delete_documents）/ `:2555-2586`（repair_index）——「fts_nodes(rowid) → nodes → documents → pst_email_meta → index_meta」四/五表级联删除三份复制。新增一张关联表（如未来加表）需同步改三处。
- **风险**：漏改一处 → 该路径删除留下孤儿行，索引 repair 语义漂移（与 core 台账 AP-8 孤儿治理主题同域）。
- **修复方案**：抽 `_cascade_delete_doc_ids(doc_ids)` 单点；三入口收敛调用。
- **回归验证**：`tests/test_lazy_search.py`；新增「三入口删除后无孤儿行」断言（sqlite 直接查表）。

### AP-20 score_nodes_batch 吞异常返回空 dict / _search_like Phase-2 吞异常返回空列表 [P3] [status: pending]
- **形态**：Error Hiding
- **证据**：`treesearch/fts.py:1474-1475` `except Exception: return {}`（查询失败/连接损坏与「无结果」不可区分，下游打分拿到全 0）；`:1281-1282` `_search_like` Phase-2 `except Exception: return []` 同款。对照反证：`:985-986` phrase boost 的 OperationalError 特化捕获带注释降级，是本文件正面写法。
- **风险**：DB 层故障被转译成「全部节点 fts 分为 0」——搜索仍返回结果但排序完全失真，比报错更难察觉。
- **修复方案**：异常上抛让调用方（search 层已有 IndexUnavailable 处理链）决策；或返回哨兵并记 warning。
- **回归验证**：`tests/test_lazy_search.py tests/test_web_search_api_matrix.py`（LIKE/降级路径）。

### AP-21 _build_flat_nodes 约 400 行 Long Method，内嵌三份同构 ctx 构建 [P3] [status: pending]
- **形态**：Long Method + Copy-and-Paste Programming
- **证据**：`treesearch/tree_searcher.py:603-1006`——缓存查询/截断/NodeContext 构建/7 个打分阶段/walk 注入/兜底补算/组装排序全部内联；`_ctx` 构建三份近乎复制（`:675-698` P0 主 pass、`:786-805` walk 注入、`:824-849` rerank 补 pass），各自演化（walk 版只算部分字段）；9 元组以模块级魔数下标 `_TITLE=0…_TEXTLEN=8` 访问约 30 处（`:670-673`）。
- **风险**：打分调参/加字段（ctx 加一列）需同步改三份+全部下标引用，漏改即静默用错字段值（与 AP-10 同性质）。
- **修复方案**：① ctx 构建抽 `_build_ctx(doc, node, fields)` 单点；② 9 元组改 NamedTuple（下标访问兼容，渐进迁移）；③ 函数按 7 阶段拆分（与 core 台账 AP-6 协同）。
- **回归验证**：`tests/test_search_preset_params.py tests/test_lazy_search.py`。

### AP-22 doclens 三处「doc_map → unindexed → 逐条 index_document」重复 + TreeSearcher 构造内重查 [P3] [status: pending]
- **形态**：Copy-and-Paste + Yo-yo Problem（同批数据沿调用链反复核验）
- **证据**：`treesearch/search.py:613-617`（search 路由）、`:1015-1017`（_get_fts_scorer）、`treesearch/tree_searcher.py:161-165`（_auto_score）三处几乎逐行重复补录逻辑；tree 路径下 search() 已补录后 TreeSearcher 构造又重查一遍 unindexed——同请求内同一校验穿 3 层做 2 次。
- **风险**：补录策略调整（如批量接口 `index_documents`）需改三处；每请求多付一轮全 doc_map 扫描。
- **修复方案**：补录收敛到 search() 入口单点（构造 TreeSearcher 时传入已补录标记/回调）；或 lazy_search 协议显式化「谁负责补录」。
- **回归验证**：`tests/test_lazy_search.py`（lazy 协议断言）。

### AP-23 pathutil 双轨同构：resolve_paths / iter_resolve_paths 演化分裂 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming（注释自白的 "Differences"）
- **证据**：`treesearch/pathutil.py:192-334`——同一套 glob/目录/文件三分支逻辑两份拷贝：前者 dedup+ghost_candidates+source_type_filter 旗标，后者无 dedup 无 ghost；config 覆盖逻辑 `:239-245` 与 `:309-314` 逐行重复；`iter_resolve_paths` docstring 自认 "Same resolution rules"。
- **风险**：路径解析规则修 bug（如 gitignore 边界）只修一份 → 建索引与变更检测看到不同文件集，增量索引静默漏文件。
- **修复方案**：iter 版为唯一实现（生成器），resolve_paths = `list(iter_resolve_paths(...)) + dedup + ghost 钩子`；差异点参数化。
- **回归验证**：`tests/test_change_detection.py tests/test_file_watcher_exclude.py`；补「两函数对同一输入产出一致（除 dedup/ghost）」对拍单测。

### AP-24 unindexed 补录 for 循环逐条 index_document，批量接口闲置 [P4] [status: pending]
- **形态**：N+1（缓解后残留）
- **证据**：`treesearch/search.py:616-617` / `tree_searcher.py:164-165` 逐条调 `index_document`；`FTS5Index.index_documents` 批量接口在 `tree_searcher.py:140` docstring 被提及却未用于此。每次 1 SQL 往返（非每节点），量级中等。
- **风险**：首批 lazy 补录多文档时延迟线性叠加；与 AP-22 收敛时一并处理即可。
- **修复方案**：改 `index_documents(batch)`；随 AP-22 一并做。
- **回归验证**：`tests/test_lazy_search.py`。

### AP-25 kb_tools 直改 IndexManager 私有字段绕过状态管理 [P3] [status: pending]
- **形态**：越界访问私有成员（违反仓库纪律规则 2 的 doclens 内部版）
- **证据**：`doclens/kb_tools.py:501-502` `_kb_reindex` 直接写 `idx_manager._ts`、`idx_manager._path_map`。同类：`grep_tools.py:312` 函数内 import execute_grep_search（一致性欠佳但非环）。
- **风险**：IndexManager 的换柄不变量（AP-13 的 _ts 读写窗口）被第二处写点打破——kb_reindex 与 load_or_build_index 并发时 _ts 状态竞争面翻倍；未来门面收紧（doclens-backend AP-9 后续）此处即静默崩。
- **修复方案**：IndexManager 提供 `swap_index(new_ts)` 公共方法（内含锁与 path_map 重建），kb_tools 改调它。
- **回归验证**：`tests/test_change_detection.py` + kb reindex 工具测试。

### AP-26 fts_expression 双入口消毒不一致 [P4] [status: pending]
- **形态**：Duplicated Source of Truth（入口语义分裂）
- **证据**：`treesearch/fts.py:2389-2391` `build_fts_expression` 用 `_RE_FTS5_SPECIAL` 清洗关键词；`:196-249` `_tokenize_fts_expression`（fts_expression 直达路径，search.py:517-539 显式宣传 raw 透传）仅分词不清特殊字符。MATCH 值均走 `?` 绑定（`:1002`）无 SQL 注入面；语法错被 `:1021-1023` 捕获记 warning——**风险仅剩查询报错降级**。
- **风险**：raw 透传是有意能力（高级用户写 NEAR/OR），但两个入口对特殊字符的存活语义未文档化，行为差异易被当 bug 报。
- **修复方案**：文档化双入口契约（raw 透传 vs 清洗）；或统一为「清洗可关」。记录即处置优先。
- **回归验证**：`tests/test_search_preset_params.py`（fts_expression 相关断言）。

### AP-27 杂项卫生打包 [P4] [status: pending]
- **形态**：Magic Numbers / 死代码 / 小重复（记录即处置）
- **证据**：
  - `fts.py:1931-1939` remove_document 已标 deprecated 指向 delete_document，死代码仍在（Lava Flow 待删）；
  - `ripgrep.py:199/251` 模式结果 tuple 硬编码 `len(query_words)` 当 matched、prox/fts 填 0——TUI/CLI 经 `scoring_pipeline.py:145` 消费时无重算（`execute_grep_search:855-861` 的 web 路径有重算覆盖），matched 虚高待下游核实；
  - `scoring_pipeline.py:45/57-61` 同阈值过滤两次（降级分支夹中间解释结构，一半冗余）；
  - `web_v2/api/grep.py:55` `first[:200]` 与 kb_tools `_HEAD_BUDGET_CHARS=200`（`:154`）语义不同却同值无出处；
  - `kb_tools.py:373-384` `_format_kb_results` 10 参数中 4 个默认值（800/10000/200/600）与模块常量 `:150-155` 重复定义；
  - `heuristics.py:220-294` 与 `tree_searcher.py` 七阶段系数（并入 treesearch-core AP-12，此处仅记 heuristics 侧 11 个裸权重）。
- **修复方案**：deprecated remove_document 直接删（有测试则同步）；其余择机随触及模块顺手收敛。
- **回归验证**：触及哪个跑哪个的同名测试 + `tests/test_architecture.py`。

## 三、新型态

（本轮无——所有发现均可归入既有形态词汇。其中「护栏被异常路径绕过」（AP-4）是 Error Hiding 与 fail-open/fail-closed 语义的复合形态，若后续在别处再次实证「降级值恰好使防护条件恒假」，可晋升为独立形态「Guard Value Confusion」。首次实证：本台账 AP-4。）

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-10-22 | 修 AP-6 | AP-6 | 后处理抽 `_group_results` + 第二次 `to_thread`；回归 76 passed |
| 2026-10-22 | 修 AP-7 | AP-7 | `_get_or_create_event_loop` 删除 → `_run_async_parser`（asyncio.run）；新增 2 例单测；解析器/架构回归全绿 |

## 附录：与既有台账查重对照

| 本轮发现 | 既有台账 | 处置 |
|---|---|---|
| — | treesearch-core AP-2（全局配置写入+单例互关） | 不重复收录；AP-3 补充「零锁跨线程共享」新证据维度并引用之 |
| — | treesearch-core AP-3（FTS5Index God Object）、AP-4（build_index Long Method）、AP-6（indexer 拆分）、AP-8（孤儿治理） | 不重复收录；AP-18/19/21 作为其可独立执行的下手点收录 |
| — | treesearch-core AP-11（tree↔fts 环）、AP-12（权重魔数）、AP-13（参数表膨胀）、AP-14（短命连接） | 不重复收录 |
| — | doclens-backend AP-9（index_manager God Object，done）、AP-11（全库审计，done）、AP-19（kb_tools God Module，pending） | 不重复收录；AP-8/25 是 kb_tools 待修时可并入的增量点 |
| AP-1 评分三轨 | doclens-backend 无对应条目 | 新收录（P2） |
| AP-6/7/9/11（api/kb_tools 层） | doclens-backend AP-19 只立 God Module 总账未列搜索链路明细 | 新收录明细 |
| AP-13/14/15/16（index_manager 增量） | backend AP-9/11 已修主问题 | 新收录（修复后残留/新证据） |
