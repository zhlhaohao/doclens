# TreeSearch Retrieve-Rerank Pipeline Design

## Core Insight

Tree search 的价值不在"遍历"，而在"提供结构化上下文给 LLM 做精排"。
用廉价 signal（Embedding / BM25）解决 Recall，用昂贵 signal（LLM）解决 Precision。

## Benchmark Baseline (QASPER, 9 samples)

| Metric | BM25 | Embedding | Hybrid | BestFirst | RR v1 (broken) |
|--------|------|-----------|--------|-----------|----------------|
| MRR | 0.606 | **0.726** | 0.133 | 0.281 | 0.333 |
| Hit@1 | 0.556 | **0.667** | 0.000 | 0.222 | 0.333 |
| R@5 | 0.806 | **0.917** | 0.139 | 0.444 | 0.278 |
| LLM calls | 0 | 0 | 0 | 19 | 1 |

## Root Cause Analysis (v1 failure)

v1 `retrieve_rerank` scored **worse than pure embedding** because:

1. **Alpha-weighted normalization killed single-channel recall**: alpha=0.7 (BM25 weight),
   nodes only hit by embedding got score = 0.3 * emb_norm, effectively a 70% penalty.
   Example: node at emb_rank=0 dropped to fused_rank=2; node at emb_rank=3 dropped to fused_rank=8 (out of top-8).
2. **Short query heuristic backfired**: QASPER queries average 5-7 words, all classified as
   "short" -> alpha=0.7 -> BM25 dominance. But BM25 is weaker than embedding on academic text.
3. **LLM rerank fully replaced fusion scores**: when LLM misjudged relevance, the original
   retrieval signal was completely lost.

## Fix: Three Key Changes

### 1. Reciprocal Rank Fusion (RRF) replaces weighted normalization

```
RRF_score(node) = sum(1 / (k + rank_i)) for each retrieval channel
```

RRF is rank-based, not score-based. A node appearing at rank 3 in embedding but absent
from BM25 gets score = 1/(60+4) = 0.0156, NOT zero. This preserves recall from both channels.

### 2. LLM rerank in "boost mode" (blend, not replace)

```
final_score = 0.6 * llm_relevance + 0.4 * normalized_rrf_score
```

LLM judgment improves precision without catastrophically destroying retrieval recall.

### 3. Larger rerank window (8 -> 10)

With RRF preserving more diverse candidates, a slightly larger window captures more hits.

## Architecture

```
Stage 1: Recall Maximizer (0 LLM calls, parallel)
  ├── Embedding top-20 (semantic)
  └── BM25 top-20 (keyword)
  → Union: ~25-35 unique candidates

Stage 2: Reciprocal Rank Fusion (0 LLM calls)
  → RRF(emb_ranks, bm25_ranks, k=60)
  → Rank-based fusion, no normalization needed
  → Top-10 for Stage 3

Stage 3: LLM Listwise Rerank (1 LLM call, boost mode)
  → LLM sees: title + text excerpt + ancestor path
  → final = 0.6 * llm_score + 0.4 * rrf_norm
  → Top-5 output
```

## Configuration

All parameters in `RetrieveRerankConfig`, env var overridable:

| Env Var | Default | Description |
|---------|---------|-------------|
| TREESEARCH_RR_EMB_TOPK | 20 | Embedding recall size |
| TREESEARCH_RR_BM25_TOPK | 20 | BM25 recall size |
| TREESEARCH_RR_RRF_K | 60 | RRF smoothing constant |
| TREESEARCH_RR_RERANK_N | 10 | LLM rerank window |
| TREESEARCH_RR_LLM_WEIGHT | 0.6 | LLM vs RRF blend weight |
| TREESEARCH_RR_EXCERPT_LEN | 500 | Text excerpt chars for LLM |
