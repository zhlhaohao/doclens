"""百度天气工具

整合 lunar.py 和 baidu_weather.py，提供完整的百度天气查询功能。
包含农历、节气、节日信息。
"""

from typing import List, Tuple

from .baidu_weather import get_weather as baidu_get_weather, format_weather_result
from .lunar import get_lunar_info


# 工具名称常量
BAIDU_WEATHER_TOOL = "baidu_weather"


async def handle_baidu_weather(city: str, date: str) -> str:
    """
    处理百度天气查询请求

    Args:
        city: 城市名称
        date: 日期，支持自然语言（今天、明天、后天、大后天）或标准格式 YYYY-MM-DD

    Returns:
        格式化的天气信息文本
    """
    result = await baidu_get_weather(city, date)
    return format_weather_result(result)


def make_baidu_weather_tools() -> Tuple[List[dict], dict]:
    """
    创建百度天气工具定义和处理器

    Returns:
        (工具定义列表, 处理器字典)
    """
    tools = [
        {
            "name": BAIDU_WEATHER_TOOL,
            "description": "查询城市天气信息，返回农历、节气、节日及天气预报详情。"
            "包含白天和夜晚的天气、风向、风力等信息。"
            "⚠️ 注意：date 参数优先使用自然语言（今天、明天、后天、大后天），避免使用具体日期！"
            "因为具体日期容易产生幻觉，导致查询失败。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如：北京、上海、广州、深圳",
                    },
                    "date": {
                        "type": "string",
                        "description": "日期，优先使用自然语言：今天、明天、后天、大后天。也可使用标准格式 YYYY-MM-DD，但避免使用具体日期以防幻觉。",
                    },
                },
                "required": ["city", "date"],
            },
        },
        {
            "name": "lunar_info",
            "description": "查询指定日期的农历信息，包括农历月日、节气、节日等",
            "input_schema": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "日期，优先使用自然语言（今天、明天等）或标准格式 YYYY-MM-DD",
                    },
                },
                "required": ["date"],
            },
        },
    ]

    handlers = {
        BAIDU_WEATHER_TOOL: lambda **kw: _wrap_async(
            handle_baidu_weather, kw["city"], kw["date"]
        ),
        "lunar_info": lambda **kw: get_lunar_info(kw["date"]),
    }

    return tools, handlers


def _wrap_async(func, *args, **kwargs):
    """包装异步函数为同步函数（用于非异步上下文）"""
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # 如果事件循环正在运行，创建协程
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, func(*args, **kwargs))
                return future.result()
        else:
            return loop.run_until_complete(func(*args, **kwargs))
    except RuntimeError:
        # 没有事件循环，创建新的
        return asyncio.run(func(*args, **kwargs))
