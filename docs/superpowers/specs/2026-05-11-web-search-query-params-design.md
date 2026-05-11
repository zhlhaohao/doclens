# Web Search Tool — 查询参数 JSON 封装设计

## 背景

`web_search` tool 通过 Anthropic API 的 `web_search_20250305` 服务端工具进行网络搜索。当前 API 端点不支持 `allowed_domains` 等参数直接传递到 tool 配置中，需要将这些参数封装到 `query` 字段以 JSON 字符串形式传递。

## 方案

在 `run_web_search` 内部封装 JSON，`make_web_tools` 的 `input_schema` 暴露独立参数，调用方无需感知 JSON 封装细节。

## 参数映射

| web_search tool 参数 | 类型 | JSON 字段 | 说明 |
|---|---|---|---|
| `query` (required) | string | `search_query` | 搜索关键词 |
| `allowed_domains` | string[] | `search_domain_filter` | 白名单域名，多值逗号拼接为单个字符串 |
| `count` | integer | `count` | 返回条数 1-50，默认 10 |
| `search_recency_filter` | enum | `search_recency_filter` | `oneDay/oneWeek/oneMonth/oneYear/noLimit` |
| `content_size` | enum | `content_size` | `medium/high` |
| `location` | enum | `location` | `cn/us` |

移除：`blocked_domains`（API 端点不支持黑名单）。

## JSON 封装逻辑

新增 `_build_search_query` 函数：

```python
def _build_search_query(query: str, **params) -> str:
    payload = {"search_query": query}
    for key, value in params.items():
        if value is not None:
            payload[key] = value
    return json.dumps(payload, ensure_ascii=False)
```

- `allowed_domains` 列表 → 逗号分隔字符串 → `search_domain_filter`
- 非 None 参数才写入 JSON
- 无额外参数时仍输出 JSON（`{"search_query": "..."}`）

## API 请求变更

```python
# 之前：通过 tool 配置传递 domain 参数
tool = {"type": "web_search_20250305", ...}
if allowed_domains:
    tool["allowed_domains"] = allowed_domains

# 之后：所有参数通过 query JSON 传递
tool = {"type": "web_search_20250305", "name": "web_search_20250305", "max_uses": 8}
# 不再设置 tool["allowed_domains"]
actual_query = _build_search_query(query, search_domain_filter=domain_str, count=count, ...)
```

## 变更文件

### `planify/tools/web.py`

- 新增 `_build_search_query` 函数
- `run_web_search`：移除 `blocked_domains` 参数，新增 `count`、`search_recency_filter`、`content_size`、`location` 参数；内部调用 `_build_search_query` 封装 query；移除 `tool["allowed_domains"]` 设置
- `make_web_tools`：更新 tool schema（移除 `blocked_domains`，新增 4 个参数，更新 description）；更新 handler lambda 传递新参数

### `cortex/cortex_cli.py`

- web_parser：移除 `--blocked-domains`，新增 `--count`、`--recency`、`--content-size`、`--location`
- `_cli_web`：解析新参数并传递给 `run_web_search`

### 不变的文件

- `planify/tools/registry.py`：`make_web_tools(client, model_id)` 调用签名不变
- `cortex/agent_integration.py`：通过 `build_tool_registry` 间接使用，无需改动
- `cortex/tui/app.py`：`/web` 命令只传 query，无需改动

## 错误处理

- `count` 超范围：由 tool schema `minimum/maximum` 和 argparse 约束，无需额外验证
- `allowed_domains` 空列表：跳过，不写入 JSON
- JSON 序列化：所有值均为基本类型，不会失败

## 测试要点

- 仅传 query → JSON 为 `{"search_query": "xxx"}`
- 传全部参数 → JSON 包含所有非 None 字段
- `allowed_domains` 多值 → 正确逗号拼接
- CLI `cortex web` 各参数正确透传
