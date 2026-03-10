[**🌐English**](https://github.com/shibing624/TreeSearch/blob/main/README.md) | [**🇨🇳中文**](https://github.com/shibing624/TreeSearch/blob/main/README_ZH.md)

<div align="center">
  <a href="https://github.com/shibing624/TreeSearch">
    <img src="https://raw.githubusercontent.com/shibing624/TreeSearch/main/docs/logo.svg" height="150" alt="Logo">
  </a>
</div>

-----------------

# TreeSearch: 结构感知的文档检索
[![PyPI version](https://badge.fury.io/py/pytreesearch.svg)](https://badge.fury.io/py/pytreesearch)
[![Downloads](https://static.pepy.tech/badge/pytreesearch)](https://pepy.tech/project/pytreesearch)
[![License Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![python_version](https://img.shields.io/badge/Python-3.10%2B-green.svg)](requirements.txt)
[![GitHub issues](https://img.shields.io/github/issues/shibing624/TreeSearch.svg)](https://github.com/shibing624/TreeSearch/issues)
[![Wechat Group](https://img.shields.io/badge/wechat-group-green.svg?logo=wechat)](#社区与支持)

**TreeSearch** 是一个结构感知的文档检索库。将文档解析为树结构，然后通过 FTS5/BM25 关键词匹配或 LLM 推理进行检索。支持 Markdown、纯文本、代码文件（Python/Java/Go/JS/C++ 等）、HTML、XML、JSON 和 CSV。无需向量嵌入，无需分块。

## 安装

```bash
pip install -U pytreesearch
```

## 快速开始

```python
from treesearch import TreeSearch

# 懒加载索引 —— 首次搜索时自动构建索引
ts = TreeSearch("docs/*.md", "src/*.py", model="gpt-4o")
results = ts.search("认证系统如何工作？")
for doc in results.documents:
    for node in doc["nodes"]:
        print(f"[{node['score']:.2f}] {node['title']}")
```

FTS5/BM25 策略无需 API Key 即可开箱即用。若需 LLM 增强策略（`best_first`），请先设置 API Key：

```bash
export OPENAI_API_KEY="sk-..."
# 可选：自定义 endpoint
export OPENAI_BASE_URL="https://your-endpoint/v1"
```

## 为什么选择 TreeSearch？

传统 RAG 系统将文档切分为固定大小的块，通过向量相似度检索。这种方式**破坏了文档结构**，丢失了标题层级关系，且无法处理需要推理的查询。

TreeSearch 采用完全不同的方法——根据文档的自然标题层级将其解析为**树结构**，然后使用 **BM25 + LLM 推理**在树上导航，找到最相关的章节。

| | 传统 RAG | TreeSearch |
|---|---|---|
| **预处理** | 分块 + 向量嵌入 | 解析标题 → 构建树 |
| **检索** | 向量相似度搜索 | FTS5/BM25 预打分 + LLM 树搜索 |
| **多文档** | 需要向量数据库路由 | LLM 根据文档描述路由 |
| **结构** | 分块后丢失 | 完整保留为树形层级 |
| **依赖** | 向量数据库 + 嵌入模型 | 仅 SQLite（LLM 可选，无嵌入、无向量库） |
| **零成本基线** | 无 | FTS5 独立搜索（无需 LLM） |

### 核心优势

- **无需向量嵌入** — 不需要训练、部署或付费使用嵌入模型
- **无需分块** — 文档保留自然的标题层级结构
- **无需向量数据库** — 不需要 Pinecone、Milvus 或 Chroma
- **树感知检索** — 标题层级引导搜索，而非任意的分块边界
- **SQLite FTS5 预过滤**（默认） — 持久化倒排索引，WAL 模式，增量更新，CJK 分词，SQL 聚合查询
- **BM25 零成本基线** — 即时关键词搜索，无需 API 调用，可独立使用或作为预过滤
- **LLM 预算控制** — 设定每次查询的最大 LLM 调用次数，置信度高时提前停止

## 功能特性

- **FTS5-only 搜索**（默认） — 零 LLM 调用，毫秒级 FTS5/BM25 关键词匹配，无需 API Key
- **SQLite FTS5 引擎** — 持久化倒排索引，WAL 模式，增量更新，MD 结构感知列（标题/摘要/正文/代码/前言），列权重加权，CJK 分词
- **树结构索引** — Markdown、纯文本、代码文件（Python/Java/Go/JS/C++/PHP）、HTML、XML、JSON 和 CSV 均被解析为层级树
- **GrepFilter 精准匹配** — 支持字面量/正则表达式匹配，精准定位代码符号和关键词
- **BM25 节点级索引** — 结构感知评分，层级字段加权（标题 > 摘要 > 正文）和祖先传播
- **Best-First 搜索**（可选） — 优先队列驱动，FTS5 预打分 + LLM 评估，提前停止和预算控制
- **多文档搜索** — 通过 LLM 推理在文档集合间路由查询
- **中英文支持** — 内置 jieba 中文分词和英文正则分词
- **批量索引** — `build_index()` 支持 glob 模式并发多文件处理
- **评估指标** — Precision@K、Recall@K、MRR、NDCG@K、Hit@K、F1@K（位于 `examples/benchmark/metrics.py`）
- **异步优先** — 所有核心函数均为异步，提供同步适配器
- **CLI 命令** — `treesearch index` 和 `treesearch search` 命令

## FTS5 独立搜索（无需 LLM）

```python
from treesearch import FTS5Index, Document, load_index

data = load_index("indexes/my_doc.json")
doc = Document(doc_id="doc1", doc_name=data["doc_name"], structure=data["structure"])

fts = FTS5Index(db_path="indexes/fts.db")  # 持久化, 或不传为内存模式
fts.index_documents([doc])

# 简单关键词搜索
results = fts.search("认证配置", top_k=5)
for r in results:
    print(f"[{r['fts_score']:.4f}] {r['title']}")

# 高级 FTS5 查询语法
results = fts.search("认证", fts_expression='title:认证 AND body:配置', top_k=5)

# 按文档聚合统计
agg = fts.search_with_aggregation("认证", group_by_doc=True)
for doc_agg in agg:
    print(f"{doc_agg['doc_name']}: {doc_agg['hit_count']} 命中, 最高分={doc_agg['best_score']:.4f}")
```

## CLI

```bash
# 从 glob 模式构建索引
treesearch index --paths "docs/*.md" --add-description

# 使用 Best-First + FTS5 搜索（默认预过滤引擎）
treesearch search --index_dir ./indexes/ --query "认证系统如何工作？" --fts

# 持久化 FTS5 数据库
treesearch search --index_dir ./indexes/ --query "认证" --fts --fts-db ./indexes/fts.db

# 控制 LLM 调用预算
treesearch search --index_dir ./indexes/ --query "认证" --max-llm-calls 10
```

## 工作原理

```
输入文档 (MD/TXT/Code/JSON/CSV/HTML/XML)
        │
        ▼
   ┌──────────┐
   │  Indexer  │  解析结构 → 构建树 → 生成摘要
   └────┬─────┘    (build_index 支持 glob 批量处理)
        │  JSON 索引文件
        ▼
   ┌──────────┐
   │  search   │  FTS5/Grep 匹配 → （可选）文档路由 → 树搜索
   └────┬─────┘
        │  dict 结果
        ▼
  带分数和文本的排序节点
```

**第一层 — FTS5/BM25 预打分**：`FTS5Index`（默认）使用 SQLite FTS5 倒排索引，MD 结构感知列和列权重加权实现快速预过滤。或使用 `NodeBM25Index` 进行内存 BM25 打分。两者均即时完成，无需 LLM。

**第二层 — 树搜索**（可选）：`TreeSearch` 使用优先队列展开最有潜力的节点。LLM 仅评估节点的标题 + 摘要的相关性。当最高分低于阈值时提前停止。

**第三层 — 结果输出**：预算控制的 LLM 调用，支持子树缓存以便跨查询复用。

### 搜索策略

| 策略 | 描述 | LLM 调用 | 适用场景 |
|------|------|----------|----------|
| `fts5_only`（默认） | 纯 FTS5/BM25 评分 | 零 | 快速关键词搜索，无需 API Key |
| `best_first` | FTS5/BM25 预打分 + 优先队列 + LLM 评估 | 中等（预算控制） | 准确率最高 |
| FTS5 独立 | `FTS5Index.search()` | 零 | 持久化倒排索引，无需 API Key |

## 示例

| 示例 | 描述 |
|------|------|
| [`01_basic_demo.py`](examples/01_basic_demo.py) | 最简演示：构建索引 + 搜索 |
| [`02_index_and_search.py`](examples/02_index_and_search.py) | Markdown 和纯文本索引 + FTS5 搜索 |
| [`04_cli_workflow.py`](examples/04_cli_workflow.py) | CLI 工作流：构建索引 + 策略搜索 |
| [`05_multi_doc_search.py`](examples/05_multi_doc_search.py) | 多文档搜索 + BM25 + GrepFilter + 策略对比 |

## 项目结构

```
treesearch/
├── llm.py            # 异步 LLM 客户端，支持重试和 JSON 提取
├── tree.py           # Document 数据类、树操作、持久化
├── indexer.py        # MD / 文本 / 代码 / JSON / CSV / HTML / XML → 树结构，批量 build_index()
├── search.py         # Best-First、GrepFilter，文档路由，统一 search() API
├── treesearch.py     # TreeSearch 统一引擎类（索引 + 搜索）
├── fts.py            # SQLite FTS5 全文检索引擎（持久化倒排索引）
├── rank_bm25.py      # BM25Okapi、NodeBM25Index、中英文分词器
├── config.py         # 统一配置管理（env > YAML > 默认值）
└── cli.py            # CLI 入口（index / search）
```

## 文档

- [架构设计](https://github.com/shibing624/TreeSearch/blob/main/docs/architecture.md) — 设计原则和三层架构
- [API 参考](https://github.com/shibing624/TreeSearch/blob/main/docs/api.md) — 完整 API 文档

## 社区与支持

- **GitHub Issues** — [提交 issue](https://github.com/shibing624/TreeSearch/issues)
- **微信群** — 添加微信号 `xuming624`，备注 "llm"，加入技术交流群

<img src="https://github.com/shibing624/TreeSearch/blob/main/docs/wechat.jpeg" width="200" />

## 引用

如果您在研究中使用了 TreeSearch，请引用：

```bibtex
@software{xu2026treesearch,
  author = {Xu, Ming},
  title = {TreeSearch: Structure-Aware Document Retrieval Without Embeddings},
  year = {2026},
  publisher = {GitHub},
  url = {https://github.com/shibing624/TreeSearch}
}
```

## 许可证

[Apache License 2.0](LICENSE)

## 贡献

欢迎贡献！请提交 [Pull Request](https://github.com/shibing624/TreeSearch/pulls)。

## 致谢

- [BM25 (Okapi BM25)](https://en.wikipedia.org/wiki/Okapi_BM25) — 经典的概率排序函数
- [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) — 为结构化索引与检索提供了启发
