# grep tool 搜索逻辑统一设计

## 背景

当前 TUI `/grep` 命令和 AI Agent 的 `grep` tool 使用完全不同的搜索逻辑：

| | TUI `/grep` (`_do_grep`) | grep tool (`_handle_grep`) |
|---|---|---|
| 步骤 1 | `like_search(use_regex=True)` — SQLite REGEXP | 直接 `rg_search` — ripgrep |
| 步骤 2 | 若无结果：`rg_fallback_search` + `search_paths_by_regex` | `_read_matched_lines` |
| 步骤 3 | 追加路径搜索 | 无 |
| 输出 | Rich 渲染（给人看） | 纯文本 `path:line: text`（给 Agent 看） |

问题：搜索逻辑重复且不一致。grep tool 缺少 `like_search` 和路径搜索步骤。

## 设计

### 核心思路

在 `cortex/ripgrep.py` 新增 `execute_grep_search()` 函数，封装完整的搜索流程。
TUI 和 grep tool 都调用这个函数，各自处理输出格式。

### 搜索流程

```
execute_grep_search(idx, query, max_results)
  │
  ├─ like_search(query, use_regex=True)
  │   ├─ 有结果 → content_results = like 结果转 tuple 格式
  │   └─ 无结果 → content_results = rg_fallback_search(query) 结果
  │
  ├─ path_results = search_paths_by_regex(query)
  │
  └─ 返回 GrepResult(content_results, path_results, query_words)
```

### 数据结构

```python
@dataclass
class GrepResult:
    content_results: list[tuple[str, dict, int, int, float]]
    path_results: list[tuple[str, dict, int, int, float]]
    query_words: list[str]
```

其中 tuple 格式为 `(doc_id, node_dict, matched_count, proximity, fts_score)`，
与现有的 `rg_fallback_search` / `search_paths_by_regex` 返回格式一致。

### 改动文件

#### 1. `cortex/ripgrep.py` — 新增 `execute_grep_search`

```python
def execute_grep_search(
    idx: IndexManager,
    query: str,
    max_results: int = 50,
) -> GrepResult:
```

完整搜索流程（从 `_do_grep` 提取）：
1. `idx.like_search(query, max_results, use_regex=True)`
2. 有结果：转换为 `(doc_id, node, matched, prox, fts)` tuple 格式
3. 无结果：调用 `rg_fallback_search` 获取内容结果
4. 调用 `search_paths_by_regex` 获取路径结果
5. 返回 `GrepResult`

#### 2. `cortex/tui/app.py` — 简化 `_do_grep`

```python
def _do_grep(self, query):
    result = execute_grep_search(self.idx, query, self.max_results)
    all_results = result.content_results + result.path_results
    renderables = render_search_results(
        results=all_results, query=query,
        query_words=result.query_words,
        path_map=self.idx.path_map,
        max_results=self.max_results,
        is_ripgrep=True,
    )
    self.call_from_thread(self._on_search_done, renderables)
```

#### 3. `cortex/grep_tools.py` — 重构为调用统一入口

- `build_grep_tools` 接受 `IndexManager` 参数（替代 `workdir`）
- `_handle_grep` 调用 `execute_grep_search()` 获取结构化结果
- 新增 `_format_agent_output()` 将 `GrepResult` 格式化为 Agent 友好的纯文本
- 删除 `_read_matched_lines()`（`rg_fallback_search` 已内置上下文读取）

Agent 输出格式 — 路径使用 `path_map` 中的值（如 `科技/doc.md`），
与 `read_document` 的 `path` 参数一致，Agent 可直接复制调用：

```
Found 5 results in 3 files:
Use read_document tool to read full content: path=<path value>.

科技/ai_report.md:42: Explainable AI (XAI) focuses on making AI decisions transparent
科技/ai_report.md:87: Next-Gen AI systems will prioritize explainability and safety
科技/ai_report.md:112: The evolution of AI governance frameworks
config/settings.md:15: AI_MODEL_CONFIG = {...}
config/settings.md:38: # Next-Gen model parameters

Paths matched: 科技/next_gen_ai.md, config/ai_settings.yaml

(12 more results truncated. Use max_results parameter to get more.)
```

#### 4. `cortex/agent_integration.py` — 传入 idx

```python
# 之前
grep_tools, grep_handlers = build_grep_tools(self.workdir)
# 之后
grep_tools, grep_handlers = build_grep_tools(self.idx)
```

#### 5. `cortex/cortex_cli.py` — 传入 idx

`_cli_grep` 函数已有 `idx` 参数，传入即可。

#### 6. 删除 `glob` 参数

grep tool 的 `glob` 参数在统一搜索流程中无直接对应，删除：
- `GREP_TOOL` schema 中移除 `glob` 字段
- `_handle_grep` 移除 `glob` 参数
- `cortex_cli.py` 的 `_cli_grep` 移除 `--glob` 参数

### 不改动的部分

- TUI 渲染器 (`tui/renderers/search.py`) — 不变
- Agent 输出格式 — 保持纯文本，只是数据来源变了
