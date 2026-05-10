"""网络搜索工具

使用 Anthropic API 的服务端 web_search 工具获取实时网络信息。
需要 API 端点支持 web_search_20250305 工具类型。
"""

from typing import List, Optional, Tuple

from anthropic import Anthropic


def run_web_search(
    query: str, client: Anthropic, model_id: str = "claude-opus-4-6"
) -> str:
    """
    使用 Anthropic API 的服务端 web_search 工具搜索网络信息

    Args:
        query: 搜索查询字符串
        client: Anthropic 客户端实例
        model_id: 模型 ID

    Returns:
        搜索结果文本
    """
    if client is None:
        return "网络搜索不可用：客户端未初始化"
    try:
        import httpx
        response = client.messages.create(
            model=model_id,
            max_tokens=4096,
            timeout=httpx.Timeout(60.0, connect=10.0),
            tools=[
                {
                    "name": "web_search",
                    "type": "web_search_20250305",
                    "web_search": {
                        "enable": True,
                        "search_query": "auto",
                    },
                }
            ],
            messages=[{"role": "user", "content": query}],
        )
        texts = [
            block.text
            for block in response.content
            if hasattr(block, "text") and block.text is not None
        ]
        return "\n".join(texts) if texts else "未找到相关结果"
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
            "description": "搜索网络信息。返回基于实时搜索的结果摘要。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索查询内容",
                    },
                },
                "required": ["query"],
            },
        },
    ]

    handlers = {
        "web_search": lambda **kw: run_web_search(kw["query"], client, model_id),
    }

    return tools, handlers
