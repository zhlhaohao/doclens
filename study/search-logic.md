# Cortex 搜索逻辑详解

---

# 第一章 search 管道

> CLI `cortex search <query>` 和 TUI `/search <query>` 共享同一套管道，基于 `scoring_pipeline.py` 的 `score_and_rank()` 实现评分/过滤/降级逻辑。

---

## 1.1 整体架构

```mermaid
flowchart TB
    subgraph 入口
        CLI["CLI: cortex search &lt;query&gt;"]
        TUI["TUI: /search &lt;query&gt;"]
    end

    subgraph 公共管道["scoring_pipeline.py"]
        SAR["score_and_rank()"]
    end

    subgraph 评分核心["scoring.py（第三章）"]
        TOK["tokenize_query()"]
        CPS["calc_proximity_score()"]
        CCS["compute_composite_score()"]
    end

    subgraph 渲染层
        CLI_R["CLI _render_results()<br/>ANSI 高亮 + VSCode 链接"]
        TUI_R["TUI renderers/search.py<br/>Rich Text + 星级评分"]
    end

    CLI --> SAR
    TUI --> SAR
    TOK --> SAR
    SAR --> CPS
    SAR --> CCS
    SAR -->|ScoreResult| CLI_R
    SAR -->|ScoreResult| TUI_R
```

---

## 1.2 搜索管道流程

`score_and_rank()` 是核心入口，封装了完整的评分 → 过滤 → 降级 → 排序流程：

```mermaid
flowchart TD
    START(["用户输入 query"]) --> TOKEN["tokenize_query(query)<br/>jieba 分词，过滤单字"]
    TOKEN --> FTS["IndexManager.search(query)<br/>FTS5 BM25 全文检索"]

    FTS -->|nodes 非空| BUILD["_build_doc_maps()<br/>构建 doc_nodes_map + doc_fts_best"]
    FTS -->|nodes 为空| FALLBACK

    BUILD --> SCORE["_score_nodes()<br/>逐文档逐节点评分<br/>每文档取 top N"]
    SCORE --> FILTER["_filter_candidates()<br/>composite >= threshold<br/>OR (keyword_match AND proximity)"]

    FILTER -->|有结果| RANK
    FILTER -->|无结果| DEGRADE1["降级: matched >= 1"]
    DEGRADE1 -->|有结果| RANK
    DEGRADE1 -->|无结果| FALLBACK

    RANK["_rank_results()<br/>按 composite 降序排序"]
    RANK --> FILTER2["二次过滤<br/>min_score_threshold > 0 时<br/>再筛一遍低分结果"]
    FILTER2 --> RESULT(["返回 ScoreResult<br/>source='fts'"])

    subgraph FALLBACK["降级路径 _fallback_no_fts()"]
        F1["idx.like_search(query)<br/>SQLite LIKE 子串匹配"]
        F1 -->|有结果| R1(["返回 source='like'"])
        F1 -->|无结果| F2["rg_fallback_search(query)<br/>ripgrep 精确子串搜索"]
        F2 --> R2(["返回 source='ripgrep'"])
    end
```

---

## 1.3 过滤策略（三级降级）

```mermaid
flowchart TD
    CANDIDATES["all_candidates<br/>所有评分过的节点"] --> L1{"Level 1: 初始过滤<br/>composite >= threshold<br/>OR (keyword >= 2 AND proximity >= 1)"}
    L1 -->|通过| RANK["进入排序"]
    L1 -->|全部被过滤| L2{"Level 2: 放宽条件<br/>matched >= 1"}
    L2 -->|通过| RANK
    L2 -->|仍无结果| L3{"Level 3: 降级搜索<br/>LIKE → ripgrep"}
    L3 --> LIKE["SQLite LIKE 子串匹配"]
    LIKE -->|有结果| RENDER_LIKE["渲染 (LIKE)"]
    LIKE -->|无结果| RG["ripgrep 文件搜索"]
    RG -->|有结果| RENDER_RG["渲染 (ripgrep)"]
    RG -->|无结果| EMPTY["未找到结果"]
```

**关键配置参数**（`CortexConfig`）：

| 参数 | 默认值 | 作用 |
|------|--------|------|
| `min_score_threshold` | 0.0 | 综合评分阈值（初始 + 二次过滤） |
| `min_keyword_match` | 2 | 最少匹配关键词数 |
| `min_proximity_score` | 1 | 最少邻近度分数 |
| `max_nodes_per_doc` | 3 | 每文档最多返回几个节点 |

---

## 1.4 上下文选择算法（智能锚点）

搜索结果中每个节点的文本展示，使用"智能锚点"算法选择最有代表性的行：

```mermaid
flowchart TD
    LINES["节点文本按行拆分"] --> COUNT["计算每行的关键词命中数<br/>line_keyword_counts"]
    COUNT --> HAS{"有匹配行?"}

    HAS -->|无| EMPTY_CTX["取前 max_context_lines 个非空行"]
    HAS -->|有| SORT["按命中数降序排序"]

    SORT --> ANCHOR["筛选命中数 >= min_keywords_per_line<br/>的行作为锚点候选"]
    ANCHOR --> HAS_ANCHOR{"有合格锚点?"}
    HAS_ANCHOR -->|无| FALLBACK_ANCHOR["取前 max_context_lines 个匹配行"]
    HAS_ANCHOR -->|有| SELECT["取前 max_anchor_lines 个锚点"]

    FALLBACK_ANCHOR --> EXPAND
    SELECT --> EXPAND["每个锚点向前后<br/>各扩展 context_expand_range 行"]

    EXPAND --> MERGE["合并、去重、排序行号"]
    MERGE --> OUTPUT["输出上下文片段"]
```

**配置参数**：

| 参数 | 默认值 | 作用 |
|------|--------|------|
| `max_anchor_lines` | 3 | 最多选几个锚点行 |
| `context_expand_range` | 5 | 锚点向前后各扩展几行 |
| `min_keywords_per_line` | 2 | 行至少命中几个关键词才算锚点 |
| `max_context_lines` | 5 | 无匹配行时取前 N 个非空行 |

---

## 1.5 调用方对比

### CLI (`cortex_cli.py`)

```python
# format_results() 精简后 ~45 行
result = score_and_rank(nodes, docs, query, query_words, self.idx)

if result.source == "like":
    like_items = self._convert_like_to_render_items(result.like_raw, query_words)
    self._render_results(query, like_items, ..., is_like=True)
elif result.source == "ripgrep":
    self._render_results(query, result.results, ..., is_ripgrep=True)
else:
    # CLI 特有: 分数过滤日志
    self._render_results(query, result.results, ...)
```

### TUI (`tui/app.py`)

```python
# _do_search() 精简后 ~47 行
result = score_and_rank(nodes, docs, query, query_words, self.idx)

render_kwargs = dict(query=..., path_map=..., max_anchor_lines=..., ...)

if result.source == "like":
    renderables = render_search_results(results=result.like_raw, is_like=True, **render_kwargs)
elif result.source == "ripgrep":
    renderables = render_search_results(results=result.results, is_ripgrep=True, **render_kwargs)
else:
    renderables = render_search_results(results=result.results, **render_kwargs)

self.call_from_thread(self._on_search_done, renderables)
```

**差异仅在渲染层**：CLI 用 ANSI 转义码 + VSCode 超链接，TUI 用 Rich Text + 星级评分。搜索结果数据完全一致。

---

# 第二章 search_kb 管道

> CLI `cortex search_kb <query>` 和 Agent `search_kb` Tool 共享同一入口 `_handle_search_kb()`（`kb_tools.py`）。
> 评分算法与第一章相同（共用 `scoring.py`），但无降级搜索、输出为 XML 结构化文本。

---

## 2.1 整体架构

```mermaid
flowchart TB
    subgraph 入口
        CLI_KB["CLI: cortex search_kb &lt;query&gt;"]
        AGENT_KB["Agent Tool: search_kb(query, max_results)"]
    end

    subgraph 管道["kb_tools.py"]
        HSKB["_handle_search_kb()"]
    end

    subgraph 评分核心["scoring.py（第三章）"]
        TOK["tokenize_query()"]
        CPS["calc_proximity_score()"]
        CCS["compute_composite_score()"]
    end

    subgraph 格式化["kb_tools.py"]
        FKB["_format_kb_results()<br/>XML 结构化输出"]
        BHP["_build_hierarchy_path()<br/>文档层级路径"]
    end

    CLI_KB --> HSKB
    AGENT_KB --> HSKB
    HSKB --> TOK
    HSKB --> CPS
    HSKB --> CCS
    HSKB --> FKB
    FKB --> BHP
```

---

## 2.2 搜索管道流程

`_handle_search_kb()` 是核心入口，内联了评分 → 过滤 → 排序流程（**无降级搜索**）：

```mermaid
flowchart TD
    START(["用户输入 query"]) --> IDX{"索引就绪?"}
    IDX -->|否| BUILD["load_or_build_index()"]
    BUILD --> IDX2{"仍无索引?"}
    IDX2 -->|是| EMPTY_IDX(["返回: 索引未就绪提示"])
    IDX2 -->|否| TOKEN
    IDX -->|是| TOKEN

    TOKEN["tokenize_query(query)<br/>jieba 分词，过滤单字"]
    TOKEN --> FTS["IndexManager.search(query)<br/>FTS5 BM25 全文检索"]

    FTS -->|nodes 为空| NO_FTS(["返回: 未找到结果提示"])
    FTS -->|nodes 非空| MAPS["构建映射<br/>doc_nodes_map + doc_title_map<br/>+ doc_tree_map（层级树）"]

    MAPS --> SCORE["逐文档逐节点评分<br/>calc_proximity_score → compute_composite_score<br/>每文档取 max_nodes_per_doc 个最高分节点"]
    SCORE --> FILTER["Level 1: 初始过滤<br/>composite >= threshold<br/>OR (keyword >= 2 AND proximity >= 1)"]

    FILTER -->|有结果| RANK
    FILTER -->|无结果| DEGRADE["Level 2: 放宽条件<br/>matched >= 1"]
    DEGRADE -->|有结果| RANK
    DEGRADE -->|无结果| EMPTY(["返回: 未找到结果提示"])

    RANK["按 composite 降序排序"]
    RANK --> FILTER2["二次过滤<br/>min_score_threshold > 0 时<br/>再筛一遍低分结果"]
    FILTER2 --> FORMAT["_format_kb_results()<br/>XML 结构化输出"]
    FORMAT --> RESULT(["返回 XML 字符串"])
```

---

## 2.3 与 search 管道的差异

| 维度 | `score_and_rank()`（第一章） | `_handle_search_kb()` |
|------|--------------------------|----------------------|
| **FTS 无结果** | LIKE → ripgrep 两步降级 | **直接返回提示，无降级** |
| **评分过滤后无结果** | ripgrep 降级搜索 | **直接返回提示，无降级** |
| **代码组织** | 提取为 5 个函数 | ~80 行内联（未复用管道函数） |
| **层级路径** | 无 | `doc_tree_map` + `_build_hierarchy_path()` |
| **输出格式** | `ScoreResult` dataclass（交由渲染层） | XML 结构化字符串 |
| **字符限制** | 无硬性限制 | `max_context_chars_per_result` + `max_total_chars` |
| **评分算法** | 完全相同 | 完全相同 |

---

## 2.4 过滤策略（两级，无降级搜索）

```mermaid
flowchart TD
    CANDIDATES["all_candidates<br/>所有评分过的节点"] --> L1{"Level 1: 初始过滤<br/>composite >= threshold<br/>OR (keyword >= 2 AND proximity >= 1)"}
    L1 -->|通过| RANK["进入排序"]
    L1 -->|全部被过滤| L2{"Level 2: 放宽条件<br/>matched >= 1"}
    L2 -->|通过| RANK
    L2 -->|仍无结果| EMPTY["返回: 未找到结果提示"]
```

与第一章的三级降级（§1.3）相比，`search_kb` 只有**两级过滤**，Level 2 失败后不再尝试 LIKE 或 ripgrep。

---

## 2.5 XML 输出格式

`_format_kb_results()` 生成 XML 结构化文本，每个结果包含元信息和内容摘要：

```xml
Found 3 results:
Use read_document tool to read full content: path=<path value>, section=<any section in hierarchy>.

<result index="1" score="85%" matches="3/4">
  <meta>
    <doc>量子计算入门.md</doc>
    <path>docs/quantum/量子计算入门.md</path>
    <hierarchy>量子计算入门 > 基础概念 > 量子比特</hierarchy>
  </meta>
  <content>
    量子比特（qubit）是量子计算的基本单位...
  </content>
</result>
```

**输出控制参数**：

| 参数 | 默认值 | 作用 |
|------|--------|------|
| `max_results` | 配置值 | 返回的最大结果数 |
| `max_context_chars_per_result` | 配置值 | 每个结果的内容字符上限 |
| `max_total_chars` | 配置值 | 总输出字符上限（超出截断） |

---

## 2.6 层级路径构建

`_build_hierarchy_path()` 通过 DFS 遍历文档树结构，构建节点从根到目标的标题路径：

```
文档树:                    输出:
├─ 量子计算入门            量子计算入门 > 基础概念 > 量子比特
│  ├─ 基础概念
│  │  ├─ 量子比特  ← 命中
│  │  └─ 量子门
│  └─ 进阶应用
```

---

## 2.7 调用方对比

### CLI (`cortex_cli.py`)

```python
# _cli_search_kb() 精简后
result = _handle_search_kb(idx, Path(idx.search_path), query=query)
print(result)
```

### Agent Tool (`kb_tools.py`)

```python
# build_kb_tools() 注册 handler
handlers = {
    "search_kb": lambda **kw: _handle_search_kb(idx_manager, workdir, **kw),
}

# LLM 返回 tool_use 时，handler 被调用，结果作为 tool_result 返回给 LLM
```

**差异仅在输出去向**：CLI 用 `print()` 输出到终端，Agent Tool 将字符串返回给 LLM 作为 `tool_result`。业务逻辑完全相同。

---

# 第三章 公共模块

> `scoring.py` 和 `scoring_pipeline.py` 是两个管道共用的评分核心与管道基础设施。

---

## 3.1 综合评分算法

### 3.1.1 评分因子与权重

`compute_composite_score()` 使用加权平均计算综合评分（0~1）：

| 因子 | 权重 | 计算方式 | 说明 |
|------|------|----------|------|
| `keyword_match_ratio` | 3.0 | 匹配词数 / 总词数 | 最重要：查了多少个词 |
| `file_name_match` | 2.0 | 文件名命中词数 / 总词数 | 文件名匹配说明文档相关 |
| `fts_score` | 2.0 | sigmoid(BM25分数) | FTS5 原始 BM25 相关性 |
| `title_match` | 1.5 | 标题命中词数 / 总词数 | 章节标题匹配 |
| `proximity_match` | 1.0 | proximity / 2.0 | 关键词是否紧邻出现 |

**公式**：`composite = Σ(weight × factor_value) / Σ(weight)`

### 3.1.2 邻近度评分 `calc_proximity_score()`

```mermaid
flowchart LR
    TEXT["节点文本"] --> FIND["找每个关键词在文本中的<br/>首次出现位置"]
    FIND --> POS["positions = [pos1, pos2, ...]"]
    POS --> CHECK{"全部匹配<br/>且跨度 <= max_span?"}
    CHECK -->|是| P2["proximity = 2<br/>（全部紧邻）"]
    CHECK -->|部分匹配| P1["proximity = 1<br/>（部分匹配）"]
    CHECK -->|无匹配| P0["proximity = 0"]
```

- `max_span` 默认 20 字符，控制"紧邻"的判定范围
- 返回 `(matched_count, proximity)`，供综合评分使用

---

## 3.2 文件结构

```
搜索相关文件
├── cortex/
│   ├── scoring.py             ← 纯计算模块（第三章 §3.1）
│   │   ├── tokenize_query()      jieba 分词，过滤单字
│   │   ├── calc_proximity_score() 关键词邻近度
│   │   └── compute_composite_score() 综合评分（加权平均）
│   │
│   ├── scoring_pipeline.py    ← search 公共管道（第一章）
│   │   ├── ScoreResult          dataclass: results + source + like_raw
│   │   ├── score_and_rank()     主入口：评分→过滤→降级→排序
│   │   ├── _build_doc_maps()    构建 doc_nodes_map + doc_fts_best
│   │   ├── _score_nodes()       逐文档评分，每文档取 top N
│   │   ├── _filter_candidates() 初始过滤
│   │   ├── _rank_results()      排序
│   │   └── _fallback_no_fts()   降级: LIKE → ripgrep
│   │
│   ├── kb_tools.py            ← search_kb 管道（第二章）
│   │   ├── _handle_search_kb()  主入口：评分→过滤→排序（无降级）
│   │   ├── _format_kb_results() XML 格式化输出
│   │   └── _build_hierarchy_path() 文档层级路径
│   │
│   ├── cortex_cli.py          ← CLI 入口
│   ├── tui/
│   │   ├── app.py             ← TUI 入口
│   │   └── renderers/
│   │       └── search.py      ← TUI 渲染器（Rich Text）
│   │
│   ├── index_manager.py       ← IndexManager（封装 TreeSearch）
│   ├── config.py              ← CortexConfig（所有配置参数）
│   └── ripgrep.py             ← ripgrep 降级搜索
```
