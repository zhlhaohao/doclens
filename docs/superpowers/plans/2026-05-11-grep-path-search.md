# grep 路径搜索实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/grep` 命令中增加路径搜索功能，正则匹配文件路径，结果放在内容匹配之后

**Architecture:** 在 `cortex/ripgrep.py` 新增 `search_paths_by_regex` 函数，在 `cortex/tui/app.py` 的 `_do_grep` 中调用路径搜索，结果通过 `render_search_results` 渲染，新增 `is_path` 参数区分路径匹配

**Tech Stack:** Python, re (正则), ripgrep

---

## Task 1: 新增 `search_paths_by_regex` 函数

**Files:**
- Modify: `cortex/ripgrep.py` (在文件末尾添加新函数)

- [ ] **Step 1: 在 `cortex/ripgrep.py` 末尾添加函数**

在 `cortex/ripgrep.py` 文件末尾（约第 160 行后）添加：

```python
def search_paths_by_regex(
    regex: str,
    path_map: dict[str, str],
    max_results: int = 100,
) -> list[tuple[str, dict, int, int, float]]:
    """在文件路径上执行正则匹配。

    Args:
        regex: 正则表达式
        path_map: doc_id -> 文件路径的映射
        max_results: 最大返回结果数

    Returns:
        [(doc_id, node_dict, matched_count, proximity, fts_score)]
        node_dict 包含 'title'（路径）和 'text'（路径）字段
    """
    results = []
    try:
        pattern = re.compile(regex, re.IGNORECASE)
    except re.error:
        return results

    for doc_id, file_path in path_map.items():
        if pattern.search(file_path):
            # 构造与 rg_fallback_search 模式 2 一致的 node dict
            node = {
                "title": f"[路径匹配] {file_path}",
                "text": f"路径包含正则匹配: {regex}",
            }
            results.append((doc_id, node, 1, 0, 0.0))

    return results[:max_results]
```

- [ ] **Step 2: 提交变更**

```bash
git add cortex/ripgrep.py
git commit -m "feat(ripgrep): add search_paths_by_regex for path matching"
```

---

## Task 2: 修改 `_do_grep` 调用路径搜索

**Files:**
- Modify: `cortex/tui/app.py:511-551` (修改 `_do_grep` 方法)

- [ ] **Step 1: 修改 `_do_grep` 方法**

将 `cortex/tui/app.py` 第 521-548 行的内容搜索逻辑后面，增加路径搜索。

在 `else` 分支（内容搜索有结果时）和 `if not results`（ripgrep 降级后）的结果渲染前，增加路径搜索调用。

具体修改：在 `results` 或 `filtered` 结果后，追加路径搜索结果。

```python
def _do_grep(self, query: str) -> None:
    """后台线程：执行正则搜索"""
    worker = get_current_worker()
    if worker.is_cancelled:
        return

    try:
        results = self.idx.like_search(query, max_results=self.max_results, use_regex=True)
        query_words = [query]

        if not results:
            # 正则无结果，尝试 ripgrep 降级
            filtered = rg_module.rg_fallback_search(
                query,
                self.idx.path_map,
                {},
                query_words,
                context_before=self.idx.rg_context_before,
                context_after=self.idx.rg_context_after,
            )
            # 追加路径搜索
            path_results = rg_module.search_paths_by_regex(
                query,
                self.idx.path_map,
                max_results=self.max_results,
            )
            # 合并结果（路径排在后面）
            all_results = filtered + path_results
            renderables = render_search_results(
                results=all_results,
                query=query,
                query_words=query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                is_ripgrep=True,
            )
        else:
            # 追加路径搜索
            path_results = rg_module.search_paths_by_regex(
                query,
                self.idx.path_map,
                max_results=self.max_results,
            )
            # 合并结果（内容在前，路径在后）
            all_results = results + path_results
            renderables = render_search_results(
                results=all_results,
                query=query,
                query_words=query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                is_like=True,
            )
        self.call_from_thread(self._on_search_done, renderables)

    except Exception as exc:
        self.call_from_thread(self._on_search_error, str(exc))
```

- [ ] **Step 2: 验证语法正确性**

检查修改后的代码是否有语法错误。

- [ ] **Step 3: 提交变更**

```bash
git add cortex/tui/app.py
git commit -m "feat(grep): append path search results after content matches"
```

---

## Task 3: 手动测试验证

**Files:**
- Test: 在 TUI 中执行 `/grep src` 等命令

- [ ] **Step 1: 启动 TUI**

```bash
.venv/Scripts/python.exe -m cortex
```

- [ ] **Step 2: 测试路径搜索**

在 TUI 中执行：
- `/grep src` → 应显示路径包含 `src` 的文件（标记为 `[路径匹配]`）
- `/grep 量子` → 内容匹配优先，路径匹配在后

- [ ] **Step 3: 确认结果格式正确**

路径匹配应显示 `[路径匹配] /path/to/file`，并标注"路径包含正则匹配: xxx"

---

## 变更摘要

| 文件 | 变更 |
|---|---|
| `cortex/ripgrep.py` | 新增 `search_paths_by_regex` 函数 |
| `cortex/tui/app.py` | `_do_grep` 中追加路径搜索并合并结果 |
