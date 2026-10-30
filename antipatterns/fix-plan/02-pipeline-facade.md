# 1025-2 索引管线与门面任务书（indexer/watch/treesearch/config/cli/pathutil）· 全独立版

> worktree `../1025-2`｜分支 `1025-2`｜上游 `00-orchestration.md` v2
> **独立性**：全部条目只用 fts/parsers 的**既有公共 API**（`filter_known_source_paths`/`commit`/`load_document_by_source_path`/`result.get()`），对其他树的改动零假设；parse_status 用防御式读取，单侧合入即生效。
> **文件红线**：`indexer.py、watch.py、treesearch.py、config.py、cli.py、pathutil.py、__init__/__main__`；扩 `test_lazy_search/index_chunking/change_detection/max_dir_files/file_watcher_*`，新增 `test_ri_*.py`/`test_rc_*.py`。

## 执行顺序（19 提交 + 拆分）

### ① 旧AP-1 + 旧AP-5 [P1] abatch 元组 bug + 复制漂移合修
- `treesearch.py:404` 解包 `changed, has_orphans`；抽 `_ensure_documents_loaded()` 供 asearch(:236-260)/abatch(:397-416) 共用，orphan 分支对齐。
- 回归（先红后绿）：四态（DB 在+pending+修改+删除）batch_search ≡ asearch 断言。

### ② RI-1 [P1] 全失败 chunk failed_files 必丢（重设计版，无 RM-9 依赖）
- `indexer.py` `_commit_chunk` 内 gather 之后**无条件 `fts.commit()`**（既有公共 API :1081）——成功半批与失败记录一并落盘；`_index_one` 失败路径 `:1851` 的 upsert 随之生效。原 `:1990` 门禁语义保留但不再跳过失败写入。
- 回归（先红后绿）：全失败 chunk 后 `get_all_failed_files()` 可读断言。

### ③ RI-3 [P2] 增量跳过 N+1（重设计版，无 RM-1 依赖）
- `indexer.py:1711-1718` 常规文件存在性改用**既有** `fts.filter_known_source_paths()`（:2595 分批 IN）一次批量；PST 前缀检查（`has_docs_with_source_prefix`）保持逐个——PST 稀少；RM-1 在 1025-1 独立把它索引化，两修叠加增益、互不需要。
- 回归：增量索引 SQL 次数 ≤ 上限断言（对照 :1621 先例）。

### ④ RI-4 [P2] watch 撞锁丢批（含旧AP-17）
- `indexer.py:1601-1603` 撞 `_NullLock` 抛 `IndexLockedError`（indexer 内定义）；`watch.py` 捕获 → 批重新入 pending + 退避重挂 Timer。
- 回归：双 Timer 并发确定性复现「撞锁批不丢失」。

### ⑤ RC-2 [P2] 门面/CLI 超时
- `treesearch.py` 可选 `index_timeout_s/search_timeout_s`（wait_for 包 :173-184/252-259/271/327/432，默认 None 兼容）；`cli.py --timeout`。
- 回归：挂起 mock 超时返回明确错误断言。

### ⑥ RI-2 [P2] indexer 三处同步重活 to_thread（含旧AP-9）
- `:1821` text_to_tree 调用点、`:1836` shadow md、`:1795-1798` purge 包 to_thread。
- 回归：并发 wall time < 串行和断言。

### ⑦ RC-3a [P2] 缓存路径 docs 延后加载（本树半边）
- `treesearch.py:240-241/:401-402`：`load_all_documents()` 移入「确认无变更」分支（变更场景白做的全量解析消除）；get_indexed_files 直查（RC-3b）在收尾清单。
- 回归：变更/无变更两路径行为等价断言。

### ⑧ RI-8 [P2]（新编号）skipped 回载改点查（RM-4 消费方独立版）
- `indexer.py:2053` 全量 `load_all_documents()` 回载改按 skipped 的 source_path 逐个 `fts.load_document_by_source_path()`（既有 :1848）——N=skipped 数（受 chunk 上界），不需要任何新变体。
- 回归：return_documents 两态行为等价断言。

### ⑨ RI-5 [P2] json/jsonl/csv 降级可观测（parse_status 防御式消费）
- `indexer.py:866-880/983-984/1026-1027` 三处**自有函数**：空产出时检查 `result.get("parse_status")`——1025-4 合入前该键恒缺省，走现有行为+新增 debug 日志；合入后自动分流 failed_files。本树不定义契约、不依赖其存在。
- 回归：json 损坏 → 日志可见断言（不依赖 parse_status 键）。

### ⑩ AP-2 [P2] 构造改写全局配置
- `treesearch.py:102-103` 实例级配置（copy/构造参数），不写 `get_config()` 单例。
- 回归：双实例不同 db_path 并存断言。

### ⑪ RC-5 [P3] loop 探测 ×3 → `_run_sync`（含旧AP-15）
### ⑫ RC-4 [P3] cli 默认值单源化
- 统一引 `config.get_config()`；**search-mode 分叉（cli.py:449 tree vs :239 auto）开工前问 lead 裁决**。
### ⑬ RC-6 [P3] lazy 加载失败 warning + degraded_doc_ids
### ⑭ RI-7 [P3] Windows 锁缝 try/finally + 裸 pass 收窄（indexer.py:1217/:1322）
### ⑮ RI-6 [P3] 派生路径单源（indexer 侧闭环）
- `pathutil.py` 增 `derive_entry_path/split_entry_path`；indexer 五处（:1907/1668/1718/1920/2069）改调；`:1317` 图像扩展名改 `from .parsers.image_metadata import INTERPRETED_IMAGE_EXTS`（import 既有模块，无需协调）。
- 回归：派生路径一致性断言。
### ⑯ AP-13 [P3] 门面层 kwargs 收敛（SearchOptions TypedDict；build_index 参数收敛随 ⑱）
### ⑰ RC-8 [P4] config frozen + RC-7 [P4] _env_int warning（两小项一提交）
### ⑱ AP-16 [P4] 杂项卫生（台账清单）

## lead 下令才做

### ⑲ AP-4 build_index God Function 拆分【前置①-⑱完成】
- 提取 expand_and_plan/detect_moves/parse_chunk/commit_chunk/finalize；闭包状态显式化。
- 回归：引擎全家桶 + `test_web_search_api_matrix.py` + 0-diff 取证。

## 台账
每提交改 `antipatterns/treesearch-core.md` 对应条目 → `done(<commit>)`；RI-8 为新立条目（RM-4 消费方半边），立时注明「1025-2 独立完成」。
