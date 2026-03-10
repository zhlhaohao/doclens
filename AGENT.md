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

- `treesearch/config.py` — 统一配置管理（单一来源），支持 env > default 优先级
- `treesearch/llm.py` — 异步 LLM 客户端（单例连接池、重试、token 计数、JSON 提取）
- `treesearch/search.py` — 核心搜索逻辑（fts5_only / best_first / auto 策略），search() 和 build_index() 默认值从 get_config() 读取
- `treesearch/indexer.py` — 文档树索引构建，通过 ParserRegistry 分派解析器
- `treesearch/rank_bm25.py` — BM25 排序
- `treesearch/fts.py` — SQLite FTS5 全文检索引擎（持久化倒排索引）
- `treesearch/treesearch.py` — TreeSearch 统一引擎类（索引 + 搜索）
- `treesearch/cli.py` — CLI 入口（index / search）
- `treesearch/parsers/` — 可扩展解析器注册表
  - `registry.py` — ParserRegistry, SOURCE_TYPE_MAP, STRATEGY_ROUTING, 内置解析器自动注册
  - `ast_parser.py` — Python AST 结构提取（类、函数、完整签名）
  - `pdf_parser.py` — PDF 解析器（可选：pageindex）
  - `docx_parser.py` — DOCX 解析器（可选：python-docx）
  - `html_parser.py` — HTML 解析器（可选：beautifulsoup4）

---

# 开发历史记录

## 最近更新 (2026-03-10)

### v0.5.0 重构演进（Phase 1-4 全部完成）

**Phase 1：解析器注册表 + 自动路由**
- 新增 `treesearch/parsers/` 子包，定义 `ParserRegistry` + `SOURCE_TYPE_MAP` + `STRATEGY_ROUTING`
- `_register_builtin_parsers()` 在模块加载时自动注册所有内置解析器（md, txt, code, json, csv, pdf, docx, html）
- `indexer.py` `_index_one()` 改为 `get_parser(ext)` 分派，不再需要 hardcoded if/elif 链
- `Document` 增加 `source_type` 字段
- `search()` 增加 `strategy="auto"` 模式，根据 source_type 路由策略

**Phase 2：代码 AST 解析**
- 新增 `parsers/ast_parser.py`：基于 `ast` 模块解析 Python 源码，提取 class/function 签名（含参数、返回值注解、装饰器）
- `_detect_code_headings()` 优先走 AST，语法错误时回退 regex
- `_CombinedScorer` 自动组合 GrepFilter + FTS5 用于代码文件搜索
- tree-sitter 作为可选扩展点保留

**Phase 3：配置治理 + 缓存隔离**
- `search()` / `build_index()` 所有参数默认值改为 `None`，运行时从 `get_config()` 读取
- `node_id` 改为变长编码（移除 `zfill(4)`）
- `_doc_cache` / `clear_doc_cache` 已移除
- YAML 配置支持已移除，简化为 env > defaults

**Phase 4：新格式支持**
- `parsers/pdf_parser.py` — 基于 pageindex 提取 PDF 文本
- `parsers/docx_parser.py` — 基于 python-docx 提取 DOCX heading 结构
- `parsers/html_parser.py` — 基于 BeautifulSoup 提取 h1-h6 结构
- `pyproject.toml` 新增 `[docx]` / `[html]` optional dependencies

### 其他修复
- `cli.py` `_run_index()` 修复 dict 访问 Document 对象的 bug
- FTS5 表达式 tokenization：新增 `_tokenize_fts_expression()` 对查询词做 stemming

## 更早更新 (2026-02-27)

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
