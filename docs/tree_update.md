# TreeSearch 升级方案：三阶段 Retrieve-Rerank Pipeline

## 问题分析

### 当前 Benchmark 结果 (QASPER, 9 samples)

| 指标 | BM25 | Embedding | Hybrid | BestFirst |
|------|------|-----------|--------|-----------|
| MRR | 0.606 | **0.726** | 0.481 | 0.272 |
| Hit@1 | 0.556 | **0.667** | 0.333 | 0.222 |
| R@5 | 0.806 | **0.917** | 0.833 | 0.444 |
| NDCG@5 | 0.646 | **0.753** | 0.600 | 0.313 |
| LLM调用 | 0 | 0 | 0 | 19/query |
| 延迟 | **0.04s** | 7.8s | 14.2s | 3.7s |

### 各策略核心问题

1. **BestFirst**: LLM 只看 title+summary（信息量~20%），而 BM25/Embedding 搜索的是 text 全文（信息量100%）。19次 LLM 调用逐节点 pointwise 打分，效率低下。
2. **Hybrid (BM25+Emb)**: per-doc min-max 归一化破坏跨文档可比性。BM25 稀疏长尾分布 vs Embedding 密集窄区间分布，简单线性加权不合理。
3. **BestFirst routing**: `route_documents()` LLM 选错论文后，后续搜索全废。

## 升级方案

### 1. 修复 Hybrid 归一化

将 `HybridPreFilter.search()` 改为候选池内归一化（而非 per-doc），确保跨文档可比：
- 先分别收集全局 BM25/Embedding 分数
- 在全局候选池内做 min-max 归一化
- 再加权合并排序

### 2. 三阶段 Pipeline（核心策略）

新增 `retrieve_rerank` 策略，替代简单 BestFirst：

```
Stage 1: Retrieve（高召回粗筛，0 次 LLM）
  → Embedding 全局搜索 top-K 候选（如 K=20）
  → 目标：高 Recall，不漏掉相关节点

Stage 2: Score Fusion（BM25 信号增强，0 次 LLM）
  → 对 Stage 1 候选计算 BM25 score
  → 候选池内归一化后加权：score = α * emb + (1-α) * bm25
  → 截取 top-M（如 M=10）

Stage 3: LLM Rerank（精排 top-N，N 次 LLM）
  → 对 Stage 2 的 top-N（如 N=5-8）候选
  → LLM 看 title + summary + text 片段 + ancestor path
  → Listwise 对比排序（一次调用评估所有候选）
  → 利用树结构提供上下文（ancestor titles, sibling context）
```

### Stage 3 LLM Rerank Prompt 设计

```
Given a query and candidate document sections, rank each by relevance.

Query: {query}

Candidate 1:
  Path: {ancestor_path}
  Title: {title}
  Content (excerpt): {text[:500]}

Candidate 2: ...

Return JSON: {"rankings": [{"node_id": "...", "relevance": 0.0-1.0}]}
```

优势：
- **Listwise > Pointwise**: LLM 看到所有候选后综合判断，而非逐个打分
- **Tree context**: ancestor path 提供结构定位信息
- **Text excerpt**: 直接看内容而非仅看 summary
- **LLM 调用从 19 次降至 1-2 次**

### 3. 自适应逻辑

- 树深度 ≤ 2：Stage 3 用 listwise rerank
- 树深度 ≥ 3：Stage 1 候选命中深层节点时，自动扩展 siblings 到候选池
- Query 长度短（关键词型）：α 偏 BM25；长（语义型）：α 偏 Embedding

## 实施计划

| 优先级 | 改动 | 文件 |
|--------|------|------|
| P0 | 修复 Hybrid 归一化 | `treesearch/embeddings.py` |
| P0 | 新增 `retrieve_rerank` 策略 | `treesearch/search.py` |
| P0 | benchmark 支持新策略 | `examples/benchmark/benchmark.py`, `qasper_benchmark.py` |
| P1 | 自适应深度/query 类型 | 后续迭代 |
