# TreeSearch v0.3 重构优化技术方案

## 背景

TreeSearch 基于 PageIndex 的树结构索引，核心思路：文档天然是树 → BM25 预筛 → LLM 推理评估节点相关性。当前版本（v0.2.4）已实现 BestFirst + MCTS + BM25 三层搜索管线。

本次重构有两个目标：

1. **论文需求**：在 RAG 标准 Benchmark（HotpotQA / MultiHop-RAG / HybridRAG-Bench）上跑出优于 Naive RAG baseline 的效果，接近或超越 GraphRAG+KG 的部分子任务。
2. **开源项目需求**：开箱即用，工业可落地，提升 star。

核心学术论点：**树结构感知检索（Tree-Aware Retrieval）通过 LLM 深度推理替代 Embedding 相似度匹配，在结构化文档检索上实现更优的 precision-cost tradeoff。**

---

## 一、当前方法的竞争力分析

### 1.1 方法定位

```
传统 RAG:  Document → Chunk Split → Embedding → Vector Top-K → LLM Generate
GraphRAG:  Document → Entity/Relation Extract → KG Build → Graph Traverse → LLM Generate
TreeSearch: Document → Tree Index (headings/TOC) → BM25 + LLM Tree Navigate → Node Locate → LLM Generate
```

### 1.2 核心优势

| 维度 | TreeSearch | 传统 RAG | GraphRAG |
|------|-----------|---------|----------|
| 结构保留 | 天然保留文档层级 | Chunk 打碎结构 | 重建关系图 |
| 检索精度 | LLM 推理判断 > 向量相似度 | Embedding 压缩损失 | 依赖 KG 质量 |
| 离线成本 | 低（解析标题+摘要） | 中（Embedding） | 高（实体关系抽取） |
| 可解释性 | 树路径直觉清晰 | 弱 | 一般 |
| 更新成本 | 单文档重建 | 重新 Embed | 增量图更新困难 |

### 1.3 当前短板（需本次重构解决）

| 短板 | 说明 | 影响 |
|------|------|------|
| 无 Answer Generation 模块 | 只输出节点，不生成最终答案 | 无法直接跑 QA Benchmark |
| 无 Query Decomposition | 不支持多跳问题拆解 | Multi-Hop 任务表现差 |
| 不支持 PDF/HTML 输入 | 仅 MD/TXT | 工业场景覆盖不足 |
| 无标准 Benchmark 集成 | 缺少 BEIR/MTEB/HotpotQA 评测脚本 | 无法量化对比 |
| 无 Embedding 可选支持 | 纯 BM25 在语义匹配上有缺陷 | 部分查询召回不足 |
| 无 Chunk 级检索 | 只定位到 Node（章节级），不到段落 | 大章节内精度不够 |

---

## 二、重构方案总览

### 2.1 模块架构（v0.3 目标）

```
treesearch/
├── __init__.py          # 公开 API 导出
├── __main__.py          # python -m treesearch 入口
├── cli.py               # CLI: index / search / benchmark
├── llm.py               # 异步 LLM 客户端（已有）
├── tree.py              # 树数据结构与持久化（已有）
├── indexer.py            # 文档索引构建（已有，需扩展）
├── rank_bm25.py         # BM25 实现（已有）
├── search.py            # 搜索策略（已有，需扩展）
├── answer.py            # [新增] Answer Generation — 基于检索结果生成答案
├── decompose.py         # [新增] Query Decomposition — 多跳问题拆解+迭代检索 === 改名字为query_decompose.py 
├── chunk.py             # [新增] Node-内 Chunk 级精细检索
├── embeddings.py        # [新增] 可选 Embedding 支持（PreFilter 协议实现）
├── metrics.py           # 检索评估指标（已有）
├── benchmark.py         # [新增] 标准 Benchmark 评测（HotpotQA/MultiHop-RAG 等）
└── config.py            # [新增] 统一配置管理
```

### 2.2 优先级排序

| 优先级 | 模块 | 论文价值 | 开源价值 | 工作量 |
|--------|------|---------|---------|--------|
| P0 | answer.py (Answer Generation) | 必须 — 跑 QA Benchmark 的前提 | 高 — 用户最常问的需求 | 小 |
| P0 | decompose.py (Query Decomposition) | 必须 — Multi-Hop 任务提升 10-15pp | 高 — 多跳推理是刚需 | 中 |
| P0 | benchmark.py (标准评测) | 必须 — 论文数据来源 | 高 — 展示实力 | 中 |
| P1 | chunk.py (Chunk 级精细检索) | 高 — 提升 Single-Hop 精度 | 高 — 精确答案定位 | 中 |
| P1 | embeddings.py (可选 Embedding) | 高 — Hybrid 方案消融实验 | 高 — 兼容主流生态 | 小 |
| P2 | config.py (配置管理) | 低 | 中 | 小 |
| P2 | PDF/HTML 输入支持 | 低 | 高 — 工业落地必备 | 中 |

---

## 三、核心新增模块设计

### 3.1 Answer Generation (`answer.py`)

**目的**：将检索到的 Node 文本传入 LLM 生成最终答案。跑 QA Benchmark 的必要前提。

```python
async def generate_answer(
    query: str,
    search_result: SearchResult,
    model: str = DEFAULT_MODEL,
    max_context_tokens: int = 8000,
    answer_mode: str = "extractive",  # "extractive" | "generative" | "boolean"
) -> AnswerResult:
    """
    基于检索到的节点文本生成答案。

    Args:
        query: 用户问题
        search_result: search() 返回的 SearchResult
        model: LLM 模型
        max_context_tokens: 上下文 token 上限
        answer_mode:
            - extractive: 从检索文本中抽取答案片段
            - generative: 基于检索文本自由生成
            - boolean: 是/否判断

    Returns:
        AnswerResult(answer, confidence, sources, reasoning)
    """
```

**端到端 API 设计**：

```python
# 一行完成 检索 + 生成
result = await ask(query, documents, model="gpt-4o-mini")
print(result.answer)       # 最终答案
print(result.sources)      # 来源节点
print(result.confidence)   # 置信度
```

`ask()` 内部调用链：`search()` → context assembly → `generate_answer()`

**Context Assembly 策略**：
- 按 search score 降序排列节点
- 每个节点附加其父节点的 title 作为上下文锚点
- 截断到 `max_context_tokens`
- 保留节点的 `line_start/line_end` 以支持溯源

### 3.2 Query Decomposition (`decompose.py`)

**目的**：将多跳问题拆解为单跳子问题，逐步检索并积累上下文。这是 Multi-Hop 任务提升的关键。

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
    多跳问题的迭代检索。

    Pipeline:
      1. LLM 分析问题是否需要多跳 → 如果不需要，直接 search()
      2. LLM 分解为子问题序列
      3. 逐个子问题执行 search()，将已获取信息注入下一轮搜索的 context
      4. 合并所有检索结果

    关键设计：
      - 子问题的 expert_knowledge 参数会注入前序步骤的发现
      - 每一跳的 search 都享受 BM25 + LLM tree search 的完整能力
      - 不需要预构建知识图谱
    """
```

**分解 prompt 设计**：

```
Given a complex question, break it into simple sub-questions that can be answered independently.
Each sub-question should be self-contained and answerable from a single document section.

Question: {query}

Return JSON:
{
    "needs_decomposition": true/false,
    "sub_questions": ["q1", "q2", "q3"],
    "reasoning": "..."
}
```

**迭代检索流程**：

```
原始问题: "What model architecture does the paper that introduced attention mechanism use?"
  ↓ 分解
子问题1: "Which paper introduced the attention mechanism?" → search → 找到 "Attention Is All You Need"
子问题2: "What model architecture does Attention Is All You Need use?" → search (with context from step 1) → 找到 "Transformer"
  ↓ 合并
最终上下文: [Transformer 相关节点 + Attention 相关节点]
```

### 3.3 Chunk 级精细检索 (`chunk.py`)

**目的**：当前 search 定位到 Node（章节级），但一个 Node 可能有几千 token。对于精确 QA，需要进一步定位到具体段落/句子。

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
    """
    在 Node 内部进一步做 chunk 级检索。

    Pipeline:
      1. 取 search_result 中的 top nodes
      2. 将每个 node.text 切分为 chunks（滑动窗口）
      3. BM25 + LLM 对 chunks 排序
      4. 返回精细定位的文本片段

    这一层是可选的——对于大多数应用，Node 级够用。
    只有在需要精确答案抽取时才调用。
    """
```

**两层检索架构**：

```
search() → Node 级定位（章节粒度，快，BM25+LLM tree search）
    ↓
refine_search() → Chunk 级精细定位（段落粒度，可选，BM25+LLM rerank）
    ↓
generate_answer() → 生成最终答案
```

### 3.4 可选 Embedding 支持 (`embeddings.py`)

**目的**：
- 论文角度：消融实验对比 BM25 vs Embedding vs Hybrid
- 开源角度：兼容主流 Embedding 生态，降低用户迁移成本

**设计原则**：Embedding 是可选增强，不是必需依赖。

```python
class EmbeddingPreFilter:
    """
    实现 PreFilter 协议的 Embedding 检索器。
    可无缝替换 NodeBM25Index 作为 search() 的 pre_filter 参数。
    """
    def __init__(
        self,
        documents: list[Document],
        embedding_model: str = "text-embedding-3-small",
        api_key: str = None,
    ):
        """构建向量索引。"""
        ...

    def score_nodes(self, query: str, doc_id: str) -> dict[str, float]:
        """PreFilter 协议实现。"""
        ...


class HybridPreFilter:
    """
    BM25 + Embedding 混合评分。
    hybrid_score = alpha * bm25_norm + (1-alpha) * embedding_norm
    """
    def __init__(
        self,
        documents: list[Document],
        bm25_weight: float = 0.5,
        embedding_model: str = "text-embedding-3-small",
    ):
        ...
```

**PreFilter 协议的设计优势**：

已有的 `PreFilter` 协议使得 Embedding 支持不侵入任何已有代码：

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

### 3.5 标准 Benchmark 评测 (`benchmark.py`)

**目的**：论文数据来源。在标准数据集上量化 TreeSearch 的效果。

**评测数据集选择**：

| 数据集 | 任务类型 | 为什么选 | 预期优势 |
|--------|---------|---------|---------|
| **HotpotQA** | 多跳事实 QA | 最经典的 Multi-Hop 基准 | decompose 模块提升 |
| **MultiHop-RAG** | 多跳检索+生成 | 专门针对 RAG 系统 | 树结构导航优势 |
| **NarrativeQA** | 长文档理解 | 需要章节级定位 | 树搜索的核心场景 |
| **QASPER** | 学术论文 QA | 天然结构化，论文有标题层级 | 最大优势场景 |
| **自建 StructuredDocQA** | 技术文档 QA | 独占赛道 | SOTA |

**评测脚本设计**：

```python
async def run_benchmark(
    dataset: str,              # "hotpotqa" | "multihop_rag" | "qasper" | "custom"
    strategies: list[str],     # ["bm25", "best_first", "best_first+decompose", "hybrid"]
    models: list[str],         # ["gpt-4o-mini", "gpt-4o"]
    output_dir: str = "./benchmark_results",
    max_samples: int = 500,    # 评测样本数
) -> BenchmarkReport:
    """
    标准 Benchmark 评测。

    对每个 (strategy, model) 组合：
      1. 对数据集中每个问题执行检索+生成
      2. 计算 EM/F1/BLEU + Retrieval Precision/Recall/NDCG
      3. 按问题类型细分（single-hop/multi-hop/global）
      4. 输出对比报表
    """
```

**评测指标**：

| 层级 | 指标 | 说明 |
|------|------|------|
| 检索层 | Precision@K, Recall@K, NDCG@K, MRR | 检索出的节点是否包含答案 |
| 生成层 | EM (Exact Match), F1, BLEU | 生成答案与标准答案的匹配度 |
| 效率层 | LLM Calls, Latency, Token Cost | 成本效率 |

---

## 四、现有模块增强

### 4.1 search.py 增强

**4.1.1 支持 Node 文本返回策略**

当前 `search()` 返回 `text` 字段，但对于 Benchmark 需要更灵活的控制：

```python
# 新增参数
text_mode: str = "full"  # "full" | "summary" | "none"
include_ancestors: bool = False  # 是否附加祖先节点的 title/summary 作为上下文
```

**4.1.2 支持多文档 merge 策略**

当前多文档搜索是独立搜索后简单拼接。增加全局排序：

```python
# 新增参数
merge_strategy: str = "interleave"  # "interleave" | "per_doc" | "global_score"
```

- `interleave`：按分数交错排列各文档结果（当前行为）
- `per_doc`：每文档独立返回（当前行为）
- `global_score`：所有文档的节点统一按分数排序

### 4.2 indexer.py 增强

**4.2.1 PDF 输入支持（复用 PageIndex）**

```python
async def pdf_to_tree(
    pdf_path: str,
    model: str = DEFAULT_MODEL,
    **kwargs,
) -> dict:
    """
    PDF → 树索引。
    内部调用 PageIndex 的 page_index() 获取 TOC 结构，
    然后转换为 TreeSearch 的标准 Document 格式。
    """
```

**集成方式**：PageIndex 作为可选依赖（`pip install treesearch[pdf]`），不强制要求。

**4.2.2 build_index 支持 PDF**

```python
# 自动检测文件类型
await build_index(
    paths=["docs/*.md", "papers/*.pdf", "reports/*.txt"],
    output_dir="./indexes",
)
```

### 4.3 rank_bm25.py 增强

**4.3.1 TF-IDF 可选实现**

对于短查询，TF-IDF 有时比 BM25 更稳定：

```python
class NodeTFIDFIndex:
    """TF-IDF 节点索引，作为 BM25 的替代 PreFilter。"""
    ...
```

**4.3.2 查询扩展**

```python
async def expand_query(query: str, model: str) -> str:
    """LLM 扩展查询词，弥补 BM25 的词汇鸿沟。"""
    prompt = f"""Expand this search query with synonyms and related terms.
    Original: {query}
    Return the expanded query as a single string."""
    return await achat(prompt, model=model)
```

---

## 五、论文实验设计

### 5.1 论文标题方向

**"TreeSearch: Structure-Aware Document Retrieval via LLM-Guided Tree Navigation"**

### 5.2 核心 Claim

1. 文档天然具有层级结构（标题、章节、段落），TreeSearch 利用这种结构进行检索，避免了 chunk splitting 导致的上下文碎片化
2. LLM 在树节点上做相关性推理，比 Embedding 相似度匹配更精准（可消融实验验证）
3. Query Decomposition + Tree Search 组合可在多跳任务上接近 KG-based 方法，但构建成本远低于 GraphRAG

### 5.3 实验矩阵

```
数据集: [QASPER, HotpotQA, MultiHop-RAG, NarrativeQA, StructuredDocQA(自建)]

方法:
  - Naive RAG (chunk + embedding + top-k)
  - BM25 baseline
  - TreeSearch-BM25 (BM25-only，零 LLM 成本)
  - TreeSearch-BF (BestFirst，BM25 + LLM)
  - TreeSearch-BF+Decompose (BestFirst + Query Decomposition)
  - TreeSearch-Hybrid (BM25 + Embedding + LLM)
  - GraphRAG / LightRAG (复现或引用数据)

LLM 模型: [gpt-4o-mini, gpt-4o, DeepSeek-V3]

指标:
  - 检索: Precision@3, Recall@3, NDCG@3, MRR
  - 生成: EM, F1
  - 效率: LLM Calls, Latency(s), Token Cost($)
```

### 5.4 预期实验结论

| 实验 | 预期结论 |
|------|---------|
| TreeSearch-BF vs Naive RAG | Single-Hop: +8-15pp EM/F1；Multi-Hop: +3-5pp |
| TreeSearch-BF+Decompose vs Naive RAG | Multi-Hop: +12-20pp（decompose 是关键） |
| TreeSearch-BF vs GraphRAG | Single-Hop: 接近或略优；Multi-Hop: 略低但 cost 低 10x |
| TreeSearch-Hybrid vs TreeSearch-BF | Hybrid 在语义模糊查询上 +3-5pp，说明 Embedding 是有益补充 |
| BM25+LLM 消融 | 去掉 LLM rerank 后掉 10-15pp，说明 LLM 推理评估的关键性 |
| Tree Structure 消融 | 去掉树结构（flat BM25+LLM）后掉 5-8pp，说明结构感知的贡献 |
| QASPER (论文 QA) | TreeSearch SOTA — 论文天然有标题层级，树搜索最大优势场景 |

### 5.5 关键图表设计

1. **Accuracy-Cost Tradeoff 曲线**：X 轴 LLM API Cost，Y 轴 EM/F1。展示 TreeSearch 在同成本下的精度优势
2. **搜索路径可视化**：对比 flat retrieval vs tree navigation 的路径差异
3. **消融实验条形图**：各组件（BM25 / LLM / Tree Structure / Decompose / Embedding）的贡献分解
4. **按问题类型细分表**：Single-Hop / Multi-Hop / Open-ended 分别报数
5. **Case Study**：2-3 个典型查询的完整搜索过程展示

---

## 六、开源项目完善计划

### 6.1 用户体验提升

| 改进 | 说明 | 优先级 |
|------|------|--------|
| `ask()` 一行 API | 检索+生成一步到位 | P0 |
| `pip install treesearch[pdf]` | PDF 支持作为可选依赖 | P1 |
| `pip install treesearch[embedding]` | Embedding 支持作为可选依赖 | P1 |
| 更好的 error message | API Key 缺失、文件格式不支持等场景 | P1 |
| 进度条 | 索引构建和搜索过程的进度反馈 | P2 |
| Streaming 输出 | answer generation 支持流式返回 | P2 |

### 6.2 开箱即用的 API 设计

```python
import treesearch

# 1. 构建索引（一行）
docs = await treesearch.build_index(["papers/*.md", "docs/*.txt"])

# 2. 搜索（一行）
result = await treesearch.search("How does attention work?", docs)

# 3. 问答（一行）
answer = await treesearch.ask("How does attention work?", docs)
print(answer.text)

# 4. 多跳问答（自动 decompose）
answer = await treesearch.ask(
    "What architecture does the paper that introduced attention use?",
    docs,
    decompose=True,
)

# 5. 混合检索（BM25 + Embedding）
answer = await treesearch.ask(
    "How does attention work?",
    docs,
    use_embedding=True,
)
```

### 6.3 README 更新重点

1. 一行安装 + 三行跑通的 Quick Start
2. 与 LangChain / LlamaIndex / GraphRAG 的对比表格
3. Benchmark 结果表（从论文实验直接引用）
4. Architecture diagram（三层搜索管线图）
5. 中英文双 README

### 6.4 依赖管理

```toml
[project]
dependencies = [
    "openai>=1.0",
    "tiktoken>=0.5",
    "jieba>=0.42",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
pdf = ["pageindex>=0.1"]     # PDF 支持
all = ["pageindex>=0.1"]

[project.scripts]
treesearch = "treesearch.cli:main"
```

---

## 七、实施路线

### Phase 4: Answer Generation + Benchmark 基础（2 周）

- [ ] `answer.py`: AnswerResult, generate_answer(), ask()
- [ ] `benchmark.py`: HotpotQA 数据加载 + 评测循环
- [ ] QASPER 数据集集成（论文 QA，最佳优势场景）
- [ ] 端到端评测脚本：search → answer → evaluate
- [ ] 测试覆盖

### Phase 5: Query Decomposition + Multi-Hop（2 周）

- [ ] `decompose.py`: 问题分析、分解、迭代检索
- [ ] search() 集成 decompose 选项
- [ ] HotpotQA Multi-Hop 子集评测
- [ ] MultiHop-RAG 数据集集成
- [ ] 消融实验：with/without decompose

### Phase 6: Chunk 级检索 + Embedding 支持（1 周）

- [ ] `chunk.py`: Node 内 chunk splitting + BM25/LLM rerank
- [ ] `embeddings.py`: EmbeddingPreFilter, HybridPreFilter
- [ ] 消融实验：BM25 vs Embedding vs Hybrid
- [ ] query expansion 实现

### Phase 7: 工程完善 + 论文 Ready（1 周）

- [ ] PDF 输入支持（集成 PageIndex）
- [ ] config.py 统一配置
- [ ] README 全面更新
- [ ] 论文实验跑完，结果汇总
- [ ] 版本发布 v0.3.0

---

## 八、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| HotpotQA 效果不及预期 | 中 | 论文数据不够 | 聚焦 QASPER/NarrativeQA 等结构化文档 QA |
| LLM API 成本过高 | 低 | 评测预算超支 | 优先用 gpt-4o-mini，QASPER 数据量适中 |
| Multi-Hop 提升不够 | 中 | 论文故事不完整 | 强调 cost-accuracy tradeoff 而非绝对精度 |
| Embedding 方案与 BM25 差距小 | 低 | 消融实验不显著 | 本身就是好消息——说明纯 BM25+LLM 够强 |

---

## 九、论文 vs 开源的协同策略

- 论文中的每个实验对应一个 `examples/` 下的可复现脚本
- Benchmark 结果直接在 README 中展示，增强项目可信度
- 论文投稿后第一时间更新 README 附上 arXiv 链接
- 所有实验代码开源，支持一键复现（`python examples/07_paper_experiments.py`）
