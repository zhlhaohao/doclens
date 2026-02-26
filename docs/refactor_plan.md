# TreeSearch v0.3 重构优化技术方案

## 背景

TreeSearch 基于 PageIndex 的树结构索引，核心思路：文档天然是树 → BM25 预筛 → LLM 推理评估节点相关性。当前版本（v0.2.4）已实现 BestFirst + MCTS + BM25 三层搜索管线。

### 项目定位调整

**TreeSearch 聚焦 Search（信息检索），不做 RAG（答案生成）。**

核心价值：**给定 query + document tree → 返回最相关的 node_ids（带 score）**

这是一个 **Information Retrieval (IR)** 问题，不是 QA 问题。Answer Generation 属于下游 RAG 框架（LangChain / LlamaIndex 等）的职责，TreeSearch 不重复造轮子。

### 重构目标

1. **论文需求**：在检索 Benchmark 上跑出优于 Naive RAG baseline 的检索指标（Precision/Recall/NDCG/MRR）。
2. **开源项目需求**：职责单一、边界清晰、开箱即用，用户一看就知道这是一个检索组件。

核心学术论点：**树结构感知检索（Tree-Aware Retrieval）通过 LLM 深度推理替代 Embedding 相似度匹配，在结构化文档检索上实现更优的 precision-cost tradeoff。**

---

## 一、需要移除/降级的已有功能

### 1.1 移除清单

以下模块和功能不属于 Search 核心职责，需要从核心库中移除：

| 模块/功能 | 当前位置 | 处理方式 | 原因 |
|-----------|---------|---------|------|
| `answer.py` | `treesearch/answer.py` | 移到 `examples/answer/` | Answer Generation 属于 RAG 层，不是 Search 职责 |
| `ask()` / `ask_sync()` | `treesearch/__init__.py` 导出 | 移除导出 | 端到端 QA API 不属于检索组件 |
| `benchmark.py` | `treesearch/benchmark.py` | 移到 `examples/benchmark/` | QA Benchmark（EM/F1）依赖答案生成，与 Search 无关 |
| CLI `ask` 子命令 | `treesearch/cli.py` | 移除 | 依赖 answer.py |
| CLI `benchmark` 子命令 | `treesearch/cli.py` | 移除 | 依赖 benchmark.py |
| `tests/test_answer.py` | `tests/` | 删除 | 对应模块已移除 |
| `tests/test_benchmark.py` | `tests/` | 删除 | 对应模块已移除 |

### 1.2 移动到 `examples/` 的详细方案

这些代码有参考价值，作为示例保留在 `examples/` 下，供用户参考如何在 TreeSearch 检索结果之上构建 QA 管线。

#### 1.2.1 `examples/answer/` — Answer Generation 示例

将 `treesearch/answer.py` 改写为独立示例脚本：

```
examples/answer/
├── answer_demo.py        # 基于 treesearch.search() 结果做答案生成的完整示例
└── README_answer.md      # 说明：如何在 TreeSearch 检索结果上套 LLM 生成答案（可选）
```

**`answer_demo.py` 内容要点**：
- 从 `treesearch/answer.py` 提取核心逻辑：`AnswerResult`、`_build_context()`、`_answer_prompt()`、`generate_answer()`、`ask()`
- 改为直接 `import treesearch` 调用 `search()`，然后在示例内部完成 answer generation
- 不再作为 `treesearch` 包的一部分导入，而是一个独立可运行的脚本
- 支持 extractive / generative / boolean 三种模式

#### 1.2.2 `examples/benchmark/` — QA Benchmark 示例

将 `treesearch/benchmark.py` 改写为独立评测脚本：

```
examples/benchmark/
├── qa_benchmark.py       # 端到端 QA 评测脚本（EM/F1，依赖 answer generation）
├── retrieval_benchmark.py # 纯检索评测脚本（Precision/Recall/NDCG/MRR，不需要答案生成）
└── README_benchmark.md    # 说明两种评测方式的区别
```

**`qa_benchmark.py` 内容要点**：
- 从 `treesearch/benchmark.py` 提取：`BenchmarkSample`、`BenchmarkResult`、`BenchmarkReport`、`exact_match()`、`f1_score()`、数据集加载器（`load_hotpotqa`、`load_qasper`、`load_custom`）、`evaluate_sample()`、`run_benchmark()`
- 内部引用 `examples/answer/answer_demo.py` 的 `ask()` 函数
- 作为论文实验脚本使用，不是核心库功能

**`retrieval_benchmark.py` 内容要点**：
- 纯检索评测，调用 `treesearch.search()` + `treesearch.evaluate_query()` 
- 不需要任何答案生成
- **这个才是 TreeSearch 项目真正需要的 benchmark 脚本**
- 现有的 `examples/06_benchmark.py` 已经是这个角色，保持不变

### 1.3 `__init__.py` 修改

移除以下导出：

```python
# 移除这些行：
from treesearch.answer import ask, ask_sync, generate_answer, AnswerResult
from treesearch.benchmark import run_benchmark, BenchmarkReport, print_report
```

修改后的 Core API 注释：

```python
"""
Core API:
    build_index      - Build tree indexes from documents (returns list[Document])
    load_documents   - Load indexed documents from a directory (returns list[Document])
    search           - Search across documents (returns SearchResult)
    search_sync      - Synchronous search wrapper
    evaluate_query   - Evaluate retrieval quality for a single query
    evaluate_benchmark - Evaluate retrieval quality across multiple queries
    Document         - Document data class
"""
```

### 1.4 `cli.py` 修改

移除 `ask` 和 `benchmark` 子命令，CLI 只保留：

```
treesearch index     - Build tree structure index from documents
treesearch search    - Search across indexed documents
```

---

## 二、当前方法的竞争力分析

### 2.1 方法定位

```
传统 RAG:   Document → Chunk Split → Embedding → Vector Top-K
GraphRAG:   Document → Entity/Relation Extract → KG Build → Graph Traverse
TreeSearch: Document → Tree Index (headings/TOC) → BM25 + LLM Tree Navigate → Node Locate
```

注意：TreeSearch 只负责检索（Retrieval），不负责生成（Generation）。下游 RAG 框架可以接上任意 LLM 生成答案。

### 2.2 核心优势

| 维度 | TreeSearch | 传统 RAG | GraphRAG |
|------|-----------|---------|----------|
| 结构保留 | 天然保留文档层级 | Chunk 打碎结构 | 重建关系图 |
| 检索精度 | LLM 推理判断 > 向量相似度 | Embedding 压缩损失 | 依赖 KG 质量 |
| 离线成本 | 低（解析标题+摘要） | 中（Embedding） | 高（实体关系抽取） |
| 可解释性 | 树路径直觉清晰 | 弱 | 一般 |
| 更新成本 | 单文档重建 | 重新 Embed | 增量图更新困难 |

### 2.3 当前短板（需本次重构解决）

| 短板 | 说明 | 影响 |
|------|------|------|
| 无 Query Decomposition | 不支持多跳问题拆解 | Multi-Hop 检索召回不足 |
| 不支持 PDF/HTML 输入 | 仅 MD/TXT | 工业场景覆盖不足 |
| 无标准检索 Benchmark 集成 | 缺少 BEIR/MTEB 等检索评测脚本 | 无法量化对比检索效果 |
| 无 Embedding 可选支持 | 纯 BM25 在语义匹配上有缺陷 | 部分查询召回不足 |
| 无 Chunk 级检索 | 只定位到 Node（章节级），不到段落 | 大章节内精度不够 |

---

## 三、重构方案总览

### 3.1 模块架构（v0.3 目标）

```
treesearch/
├── __init__.py          # 公开 API 导出（聚焦 Search）
├── __main__.py          # python -m treesearch 入口
├── cli.py               # CLI: index / search（仅两个子命令）
├── llm.py               # 异步 LLM 客户端（已有）
├── tree.py              # 树数据结构与持久化（已有）
├── indexer.py           # 文档索引构建（已有，需扩展）
├── rank_bm25.py         # BM25 实现（已有）
├── search.py            # 搜索策略（已有，需扩展）
├── query_decompose.py   # [已有] Query Decomposition — 多跳问题拆解+迭代检索
├── chunk.py             # [已有] Node-内 Chunk 级精细检索
├── embeddings.py        # [已有] 可选 Embedding 支持（PreFilter 协议实现）
├── metrics.py           # 检索评估指标（已有）
└── config.py            # [已有] 统一配置管理
```

**已移除**：`answer.py`、`benchmark.py`（移到 `examples/`）

### 3.2 核心 API

```python
import treesearch

# 1. 构建索引
docs = await treesearch.build_index(["papers/*.md", "docs/*.txt"])

# 2. 搜索
result = await treesearch.search("How does attention work?", docs)
# result.documents[0]["nodes"] → [{node_id, title, score, text, ...}]

# 3. 同步搜索
result = treesearch.search_sync("How does attention work?", docs)

# 4. 多跳搜索（自动 decompose）
from treesearch import decompose_and_search
result = await decompose_and_search("What arch does the attention paper use?", docs)

# 5. Chunk 级精细检索
from treesearch import refine_search
refined = await refine_search("query", result)

# 6. 评估检索质量
metrics = treesearch.evaluate_query(retrieved_ids, relevant_ids, k_values=[1,3,5])
```

### 3.3 优先级排序

| 优先级 | 模块 | 论文价值 | 开源价值 | 工作量 |
|--------|------|---------|---------|--------|
| P0 | query_decompose.py (Query Decomposition) | 必须 — Multi-Hop 检索提升 | 高 — 多跳检索是刚需 | 中 |
| P0 | 检索 Benchmark 评测脚本 | 必须 — 论文数据来源 | 高 — 展示检索实力 | 中 |
| P1 | chunk.py (Chunk 级精细检索) | 高 — 提升 Single-Hop 精度 | 高 — 精确定位 | 中 |
| P1 | embeddings.py (可选 Embedding) | 高 — Hybrid 方案消融实验 | 高 — 兼容主流生态 | 小 |
| P2 | config.py (配置管理) | 低 | 中 | 小 |
| P2 | PDF/HTML 输入支持 | 低 | 高 — 工业落地必备 | 中 |

---

## 四、核心模块设计

### 4.1 Query Decomposition (`query_decompose.py`)（已实现）

**目的**：将多跳问题拆解为单跳子问题，逐步检索并积累上下文。这是 Multi-Hop 检索召回提升的关键。

**核心思路**：不造 KG 轮子，用纯 LLM 推理链替代图遍历。

```python
async def decompose_and_search(
    query: str,
    documents: list[Document],
    model: str = DEFAULT_MODEL,
    max_hops: int = 3,
    strategy: str = "best_first",
    **search_kwargs,
) -> SearchResult:
    """
    多跳问题的迭代检索。返回 SearchResult（不生成答案）。
    """
```

### 4.2 Chunk 级精细检索 (`chunk.py`)（已实现）

```python
async def refine_search(
    query: str,
    search_result: SearchResult,
    model: str = DEFAULT_MODEL,
    chunk_size: int = 256,
    chunk_overlap: int = 64,
    top_k_chunks: int = 3,
    use_bm25: bool = True,
) -> RefinedSearchResult:
    """在 Node 内部进一步做 chunk 级检索。"""
```

### 4.3 可选 Embedding 支持 (`embeddings.py`)（已实现）

```python
# 纯 BM25（默认，无需 Embedding）
result = await search(query, documents)

# 纯 Embedding
emb_filter = EmbeddingPreFilter(documents, model="text-embedding-3-small")
result = await search(query, documents, pre_filter=emb_filter, use_bm25=False)

# Hybrid（BM25 + Embedding）
hybrid_filter = HybridPreFilter(documents, bm25_weight=0.4)
result = await search(query, documents, pre_filter=hybrid_filter, use_bm25=False)
```

---

## 五、现有模块增强

### 5.1 search.py 增强

**5.1.1 支持 Node 文本返回策略**

```python
text_mode: str = "full"  # "full" | "summary" | "none"
include_ancestors: bool = False  # 是否附加祖先节点的 title/summary 作为上下文
```

**5.1.2 支持多文档 merge 策略**

```python
merge_strategy: str = "interleave"  # "interleave" | "per_doc" | "global_score"
```

### 5.2 indexer.py 增强

**PDF 输入支持（复用 PageIndex）**：PageIndex 作为可选依赖（`pip install treesearch[pdf]`），不强制要求。

### 5.3 rank_bm25.py 增强

- TF-IDF 可选实现（`NodeTFIDFIndex`，已实现）
- 查询扩展（`expand_query`，已实现）

---

## 六、论文实验设计

### 6.1 论文标题方向

**"TreeSearch: Structure-Aware Document Retrieval via LLM-Guided Tree Navigation"**

### 6.2 核心 Claim

1. 文档天然具有层级结构，TreeSearch 利用这种结构进行检索，避免了 chunk splitting 导致的上下文碎片化
2. LLM 在树节点上做相关性推理，比 Embedding 相似度匹配更精准（可消融实验验证）
3. Query Decomposition + Tree Search 组合可在多跳检索上接近 KG-based 方法，但构建成本远低于 GraphRAG

### 6.3 论文只跑检索指标（不跑 QA 生成指标）

**关键决策**：论文聚焦检索评测，不评答案生成质量。

理由：
- TreeSearch 的核心贡献是 **检索**，不是答案生成
- 检索指标（P/R/NDCG/MRR）直接反映 TreeSearch 的价值
- Answer Generation 只是在检索结果上套一层 LLM，任何框架都能做，不是 TreeSearch 的贡献
- BEIR / MTEB 等标准检索 Benchmark 也只评检索质量

如果 reviewer 要求看端到端 QA 效果，可以用 `examples/answer/` 和 `examples/benchmark/qa_benchmark.py` 补充实验。

### 6.4 评测数据集选择

| 数据集 | 任务 | 评测指标 | 说明 |
|--------|------|---------|------|
| **QASPER** | 检索支撑段落 | P@K, R@K, NDCG@K | 天然有标题层级，最大优势场景 |
| **HotpotQA** | 检索 supporting facts | P@K, R@K, MRR | 多跳场景 + query decompose |
| **自建 StructuredDocQA** | 技术文档检索 | P@K, R@K, NDCG@K | 独占赛道 |

所有这些数据集都有 **ground truth supporting facts / evidence paragraphs**，可以直接评检索准确率，不需要生成答案。

### 6.5 实验矩阵

```
数据集: [QASPER, HotpotQA, StructuredDocQA(自建)]

方法:
  - Naive RAG (chunk + embedding + top-k)
  - BM25 baseline
  - TreeSearch-BM25 (BM25-only，零 LLM 成本)
  - TreeSearch-BF (BestFirst，BM25 + LLM)
  - TreeSearch-BF+Decompose (BestFirst + Query Decomposition)
  - TreeSearch-Hybrid (BM25 + Embedding + LLM)
  - GraphRAG / LightRAG (复现或引用数据)

LLM 模型: [gpt-4o-mini, gpt-4o, DeepSeek-V3]

指标（纯检索）:
  - Precision@K (K=1,3,5)
  - Recall@K (K=1,3,5)
  - NDCG@K (K=1,3,5)
  - MRR
  - F1@K
  - Hit@K
  - LLM Calls, Latency(s), Token Cost($)
```

### 6.6 预期实验结论

| 实验 | 预期结论 |
|------|---------|
| TreeSearch-BF vs Naive RAG | 检索 P@3/R@3: +10-20pp |
| TreeSearch-BF+Decompose vs TreeSearch-BF | Multi-Hop 检索 R@3: +10-15pp |
| TreeSearch-BF vs GraphRAG | Single-Hop 接近或略优；Multi-Hop 略低但 cost 低 10x |
| TreeSearch-Hybrid vs TreeSearch-BF | 语义模糊查询 +3-5pp |
| BM25+LLM 消融 | 去掉 LLM rerank 后检索 P@3 掉 10-15pp |
| Tree Structure 消融 | 去掉树结构（flat BM25+LLM）后掉 5-8pp |
| QASPER (论文 QA) | TreeSearch 检索 SOTA — 论文天然有标题层级 |

### 6.7 关键图表设计

1. **Retrieval Accuracy-Cost Tradeoff 曲线**：X 轴 LLM API Cost，Y 轴 NDCG@3。展示 TreeSearch 在同成本下的检索精度优势
2. **搜索路径可视化**：对比 flat retrieval vs tree navigation 的路径差异
3. **消融实验条形图**：各组件（BM25 / LLM / Tree Structure / Decompose / Embedding）对检索指标的贡献分解
4. **按问题类型细分表**：Single-Hop / Multi-Hop 分别报检索指标
5. **Case Study**：2-3 个典型查询的完整搜索过程展示

---

## 七、开源项目完善计划

### 7.1 用户体验提升

| 改进 | 说明 | 优先级 |
|------|------|--------|
| `pip install treesearch[pdf]` | PDF 支持作为可选依赖 | P1 |
| `pip install treesearch[embedding]` | Embedding 支持作为可选依赖 | P1 |
| 更好的 error message | API Key 缺失、文件格式不支持等场景 | P1 |
| 进度条 | 索引构建和搜索过程的进度反馈 | P2 |

### 7.2 开箱即用的 API 设计

```python
import treesearch

# 1. 构建索引（一行）
docs = await treesearch.build_index(["papers/*.md", "docs/*.txt"])

# 2. 搜索（一行）
result = await treesearch.search("How does attention work?", docs)

# 3. 同步搜索
result = treesearch.search_sync("How does attention work?", docs)

# 4. 多跳搜索
from treesearch import decompose_and_search
result = await decompose_and_search("complex multi-hop query", docs)

# 5. 检索评估
metrics = treesearch.evaluate_query(retrieved_ids, relevant_ids, k_values=[1,3,5])
```

### 7.3 README 更新重点

1. 一行安装 + 三行跑通的 Quick Start
2. 与 LangChain / LlamaIndex / GraphRAG 的对比表格（聚焦检索能力）
3. Benchmark 检索结果表（从论文实验直接引用）
4. Architecture diagram（三层搜索管线图）
5. 中英文双 README
6. 明确说明：TreeSearch 是检索组件，可集成到任何 RAG 框架中

### 7.4 依赖管理

```toml
[project]
dependencies = [
    "openai>=1.0",
    "tiktoken>=0.5",
    "jieba>=0.42",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
pdf = ["pageindex>=0.1"]
all = ["pageindex>=0.1"]

[project.scripts]
treesearch = "treesearch.cli:main"
```

---

## 八、实施路线

### Phase 4: 核心库瘦身 + 检索 Benchmark（1 周）

- [x] 从核心库移除 `answer.py` → `examples/answer/answer_demo.py`
- [x] 从核心库移除 `benchmark.py` → `examples/benchmark/qa_benchmark.py`
- [x] 从 `__init__.py` 移除 `ask`/`ask_sync`/`generate_answer`/`AnswerResult`/`run_benchmark`/`BenchmarkReport`/`print_report` 导出
- [x] 从 `cli.py` 移除 `ask` 和 `benchmark` 子命令
- [x] 删除 `tests/test_answer.py` 和 `tests/test_benchmark.py`
- [ ] 完善 `examples/06_benchmark.py`（纯检索评测脚本）
- [ ] 测试所有保留模块正常工作

### Phase 5: Query Decomposition 优化 + Multi-Hop 检索评测（2 周）

- [ ] 优化 `query_decompose.py` 的多跳检索效果
- [ ] HotpotQA 检索子集评测（只评检索，不评答案）
- [ ] QASPER 检索评测
- [ ] 消融实验：with/without decompose 对检索指标的影响

### Phase 6: Chunk 级检索 + Embedding 支持优化（1 周）

- [ ] 优化 `chunk.py` 的检索精度
- [ ] 优化 `embeddings.py` 的 Hybrid 方案
- [ ] 消融实验：BM25 vs Embedding vs Hybrid（检索指标对比）
- [ ] query expansion 优化

### Phase 7: 工程完善 + 论文 Ready（1 周）

- [ ] PDF 输入支持（集成 PageIndex）
- [ ] config.py 统一配置
- [ ] README 全面更新（聚焦检索能力）
- [ ] 论文检索实验跑完，结果汇总
- [ ] 版本发布 v0.3.0

---

## 九、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| HotpotQA 检索效果不及预期 | 中 | 论文数据不够 | 聚焦 QASPER 等结构化文档检索 |
| LLM API 成本过高 | 低 | 评测预算超支 | 优先用 gpt-4o-mini |
| Multi-Hop 检索提升不够 | 中 | 论文故事不完整 | 强调 cost-accuracy tradeoff |
| Embedding 方案与 BM25 差距小 | 低 | 消融实验不显著 | 好消息——纯 BM25+LLM 够强 |
| Reviewer 要求看端到端 QA 效果 | 中 | 需补充实验 | 用 examples/ 下的脚本快速补实验 |

---

## 十、论文 vs 开源的协同策略

- 论文中的每个检索实验对应一个 `examples/` 下的可复现脚本
- Benchmark 检索结果直接在 README 中展示，增强项目可信度
- 论文投稿后第一时间更新 README 附上 arXiv 链接
- 所有实验代码开源，支持一键复现
- `examples/answer/` 和 `examples/benchmark/qa_benchmark.py` 作为"可选扩展"展示 TreeSearch 集成 RAG 的能力
