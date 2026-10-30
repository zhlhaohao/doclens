# 1025-3 搜索管线任务书（search/tree_searcher/heuristics/ripgrep/tokenizer/ghost）· 全独立版

> worktree `../1025-3`｜分支 `1025-3`｜上游 `00-orchestration.md` v2
> **独立性**：六文件自包含闭环；全部条目无外部依赖（v1 即无，维持）。
> **文件红线**：`search.py、tree_searcher.py、heuristics.py、ripgrep.py、tokenizer.py、ghost.py`；测试**只新增** `tests/test_rs_*.py`（不改任何既有测试文件——避免与 1025-2 在 lazy_search 上的写冲突）。

## 执行顺序（7 提交）

### ① RS-1 [P2] GrepFilter 归一基准改全局 max
- `search.py:258-262` per-(query,doc) max 归一改为消费点聚合后统一归一（`route_documents_db` :150-166 与 `search` :658 两处，节点内相对序不变；思路同 644ec39b）。
- 回归（先红后绿，`tests/test_rs_grep_norm.py`）：命中 2 行 vs 200 行双文档路由序断言；跑（不改）`test_lazy_search.py test_search_preset_params.py`。

### ② RS-2 [P2] 非法正则双语义统一
- `search.py:274-275` GrepFilter `re.error` 上抛（对齐 :555-559）；`route_documents_db`(:73-86) 构造处透传。**契约变更**（吞→抛）在 commit message 标注。
- 回归：`tests/test_rs_regex_semantics.py` 双路径同非法正则行为一致断言。

### ③ RC-1 [P2] rg 三态失败可区分
- `ripgrep.py` 定义 `RgError`（子类 `RgTimeout/RgUnavailable`）；`_run_rg`(:118-137) 失败上抛；`search_grep`(:91/106/113) 调用方决定：超时→已有部分结果+warning 继续返回、rg 缺失→上抛（宿主对齐 c7d1a1d0 四态）。
- 回归：`tests/test_rs_rg_states.py` mock 缺失/超时/零命中三态可区分断言；跑（不改）`test_grep_corpus_bypass.py`。

### ④ RS-4 [P3] tokenizer 死代码 + 双路径收敛
- 删 `tokenizer.py:20` 宽版正则（零消费）；`:151` auto 分支收敛走 `:76` 单点；`:171` 重复检测合并。
- 回归：`tests/test_rs_tokenizer.py` 四模式（auto/jieba/bigram/char）输出 0-diff。

### ⑤ RS-5 [P3] ghost fail-closed 补日志
- `ghost.py:74-75` except 补 `logger.debug`（契约不变）。
- 回归：`tests/test_rs_ghost_log.py` 日志断言。

### ⑥ RS-3 + RS-6 [P3×2] rerank 系数命名 + 排序非就地
- `tree_searcher.py` 模块级 `RerankWeights` NamedTuple 收编约 15 个裸系数（:260/773/782/807-808/891/905/919/955/974）；`:745` 裸 `x[2]` 改 `_FULL`；`:537` `states.sort` → `sorted()` + 顺序依赖注释。
- 回归：`tests/test_rs_rerank_weights.py` 数值 0-diff 断言（权重不变仅命名）。

### ⑦ AP-7 拆分 + AP-6 双份合并【lead 下令才做；前置①-⑥完成】
- `tree_searcher.py:603-1006` 按 7 阶段提取；入参 `fts_score_map` 局部浅拷贝（:653-656 就地截断契约显式化）；ctx(:672) 改 NamedTuple。同批：`search.py:859/975` flat_nodes 双份抽 `_build_flat_nodes` 共用（AP-6）。
- 回归：本树全套 + 跑（不改）`test_web_search_api_matrix.py`；拆分前后搜索结果 0-diff 取证。

## 台账
每提交改 `antipatterns/treesearch-core.md` 对应 RS/RC-1 条目 → `done(<commit>)`。
灰色项（heuristics 恒同值复测）归收尾清单，不在本任务书。
