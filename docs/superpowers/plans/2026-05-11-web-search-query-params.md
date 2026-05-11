# Web Search Query Params JSON 封装 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 web_search tool 的搜索参数（allowed_domains、count、search_recency_filter、content_size、location）封装为 JSON 字符串传递给 API query 字段。

**Architecture:** 在 `run_web_search` 内部新增 `_build_search_query` 函数负责 JSON 封装，`make_web_tools` 的 input_schema 暴露独立参数给 AI Agent，CLI 新增对应命令行参数。移除 `blocked_domains`。

**Tech Stack:** Python, Anthropic API, argparse, json

---

### Task 1: 新增 `_build_search_query` 函数并编写测试

**Files:**
- Modify: `planify/tools/web.py:1-10` (新增 import json)
- Modify: `planify/tools/web.py:55-56` (在 `run_web_search` 之前插入新函数)

- [ ] **Step 1: 在 `planify/tools/web.py` 顶部新增 `import json`**

在现有 `from typing import Any, List, Optional, Tuple` 之后添加：

```python
import json
```

- [ ] **Step 2: 在 `run_web_search` 之前插入 `_build_search_query` 函数**

在第 55 行（`def run_web_search` 之前）插入：

```python
def _build_search_query(
    query: str,
    allowed_domains: Optional[List[str]] = None,
    count: Optional[int] = None,
    search_recency_filter: Optional[str] = None,
    content_size: Optional[str] = None,
    location: Optional[str] = None,
) -> str:
    """将搜索参数封装为 JSON 字符串，用于传递给 API query 字段。"""
    payload: dict[str, Any] = {"search_query": query}
    if allowed_domains:
        payload["search_domain_filter"] = ",".join(allowed_domains)
    if count is not None:
        payload["count"] = count
    if search_recency_filter is not None:
        payload["search_recency_filter"] = search_recency_filter
    if content_size is not None:
        payload["content_size"] = content_size
    if location is not None:
        payload["location"] = location
    return json.dumps(payload, ensure_ascii=False)
```

- [ ] **Step 3: 验证函数可用**

Run:
```bash
cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "
from planify.tools.web import _build_search_query
import json

# 测试 1: 仅 query
result = _build_search_query('python tutorial')
assert json.loads(result) == {'search_query': 'python tutorial'}
print('Test 1 passed: query only')

# 测试 2: 全部参数
result = _build_search_query('test', allowed_domains=['python.org', 'docs.python.org'], count=20, search_recency_filter='oneWeek', content_size='high', location='us')
parsed = json.loads(result)
assert parsed['search_query'] == 'test'
assert parsed['search_domain_filter'] == 'python.org,docs.python.org'
assert parsed['count'] == 20
assert parsed['search_recency_filter'] == 'oneWeek'
assert parsed['content_size'] == 'high'
assert parsed['location'] == 'us'
print('Test 2 passed: all params')

# 测试 3: allowed_domains 空列表被跳过
result = _build_search_query('test', allowed_domains=[])
parsed = json.loads(result)
assert 'search_domain_filter' not in parsed
print('Test 3 passed: empty allowed_domains')

print('All tests passed!')
"
```
Expected: `All tests passed!`

- [ ] **Step 4: 提交**

```bash
git add planify/tools/web.py
git commit -m "feat: add _build_search_query for JSON query parameter encapsulation"
```

---

### Task 2: 更新 `run_web_search` 函数签名和内部逻辑

**Files:**
- Modify: `planify/tools/web.py:57-127`

- [ ] **Step 1: 替换 `run_web_search` 函数**

将整个 `run_web_search` 函数（第 57-127 行）替换为：

```python
def run_web_search(
    query: str,
    client: Anthropic,
    model_id: str = "claude-opus-4-6",
    thinking_budget: int = 10000,
    allowed_domains: Optional[List[str]] = None,
    count: Optional[int] = None,
    search_recency_filter: Optional[str] = None,
    content_size: Optional[str] = None,
    location: Optional[str] = None,
) -> str:
    """
    使用 Anthropic API 的服务端 web_search 工具搜索网络信息

    Args:
        query: 搜索查询字符串
        client: Anthropic 客户端实例
        model_id: 模型 ID
        thinking_budget: Thinking 预算 token 数（默认 10000）
        allowed_domains: 只搜索这些域名
        count: 返回结果条数 (1-50)
        search_recency_filter: 时间范围 (oneDay/oneWeek/oneMonth/oneYear/noLimit)
        content_size: 内容详细度 (medium/high)
        location: 搜索地区 (cn/us)

    Returns:
        格式化后的搜索结果文本
    """
    if client is None:
        return "网络搜索不可用：客户端未初始化"

    # 将所有搜索参数封装为 JSON 字符串传递给 API query 字段
    actual_query = _build_search_query(
        query,
        allowed_domains=allowed_domains,
        count=count,
        search_recency_filter=search_recency_filter,
        content_size=content_size,
        location=location,
    )

    tool: dict[str, Any] = {
        "type": "web_search_20250305",
        "name": "web_search_20250305",
        "max_uses": 8,
    }
    tools = [tool]

    kwargs: dict[str, Any] = {
        "model": model_id,
        "max_tokens": 32000,
        "tools": tools,
        "messages": [{"role": "user", "content": f"Perform a web search for: {actual_query}"}],
        "thinking": {"type": "enabled", "budget_tokens": thinking_budget},
    }

    import logging
    logging.getLogger("planify.tools.web").info(
        "web_search request | model=%s | kwargs=%s",
        model_id,
        kwargs,
    )

    try:
        import httpx
        kwargs["timeout"] = httpx.Timeout(60.0, connect=10.0)

        # 内部流式调用，获取最终结果
        with client.messages.stream(**kwargs) as stream:
            response = stream.get_final_message()

        results = extract_search_results(response.content)
        return _format_results(results)

    except Exception as e:
        err_msg = str(e)
        if "401" in err_msg or "authentication" in err_msg.lower():
            return "网络搜索不可用：当前 API 端点不支持 web_search"
        if "timeout" in err_msg.lower() or "timed out" in err_msg.lower():
            return "网络搜索超时，请稍后重试"
        return f"网络搜索不可用：{err_msg}"
```

- [ ] **Step 2: 验证函数签名正确**

Run:
```bash
cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "
import inspect
from planify.tools.web import run_web_search
params = list(inspect.signature(run_web_search).parameters.keys())
print('Parameters:', params)
assert 'blocked_domains' not in params, 'blocked_domains should be removed'
assert 'count' in params, 'count should be added'
assert 'search_recency_filter' in params, 'search_recency_filter should be added'
assert 'content_size' in params, 'content_size should be added'
assert 'location' in params, 'location should be added'
print('Signature OK')
"
```
Expected: `Signature OK`

- [ ] **Step 3: 提交**

```bash
git add planify/tools/web.py
git commit -m "feat: update run_web_search to use JSON query encapsulation, remove blocked_domains"
```

---

### Task 3: 更新 `make_web_tools` 的 tool schema 和 handler

**Files:**
- Modify: `planify/tools/web.py:130-183`

- [ ] **Step 1: 替换 `make_web_tools` 函数**

将整个 `make_web_tools` 函数替换为：

```python
def make_web_tools(
    client: Optional[Anthropic], model_id: str = "claude-opus-4-6"
) -> Tuple[List[dict], dict]:
    """
    创建 web_search 工具定义和处理器

    Args:
        client: Anthropic 客户端实例
        model_id: 模型 ID

    Returns:
        (工具定义列表, 处理器字典)
    """
    if client is None:
        return [], {}

    tools = [
        {
            "name": "web_search",
            "description": "搜索网络信息。返回基于实时搜索的结果摘要。支持域名过滤、结果数量、时效性、内容详细度和地区控制。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索查询内容",
                    },
                    "allowed_domains": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "只搜索这些域名，如 ['python.org', 'docs.python.org']",
                    },
                    "count": {
                        "type": "integer",
                        "description": "返回结果条数，1-50，默认10",
                        "minimum": 1,
                        "maximum": 50,
                    },
                    "search_recency_filter": {
                        "type": "string",
                        "enum": ["oneDay", "oneWeek", "oneMonth", "oneYear", "noLimit"],
                        "description": "搜索时间范围过滤，默认noLimit",
                    },
                    "content_size": {
                        "type": "string",
                        "enum": ["medium", "high"],
                        "description": "返回内容详细度，medium=摘要，high=详细",
                    },
                    "location": {
                        "type": "string",
                        "enum": ["cn", "us"],
                        "description": "搜索地区/语言，cn=中文，us=英文",
                    },
                },
                "required": ["query"],
            },
        },
    ]

    handlers = {
        "web_search": lambda **kw: run_web_search(
            kw["query"],
            client,
            model_id,
            allowed_domains=kw.get("allowed_domains"),
            count=kw.get("count"),
            search_recency_filter=kw.get("search_recency_filter"),
            content_size=kw.get("content_size"),
            location=kw.get("location"),
        ),
    }

    return tools, handlers
```

- [ ] **Step 2: 验证 tool schema 结构**

Run:
```bash
cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "
from planify.tools.web import make_web_tools
from unittest.mock import MagicMock

client = MagicMock()
tools, handlers = make_web_tools(client, 'test-model')

schema_props = tools[0]['input_schema']['properties']
assert 'blocked_domains' not in schema_props, 'blocked_domains should be removed'
assert 'count' in schema_props
assert 'search_recency_filter' in schema_props
assert 'content_size' in schema_props
assert 'location' in schema_props
assert 'allowed_domains' in schema_props
assert tools[0]['input_schema']['required'] == ['query']
print('Tool schema OK')

# 验证 handler 可调用
assert 'web_search' in handlers
print('Handler OK')
"
```
Expected: `Tool schema OK` + `Handler OK`

- [ ] **Step 3: 提交**

```bash
git add planify/tools/web.py
git commit -m "feat: update web_search tool schema with count, recency, content_size, location params"
```

---

### Task 4: 更新 CLI `web` 子命令参数和处理器

**Files:**
- Modify: `cortex/cortex_cli.py:846-859` (web_parser 参数定义)
- Modify: `cortex/cortex_cli.py:1044-1072` (_cli_web 处理函数)

- [ ] **Step 1: 替换 web_parser 参数定义**

将第 846-859 行的 web_parser 部分替换为：

```python
    # cortex web <query> [--allowed-domains DOMAINS] [--count N] [--recency FILTER] [--content-size SIZE] [--location LOC]
    web_parser = sub.add_parser(
        "web", help="Web search using Anthropic server-side search"
    )
    web_parser.add_argument("query", nargs="+", help="Search query keywords")
    web_parser.add_argument(
        "--allowed-domains", type=str, default=None,
        help="只搜索这些域名（逗号分隔）"
    )
    web_parser.add_argument(
        "--count", type=int, default=None,
        help="返回结果条数 (1-50)"
    )
    web_parser.add_argument(
        "--recency", type=str, default=None,
        choices=["oneDay", "oneWeek", "oneMonth", "oneYear", "noLimit"],
        help="时间范围过滤"
    )
    web_parser.add_argument(
        "--content-size", type=str, default=None,
        choices=["medium", "high"],
        help="内容详细度"
    )
    web_parser.add_argument(
        "--location", type=str, default=None,
        choices=["cn", "us"],
        help="搜索地区"
    )
    web_parser.set_defaults(func=_cli_web)
```

- [ ] **Step 2: 替换 `_cli_web` 处理函数**

将第 1044-1072 行的 `_cli_web` 函数替换为：

```python
def _cli_web(args, config, idx):
    """Handle `cortex web <query>` — web search via Anthropic server-side search."""
    query = " ".join(args.query)

    allowed = None
    if args.allowed_domains:
        allowed = [d.strip() for d in args.allowed_domains.split(",") if d.strip()]

    from planify.tools.web import run_web_search
    from planify.core.client import init_anthropic_client

    api_key = config.planify_api_key
    base_url = config.planify_base_url
    model_id = config.planify_model_id

    if not api_key:
        print("错误: 未配置 PLANIFY_API_KEY。请在 .env 中设置。")
        return

    client = init_anthropic_client(base_url, api_key)
    result = run_web_search(
        query, client, model_id,
        allowed_domains=allowed,
        count=args.count,
        search_recency_filter=args.recency,
        content_size=args.content_size,
        location=args.location,
    )
    print(result)
```

- [ ] **Step 3: 验证 CLI 参数解析正确**

Run:
```bash
cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "
from cortex.cortex_cli import _build_parser
parser = _build_parser()

# 测试基本解析
args = parser.parse_args(['web', 'test', 'query', '--count', '20', '--recency', 'oneWeek', '--content-size', 'high', '--location', 'cn', '--allowed-domains', 'python.org,docs.python.org'])
assert args.query == ['test', 'query']
assert args.count == 20
assert args.recency == 'oneWeek'
assert args.content_size == 'high'
assert args.location == 'cn'
assert args.allowed_domains == 'python.org,docs.python.org'
assert args.func.__name__ == '_cli_web'
print('CLI parsing OK')
"
```
Expected: `CLI parsing OK`

- [ ] **Step 4: 提交**

```bash
git add cortex/cortex_cli.py
git commit -m "feat: update cortex web CLI with count, recency, content-size, location params"
```

---

### Task 5: 端到端验证

- [ ] **Step 1: 验证模块导入链完整**

Run:
```bash
cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "
from planify.tools.web import run_web_search, make_web_tools, _build_search_query
from unittest.mock import MagicMock

# 验证 make_web_tools 产出完整
client = MagicMock()
tools, handlers = make_web_tools(client)
print('Tools:', [t['name'] for t in tools])
print('Handlers:', list(handlers.keys()))

# 验证 registry 调用链
from planify.tools.registry import build_tool_registry
print('Registry import OK')
"
```
Expected: 工具列表和 handlers 列表正确打印，无报错。

- [ ] **Step 2: 验证 CLI help 输出**

Run:
```bash
cd /c/Users/lianghao/github/cortex && .venv/Scripts/python.exe -m cortex web --help
```
Expected: 显示 `--allowed-domains`, `--count`, `--recency`, `--content-size`, `--location` 参数，不再有 `--blocked-domains`。

- [ ] **Step 3: 最终提交（如有遗留更改）**

```bash
git status
# 如有未提交更改：
git add -A && git commit -m "chore: final cleanup for web search query params"
```
