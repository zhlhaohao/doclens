# KB Search V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `search_kb_v2` 工具，支持结构化查询（AND/OR/NOT/PHRASE），复用 FTS5 索引。

**Architecture:** 结构化查询通过 `_build_fts5_query()` 转换为 FTS5 原生语法，复用现有 BM25 搜索和评分逻辑。

**Tech Stack:** Python, FTS5, SQLite, cortex/kb_tools.py

---

## File Structure

- **Modify:** `cortex/kb_tools.py` - 新增 `_build_fts5_query()`, `_handle_search_kb_v2()`, 工具注册
- **Modify:** `cortex/skills/knowledge_base/SKILL.md` - 更新工具说明

---

## Task 1: 实现 `_build_fts5_query()` 函数

**Files:**
- Modify: `cortex/kb_tools.py:155-158` (在搜索辅助函数区域新增)

- [ ] **Step 1: 编写测试**

```python
def test_build_fts5_query():
    # AND 查询
    assert _build_fts5_query({"type": "and", "terms": ["机器学习", "深度学习"]}) == "机器学习 深度学习"
    # OR 查询
    assert _build_fts5_query({"type": "or", "terms": ["机器学习", "深度学习"]}) == "机器学习 OR 深度学习"
    # NOT 查询
    assert _build_fts5_query({"type": "not", "term": "Keras"}) == "-Keras"
    # PHRASE 查询
    assert _build_fts5_query({"type": "phrase", "text": "机器学习算法"}) == '"机器学习算法"'
    # AND + exclude
    assert _build_fts5_query({"type": "and", "terms": ["TensorFlow"], "exclude": ["Keras"]}) == "TensorFlow -Keras"
    print("all tests passed")
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /c/Users/lianghao/github/cortex && python -c "from cortex.kb_tools import _build_fts5_query; print(_build_fts5_query({'type': 'and', 'terms': ['A']}))"`
Expected: NameError: name '_build_fts5_query' is not defined

- [ ] **Step 3: 实现函数**

在 `cortex/kb_tools.py` 第 155 行后添加：

```python
def _build_fts5_query(query_tokens: dict) -> str:
    """将结构化查询转换为 FTS5 查询语法。

    Args:
        query_tokens: 结构化查询字典，支持以下类型：
            - {"type": "and", "terms": [...], "exclude": [...]}  # 所有词都匹配，可选排除
            - {"type": "or", "terms": [...]}  # 任一词匹配
            - {"type": "not", "term": "word"}  # 排除该词
            - {"type": "phrase", "text": "exact phrase"}  # 短语精确匹配

    Returns:
        FTS5 查询字符串
    """
    qtype = query_tokens.get("type", "").lower()

    if qtype == "and":
        terms = query_tokens.get("terms", [])
        exclude = query_tokens.get("exclude", [])
        parts = list(terms)
        for ex in exclude:
            parts.append(f"-{ex}")
        return " ".join(parts)

    elif qtype == "or":
        terms = query_tokens.get("terms", [])
        return " OR ".join(terms)

    elif qtype == "not":
        term = query_tokens.get("term", "")
        return f"-{term}"

    elif qtype == "phrase":
        text = query_tokens.get("text", "")
        return f'"{text}"'

    else:
        raise ValueError(f"Unknown query type: {qtype}")
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd /c/Users/lianghao/github/cortex && python -c "from cortex.kb_tools import _build_fts5_query; assert _build_fts5_query({'type': 'and', 'terms': ['A', 'B']}) == 'A B'; print('PASS')"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add cortex/kb_tools.py
git commit -m "feat: add _build_fts5_query for structured search"
```

---

## Task 2: 实现 `_handle_search_kb_v2()` 函数

**Files:**
- Modify: `cortex/kb_tools.py:745` (在 _handle_search_kb 后新增)

- [ ] **Step 1: 编写测试**

```python
def test_handle_search_kb_v2_basic():
    from cortex.kb_tools import _handle_search_kb_v2
    # 测试无效查询类型
    try:
        _handle_search_kb_v2(None, None, query_tokens={"type": "invalid"})
        assert False, "Should raise ValueError"
    except ValueError as e:
        assert "Unknown query type" in str(e)
    print("test_handle_search_kb_v2_basic passed")
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /c/Users/lianghao/github/cortex && python -c "from cortex.kb_tools import _handle_search_kb_v2; _handle_search_kb_v2(None, None, query_tokens={'type': 'invalid'})"`
Expected: NameError: name '_handle_search_kb_v2' is not defined

- [ ] **Step 3: 实现函数**

在 `cortex/kb_tools.py` 第 745 行附近（在 `_handle_search_kb` 函数结束后添加：

```python
def _handle_search_kb_v2(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    query_tokens: dict,
    max_results: Optional[int] = None,
) -> str:
    """使用结构化查询搜索知识库。

    Args:
        query_tokens: 结构化查询字典
            - {"type": "and", "terms": [...], "exclude": [...]}  # 所有词匹配，可选排除
            - {"type": "or", "terms": [...]}  # 任一词匹配
            - {"type": "not", "term": "word"}  # 排除该词
            - {"type": "phrase", "text": "exact phrase"}  # 短语精确匹配
        max_results: 最大结果数

    Returns:
        带层次结构的格式化搜索结果
    """
    if max_results is None:
        max_results = idx_manager.max_results

    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    if idx_manager.ts is None or not idx_manager.documents:
        return (
            "知识库索引未就绪或为空。\n"
            "请用 manage_kb(action='reindex') 构建索引，"
            "或确认知识库路径下有文件。"
        )

    from cortex.scoring import calc_proximity_score, compute_composite_score
    from cortex import ripgrep as rg_module

    # 解析结构化查询为 FTS5 语法
    try:
        fts_query = _build_fts5_query(query_tokens)
    except ValueError as e:
        return f"无效的查询结构: {e}"

    # 提取关键词用于 proximity 评分
    query_words = _extract_keywords(query_tokens)

    # 执行 FTS5 搜索
    nodes, docs = idx_manager.search(fts_query, max_results=max_results)

    if not nodes:
        # 降级到 ripgrep
        filtered = rg_module.rg_fallback_search(
            fts_query, idx_manager.path_map, {}, query_words,
            context_before=idx_manager.rg_context_before, context_after=idx_manager.rg_context_after,
        )
        if not filtered:
            return (
                f"未找到包含 '{fts_query}' 的结果。\n"
                "建议：\n"
                "1. 尝试不同的关键词\n"
                "2. 用 manage_kb(action='reindex') 重建索引\n"
                "3. 用 bash grep 搜索文件名或内容"
            )
        return _format_ripgrep_results(filtered, query_words, idx_manager.path_map, max_results)

    doc_nodes_map: dict[str, list[dict]] = {}
    doc_title_map: dict[str, str] = {}
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        doc_name = doc.get("doc_name", doc_id)
        doc_title_map[doc_id] = doc_name
        doc_nodes_map[doc_id] = list(doc.get("nodes", []))

    doc_best: dict[str, tuple] = {}
    doc_fts_best: dict[str, float] = {}
    for node in nodes:
        doc_id = node.get("doc_id", "")
        score = node.get("score", 0.0)
        if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
            doc_fts_best[doc_id] = score
        if doc_id in doc_best:
            continue
        all_nodes = doc_nodes_map.get(doc_id, [])
        best_node = None
        best_count = 0
        best_proximity = 0
        for n in all_nodes:
            n_text = n.get("text", "") or ""
            cnt, proximity = calc_proximity_score(n_text, query_words, max_span=idx_manager.max_span)
            if proximity > best_proximity or (proximity == best_proximity and cnt > best_count):
                best_count = cnt
                best_proximity = proximity
                best_node = n
        if best_node and best_count > 0:
            doc_best[doc_id] = (best_node, best_count, best_proximity, doc_fts_best.get(doc_id, 0.0))

    filtered = [
        (did, bn, cnt, prox, fts)
        for did, (bn, cnt, prox, fts) in doc_best.items()
        if cnt >= idx_manager.min_keyword_match and prox >= idx_manager.min_proximity_score
    ]
    if not filtered and query_words:
        filtered = [
            (did, bn, cnt, prox, fts)
            for did, (bn, cnt, prox, fts) in doc_best.items()
            if cnt >= 1
        ]
    if not filtered:
        filtered = rg_module.rg_fallback_search(
            fts_query, idx_manager.path_map, doc_nodes_map, query_words,
            context_before=idx_manager.rg_context_before, context_after=idx_manager.rg_context_after,
        )

    if not filtered:
        return f"未找到包含 '{fts_query}' 的结果。请尝试不同的关键词或重建索引。"

    scored_results = []
    for item in filtered:
        did, display_node, matched, prox, fts = item
        composite, _ = compute_composite_score(
            matched_count=matched,
            total_keywords=len(query_words),
            doc_name=did,
            node_title=display_node.get("title", ""),
            fts_score=fts,
            query_words=query_words,
            weights=idx_manager.scoring_weights,
        )
        scored_results.append((composite, item))
    scored_results.sort(key=lambda x: -x[0])

    return _format_kb_results(
        scored_results, query_words, idx_manager.path_map, doc_nodes_map, doc_title_map, max_results,
        max_context_chars_per_result=idx_manager.max_context_chars_per_result,
        max_total_chars=idx_manager.max_total_chars,
    )


def _extract_keywords(query_tokens: dict) -> list[str]:
    """从结构化查询中提取所有关键词用于 proximity 评分。

    Args:
        query_tokens: 结构化查询字典

    Returns:
        关键词列表
    """
    qtype = query_tokens.get("type", "").lower()
    keywords = []

    if qtype == "and":
        keywords.extend(query_tokens.get("terms", []))
        keywords.extend(query_tokens.get("exclude", []))
    elif qtype == "or":
        keywords.extend(query_tokens.get("terms", []))
    elif qtype == "not":
        term = query_tokens.get("term", "")
        if term:
            keywords.append(term)
    elif qtype == "phrase":
        text = query_tokens.get("text", "")
        if text:
            keywords.append(text)

    return keywords
```

- [ ] **Step 4: 运行测试验证**

Run: `cd /c/Users/lianghao/github/cortex && python -c "from cortex.kb_tools import _handle_search_kb_v2; print('function exists')"`
Expected: function exists

- [ ] **Step 5: 提交**

```bash
git add cortex/kb_tools.py
git commit -m "feat: add _handle_search_kb_v2 for structured search"
```

---

## Task 3: 注册 `search_kb_v2` 工具

**Files:**
- Modify: `cortex/kb_tools.py:127-153` (get_kb_tools 函数)

- [ ] **Step 1: 添加工具定义**

在 `SEARCH_KB_TOOL` 定义后（第 40 行）添加新的工具定义：

```python
SEARCH_KB_V2_TOOL = {
    "name": "search_kb_v2",
    "description": (
        "使用结构化查询在知识库索引中搜索相关文档片段。"
        "query_tokens 支持: "
        "AND (所有词匹配), OR (任一匹配), NOT (排除), PHRASE (短语精确匹配)。"
        "返回带层次结构的搜索结果。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query_tokens": {
                "type": "object",
                "description": "结构化查询，支持 AND/OR/NOT/PHRASE 操作符",
                "properties": {
                    "type": {"type": "string", "enum": ["and", "or", "not", "phrase"]},
                    "terms": {"type": "array", "items": {"type": "string"}},
                    "term": {"type": "string"},
                    "text": {"type": "string"},
                    "exclude": {"type": "array", "items": {"type": "string"}},
                },
            },
            "max_results": {
                "type": "integer",
                "description": "返回的最大结果数，默认 10",
                "default": 10,
            },
        },
        "required": ["query_tokens"],
    },
}
```

- [ ] **Step 2: 修改 get_kb_tools 函数**

在 `cortex/kb_tools.py` 第 127-153 行找到 `get_kb_tools` 函数，修改为：

```python
def get_kb_tools(idx_manager: IndexManager, workdir: Path):
    # 动态生成 search_kb schema
    search_kb_schema = {
        "name": "search_kb",
        "description": SEARCH_KB_TOOL["description"],
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词，支持中英文混合",
                },
                "max_results": {
                    "type": "integer",
                    "description": "返回的最大结果数",
                    "default": idx_manager.max_results,
                },
            },
            "required": ["query"],
        },
    }

    handlers = {
        "search_kb": lambda **kw: _handle_search_kb(idx_manager, workdir, **kw),
        "search_kb_v2": lambda **kw: _handle_search_kb_v2(idx_manager, workdir, **kw),
        "manage_kb": lambda **kw: _handle_manage_kb(idx_manager, **kw),
        "read_document": lambda **kw: _handle_read_document(idx_manager, workdir, **kw),
    }
    return [search_kb_schema, SEARCH_KB_V2_TOOL, MANAGE_KB_TOOL, READ_DOCUMENT_TOOL], handlers
```

- [ ] **Step 3: 验证工具注册**

Run: `cd /c/Users/lianghao/github/cortex && python -c "from cortex.kb_tools import get_kb_tools, IndexManager; im = IndexManager(); tools, handlers = get_kb_tools(im, '.'); print([t['name'] for t in tools])"`
Expected: `['search_kb', 'search_kb_v2', 'manage_kb', 'read_document']`

- [ ] **Step 4: 提交**

```bash
git add cortex/kb_tools.py
git commit -m "feat: register search_kb_v2 tool"
```

---

## Task 4: 更新 SKILL.md 文档

**Files:**
- Modify: `cortex/skills/knowledge_base/SKILL.md`

- [ ] **Step 1: 更新文档**

读取 `cortex/skills/knowledge_base/SKILL.md`，找到"搜索策略"部分，将：

```
- **search_kb**: 在知识库索引中搜索文档片段（FTS5 BM25 + ripgrep 降级）。返回带层次路径的搜索结果。
```

更新为：

```
- **search_kb_v2**: 在知识库索引中搜索文档片段（结构化查询）。支持 AND/OR/NOT/PHRASE 操作符。返回带层次路径的搜索结果。
```

同时更新"简单问答"部分，将 `search_kb` 改为 `search_kb_v2`。

- [ ] **Step 2: 验证**

确认文档中不再提及旧的 `search_kb` 作为主要搜索工具。

- [ ] **Step 3: 提交**

```bash
git add cortex/skills/knowledge_base/SKILL.md
git commit -m "docs: update knowledge_base skill to use search_kb_v2"
```

---

## Task 5: 端到端测试

**Files:**
- Test: 手动测试

- [ ] **Step 1: 测试 AND 查询**

```python
from cortex.kb_tools import _build_fts5_query, _extract_keywords

# AND
assert _build_fts5_query({"type": "and", "terms": ["机器学习", "深度学习"]}) == "机器学习 深度学习"
assert _extract_keywords({"type": "and", "terms": ["机器学习", "深度学习"]}) == ["机器学习", "深度学习"]

# OR
assert _build_fts5_query({"type": "or", "terms": ["机器学习", "深度学习"]}) == "机器学习 OR 深度学习"

# NOT
assert _build_fts5_query({"type": "not", "term": "Keras"}) == "-Keras"

# PHRASE
assert _build_fts5_query({"type": "phrase", "text": "机器学习算法"}) == '"机器学习算法"'

# AND + exclude
assert _build_fts5_query({"type": "and", "terms": ["TensorFlow"], "exclude": ["Keras"]}) == "TensorFlow -Keras"

print("All tests passed!")
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "test: add search_kb_v2 implementation - all tests pass"
```
