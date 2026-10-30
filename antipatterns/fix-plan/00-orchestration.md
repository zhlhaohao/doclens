# treesearch 修复 · 4-worktree 全独立并行分派总控 v2

> 生成日期：2026-10-25（v2，取代 v1 的波次依赖结构）｜上游：`antipatterns/treesearch-fix-plan.md`（78 条）
> **独立性契约（硬约束）**：每个 worktree 的任务单凭自己的分支即可完成、测试、合并；**不依赖其他 worktree 的任何改动，合并顺序任意**。原 v1 的 4 处跨树依赖已全部消除（见第三节「依赖消除记录」）。

## 一、worktree 与文件所有权（写权限互斥）

| worktree | 分支 | 专属文件（只许改这些 + 各自新增测试） | 主题 | 条目数 |
|---|---|---|---|---|
| **1025-1** | `1025-1` | `treesearch/fts.py`、`treesearch/tree.py`；测试：新增 `tests/test_rm_*.py` 或扩 `test_fts_*.py` | 存储层 | RM-1~10、AP-3 拆分 |
| **1025-2** | `1025-2` | `treesearch/indexer.py`、`watch.py`、`treesearch.py`、`config.py`、`cli.py`、`pathutil.py`、`__init__/__main__`；测试：扩 `test_lazy_search.py test_index_chunking.py test_change_detection.py test_max_dir_files.py test_file_watcher_*.py`，新增 `test_ri_*.py`/`test_rc_*.py` | 索引管线与门面 | AP-1/5、RI-1~8、RC-2~8、AP-2/4/13/15/16 |
| **1025-3** | `1025-3` | `treesearch/search.py`、`tree_searcher.py`、`heuristics.py`、`ripgrep.py`、`tokenizer.py`、`ghost.py`；测试：**只新增** `tests/test_rs_*.py`（不改既有文件） | 搜索管线 | RS-1~6、RC-1、AP-6/7 |
| **1025-4** | `1025-4` | `treesearch/parsers/**`；测试：扩 `test_pst_parser.py test_anydoc_parser.py test_docx_parser.py test_pdf_native_preview_api.py`，新增 `test_rq_*.py`/`test_rp_*.py` | 解析器 | RP-1~7、RQ-1~9、P-AP-3/5/6/9/10/12/13/14 |

创建（各自基于 release，无先后）：
```bash
git worktree add ../1025-1 -b 1025-1 release   # ×4 同构
```
pytest 一律主仓 venv：`../cortex/.venv/Scripts/python.exe -m pytest`。

## 二、执行模型（无波次）

- 4 个 worktree **同时开工、各自按任务书内顺序执行**，条目间顺序只在任务书内部（同文件改动的先后），树与树之间无任何顺序。
- 完成即提（引用条目编号）→ lead 随时合入 release，**合并顺序任意**（1/2/3/4 任意排列均无冲突：代码文件互斥，台账改各自的行）。
- 「lead 下令才做」仅存的四个 God Object 拆分是**风险闸**（要求本树前置条目先完成+护栏就位），不是树间顺序。

## 三、依赖消除记录（v1 → v2 的重设计）

| v1 依赖 | 消除方式 |
|---|---|
| RM-1 提供 batch 方法 → RI-3 消费 | **RI-3 重设计**：改用 fts 既有公共 API `filter_known_source_paths()`（fts.py:2595，分批 IN 已存在）批量验常规文件存在性；PST 前缀检查保持逐个（PST 稀少，且 RM-1 独立把它索引化——两修各自成立、叠加增益，互不需要）。RM-1 的 batch API 承诺**取消** |
| RM-9 事务语义 → RI-1 依赖 | **RI-1 重设计**：indexer 在失败写入后直接调**既有公共 API** `fts.commit()`（fts.py:1081）立即提交；全失败 chunk 在 gather 后补一次 commit。不依赖 RM-9；RM-9 后合入时双 commit 幂等无害 |
| RP-1 parse_status 契约 → RI-5 消费 | **双侧解耦**：RP-1 的 P1 效果（文件级失败 raise）天然流入 indexer **既有** except→failed_files 通道（indexer.py:1847-1857），无需 indexer 改动；RI-5 修的是 indexer **自有**三格式函数（json/jsonl/csv 都在 indexer.py），外部 parser 的 parse_status 字段用 `result.get()` 防御式读取——单侧合入即单侧生效，双侧合入全效，任意顺序兼容 |
| RI-6 pathutil 真源 ⟷ RQ-7 半边 | **本就无依赖**（v1 误设）：RQ-7 的修复是 image_parser import image_metadata——**两者都在 parsers/**，1025-4 内部闭环；indexer.py:1317 那份是 RI-6 自己的事（import 既有模块不需要协调） |

另两处原跨树项处置：
- **RC-3 拆半**：RC-3a（缓存路径 docs 延后加载，纯 treesearch.py 逻辑）归 1025-2 独立完成；RC-3b（get_indexed_files 元数据直查，需 fts 新 API+treesearch 消费两点联动）**移出并行范围，入第五节收尾清单**。
- **RM-4 的 indexer 消费方**（indexer.py:2053 skipped 回载）独立成 **RI-8** 归 1025-2：改用既有 `load_document_by_source_path()`（fts.py:1848）按 skipped 逐个点查（N=skipped 数，受 chunk 上界约束）——不需要 RM-4 的任何新变体。

## 四、共享资产纪律

| 资产 | 规则 |
|---|---|
| `antipatterns/treesearch-core.md` / `-parsers.md` | 只改自己条目的 status 行（不同行自动合并）；冲突由 lead 合并时解决 |
| `tests/conftest.py`、`test_architecture.py`、`pyproject.toml` | **冻结**；确需动 → 停，报 lead |
| 既有测试文件 | 按第一节所有权：1025-3 只新增不改既有；其余各自域内可扩 |
| 新增测试文件 | 按前缀归属（test_rm_/ri_/rc_/rs_/rq_/rp_），零冲突 |

## 五、合并后收尾清单（lead 单人单提交序列，**不属于任何 worktree**）

1. RC-3b：get_indexed_files 元数据直查（fts 加 `load_doc_metadata()` + treesearch.py 消费，两点一提交）
2. heuristics 压缩链恒同值复测（W7 trace 脚手架随 1025-1⑧合入后跑 rag-bench）
3. `image_parser.py:14` 反向 import indexer 层次判定（对照 test_architecture 口径）
4. PST 前缀批量探测（`batch_has_docs_with_source_prefix`）：仅当大库实测仍有需要
5. 全量回归：四树全合后 `background_run` 全量 pytest + 7860 大库三项实测（增量 SQL 次数 / PST 前缀查询 / 大 PDF 内存峰值）回填台账

## 六、worktree 完成关（各自独立执行）

每树全部条目完成时：跑本树专属全家桶 + `test_architecture.py`，全绿后报 lead 合并。条目清单见各任务书；回归三层体系见 `../treesearch-fix-plan.md` 回归章节。
