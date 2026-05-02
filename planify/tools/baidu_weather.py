"""百度天气 API 调用模块

调用百度地图天气 API 获取城市天气信息。
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple

import httpx

from .lunar import get_lunar_info

logger = logging.getLogger(__name__)

# 百度天气 API 配置（从环境变量读取）
BAIDU_WEATHER_API_URL = os.getenv(
    "BAIDU_WEATHER_API_URL",
    "https://api.map.com.com/weather/v2/"
)
BAIDU_WEATHER_AK = os.getenv("BAIDU_WEATHER_AK", "")
BAIDU_WEATHER_DATA_TYPE = os.getenv("BAIDU_WEATHER_DATA_TYPE", "fc")


# 天气预报查询范围（天内）
WEATHER_FORECAST_DAYS = 5

# 相对日期映射
RELATIVE_DATE_MAP = {
    "今天": 0,
    "明天": 1,
    "后天": 2,
    "大后天": 3,
}


def parse_date_input(date_input: str) -> Tuple[Optional[str], Optional[str]]:
    """
    解析日期输入，支持自然语言和标准格式

    Args:
        date_input: 日期输入，如"今天"、"明天"、"2026-04-15"

    Returns:
        (标准日期字符串 YYYY-MM-DD, 错误信息)
        如果解析成功，错误信息为 None
        如果解析失败，日期字符串为 None
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # 清理输入
    date_input = date_input.strip()

    # 检查是否是相对日期
    if date_input in RELATIVE_DATE_MAP:
        days_offset = RELATIVE_DATE_MAP[date_input]
        target_date = today + timedelta(days=days_offset)

        # 检查是否在 5 天范围内
        if days_offset >= WEATHER_FORECAST_DAYS:
            return (
                None,
                f"天气预报仅支持查询 {WEATHER_FORECAST_DAYS} 天内的数据，无法查询「{date_input}」的天气",
            )

        return target_date.strftime("%Y-%m-%d"), None

    # 尝试解析标准日期格式 YYYY-MM-DD
    try:
        parsed = datetime.strptime(date_input, "%Y-%m-%d")
        days_diff = (parsed.date() - today.date()).days

        # 检查是否在 5 天范围内
        if days_diff < 0:
            return None, f"「{date_input}」是过去日期，天气预报无法查询历史天气"
        if days_diff >= WEATHER_FORECAST_DAYS:
            return (
                None,
                f"天气预报仅支持查询 {WEATHER_FORECAST_DAYS} 天内的数据，「{date_input}」超出范围",
            )

        return date_input, None
    except ValueError:
        pass

    # 尝试解析短格式日期
    patterns = [
        r"^(\d{1,2})月(\d{1,2})[日号]?$",  # 4月15日、4月15号
        r"^(\d{1,2})-(\d{1,2})$",  # 4-15
        r"^(\d{1,2})/(\d{1,2})$",  # 4/15
    ]

    for pattern in patterns:
        match = re.match(pattern, date_input.strip())
        if match:
            month = int(match.group(1))
            day = int(match.group(2))

            # 验证月份和日期
            if month < 1 or month > 12 or day < 1 or day > 31:
                continue

            try:
                # 优先使用今年的日期
                candidates = [
                    datetime(today.year, month, day),
                    datetime(today.year - 1, month, day),
                    datetime(today.year + 1, month, day),
                ]

                # 选择距离今天最近的候选日期
                best = None
                best_diff = float("inf")
                for c in candidates:
                    diff = (c.date() - today.date()).days
                    if abs(diff) < abs(best_diff):
                        best_diff = diff
                        best = c

                if best is None:
                    continue

                # 检查范围
                days_diff = (best.date() - today.date()).days
                if days_diff < 0:
                    return None, f"「{date_input}」是过去日期，天气预报无法查询历史天气"
                if days_diff >= WEATHER_FORECAST_DAYS:
                    return (
                        None,
                        f"天气预报仅支持查询 {WEATHER_FORECAST_DAYS} 天内的数据，「{date_input}」超出范围",
                    )

                return best.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    # 无法解析
    return (
        None,
        f"无法解析日期「{date_input}」，请使用标准格式（如 2026-04-15）或自然语言（如今天、明天）",
    )


# 天气图标映射
WEATHER_EMOJI = {
    "晴": "☀️",
    "多云": "⛅",
    "阴": "☁️",
    "小雨": "🌧️",
    "中雨": "🌧️",
    "大雨": "🌧️",
    "暴雨": "⛈️",
    "雷阵雨": "⛈️",
    "小雪": "🌨️",
    "中雪": "🌨️",
    "大雪": "❄️",
    "雨夹雪": "🌨️",
    "雾": "🌫️",
    "霾": "🌫️",
    "沙尘暴": "🌪️",
    "雾霾": "🌫️",
    "雷暴": "⛈️",
    "阵雨": "🌦️",
    "冻雨": "🌨️",
    "冰雹": "🧊",
}


def _get_weather_emoji(text: str) -> str:
    """获取天气对应的 emoji"""
    if not text:
        return ""
    # 精确匹配
    if text in WEATHER_EMOJI:
        return WEATHER_EMOJI[text]
    # 模糊匹配
    for key, emoji in WEATHER_EMOJI.items():
        if key in text:
            return emoji
    return ""


# 限流器：3次/秒
_semaphore = asyncio.Semaphore(3)


async def _call_baidu_weather_api(city: str, date_str: str) -> Optional[dict]:
    """
    调用百度地图天气 API

    Args:
        city: 城市名称
        date_str: 日期字符串，格式为 YYYY-MM-DD

    Returns:
        API 返回的原始数据，失败返回 None
    """
    api_url = BAIDU_WEATHER_API_URL
    ak = BAIDU_WEATHER_AK
    data_type = BAIDU_WEATHER_DATA_TYPE

    if not api_url or not ak:
        return None

    params = {
        "district": city,
        "ak": ak,
        "date": date_str,
        "data_type": data_type or "fc",
    }

    async with _semaphore:
        try:
            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                response = await client.get(api_url, params=params)
                response.raise_for_status()
                result = response.json()
                # 记录原始响应
                logger.info(
                    f"百度天气API请求: city={city}, date={date_str}, "
                    f"response_status={result.get('status')}, "
                    f"response={json.dumps(result, ensure_ascii=False)[:500]}"
                )
                return result
        except Exception as e:
            logger.warning(
                f"百度天气API请求失败: city={city}, date={date_str}, error={e}"
            )
            return None


def _parse_weather_response(data: dict, city: str, date_str: str) -> dict:
    """
    解析百度天气 API 响应

    Args:
        data: API 返回的原始数据
        city: 城市名称
        date_str: 日期字符串

    Returns:
        解析后的天气信息字典
    """
    if not data or data.get("status") != 0:
        return {
            "day": _format_day(date_str),
            "weekday": _get_weekday(date_str),
            "lunar": get_lunar_info(date_str),
            "weather": "获取天气失败，原因可能是地点存在歧义，例如「中山」可能是中山市或中山区 - 优先选择中山市",
            "weather_other": "",
        }

    result = data.get("result", {})
    location = result.get("location", {})
    forecasts = result.get("forecasts", [])

    city_name = location.get("name", city)
    province = location.get("province", "")

    # 查找目标日期的预报
    forecast = None
    for f in forecasts:
        if f.get("date") == date_str:
            forecast = f
            break

    if not forecast and forecasts:
        # 如果没有精确匹配，取第一天的预报
        forecast = forecasts[0]

    if not forecast:
        return {
            "day": _format_day(date_str),
            "weekday": _get_weekday(date_str),
            "lunar": get_lunar_info(date_str),
            "weather": "获取天气失败，原因可能是地点存在歧义，例如「中山」可能是中山市或中山区 - 优先选择中山市",
            "weather_other": "",
        }

    # 解析预报数据
    weekday = forecast.get("week", _get_weekday(date_str))
    high = forecast.get("high", "")
    low = forecast.get("low", "")
    text_day = forecast.get("text_day", "")
    text_night = forecast.get("text_night", "")
    wd_day = forecast.get("wd_day", "")
    wc_day = forecast.get("wc_day", "")
    wd_night = forecast.get("wd_night", "")
    wc_night = forecast.get("wc_night", "")

    # 格式化温度
    temp_str = ""
    if high and low:
        temp_str = f"{low}-{high}℃"
    elif high:
        temp_str = f"{high}℃"
    elif low:
        temp_str = f"{low}℃"

    # 主天气描述
    weather_main = text_day if text_day else text_night
    if not weather_main:
        weather_main = "未知"
    weather_emoji = _get_weather_emoji(weather_main)

    # 主天气
    wind_main = wd_day if wd_day else wd_night
    wind_level = wc_day if wc_day else wc_night

    weather = f"{weather_emoji}{weather_main}，{temp_str}"
    if city_name:
        weather += f" ({city_name})"
    if wind_main:
        weather += f" {wind_main}"
    if wind_level:
        weather += f" {wind_level}"

    # 次要天气（夜晚）
    weather_other = ""
    if text_night and text_night != text_day:
        weather_other = f"{_get_weather_emoji(text_night)}{text_night}"
        if wd_night:
            weather_other += f" {wd_night}"
        if wc_night:
            weather_other += f" {wc_night}"

    return {
        "day": _format_day(date_str),
        "weekday": weekday,
        "lunar": get_lunar_info(date_str),
        "weather": weather,
        "weather_other": weather_other,
    }


def _format_day(date_str: str) -> str:
    """格式化日期为 月日 格式"""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{d.month}月{d.day}日"
    except (ValueError, TypeError):
        return date_str


def _get_weekday(date_str: str) -> str:
    """获取星期几"""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        weekdays = [
            "星期一",
            "星期二",
            "星期三",
            "星期四",
            "星期五",
            "星期六",
            "星期日",
        ]
        return weekdays[d.weekday()]
    except (ValueError, TypeError):
        return ""


async def get_weather(city: str, date_input: str) -> dict:
    """
    获取城市天气信息

    Args:
        city: 城市名称
        date_input: 日期输入，支持标准格式（YYYY-MM-DD）或自然语言（今天、明天、后天、大后天）

    Returns:
        天气信息字典，包含 day, weekday, lunar, weather, weather_other
    """
    # 解析日期输入
    date_str, error = parse_date_input(date_input)
    if error:
        today = datetime.now()
        return {
            "day": _format_day(today.strftime("%Y-%m-%d")),
            "weekday": _get_weekday(today.strftime("%Y-%m-%d")),
            "lunar": get_lunar_info(today.strftime("%Y-%m-%d")),
            "weather": error,
            "weather_other": "",
        }

    data = await _call_baidu_weather_api(city, date_str)
    return _parse_weather_response(data, city, date_str)


async def get_weather_batch(cities: list, date_str: str) -> list:
    """
    批量获取城市天气信息

    Args:
        cities: 城市名称列表
        date_str: 日期字符串，格式为 YYYY-MM-DD

    Returns:
        天气信息字典列表
    """
    tasks = [get_weather(city, date_str) for city in cities]
    return await asyncio.gather(*tasks)


def format_weather_result(result: dict) -> str:
    """
    格式化天气结果为文本

    Args:
        result: 天气信息字典

    Returns:
        格式化的天气文本
    """
    parts = []
    if result.get("day"):
        parts.append(result["day"])
    if result.get("weekday"):
        parts.append(result["weekday"])
    if result.get("lunar"):
        parts.append(result["lunar"])

    lines = [" ".join(parts)] if parts else []

    if result.get("weather"):
        lines.append(result["weather"])

    if result.get("weather_other"):
        lines.append(result["weather_other"])

    return "\n".join(lines)


if __name__ == "__main__":
    # 测试
    async def test():
        # 注意：需要配置百度天气 API 才能正常测试
        result = await get_weather("广州", "2026-04-15")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print("\n格式化结果:")
        print(format_weather_result(result))

    asyncio.run(test())
