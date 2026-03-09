# AGENT.md

## Project Overview

TreeSearch — 基于树结构的文档检索框架，支持 LLM Tree Search（best_first/MCTS）、Embedding Retrieve-Rerank、BM25 等多种搜索策略。

## Development Commands

```bash
# 安装
pip install -e .

# 运行测试
python -m pytest tests/ -v

# 运行 benchmark
python examples/benchmark/qasper_benchmark.py
```

## Architecture

- `treesearch/config.py` — 统一配置管理（单一来源），支持 env > YAML > default 优先级
- `treesearch/llm.py` — 异步 LLM 客户端（单例连接池、重试、token 计数、JSON 提取）
- `treesearch/search.py` — 核心搜索逻辑（best_first / MCTS / retrieve_rerank）
- `treesearch/indexer.py` — 文档树索引构建
- `treesearch/embeddings.py` — Embedding 相关
- `treesearch/chunk.py` — 文档分块与 LLM rerank
- `treesearch/rank_bm25.py` — BM25 排序
- `treesearch/query_decompose.py` — 查询分解

---

# 开发历史记录

## 最近更新 (2026-02-27)

### 1. 彻底删除 DEFAULT_MODEL 硬编码

- **问题**：`llm.py` 中 `DEFAULT_MODEL = "gpt-4o-mini"` 硬编码导致自定义 model 的 demo 跑不通（404 错误）
- **解决方案**：删除 `DEFAULT_MODEL` 和 `_get_default_model()` 函数，所有函数签名改为 `model: Optional[str] = None`，内部 `model is None` 时通过 `get_config().model` 动态获取
- **涉及文件**：

| 文件路径 | 修改类型 |
|---------|---------|
| `treesearch/llm.py` | 修改 — 删除 DEFAULT_MODEL、_get_default_model()，achat/count_tokens 等内部走 get_config().model |
| `treesearch/search.py` | 修改 — 去掉 DEFAULT_MODEL import，model 参数改为 Optional[str] = None |
| `treesearch/indexer.py` | 修改 — 同上 |
| `treesearch/chunk.py` | 修改 — 同上 |
| `treesearch/query_decompose.py` | 修改 — 同上 |
| `treesearch/rank_bm25.py` | 修改 — 同上 |
| `examples/answer/answer_demo.py` | 修改 — 同上 |
| `examples/benchmark/benchmark.py` | 修改 — 同上 |

### 2. tiktoken 自定义 model 名兼容

- **问题**：自定义 endpoint ID（如 `ep-xxxxx`）tiktoken 不识别会报 KeyError
- **解决方案**：`count_tokens` 中 `tiktoken.encoding_for_model` 加 try/except，fallback 到 `cl100k_base`
- **修改文件**：`treesearch/llm.py`

### 3. LLM thinking_type 配置化（三模式）

- **问题**：`_achat_impl` 中 `extra_body={"thinking": {"type": "disabled"}}` 硬编码，无法切换思考模式
- **解决方案**：`TreeSearchConfig` 新增 `thinking_type: str = "disabled"`，支持三种模式：
  - `disabled` — 不使用深度思考
  - `enabled` — 启用深度思考
  - `auto` — 模型自行判断
- **配置方式**：环境变量 `TREESEARCH_THINKING_TYPE=auto`、YAML `thinking_type: enabled`、或编程 `set_config(TreeSearchConfig(thinking_type="enabled"))`
- **涉及文件**：

| 文件路径 | 修改类型 |
|---------|---------|
| `treesearch/config.py` | 修改 — 新增 thinking_type 字段、TREESEARCH_THINKING_TYPE 环境变量、from_env 加载逻辑 |
| `treesearch/llm.py` | 修改 — _achat_impl 根据 cfg.thinking_type 动态构建 extra_body |

### 4. best_first 策略改进思路（未实现，规划中）

核心改进方向：
- **两阶段 pipeline**：embedding 粗筛子树 + best_first 精搜（减少 LLM 调用，保留树结构推理）
- **Value 估计改进**：多维度打分、对比式兄弟节点排序、embedding score 作为 prior
- **剪枝优化**：early termination、sibling pruning（低 embedding score 直接跳过）、深度自适应
- **Batch 评估**：同层兄弟节点一次 LLM 调用评估，调用次数从 O(节点数) 降到 O(深度)
- **Benchmark 完善**：按 query 难度分层（事实型/推理型/多跳型），单独评估各策略优势场景
