# grep 路径搜索功能设计

## 需求

`/grep <正则表达式>` 命令在执行完内容匹配搜索后，自动追加路径匹配搜索，路径结果放在文件匹配结果的后面。

## 背景

当前 `/grep` 命令的工作流程：
1. `like_search` — 通过 FTS5 或 SQLite LIKE/REGEXP 在索引内容中搜索
2. 无结果时 → `rg_fallback_search` — 在实际文件中用 ripgrep 做正则匹配

问题：用户想通过路径关键字搜索文件时（如 `/grep src` 搜索路径含 `src` 的文件），现有 grep 命令无法匹配路径。

## 设计

### 执行流程

1. **第一阶段**：执行现有内容搜索（`like_search` → `rg_fallback_search` 降级）
2. **第二阶段**：执行新增的路径搜索，用相同正则匹配所有已索引文件的路径
3. **输出**：内容匹配结果在前，路径匹配结果在后

### 路径搜索实现

在 `cortex/ripgrep.py` 新增函数：

```python
def search_paths_by_regex(
    regex: str,
    path_map: dict[str, str],
    max_results: int = 100,
) -> list[tuple[str, str, int, int, float]]:
    """在文件路径上执行正则匹配。

    Args:
        regex: 正则表达式
        path_map: doc_id -> 文件路径的映射
        max_results: 最大返回结果数

    Returns:
        [(doc_id, file_path, matched_count, proximity, fts_score)]
        其中 matched_count=1, proximity=0, fts_score=0.0（占位值）
    """
    results = []
    try:
        pattern = re.compile(regex, re.IGNORECASE)
    except re.error:
        return results

    for doc_id, file_path in path_map.items():
        if pattern.search(file_path):
            # 占位值，与现有结果格式兼容
            results.append((doc_id, file_path, 1, 0, 0.0))

    return results[:max_results]
```

### 结果渲染

路径匹配结果复用现有 `_render_results` 格式：
- 标签改为 `[路径匹配]`（而非 `ripgrep`）
- 显示文件路径而非行内容
- 放在内容匹配结果之后

### 展示效果

```
============================================================
关键词: src  |  找到 5 个匹配
============================================================

+-- [1] Button 组件
    文件: vscode://file/C:/project/src/components/Button.tsx:1
    ---------------------------------------------
      ### Button 组件
      ...
    评分: 85% | 匹配: 1/1 词

+-- [2] [路径匹配] src/components
    文件: vscode://file/C:/project/src/components/Button.tsx
    ---------------------------------------------
      路径包含正则匹配: src/components
    评分: N/A | 匹配: 1/1 词
```

## 变更文件

- `cortex/ripgrep.py`: 新增 `search_paths_by_regex` 函数
- `cortex/tui/app.py`: `_do_grep` 方法中，在内容搜索完成后调用路径搜索

## 测试验证

1. `/grep src` → 应返回路径包含 `src` 的文件（作为路径匹配）
2. `/grep Button` → 应同时返回内容匹配和路径匹配（内容优先）
3. `/grep "src/components"` → 正则表达式路径匹配
