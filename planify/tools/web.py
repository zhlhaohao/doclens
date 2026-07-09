"""网络搜索工具
.venv/Scripts/python.exe -m cortex web  "外交部活动 --  search from domain gov.cn, 不要总结，只需要给出网站标题和url"

使用 LLM Provider 的服务端 web_search 工具获取实时网络信息。
需要 API 端点支持 web_search 工具类型。
"""

from __future__ import annotations

import json
from typing import Any, List, Optional, Tuple

from ..core.llm.provider import LLMProvider


def extract_search_results(content_blocks: list) -> list[dict]:
    """
    从 Provider 返回的 content blocks 中提取搜索结果

    支持 dataclass（TextBlock / ToolUseBlock 等）和 dict 两种格式。

    Args:
        content_blocks: Provider 返回的 content 块列表

    Returns:
        结果字典列表，每项包含 title/url/page_age 或 type:text
    """
    results = []
    for block in content_blocks:
        btype = getattr(block, "type", None) if not isinstance(block, dict) else block.get("type")
        if btype == "web_search_tool_result":
            inner = getattr(block, "content", None) if not isinstance(block, dict) else block.get("content")
            if isinstance(inner, list):
                for r in inner:
                    if isinstance(r, dict):
                        title = r.get("title", "")
                        url = r.get("url", "")
                        page_age = r.get("page_age")
                        results.append({
                            "title": title,
                            "url": url,
                            **({"page_age": page_age} if page_age else {}),
                        })
                    else:
                        if hasattr(r, "title") and hasattr(r, "url"):
                            results.append({
                                "title": r.title,
                                "url": r.url,
                                **({"page_age": r.page_age} if hasattr(r, "page_age") and r.page_age else {}),
                            })
        elif btype == "text":
            text = getattr(block, "text", None) if not isinstance(block, dict) else block.get("text", "")
            results.append({"type": "text", "text": text or ""})
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


def _build_search_query(
    query: str,
    allowed_domains: Optional[List[str]] = None,
    search_recency_filter: Optional[str] = None,
    content_size: Optional[str] = None,
    location: Optional[str] = None,
) -> str:
    """将搜索参数封装为 JSON 字符串，用于传递给 API query 字段。"""
    payload: dict[str, Any] = {"search_query": query}
    if allowed_domains:
        payload["search_domain_filter"] = ",".join(allowed_domains)
    if search_recency_filter is not None:
        payload["search_recency_filter"] = search_recency_filter
    if content_size is not None:
        payload["content_size"] = content_size
    if location is not None:
        payload["location"] = location
    return json.dumps(payload, ensure_ascii=False)


def run_web_search(
    query: str,
    client: LLMProvider,
    model_id: str = "claude-opus-4-6",
    thinking_budget: int = 10000,
    allowed_domains: Optional[List[str]] = None,
    search_recency_filter: Optional[str] = None,
    content_size: Optional[str] = None,
    location: Optional[str] = None,
) -> str:
    """
    使用 LLM Provider 的服务端 web_search 工具搜索网络信息

    Args:
        query: 搜索查询字符串
        client: LLM Provider 实例
        model_id: 模型 ID
        thinking_budget: Thinking 预算 token 数（默认 10000）
        allowed_domains: 只搜索这些域名
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

    messages = [{"role": "user", "content": f"Perform a web search for: {actual_query}"}]

    import logging
    logging.getLogger("planify.tools.web").info(
        "web_search request | model=%s | tools=%s | messages=%s",
        model_id,
        tools,
        messages,
    )

    try:
        # 通过 LLMProvider 抽象接口调用流式接口，最终汇集结果
        last_block_index: dict[str, int] = {"text": -1, "tool": -1}
        text_parts: list[str] = []
        search_tool_result_blocks: list = []

        for event in client.stream(
            messages=messages,
            system="",
            tools=[],  # web_search 是服务端工具，由 provider 自身处理
            max_tokens=32000,
        ):
            etype = event.type
            if etype == "content_block_delta" and event.text_delta:
                text_parts.append(event.text_delta)
            elif etype == "content_block_stop":
                # provider 通常会一次性返回完整结果，content_block_stop 只是一个信号
                pass
            elif etype == "message_delta":
                pass
            elif etype == "message_stop":
                break

        # 流式 provider 通常只在 chat 接口返回完整内容；用 chat 兜底获取结构化 content
        try:
            response = client.chat(
                messages=messages,
                system="",
                tools=[],
                max_tokens=32000,
            )
            results = extract_search_results(response.content)
        except Exception:
            # 若 chat 不可用，降级使用累积的文本
            results = [{"type": "text", "text": "".join(text_parts)}] if text_parts else []

        return _format_results(results)

    except Exception as e:
        err_msg = str(e)
        if "401" in err_msg or "authentication" in err_msg.lower():
            return "网络搜索不可用：当前 API 端点不支持 web_search"
        if "timeout" in err_msg.lower() or "timed out" in err_msg.lower():
            return "网络搜索超时，请稍后重试"
        return f"网络搜索不可用：{err_msg}"


def make_web_tools(
    client: Optional[LLMProvider], model_id: str = "claude-opus-4-6"
) -> Tuple[List[dict], dict]:
    """
    创建 web_search 工具定义和处理器

    Args:
        client: LLM Provider 实例
        model_id: 模型 ID

    Returns:
        (工具定义列表, 处理器字典)
    """
    if client is None:
        return [], {}

    tools = [
        {
            "name": "web_search",
            "description": "搜索网络信息。返回基于实时搜索的结果摘要。支持域名过滤、时效性、内容详细度和地区控制。",
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
            search_recency_filter=kw.get("search_recency_filter"),
            content_size=kw.get("content_size"),
            location=kw.get("location"),
        ),
    }

    return tools, handlers
