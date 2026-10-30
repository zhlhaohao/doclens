# 1025-1 存储层任务书（fts.py + tree.py）· 全独立版

> worktree `../1025-1`｜分支 `1025-1`｜上游 `00-orchestration.md` v2
> **独立性**：全部条目只动 fts.py/tree.py + 自有测试；对其他树的改动零假设（消费方切换全部收编到收尾清单或消费方自己的树）。
> **文件红线**：`treesearch/fts.py`、`treesearch/tree.py`；新增 `tests/test_rm_*.py` 或扩 `test_fts_*.py`。

## 执行顺序（11 提交 + 拆分）

### ① RM-1 [P1] PST 前缀四方法 instr() → GLOB
- `fts.py:2403/2411/2419/2427` 改 `GLOB '<esc>*'`（`_glob_escape` 同 :2037）；has 版补 LIMIT 1（对照 :1927）。
- 纯查询层改动，调用方（indexer/PST 预览）签名不变。
- 回归：新增 EXPLAIN QUERY PLAN 无 SCAN 断言×4（`tests/test_rm_prefix_glob.py`）；跑（不改）`test_pst_parser.py test_lazy_search.py` + `test_architecture.py`。

### ② RM-9 [P2] vision/failed_files 四方法事务收口
- `fts.py:717/731/763/822` 各自 `with self._conn:` 单语句事务；顺带 `cursor()`(:234-236) 改返 `_LockedCursor` 封口。
- 兼容性：外部调用方已有的事后 `fts.commit()` 双提交幂等无害。
- 回归：扩 `test_fts_concurrent_connection.py`（写后新连接立即可见）。

### ③ RM-3 [P2] search_with_aggregation N+1 → 批量
- `fts.py:1551-1553` 照 :1216-1235 `IN (VALUES)` 模式（分批 ≤100 对）。
- 回归：新增 execute 次数断言（`tests/test_rm_agg_batch.py`）；跑 `test_lazy_search.py`。

### ④ RM-4 [P2] 全量加载的轻量变体（本树半边）
- fts.py 新增 `iter_documents(batch=500)` keyset 变体（样板 :2562-2593）+ `load_first_document()`；**`tree.py:345` 的 `docs[0]` 改调后者**（tree.py 属本树）。`load_all_documents` 保留，docstring 加成本警示。
- 消费方 indexer.py:2053 / treesearch.py:507 的切换**不做**（各自属 1025-2，已重设计为用既有 API）。
- 回归：变体与全量 0-diff 断言。

### ⑤ RM-6 [P2] 全局 FTS 单例生命周期
- `fts.py:2943-2948` 切换 db_path 不再立即 close 旧实例（延迟 GC + docstring 所有权契约）；`:2960-2965` reset 不收走外部注入实例（注入标记）。
- 回归：新增 db_path 切换后旧引用可用断言（`tests/test_rm_singleton.py`）。

### ⑥ RM-2 [P2] like_search Phase 2 首查护栏
- `:1457-1462/1473-1477` 前置 `_phase2_rescan_allowed` 同款节点数护栏（口径同 :1515-1525 保守）。
- 回归：跑 `test_lazy_search.py test_search_preset_params.py`；新增超护栏库返空+warning 断言。

### ⑦ RM-7 [P2] 两处 SQL 失败伪装空 → 窄异常+日志
- `:1479-1480/:1672-1673` 收窄 `sqlite3.Error` + `logger.warning(exc_info=True)`（口径同 :1211-1213）。
- 回归：损坏库（mock execute 抛）返回可区分异常断言。

### ⑧ RM-8 [P3] propagate_scores 归一基准（trace 先行）
- 本提交**只建 trace 脚手架**（slack 语料祖先链文档 fts_score 分布快照工具，`tests/test_rm_trace_norm.py`）；实证后第二提交改 `:1749-1754` 全局 final_max；trace 不支持则记录关闭。
- 回归：分布对照断言。

### ⑨ RM-5 [P3] Phase 2 先裁后提取
- `:1482-1513` 排序键裁 top_k 后再 snippet。
- 回归：降级路径结果集等价断言。

### ⑩ RM-10 [P3] 热点域 row_factory
- vision/failed_files/PST meta 三域改 `sqlite3.Row`。
- 回归：触及方法同名测试。

### ⑪ AP-3 FTS5Index God Object 拆分【lead 下令才做；前置①-⑩全部完成】
- 2965 行 89 方法拆 `_VisionQueue/_FailedFiles/_PstMetaStore/_PrefixProbe/_DocStore` 协作类（先例 bb442442）；对外 API 逐字不变。
- 回归：本树全家桶 + 只读方法 0-diff 取证 + `test_architecture.py`。

## 台账
每提交改 `antipatterns/treesearch-core.md` 对应 RM 条目 → `done(<commit>)`。
