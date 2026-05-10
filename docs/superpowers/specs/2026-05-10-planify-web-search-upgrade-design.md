# planify/web_search tool 升级设计

## 目标

将独立 `web_search.py` 的 4 个能力迁移到 `planify/tools/web.py`，保持 API 兼容。

## 升级点

### 1. Thinking 支持（升级点 2）

`run_web_search()` 新增 `thinking_budget: int = 10000` 参数，传入 `client.messages.stream()` 调用：

```python
kwargs = {
    ...
    "thinking": {"type": "enabled", "budget_tokens": thinking_budget},
}
```

默认值 10000 与 `web_search.py` 保持一致。

### 2. 内部流式（升级点 3）

使用 `client.messages.stream()` 获取最终结果，对 tool caller 透明：

```python
with client.messages.stream(**kwargs) as stream:
    response = stream.get_final_message()
```

Tool schema 不变，不暴露 `stream` 参数。

### 3. 域名过滤（升级点 4）

Tool schema 和函数签名都新增 `allowed_domains` / `blocked_domains` 参数：

```python
def run_web_search(
    query: str,
    client: Anthropic,
    model_id: str = "claude-opus-4-6",
    thinking_budget: int = 10000,
    allowed_domains: Optional[List[str]] = None,
    blocked_domains: Optional[List[str]] = None,
) -> str:
```

Tool schema：
```python
"properties": {
    "query": {"type": "string", "description": "搜索查询内容"},
    "allowed_domains": {
        "type": "array", "items": {"type": "string"},
        "description": "只搜索这些域名"
    },
    "blocked_domains": {
        "type": "array", "items": {"type": "string"},
        "description": "排除这些域名"
    },
},
"required": ["query"],
```

Handler 从 `kw` 中提取 `allowed_domains` / `blocked_domains` 传给 `run_web_search()`。

### 4. 搜索结果提取（升级点 7）

从 `web_search_tool_result` 类型的 content block 中提取标题、URL、page_age：

```python
def extract_search_results(content_blocks: list) -> list[dict]:
    results = []
    for block in content_blocks:
        if hasattr(block, 'type') and block.type == 'web_search_tool_result':
            if hasattr(block, 'content') and isinstance(block.content, list):
                for r in block.content:
                    if hasattr(r, 'title') and hasattr(r, 'url'):
                        results.append({
                            "title": r.title,
                            "url": r.url,
                            **({"page_age": r.page_age} if hasattr(r, 'page_age') and r.page_age else {}),
                        })
        elif hasattr(block, 'type') and block.type == 'text':
            results.append({"type": "text", "text": block.text})
    return results
```

格式化输出：
- text block: 直接输出文本
- web_search_tool_result: 输出 `- [title](url) (page_age)` 格式

## 改动范围

- `planify/tools/web.py` — 唯一改动文件
