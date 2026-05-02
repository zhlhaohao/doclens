"""网络搜索和天气工具

使用 ZhipuAI 获取实时网络信息。
模型 ID 通过配置参数 zhipu_model_id 指定（默认 glm-4）。
"""

import sys
from typing import List, Union, Tuple
from zhipuai import ZhipuAI


def _ensure_utf8(content: str) -> str:
    """在 Windows 上确保 UTF-8 编码"""
    if sys.platform == "win32":
        if isinstance(content, bytes):
            return content.decode("utf-8", errors="replace")
        return content.encode("utf-8", errors="replace").decode(
            "utf-8", errors="replace"
        )
    return content


def run_web_search(
    query: str, zhipu_client: ZhipuAI, search_recency_filter: str = "noLimit"
) -> str:
    """
    直接调用 web_search API 搜索网络信息（返回原始搜索结果，避免 LLM 幻觉）

    Args:
        query: 搜索查询字符串
        zhipu_client: ZhipuAI 客户端实例
        search_recency_filter: 搜索时间范围（noLimit/oneDay/oneWeek/oneMonth/oneYear）

    Returns:
        搜索结果文本
    """
    if zhipu_client is None:
        return "Error: ZhipuAI 客户端未初始化，请联系管理员配置 ZHIPUAI_API_KEY"
    try:
        response = zhipu_client.web_search.web_search(
            search_query=query,
            search_engine="search_pro",
            count=5,
            search_recency_filter=search_recency_filter,
            content_size="high",
        )
        results = []
        if response.search_result:
            for i, r in enumerate(response.search_result, 1):
                results.append(
                    f"[{i}] {r.title}\n    链接: {r.link}\n    内容: {r.content}"
                )
        return "\n\n".join(results) if results else "未找到相关结果"
    except Exception as e:
        return f"Error: {e}"


def run_chat_search(query: str, zhipu_client: ZhipuAI, model_id: str = "glm-4") -> str:
    """
    使用 ZhipuAI + web_search 工具进行联网搜索并生成总结性回答

    Args:
        query: 搜索查询字符串
        zhipu_client: ZhipuAI 客户端实例
        model_id: ZhipuAI 模型 ID

    Returns:
        模型基于搜索结果生成的回答
    """
    if zhipu_client is None:
        return "Error: ZhipuAI 客户端未初始化，请联系管理员配置 ZHIPUAI_API_KEY"
    try:
        response = zhipu_client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": query}],
            tools=[
                {
                    "type": "web_search",
                    "web_search": {
                        "search_query": query,
                        "search_result": True,
                    },
                }
            ],
        )
        return _ensure_utf8(response.choices[0].message.content)
    except Exception as e:
        return f"Error: {e}"


def make_web_tools(
    zhipu_client: ZhipuAI, zhipu_model_id: str = "glm-4"
) -> Tuple[list, dict]:
    tools = [
        {
            "name": "web_search",
            "description": "搜索网络信息（不包括天气信息）",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索查询内容"},
                    "search_recency_filter": {
                        "type": "string",
                        "enum": ["noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"],
                        "description": "搜索时间范围：noLimit（不限）、oneDay（一天内）、oneWeek（一周内）、oneMonth（一个月内）、oneYear（一年内）",
                        "default": "noLimit",
                    },
                },
                "required": ["query"],
            },
        },
        {
            "name": "chat_search",
            "description": "联网搜索并生成总结性回答",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索查询内容"}
                },
                "required": ["query"],
            },
        },
    ]

    handlers = {
        "web_search": lambda **kw: run_web_search(
            kw["query"], zhipu_client, kw.get("search_recency_filter", "noLimit")
        ),
        "chat_search": lambda **kw: run_chat_search(
            kw["query"], zhipu_client, zhipu_model_id
        ),
    }

    return tools, handlers
