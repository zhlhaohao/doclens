# 搜索逻辑对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 CLI `search` 与 TUI `/search` 的过滤阈值、上下文选择策略和降级路径。

**Architecture:** 在三个文件中就地修改：TUI `_do_search()` 使用 config 阈值替代硬编码 0；TUI renderer 用 CLI 的智能锚点算法替换简单策略；CLI `format_results()` 在 ripgrep 之前加入 LIKE 降级层。

**Tech Stack:** Python, Rich (TUI), ANSI escapes (CLI), SQLite LIKE

---

### Task 1: TUI 过滤阈值对齐

**Files:**
- Modify: `cortex/tui/app.py:680-734`

- [ ] **Step 1: 修改初始过滤阈值**

将 `_do_search()` 中第 680-686 行的过滤条件从 `>= 0` 改为 `>= self.idx.min_score_threshold`：

```python
# cortex/tui/app.py 约第 680 行
# 原始代码:
            # 过滤：composite >= 0 OR (关键词匹配 AND 邻近度)
            filtered = [
                item for item in all_candidates
                if item[5] >= 0
                or (item[2] >= self.idx.min_keyword_match
                    and item[3] >= self.idx.min_proximity_score)
            ]

# 替换为:
            # 过滤：composite >= threshold OR (关键词匹配 AND 邻近度)
            filtered = [
                item for item in all_candidates
                if item[5] >= self.idx.min_score_threshold
                or (item[2] >= self.idx.min_keyword_match
                    and item[3] >= self.idx.min_proximity_score)
            ]
```

- [ ] **Step 2: 添加排序后二次过滤**

在 `_do_search()` 中 `scored_results.sort(key=lambda x: -x[0])` 之后（约第 734 行），添加二次阈值过滤：

```python
# cortex/tui/app.py 约第 734 行，在 scored_results.sort(...) 之后，renderables = ... 之前插入:
            # 按分数阈值二次过滤
            if self.idx.min_score_threshold > 0.0:
                scored_results = [r for r in scored_results if r[0] >= self.idx.min_score_threshold]
```

- [ ] **Step 3: 验证**

运行 TUI 搜索确认过滤行为：
```bash
cd E:/github/cortex
.venv/Scripts/python.exe -m cortex
# 在 TUI 中输入 /s <关键词> 确认搜索正常
```

- [ ] **Step 4: Commit**

```bash
git add cortex/tui/app.py
git commit -m "fix(tui/search): 使用 config min_score_threshold 替代硬编码 0，增加排序后二次过滤"
```

---

### Task 2: TUI 上下文选择对齐 — Renderer 参数扩展

**Files:**
- Modify: `cortex/tui/renderers/search.py:78-205`

- [ ] **Step 1: 扩展 render_search_result 签名**

在 `render_search_result()` 中增加四个参数（默认值与 `CortexConfig` 一致）：

```python
# cortex/tui/renderers/search.py 第 78 行
# 原始签名:
def render_search_result(
    index: int,
    doc_id: str,
    node: dict,
    matched: int,
    total_keywords: int,
    composite: float = 0.0,
    path: str = "",
    is_ripgrep: bool = False,
    is_like: bool = False,
    query_words: list[str] | None = None,
) -> Text:

# 替换为:
def render_search_result(
    index: int,
    doc_id: str,
    node: dict,
    matched: int,
    total_keywords: int,
    composite: float = 0.0,
    path: str = "",
    is_ripgrep: bool = False,
    is_like: bool = False,
    query_words: list[str] | None = None,
    max_anchor_lines: int = 3,
    context_expand_range: int = 5,
    min_keywords_per_line: int = 2,
    max_context_lines: int = 5,
) -> Text:
```

- [ ] **Step 2: 替换上下文选择算法**

替换 `render_search_result()` 中第 106-129 行的上下文选择逻辑。找到以下代码块：

```python
    # 内容片段
    lines = display_text.split("\n")
    kw_lower = [kw.lower() for kw in query_words if kw]
    match_indices = [
        i for i, line in enumerate(lines)
        if any(kw in line.lower() for kw in kw_lower)
        or (is_ripgrep and any(re.search(kw, line, re.IGNORECASE) for kw in query_words if kw))
    ]

    if match_indices:
        first = max(0, match_indices[0] - 1)
        last = min(len(lines) - 1, match_indices[-1] + 1)
        selected = lines[first:last + 1]
    else:
        selected = []
        for line in lines:
            stripped = line.strip()
            if stripped:
                selected.append(stripped)
            if len(selected) >= 5:
                break

    snippet = "\n".join(line.strip() for line in selected if line.strip())
    snippet = _truncate_text(snippet, 300)
```

替换为智能锚点算法：

```python
    # 内容片段 — 智能锚点上下文选择（与 CLI _render_results 对齐）
    lines = display_text.split("\n")
    kw_lower = [kw.lower() for kw in query_words if kw]

    # 给每行计算包含几个关键词
    line_keyword_counts: list[tuple[int, int, str]] = []
    for j, l in enumerate(lines):
        l_lower = l.lower()
        cnt = sum(1 for w in kw_lower if w in l_lower)
        if cnt > 0:
            line_keyword_counts.append((cnt, j, l))

    selected_line_indices: list[int]
    if not line_keyword_counts:
        # 无匹配行：取前 max_context_lines 个非空行
        selected_line_indices = []
        for j, line in enumerate(lines):
            if line.strip():
                selected_line_indices.append(j)
            if len(selected_line_indices) >= max_context_lines:
                break
    else:
        # 按关键词命中数降序排序
        line_keyword_counts.sort(key=lambda x: -x[0])
        # 筛选命中数 >= min_keywords_per_line 的行作为锚点
        best_lines = [
            (j, l)
            for cnt, j, l in line_keyword_counts
            if cnt >= min_keywords_per_line
        ]
        if not best_lines:
            best_lines = [
                (j, l)
                for cnt, j, l in line_keyword_counts[:max_context_lines]
            ]
        # 取前 max_anchor_lines 个锚点，向前后扩展 context_expand_range 行
        context_indices = set()
        for j, _l in best_lines[:max_anchor_lines]:
            for offset in range(-context_expand_range, context_expand_range + 1):
                idx = j + offset
                if 0 <= idx < len(lines):
                    context_indices.add(idx)
        selected_line_indices = sorted(context_indices)

    selected = [lines[j].strip() for j in selected_line_indices if lines[j].strip()]
    snippet = "\n".join(selected)
    snippet = _truncate_text(snippet, 300)
```

- [ ] **Step 3: 扩展 render_search_results 签名并透传参数**

在 `render_search_results()` 中增加同样的四个参数，并透传给 `render_search_result`：

```python
# cortex/tui/renderers/search.py 第 154 行
# 原始签名:
def render_search_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    is_ripgrep: bool = False,
    is_like: bool = False,
) -> list:

# 替换为:
def render_search_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    is_ripgrep: bool = False,
    is_like: bool = False,
    max_anchor_lines: int = 3,
    context_expand_range: int = 5,
    min_keywords_per_line: int = 2,
    max_context_lines: int = 5,
) -> list:
```

然后在 `render_search_results()` 内部调用 `render_search_result` 的地方（约第 190-203 行），添加四个参数：

```python
        output.append(
            render_search_result(
                index=i,
                doc_id=doc_id,
                node=node,
                matched=matched,
                total_keywords=len(query_words),
                composite=composite,
                path=path,
                is_ripgrep=is_ripgrep,
                is_like=is_like,
                query_words=query_words,
                max_anchor_lines=max_anchor_lines,
                context_expand_range=context_expand_range,
                min_keywords_per_line=min_keywords_per_line,
                max_context_lines=max_context_lines,
            )
        )
```

- [ ] **Step 4: Commit**

```bash
git add cortex/tui/renderers/search.py
git commit -m "feat(tui/renderer): 使用 CLI 智能锚点上下文选择算法替换简单策略"
```

---

### Task 3: TUI 调用方传递上下文参数

**Files:**
- Modify: `cortex/tui/app.py` — `_do_search()` 中所有 `render_search_results` 调用

- [ ] **Step 1: 在所有 render_search_results 调用中传入上下文参数**

`_do_search()` 中有 5 处调用 `render_search_results`（搜索路径：FTS 有结果的 LIKE 降级、FTS 无结果的 ripgrep 降级、二次评分无结果的 LIKE 降级、二次评分无结果的 ripgrep 降级、正常结果）。在每处调用中添加四个参数：

```python
                max_anchor_lines=self.idx.max_anchor_lines,
                context_expand_range=self.idx.context_expand_range,
                min_keywords_per_line=self.idx.min_keywords_per_line,
                max_context_lines=self.idx.max_context_lines,
```

具体位置：

**位置 1**（约第 598 行，FTS 无结果 LIKE 降级）:
```python
                    renderables = render_search_results(
                        results=like_results,
                        query=query,
                        query_words=query_words,
                        path_map=self.idx.path_map,
                        max_results=self.max_results,
                        is_like=True,
                        max_anchor_lines=self.idx.max_anchor_lines,
                        context_expand_range=self.idx.context_expand_range,
                        min_keywords_per_line=self.idx.min_keywords_per_line,
                        max_context_lines=self.idx.max_context_lines,
                    )
```

**位置 2**（约第 618 行，FTS 无结果 ripgrep 降级）:
```python
                renderables = render_search_results(
                    results=filtered,
                    query=query,
                    query_words=query_words,
                    path_map=self.idx.path_map,
                    max_results=self.max_results,
                    is_ripgrep=True,
                    max_anchor_lines=self.idx.max_anchor_lines,
                    context_expand_range=self.idx.context_expand_range,
                    min_keywords_per_line=self.idx.min_keywords_per_line,
                    max_context_lines=self.idx.max_context_lines,
                )
```

**位置 3**（约第 699 行，二次评分无结果 LIKE 降级）:
```python
                    renderables = render_search_results(
                        results=like_results,
                        query=query,
                        query_words=query_words,
                        path_map=self.idx.path_map,
                        max_results=self.max_results,
                        is_like=True,
                        max_anchor_lines=self.idx.max_anchor_lines,
                        context_expand_range=self.idx.context_expand_range,
                        min_keywords_per_line=self.idx.min_keywords_per_line,
                        max_context_lines=self.idx.max_context_lines,
                    )
```

**位置 4**（约第 718 行，二次评分无结果 ripgrep 降级）:
```python
                renderables = render_search_results(
                    results=filtered,
                    query=query,
                    query_words=query_words,
                    path_map=self.idx.path_map,
                    max_results=self.max_results,
                    is_ripgrep=True,
                    max_anchor_lines=self.idx.max_anchor_lines,
                    context_expand_range=self.idx.context_expand_range,
                    min_keywords_per_line=self.idx.min_keywords_per_line,
                    max_context_lines=self.idx.max_context_lines,
                )
```

**位置 5**（约第 736 行，正常结果）:
```python
            renderables = render_search_results(
                results=scored_results,
                query=query,
                query_words=query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                is_ripgrep=False,
                max_anchor_lines=self.idx.max_anchor_lines,
                context_expand_range=self.idx.context_expand_range,
                min_keywords_per_line=self.idx.min_keywords_per_line,
                max_context_lines=self.idx.max_context_lines,
            )
```

- [ ] **Step 2: 验证**

```bash
cd E:/github/cortex
.venv/Scripts/python.exe -m cortex
# 在 TUI 中输入 /s <关键词> 确认搜索结果显示正常，上下文选择有智能锚点效果
```

- [ ] **Step 3: Commit**

```bash
git add cortex/tui/app.py
git commit -m "fix(tui/search): 传递上下文选择参数到 renderer"
```

---

### Task 4: CLI FTS 无结果时增加 LIKE 降级

**Files:**
- Modify: `cortex/cortex_cli.py:207-224` (format_results) + `325-428` (_render_results)

- [ ] **Step 1: 在 format_results 的 FTS 无结果分支加入 LIKE 降级**

替换 `cortex_cli.py` 第 207-224 行：

```python
        # 原始代码 (第 207-224 行):
        # FTS 无结果时，直接 ripgrep 降级
        if not nodes:
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                {},
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
            )
            if not filtered:
                print(f"\n[未找到包含 '{query}' 的结果]\n")
                return
            # 降级结果直接渲染（无综合评分）
            self._render_results(
                query, filtered, query_words, max_results, is_ripgrep=True
            )
            return
```

替换为：

```python
        # FTS 无结果时，先 LIKE 降级，再 ripgrep 降级
        if not nodes:
            # 先尝试 SQLite LIKE 降级（原文子串匹配）
            like_results = self.idx.like_search(query, max_results=self.max_results)
            if like_results:
                like_items = self._convert_like_to_render_items(like_results, query_words)
                self._render_results(
                    query, like_items, query_words, max_results, is_like=True
                )
                return
            # LIKE 也无结果，ripgrep 降级
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                {},
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
            )
            if not filtered:
                print(f"\n[未找到包含 '{query}' 的结果]\n")
                return
            # 降级结果直接渲染（无综合评分）
            self._render_results(
                query, filtered, query_words, max_results, is_ripgrep=True
            )
            return
```

- [ ] **Step 2: 在 format_results 的排序后无结果分支加入 LIKE 降级**

替换 `cortex_cli.py` 第 292-301 行：

```python
        # 原始代码 (第 292-301 行):
        # 如果仍无结果，使用 ripgrep 做精确子串匹配
        if not filtered:
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                doc_nodes_map,
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
            )
```

替换为：

```python
        # 如果仍无结果，先 LIKE 降级，再 ripgrep
        if not filtered:
            like_results = self.idx.like_search(query, max_results=self.max_results)
            if like_results:
                like_items = self._convert_like_to_render_items(like_results, query_words)
                self._render_results(
                    query, like_items, query_words, max_results, is_like=True
                )
                return
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                doc_nodes_map,
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
            )
```

- [ ] **Step 3: 添加 _convert_like_to_render_items 辅助方法**

在 `NotebookSearchCLI` 类中添加辅助方法（在 `format_results` 方法之前），将 LIKE dict 结果转为 `_render_results` 能处理的 tuple 格式：

```python
    @staticmethod
    def _convert_like_to_render_items(
        like_results: list[dict], query_words: list[str]
    ) -> list[tuple]:
        """将 like_search 的 dict 结果转为 _render_results 兼容的 tuple 格式。

        LIKE 结果: {node_id, doc_id, title, summary, fts_score, depth}
        目标格式: (doc_id, node_dict, matched_count, proximity, fts_score)
        """
        items = []
        for r in like_results:
            doc_id = r.get("doc_id", "")
            node = {
                "title": r.get("title", ""),
                "text": r.get("summary", ""),
            }
            # 计算匹配词数
            text_lower = (r.get("summary", "") or "").lower()
            matched = sum(1 for w in query_words if w and w.lower() in text_lower)
            matched = max(matched, 1)  # LIKE 结果至少匹配 1 词
            fts_score = r.get("fts_score", 0.0)
            items.append((doc_id, node, matched, 0, fts_score))
        return items
```

- [ ] **Step 4: 修改 _render_results 支持 is_like 参数**

修改 `_render_results` 签名和处理逻辑：

```python
    # 原始签名 (第 325-326 行):
    def _render_results(
        self, query, results, query_words, max_results, is_ripgrep=False
    ):

    # 替换为:
    def _render_results(
        self, query, results, query_words, max_results, is_ripgrep=False, is_like=False
    ):
```

修改 `_render_results` 内部第 338-343 行的标签和 display_items 逻辑：

```python
        # 原始代码 (第 338-343 行):
        if is_ripgrep:
            label = f"找到 {len(results)} 个匹配 (ripgrep)"
            display_items = [(0.0, item) for item in results[:max_results]]
        else:
            label = f"找到 {len(results)} 个匹配"
            display_items = results[:max_results]

        # 替换为:
        if is_ripgrep:
            label = f"找到 {len(results)} 个匹配 (ripgrep)"
            display_items = [(0.0, item) for item in results[:max_results]]
        elif is_like:
            label = f"找到 {len(results)} 个匹配 (LIKE)"
            display_items = [(0.0, item) for item in results[:max_results]]
        else:
            label = f"找到 {len(results)} 个匹配"
            display_items = results[:max_results]
```

修改评分行输出（约第 421-426 行）：

```python
        # 原始代码 (第 421-426 行):
            if is_ripgrep:
                print(f"|    匹配: {matched}/{len(query_words)} 词")
            else:
                print(
                    f"|    评分: {int(composite * 100)}% | 匹配: {matched}/{len(query_words)} 词"
                )

        # 替换为:
            if is_ripgrep or is_like:
                print(f"|    匹配: {matched}/{len(query_words)} 词")
            else:
                print(
                    f"|    评分: {int(composite * 100)}% | 匹配: {matched}/{len(query_words)} 词"
                )
```

- [ ] **Step 5: 验证**

```bash
cd E:/github/cortex
# 搜索一个 FTS 分词可能拆错但 LIKE 能匹配的词
.venv/Scripts/python.exe -m cortex search <关键词>
# 确认降级路径: 先看到 "LIKE" 标签说明 LIKE 生效
```

- [ ] **Step 6: Commit**

```bash
git add cortex/cortex_cli.py
git commit -m "feat(cli/search): 增加 LIKE 降级路径，统一降级链为 FTS → LIKE → ripgrep"
```

---

### Task 5: 端到端验证

**Files:**
- 无代码变更

- [ ] **Step 1: 验证 CLI 搜索**

```bash
cd E:/github/cortex
# 普通搜索
.venv/Scripts/python.exe -m cortex search python
# 带 min-score 过滤
.venv/Scripts/python.exe -m cortex search python --min-score 0.3
```

预期：搜索结果正常，LIKE 降级可能出现在某些查询中。

- [ ] **Step 2: 验证 TUI 搜索**

```bash
.venv/Scripts/python.exe -m cortex
# 在 TUI 中输入:
# /s python
# /s token limit
# /s 量子密码
```

预期：
1. 搜索结果正常，上下文选择使用智能锚点（匹配行周围展开更多上下文）
2. 过滤使用 config 阈值而非硬编码 0
3. 排序后低分结果被二次过滤（当 min_score_threshold > 0 时）

- [ ] **Step 3: 对比确认一致性**

在 CLI 和 TUI 中分别搜索相同关键词，确认：
1. 结果数量和排序基本一致
2. 降级路径一致（都有 LIKE 中间层）
3. 过滤行为一致
