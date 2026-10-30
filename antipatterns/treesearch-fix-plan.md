# treesearch 反模式修复排序清单（联动优化版）

> 生成日期：2026-10-25｜依据：treesearch 六模块复审台账（`treesearch-core.md` + `treesearch-parsers.md` 复审分册，78 条，已修 2 条）
> 组织原则：**按根因联动打包**（同根/同路径/同文件合并为一个工作包），包内**单条目单提交**；阶段间按 P 级排序，阶段内按依赖与收益排序。

## 回归测试方案（三层体系，全工作包统一适用）

**命令**：`../cortex/.venv/Scripts/python.exe -m pytest`（worktree 内，主仓直接 `.venv/Scripts/python.exe`）。

### 第 1 层：逐提交必跑（同名约定 + 触及层）

每提交从下表按触及文件取**命中的所有行**（不是只跑一行）：

| 修复触及 | 必跑套件 | 时长 |
|---|---|---|
| `fts.py` | `test_fts_concurrent_connection.py`（连接/锁契约）＋ 触及方法同名测试（RM-1→pst 链、RM-3→`test_fts_search_batch_meta.py` 模式补例） | 秒级 |
| `indexer.py` | `test_index_chunking.py` + `test_change_detection.py` | 秒级 |
| `treesearch.py`/`config.py` | `test_lazy_search.py` + `test_max_dir_files.py` | 秒级 |
| `search.py`/`tree_searcher.py` | `test_search_preset_params.py` + `test_lazy_search.py` | 秒级 |
| `ripgrep.py` | `test_grep_corpus_bypass.py` | 秒级 |
| `parsers/**` | 对应格式：`test_pst_parser.py` / `test_pdf_native_preview_api.py` / `test_anydoc_parser.py` / `test_docx_parser.py` | 秒级 |
| **任何提交** | `test_architecture.py`（红线守卫，Architecture 层纪律） | <1s |

### 第 2 层：工作包完成关（包级全家桶）

每完成一个工作包（W1-W15），跑该包触及域的全量：

- **W1/W2/W3/W9/W12（存储+门面域）**：`test_lazy_search.py test_search_preset_params.py test_grep_corpus_bypass.py test_fts_concurrent_connection.py test_index_chunking.py` —— 对应 CLAUDE.md「treesearch 引擎」映射行
- **W4（PST）**：`test_pst_parser.py` + 引擎全家桶（PST 派生文档走增量链路）
- **W5/W6/W10（parsers 域）**：`test_anydoc_parser.py test_docx_parser.py test_pdf_native_preview_api.py test_pst_parser.py` —— CLAUDE.md「treesearch 解析器」映射行
- **W7（评分）**：引擎全家桶 + `test_web_search_api_matrix.py`（宿主侧评分消费——RS-1 改路由序必须验宿主搜索结果）
- **W11（watch）**：`test_file_watcher_exclude.py test_change_detection.py test_file_watcher_robustness.py` —— CLAUDE.md「索引/监控」映射行
- **W14（结构重构）**：上述全部 + `test_web_search_grouping.py`（行为等价最宽验面）

### 第 3 层：阶段完成关（全量回归，后台跑）

阶段一/二/三各自收尾时，**background_run 后台跑全量 pytest**（bash 前台 120s 会被掐，release 技能纪律），收 `check_background` 轮询结果；前端不触及则无需 npm。发版前全量按 release 技能走。

### 新增测试清单（修复即固化，防回归护栏）

每个 P1/P2 修复必须**先写失败断言再修**（红→绿），新增测试落点：

| 工作包 | 新增断言（防什么回归） |
|---|---|
| W1 | 「DB 已存在 + pending + 文件修改 + 文件删除」四态 `batch_search` 行为与 `asearch` 逐态一致（锁元组 bug 与 orphan 缺失） |
| W2 | EXPLAIN QUERY PLAN 无 SCAN（instr 回潮）＋增量索引 SQL 次数 ≤ 上限（N+1 回潮） |
| W3 | 全失败 chunk 后 `get_all_failed_files` 可读（RI-1 核心）＋并发写后新连接数据完整（事务收口） |
| W4 | 消费者异常 → producer 退出 + tmp 目录清理 + sidecar 进程无残留（死锁）；挂起 sidecar 被 idle 超时 kill；邮件失败计数进汇总 |
| W5 | 损坏文件（PDF/JSON/MHTML/PY 语法错）索引后 failed_files 可见（端到端跨层）；损坏图二次 reindex 不入 vision 队列 |
| W6 | 多文件并发解析 wall time < 串行和（并发度回潮即红） |
| W7 | 2 行 vs 200 行命中双文档的路由序断言；slack 语料 fts_score 分布对照（trace 存档改前后快照） |
| W8 | rg 缺失/超时场景返回可区分状态（不再是 `{}`）；同非法正则双路径行为一致 |
| W9 | `get_indexed_files`/单文档加载行为等价（0-diff 取证，对照 bb442442 先例） |
| W10 | 大文件内存峰值断言（anydoc/PDF）；并发写回计数不丢（16 线程，对照 AP-34 先例） |
| W11 | 撞锁批不丢失（并发 Timer 场景）；超时触发返回明确错误 |
| W12 | db_path 切换持旧引用不断连；config reset 后 get_config 一致 |
| W13 | 三清单一致性断言（SOURCE_TYPE_MAP 派生关系）；cli 两入口默认值一致 |
| W14 | 拆分前后只读方法 0-diff（真实语料取证）；`test_architecture` + 私有 import 守卫扩测 |

### 已知薄弱与补强（诚实声明）

1. **大库性能断言缺真实语料**：W2/W9/W10 的性能收益（全表扫→索引、O(库)→分页）在 demo 语料上差异不可测——新增断言只锁「机制」（EXPLAIN/SQL 次数/内存护栏），**量级验证依赖 7860 EnterpriseRAG 库手动实测**（修复后各包附实测数字进台账执行记录）。
2. **W7 的 trace 对照是软护栏**：RM-8 明细已标注「需 trace 实证祖先链分布后再动」——该条先建脚手架后修，防止归一化改动引发不可见检索质量回归。
3. **并发时序类（W3/W4/W11）测试有抖动风险**：死锁/竞态断言用确定性构造（mock 异常注入）而非 sleep 轮询；若仍 flaky 标 `@pytest.mark.flaky` 隔离，不混入第 1 层。
4. **watch 真实守护场景不可单测**：RI-4 丢批用「双 Timer 并发」确定性复现；端到端守护验证归 M11 修复后手动冒烟（改文件→观察索引生效）。

## 总览

| 阶段 | 工作包 | 主题 | 条目数 | 级别构成 |
|---|---|---|---|---|
| 一 | W1 | 增量搜索正确性 | 2 | P1×2 |
| 一 | W2 | 前缀查询索引化 | 2 | P1+P2 |
| 一 | W3 | 失败记录事务收口 | 2 | P1+P2 |
| 一 | W4 | PST 管线三修 | 3 | P1+P2×2 |
| 一 | W5 | 解析失败可观测链 | 6 | P1+P2×3+P3×2 |
| 二 | W6 | async 解析链去阻塞 | 3 | P2×3 |
| 二 | W7 | 评分归一化双修 | 2 | P2+P3 |
| 二 | W8 | 降级语义三态治理 | 2 | P2×2 |
| 二 | W9 | 查询侧全量拉取收敛 | 3 | P2×3 |
| 二 | W10 | 解析侧内存与竞态 | 6 | P2×4+P3×2 |
| 二 | W11 | watch 丢批与超时 | 2 | P2×2 |
| 二 | W12 | 降级护栏 + 单例/配置生命周期 | 5 | P2×3+P4×2 |
| 三 | W13 | 契约单源化与小卫生 | 8 | P3×7+P4×1 |
| 三 | W14 | 结构重构（God Object 拆分） | 14 | P2×5+P3×9 |
| 四 | W15 | P4 记录项 | 6 | P4×6 |

---

## 阶段一：P1 正确性（立即修）

### W1 增量搜索正确性：abatch 元组 bug + 复制漂移合修

**联动理由**：AP-1（bug 本体）与 AP-5（复制漂移的根因）在同一对函数（asearch/abatch_search）——逐处补丁已被证明只是排队等下一处爆（abatch 已缺 orphan 分支），必须一次收口。

| 条目 | 明细 |
|---|---|
| **旧AP-1** [P1] abatch 元组当列表用 | `treesearch.py:404` 漏解包 `(changed, has_orphans)` → `:405` 恒走重索引分支、`:410` bool 被当路径传入 build_index。修法：按 asearch :244 正确解包。 |
| **旧AP-5** [P2] asearch/abatch 复制漂移 | 双份「加载缓存→增量重建」已分叉（abatch 缺 has_orphans 清理，文件删除场景永不清理孤儿）。修法：抽 `_ensure_documents_loaded()` 单一协程供两处调用，orphan 分支语义对齐。 |

- **提交切分**：1 提交（两账目同根，AP-5 的修复即 AP-1 的修复）。
- **回归**：新增「已有 DB + pending + 文件修改 + 文件删除」四态 batch_search 断言；`tests/test_lazy_search.py tests/test_index_chunking.py`。

### W2 前缀查询索引化：instr 四连 + 增量 N+1（同一路径）

**联动理由**：RM-1 是 PST 前缀查询的谓词问题，RI-3 是同一批方法的调用方（增量跳过路径）——RM-1 修掉全表扫后 RI-3 的每文件 2 次点查仍在，必须批量化一起做才有效果。

| 条目 | 明细 |
|---|---|
| **RM-1** [P1] instr() 谓词全表扫 | `fts.py:2403/2411/2419/2427` 四方法 `WHERE instr(source_path,?)=1` 必然全表扫（同文件 :1998-2010 已有 GLOB 索引化先例与性能注记）。修法：改 `GLOB '<prefix>*'`（经 `_glob_escape`），has 版对照 :1927 加 LIMIT 1。 |
| **RI-3** [P2] 增量跳过路径 N+1 | `indexer.py:1711-1718` 每个未变更文件 2 次 SQL（get_doc_id_by_source_path + has_docs_with_source_prefix）——稳态索引主热点。修法：存在性校验一次 IN 批量查询（对照 :1621 指纹批量化的既有模式）。 |

- **提交切分**：2 提交（先 RM-1 打底，再 RI-3 批量化）。
- **回归**：`tests/test_pst_parser.py` + 新增 EXPLAIN QUERY PLAN 无 SCAN 断言与增量 SQL 次数断言；`tests/test_lazy_search.py`。

### W3 失败记录事务收口：fts 侧裸写 + indexer 侧门禁

**联动理由**：RM-9（fts 侧四方法裸 execute 挂隐式事务）与 RI-1（indexer 侧 commit 门禁只数文档写入）是同一事务缺口的两侧——只修一侧，全失败 chunk 的 failed_files 仍会丢。

| 条目 | 明细 |
|---|---|
| **RI-1** [P1] 全失败 chunk failed_files 必丢 | `indexer.py:1990` `if _pending_commits>0` 门禁只统计文档写入；失败路径 `:1851` upsert_failed_file 不递增 → 全失败 chunk commit 跳过 → `:2138` close 回滚蒸发 → 熔断 `:1739` 永远空转。修法：失败记录写入后独立小事务立即 commit（或递增门禁计数）。 |
| **RM-9** [P2] vision/failed_files 裸 execute 无事务 | `fts.py:717/731/763/822` 四方法裸 execute 后无 commit——写挂在连接级隐式事务上，被别处 commit/rollback 连带（3cbf46bf 的语句级锁修不掉事务级敞口）。修法：四方法各自 `with self._conn:` 收口单语句事务；RM-6 修复时顺带封 `cursor()` 裸游标缺口。 |

- **提交切分**：2 提交（先 RM-9 后 RI-1，RI-1 的测试依赖 RM-9 的事务语义）。
- **回归**：新增「全失败 chunk 后 failed_files 可读」+「并发写后重启数据完整」断言；`tests/test_fts_concurrent_connection.py tests/test_index_chunking.py`。

### W4 PST 管线三修：死锁、超时、失败计数

**联动理由**：同一条 PST 解析管线（sidecar 子进程 + 背压队列 + 附件线程池）。RQ-1 死锁发生时 RQ-4 的超时是唯一逃生门；RQ-9 计数让前两者的失败可见。

| 条目 | 明细 |
|---|---|
| **RQ-1** [P1] finally 与背压队列互锁 | `pst_parser.py:717-722` 消费者异常（如 `store_for_email` :90 mkdir 的 OSError）→ finally `await producer`(:718) → 生产者阻塞在满载 Queue(:473) → **finally 永久卡死**，kill(:720)/rmtree(:722) 不执行——GB 级临时目录+僵尸进程双泄漏。修法：消费者异常时先 kill+drain 再 await；mkdir 包进 store 的 try。顺带收口 :561→586 Popen 后 try 前窗口与 attachment_store :86-90 先删后建中间态。 |
| **RQ-4** [P2] sidecar 无总时限 + 附件池超时不中断 | `:561-566` Popen 无 timeout，`:695` wait(120) 只管 EOF 后；`:146-149` 附件 60s 超时用 wait_for(run_in_executor) **不中断池中同步任务**，2-worker 池（:70）被两个坏附件占满后连环超时。修法：读流加 idle 超时（stdout N 秒无输出即 kill）；附件解析换可中断机制。 |
| **RQ-9** [P3] 邮件树全量驻留 + 单封失败无计数 | `:573` trees 全量聚合至 `:728-732` 一次返回（流式背压只保护 JSONL 行）；`:687-692` 单封失败仅 warning 无计数（对照附件有 failed_attachments :725）。修法：分批 yield；邮件级失败计数入汇总。 |

- **提交切分**：3 提交（RQ-1 → RQ-4 → RQ-9）。
- **回归**：新增「消费者异常后 producer 退出 + 临时目录清理」「挂起 sidecar 超时清理」「失败计数」断言；`tests/test_pst_parser.py`。

### W5 解析失败可观测链：parse_status 分流（最大联动组）

**联动理由**：同一反模式（失败伪装成合法空结果）在 indexer 装配层 3 处 + parsers 层 5 处 + 门面层 1 处 + ast 兜底谎言 1 处——RP-1 台账已证明逐处补丁无效（AP-1 旧账 10-20 立案至今未修又多 7 个实例）。统一 `parse_status` 契约一次分流。

| 条目 | 明细 |
|---|---|
| **RP-1** [P1] 空内容伪装成功树（5 处） | `markitdown_parser.py:189-191`、`anydoc_parser.py:166-168`、`mhtml_parser.py:91-94`、`pdf_parser.py:410-413`（宽 except 降级纯文字无标记）、`pdf_parser.py:418-428`/`excel_parser.py:200-203`（占位根节点约定）。修法：解析返回结构加 `parse_status`（ok/empty/degraded/failed+原因）；「真空」需文件级证据（size==0）。含旧 P-AP-1/P-AP-2 并账。 |
| **RI-5** [P2] indexer 装配层降级三连 | `indexer.py:866-880`（json 失败降级 text 不可区分）、`:983-984`（jsonl 全失败空节点树）、`:1026-1027`（csv 空文件同形）。修法：消费 parse_status 分流 failed_files，正确范式在同文件 :1847-1857。 |
| **RQ-3** [P2] 损坏图像读失败无限重入队 | `image_metadata.py:161-163/233-235/298` 读失败=None=「未解读」→ `image_parser.py:45-49` 每次重入 vision 队列重花 API。修法：读失败独立信号 + 计数 + N 次退避（写失败 :103 有计数，补对称半边）。 |
| **RQ-5** [P2] ast_parser 契约谎言 | `ast_parser.py:28-30` 语法错误返回空，`:8` docstring 谎称有 regex fallback（实现没有）。修法：补 regex 兜底（对照 treesitter :378-391 正确同侪）或修文档+degraded 标志。 |
| **RC-6** [P3] lazy 加载失败静默过滤 | `treesearch.py:318-321` load_document None 被推导丢弃，全 None 时返回 _empty_result。修法：warning + 结果附 degraded_doc_ids。 |
| **RM-7** [P2] fts 两处 SQL 失败伪装空（旧AP-8 残留） | `fts.py:1479-1480`（like_search Phase2 `except Exception: return []`）、`:1672-1673`（score_nodes_batch `return {}`）无日志。修法：收窄异常类型 + `logger.warning(exc_info=True)`（对照 :1211-1213 主 search 正确口径）。 |

- **提交切分**：4 提交（① RM-7 小修打底 → ② RP-1+RI-5 parse_status 契约与分流【契约变更，最大提交】→ ③ RQ-3+RQ-5 → ④ RC-6）。
- **回归**：`tests/test_anydoc_parser.py tests/test_pdf_native_preview_api.py tests/test_lazy_search.py`；新增损坏文件→failed_files 可见断言（跨层端到端）。

---

## 阶段二：P2 高价值联动组（近期修）

### W6 async 解析链去阻塞（to_thread 批量）

**联动理由**：RI-2/RP-2/RQ-6 三处同病（async 外壳内同步重活），同一批 to_thread 化，修完并发度才真实存在。

| 条目 | 明细 |
|---|---|
| **RI-2** [P2] indexer 三处同步重活 | `text_to_tree`(:611-655 async def 全程零 await，经 :1821 调用)、`_generate_shadow_md`(:1836 markitdown 同步直调)、image/pst purge(:1795-1798 同步删除)——gather 退化为串行。修法：同步段包 `asyncio.to_thread`。含旧 AP-9 并账。 |
| **RP-2** [P2] markitdown/anydoc 同步转换 | `anydoc_parser.py:63-64`、`markitdown_parser.py:186` async def 内同步 convert——慢文档卡整批。修法：同上 to_thread。 |
| **RQ-6** [P2] treesitter 同步 parse + 无界递归 | `treesitter_parser.py:367-368+276+282` 同步 open/read/parse、`_walk_tree`(:299-337) 深度无上限；`image_metadata.py:230/251/284` img.load() 全像素解码只为读写一条元数据。修法：parse/decode 段 to_thread；_walk_tree 加深度上限。 |

- **提交切分**：3 提交。**回归**：并发解析 wall time < 串行和断言；`tests/test_index_chunking.py tests/test_anydoc_parser.py`。

### W7 评分归一化双修（trace 先行）

**联动理由**：RS-1 与 RM-8 是「归一化抵消」同族（一个在 GrepFilter、一个在 propagate_scores），且都需 slack 语料 trace 对照防回归——一次搭好 trace 验证脚手架。

| 条目 | 明细 |
|---|---|
| **RS-1** [P2] GrepFilter per-doc max 压平路由 | `search.py:258-262` 命中 2 行与 200 行同为 1.0，`:156/:658` doc 路由只剩二值信息。修法：归一基准改本次 query 全局 max（与 644ec39b 同思路）。 |
| **RM-8** [P3] propagate_scores 二次归一压回 | `fts.py:1749-1754` 祖先加成后按 per-doc max 除回——带强祖先链文档被压回 1.0，与全局 max 意图相悖。修法：重归一基准改全局 final_max；**需 trace 实证带祖先链文档分布后再动**。 |

- **提交切分**：2 提交（先建 trace 对照，后修）。**回归**：构造 2 行 vs 200 行双文档路由序断言；slack 语料改前后 fts_score 分布对照；`tests/test_lazy_search.py tests/test_web_search_api_matrix.py`。

### W8 降级语义三态治理

**联动理由**：RC-1（rg 三态混一）与 RS-2（正则双语义）都是「降级路径语义分裂」——宿主侧已修四态枚举（c7d1a1d0），包内对齐。

| 条目 | 明细 |
|---|---|
| **RC-1** [P2] rg 三态同返 `{}` | `ripgrep.py:129-134` 超时/OSError（含 rg 缺失）与零命中同形。修法：失败上抛 RgUnavailable/RgTimeout 或返回哨兵，调用方透传宿主四态。 |
| **RS-2** [P2] 非法正则双路径语义相反 | `search.py:555-559` 主入口 raise vs `:274-275` GrepFilter 静默降级字面匹配——正则意图被无声替换。修法：GrepFilter 对齐上抛（契约变更）或带 regex_degraded 标志。 |

- **提交切分**：2 提交。**回归**：`tests/test_grep_corpus_bypass.py` + 双路径同非法正则行为一致断言。

### W9 查询侧全量拉取收敛

**联动理由**：RM-4（源头 load_all_documents O(库)）、RM-3（aggregation N+1）、RC-3（门面 4 字段全量树）——「全量树解析」的多米诺，从源头提供轻量变体再改消费方。

| 条目 | 明细 |
|---|---|
| **RM-3** [P2] search_with_aggregation N+1 | `fts.py:1551-1553` 循环逐 doc 点查 doc_name（top 200 = 200 往返）；主链路 :1216-1235 已有批量样板（47376778）。修法：照批量 IN(VALUES) 模式改写。 |
| **RM-4** [P2] load_all_documents O(库) 内存 | `fts.py:2114-2116` 整库 blob 反序列化；`tree.py:345` 拉全库取第一条；`indexer.py:2053` return_documents 全量回载。修法：keyset 分页变体（对照 iter_index_meta :2562 样板）；tree.py 改 LIMIT 1；indexer 改按 skipped 点查批量回载。 |
| **RC-3** [P2] get_indexed_files 4 字段全量树 | `treesearch.py:507-515` 纯元数据需求全量树解析；`:240-241/:401-402` 缓存路径变更场景白做一次。修法：元数据 SQL 直查（documents 四列）；缓存路径 docs 加载延后到确认无变更分支。 |

- **提交切分**：3 提交（先 RM-4 加变体 → RC-3/RM-3 消费方切换）。**回归**：`tests/test_lazy_search.py tests/test_index_chunking.py` + 行为等价断言。

### W10 解析侧内存与竞态

**联动理由**：解析器内存峰值类（RP-3/RP-5/RQ-8/RP-6/RP-7）+ 图像并发（RQ-2）——同属「单文件解析成本无护栏」。

| 条目 | 明细 |
|---|---|
| **RP-3** [P2] anydoc 双重解析+blob 驻留 | `anydoc_parser.py:159-165` 同一字节串 to_markdown_bytes+to_document 两次完整解析，峰值内存≈文件×3。修法：按需选一 + assets 流式落盘。 |
| **RP-5** [P2] PDF 图像 blob 并发驻留+页循环无界 | `pdf_parser.py:123-146/402-403` 全文档图像同时驻留；`:124/:164` 逐页无上限。修法：逐页即交 image_store；页上限 cfg 化+超限 degraded。 |
| **RQ-2** [P2] image_metadata 双竞态 | `:103/:191-193` 计数器裸 `+=`；`:89-99` 版本口径全局互覆盖。修法：锁/实例化计数；版本走 config 注入。 |
| **RQ-8** [P3] 像素指纹 300MB 临时串 | `:336-341` 100MP 图 RGB.tobytes() 全量 md5 且增量必调。修法：>N MP 降采样指纹（防死循环语义不变）。 |
| **RP-6** [P3] excel 万行收两百行 | `excel_parser.py:108-144` 10000 行全文只取 [:200]。修法：deque(maxlen=200)+计数分离；200 提 cfg。 |
| **RP-7** [P3] html heading O(h×l) | `html_parser.py:46-57` 每 heading 全文线性找行号。修法：一次遍历建索引 O(1) 查。 |

- **提交切分**：6 提交。**回归**：各同名测试 + 内存峰值/行为等价断言；`tests/test_change_detection.py`（RQ-2/8）。

### W11 watch 丢批与门面超时

**联动理由**：RI-4 的丢批发生在 watch↔build_index 咬合处，RC-2 的零超时是同一咬合的另一半——无超时时丢批重试也无界。

| 条目 | 明细 |
|---|---|
| **RI-4** [P2] watch 撞锁静默丢批 | 链路：`watch.py:106` 换出 pending → 并发第二个 Timer → `indexer.py:1601-1603` 撞 _NullLock `return []` → `watch.py:237` INFO 记成功——批永久丢失。修法：撞锁抛 IndexLockedError（或哨兵）；watch 侧批重新入 pending+退避。含旧 AP-17 并账。 |
| **RC-2** [P2] 门面重操作零超时 | `treesearch.py:173-184/252-259/271/327/432` 全无 wait_for；cli 无 --timeout。修法：可选 index/search_timeout_s（默认不限保兼容）；cli 加 --timeout。 |

- **提交切分**：2 提交。**回归**：新增「撞锁批不丢失」并发测试；`tests/test_file_watcher_exclude.py tests/test_change_detection.py`。

### W12 降级护栏 + 单例/配置生命周期

**联动理由**：RM-2/RM-5 同函数（like_search Phase2）；RM-6/AP-2/RC-8 同族（全局可变单例三连：fts 连接、TreeSearch 写配置、config reset）。

| 条目 | 明细 |
|---|---|
| **RM-2** [P2] Phase2 blob 全库扫无护栏 | `fts.py:1457-1462/1473-1477` structure_json REGEXP/LIKE 首查不设防（护栏只盖 rescan）。修法：首查前置节点数护栏（沿用 :1515-1525 保守口径）。 |
| **RM-5** [P3] Phase2 全量提取后裁剪 | `:1482-1513` 全命中逐条 snippet 后 [:top_k]。修法：先按排序键裁剪再提取。 |
| **RM-6** [P2] 全局 FTS 单例三生命周期 | `fts.py:2943-2948` db_path 变更即 close 他人断连；`:2960-2965` reset 连注入实例收走。修法：所有权契约文档化+断连防护或窄化定位。含旧 AP-14 并账；顺带封 cursor() 裸游标。 |
| **AP-2** [P2] 构造就地改写全局配置 | `treesearch.py:102-103` 写脏 get_config() 单例；守卫造成跨实例顺序依赖（M4 新证据）。修法：配置实例化/传入而非改写全局；与 W14 的 AP-13 参数收敛联动。 |
| **RC-8** [P4] config 可变单例 reset 脱钩 | `config.py:64-65/215-218` reset 置 None 后旧引用脱钩。修法：frozen dataclass。 |

- **提交切分**：5 提交。**回归**：`tests/test_lazy_search.py` + db_path 切换不断连断言 + config 既有测试。

---

## 阶段三：P3 单源化与卫生

### W13 契约单源化（手抄字面量清剿）

**联动理由**：横切判读④「同因复发即升级」——手抄契约已实证漂移两次（RC-4 search-mode 分叉、RI-6 派生路径），六处散布一次清剿+单一真源。

| 条目 | 明细 |
|---|---|
| **RI-6+RQ-7** [P3] 派生路径/扩展名手抄 | `#`/`__` 分隔符 indexer 4 处+fts 查询契约（RQ-6 核实 pst :608 是真源）；图像扩展名三份（真源 image_metadata.py:29）。修法：pathutil 加 derive/split_entry_path 单源；image_parser/indexer 改 import 真源。 |
| **RP-4** [P3] registry 三清单重叠 | `registry.py:147-153` SHADOW_MD 手抄；`markitdown_parser.py:232` "pptx" 硬编码。修法：从 SOURCE_TYPE_MAP 派生；source_type 打标收 registry。 |
| **RC-4** [P3] cli 默认值漂移 | `"index.db"`×4、`./indexes`×2、max_nodes×2、**search-mode 两入口 tree vs auto 已分叉**（需用户裁决意图）。修法：cli 默认值统一引 config 单源。 |
| **RS-4** [P3] tokenizer 死代码+双路径 | `tokenizer.py:20` 宽版 CJK 正则零消费；:76/:151 双路径各自 ensure。修法：删死代码；auto 收敛单点；顺带 :171 重复检测。 |
| **RC-5** [P3] loop 探测块 ×3 | `treesearch.py:198-205/344-351/459-468` 逐字三份（旧 AP-15 残留）。修法：抽 `_run_sync(coro)`。 |
| **RS-5** [P3] ghost fail-closed 零信号 | `ghost.py:74-75` 补一行 debug/warning 日志（契约不变）。 |
| **RI-7** [P3] Windows 锁缝+裸 pass | `indexer.py:1217` 补 try/finally；`:1322` 收窄异常+日志。 |

- **提交切分**：6-7 提交。**回归**：各同名测试 + 清单一致性断言。

### W14 结构重构（God Object/Method 拆分——最大风险项，最后做）

**联动理由**：五个 God Object/Method 互为拆分障碍（AP-7 拆分被 RS-3 系数/RS-6 顺序耦合阻塞；AP-3 拆分需先有 W13 的单源化）。放阶段三末尾，届时 W1-W13 的行为护栏（新测试）已就位。

| 条目 | 明细 |
|---|---|
| **AP-3** [P2] FTS5Index God Object | 2965 行 89 方法六类职责（含 vision 队列+PST meta+probe）。按域拆协作类（对照 SessionsStore AP-7 拆分先例 bb442442）。 |
| **AP-4** [P2] build_index 680 行 God Function | 提取 expand_and_plan/detect_moves/parse_chunk/commit_chunk/finalize；闭包共享状态显式化。 |
| **AP-7** [P2] _build_flat_nodes 400 行 7 阶段 | 按阶段提取；入参局部浅拷贝；**RS-3 系数收 RerankWeights、RS-6 排序非就地随拆 ride-along**。 |
| **P-AP-3** [P2] pst_to_trees God Object | 与 W4 修复后的形态一起拆。 |
| **AP-6** [P2] tree/flat flat_nodes 双份 | 抽 _build_flat_nodes 共用。 |
| **AP-10** [P3] 核心包私有 import | 公共化+守卫扩测。 |
| **AP-11** [P3] tree↔fts 循环依赖 | 依赖倒置收口。 |
| **AP-13** [P3] 参数表膨胀 | kwargs 收敛 TypedDict（与 AP-2 联动）。 |
| **RM-10** [P3] 魔法下标 | 热点区域 row_factory。 |
| **P-AP-5** [P2] 办公文档资源 try/finally | 补齐 with/finally。 |
| **P-AP-6** [P2] parser 参数表 | 同 AP-13 思路。 |
| **P-AP-9** [P3] 包内私有 import | 同 AP-10。 |

- **提交切分**：每 God Object 一提交（4 大提交）+ 卫生打包若干；**每步跑行为等价取证**（对照 bb442442 的 0-diff 先例）。
- **回归**：`tests/test_web_search_api_matrix.py tests/test_lazy_search.py tests/test_index_chunking.py tests/test_pst_parser.py` 全家 + `test_architecture.py`。

---

## 阶段四：P4 记录项（择机/文档化）

### W15

| 条目 | 明细 |
|---|---|
| **RC-7** | `config.py:56-57` _env_int 非法值补 warning 一行。 |
| **AP-16** | 类型注解/CLI cwd 默认/logger 黑名单杂项。 |
| **P-AP-12** | 依赖可用性标志（渐进增强有意，维持记录）。 |
| **P-AP-13** | 魔法数字（EMU/行上限等，多数有注释已反证，仅补遗漏）。 |
| **P-AP-14** | treesitter 重复 import+warnings（库废弃 API 所致）。 |
| **P-AP-10** | registry↔parsers 耦合——反证已成立大半，**建议改判关闭**，留文档注记。 |

## 挂账灰色项（修复时顺带验证，不单独立案）

- heuristics 压缩链恒同值嫌疑（W7 trace 脚手架建成后复测）
- 门面 _get_changed_files 与 indexer 变更检测双份（W14 拆 AP-4 时核实）
- `image_parser.py:14` 反向 import indexer 层次倒置（对照 test_architecture 口径后定）
- email_html_md debug 级日志可见性（W5 统一口径时顺带）

## 收尾纪律

- 每提交：修复 → 回归 → **两份台账状态列更新**（done(commit)）→ commit message 引用条目编号。
- 契约变更项（RP-1 parse_status、RS-2 GrepFilter 异常、RC-1 rg 哨兵、AP-2 配置传入）修复前在对应提交说明中标注。
- 每完成一个工作包：跑一次 treesearch 引擎全量（lazy_search + search_preset_params + grep_corpus_bypass + architecture）。
