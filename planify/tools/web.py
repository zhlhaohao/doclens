"""网络搜索工具
.venv/Scripts/python.exe -m cortex web  "外交部活动 --  search from domain gov.cn, 不要总结，只需要给出网站标题和url" 

使用 Anthropic API 的服务端 web_search_20250305 工具获取实时网络信息。
需要 API 端点支持 web_search_20250305 工具类型。
"""

from typing import Any, List, Optional, Tuple

from anthropic import Anthropic


def extract_search_results(content_blocks: list) -> list[dict]:
    """
    从 API 返回的 content blocks 中提取搜索结果

    Args:
        content_blocks: Anthropic API 返回的 content 块列表

    Returns:
        结果字典列表，每项包含 title/url/page_age 或 type:text
    """
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


def _format_results(results: list[dict]) -> str:
    """将提取的结果格式化为字符串"""
    if not results:
        return "未找到相关结果"

    output_parts = []
    for r in results:
        if r.get("type") == "text":
            output_parts.append(r["text"])
        else:
            title = r.get("title", "Untitled")
            url = r.get("url", "")
            page_age = r.get("page_age", "")
            output_parts.append(f"- [{title}]({url}){f' ({page_age})' if page_age else ''}")

    return "\n".join(output_parts)


def run_web_search(
    query: str,
    client: Anthropic,
    model_id: str = "claude-opus-4-6",
    thinking_budget: int = 10000,
    allowed_domains: Optional[List[str]] = None,
    blocked_domains: Optional[List[str]] = None,
) -> str:
    """
    使用 Anthropic API 的服务端 web_search 工具搜索网络信息

    Args:
        query: 搜索查询字符串
        client: Anthropic 客户端实例
        model_id: 模型 ID
        thinking_budget: Thinking 预算 token 数（默认 10000）
        allowed_domains: 只搜索这些域名
        blocked_domains: 排除这些域名

    Returns:
        格式化后的搜索结果文本
    """
    if client is None:
        return "网络搜索不可用：客户端未初始化"

    # 构建工具 schema（与 TypeScript ApiSearchAdapter 一致：allowed/blocked_domains 在顶层）
    tool: dict[str, Any] = {
        "type": "web_search_20250305",
        "name": "web_search_20250305",
        "max_uses": 8,
    }
    if allowed_domains:
        tool["allowed_domains"] = allowed_domains
    if blocked_domains:
        tool["blocked_domains"] = blocked_domains

    tools = [tool]

    kwargs: dict[str, Any] = {
        "model": model_id,
        "max_tokens": 32000,
        "tools": tools,
        "messages": [{"role": "user", "content": f"Perform a web search for: {query}"}],
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
            "description": "搜索网络信息。返回基于实时搜索的结果摘要。支持 allowed_domains 和 blocked_domains 过滤。",
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
                        "description": "只搜索这些域名",
                    },
                    "blocked_domains": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "排除这些域名",
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
            blocked_domains=kw.get("blocked_domains"),
        ),
    }

    return tools, handlers
