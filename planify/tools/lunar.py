"""农历、节气、节日计算模块

使用 borax 库计算农历、节气和节日信息。
"""

from datetime import datetime, date

from borax.calendars.lunardate import LunarDate

# 节气表（每年固定日期，基于回归年）
SOLAR_TERMS = [
    ("小寒", 1, 5), ("大寒", 1, 20),
    ("立春", 2, 4), ("雨水", 2, 19),
    ("惊蛰", 3, 5), ("春分", 3, 20),
    ("清明", 4, 4), ("谷雨", 4, 20),
    ("立夏", 5, 5), ("小满", 5, 21),
    ("芒种", 6, 5), ("夏至", 6, 21),
    ("小暑", 7, 7), ("大暑", 7, 22),
    ("立秋", 8, 7), ("处暑", 8, 23),
    ("白露", 9, 7), ("秋分", 9, 23),
    ("寒露", 10, 8), ("霜降", 10, 23),
    ("立冬", 11, 7), ("小雪", 11, 22),
    ("大雪", 12, 7), ("冬至", 12, 21),
]

# 固定节日（月份-日期: 名称）
FIXED_FESTIVALS = {
    (1, 1): "元旦",
    (2, 14): "情人节",
    (3, 8): "妇女节",
    (3, 12): "植树节",
    (4, 1): "愚人节",
    (5, 1): "劳动节",
    (5, 4): "青年节",
    (6, 1): "儿童节",
    (7, 1): "建党节",
    (8, 1): "建军节",
    (9, 10): "教师节",
    (10, 1): "国庆节",
    (12, 25): "圣诞节",
}


def _parse_date(date_str: str) -> date:
    """解析日期字符串"""
    if isinstance(date_str, date):
        return date_str
    if isinstance(date_str, datetime):
        return date_str.date()
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def get_lunar_string(date_str: str) -> str:
    """
    获取指定日期的农历月日字符串

    Args:
        date_str: 日期字符串，格式为 YYYY-MM-DD

    Returns:
        农历月日字符串，如"三月初八"
    """
    try:
        d = _parse_date(date_str)
    except (ValueError, TypeError):
        return ""

    try:
        ld = LunarDate.from_solar_date(d.year, d.month, d.day)
        # cn_md 包含完整的农历月日，如"二月廿八"
        return ld.cn_md
    except Exception:
        return ""


def get_lunar_info_full(date_str: str) -> dict:
    """
    获取指定日期的完整农历信息

    Args:
        date_str: 日期字符串，格式为 YYYY-MM-DD

    Returns:
        包含 lunar_month, lunar_day, gan_zhi (干支) 的字典
    """
    try:
        d = _parse_date(date_str)
    except (ValueError, TypeError):
        return {}

    try:
        ld = LunarDate.from_solar_date(d.year, d.month, d.day)
        return {
            "lunar_month": ld.month,
            "lunar_day": ld.day,
            "gan_zhi": ld.strftime("%G"),
            "lunar_string": ld.strftime("%L%M"),
        }
    except Exception:
        return {}


def get_solar_term(date_str: str) -> str:
    """
    获取指定日期的节气名称

    Args:
        date_str: 日期字符串，格式为 YYYY-MM-DD

    Returns:
        节气名称，如"谷雨"，无节气则返回空字符串
    """
    try:
        d = _parse_date(date_str)
    except (ValueError, TypeError):
        return ""

    month = d.month
    day = d.day

    for term_name, term_month, term_day in SOLAR_TERMS:
        if month == term_month and abs(day - term_day) <= 1:
            return term_name

    return ""


def get_festival(date_str: str) -> str:
    """
    获取指定日期的节日名称

    Args:
        date_str: 日期字符串，格式为 YYYY-MM-DD

    Returns:
        节日名称，如"国庆节"，无节日则返回空字符串
    """
    try:
        d = _parse_date(date_str)
    except (ValueError, TypeError):
        return ""

    return FIXED_FESTIVALS.get((d.month, d.day), "")


def get_lunar_info(date_str: str) -> str:
    """
    获取指定日期的完整农历信息（农历月日、节气、节日）

    Args:
        date_str: 日期字符串，格式为 YYYY-MM-DD

    Returns:
        农历信息字符串，如"三月十八 谷雨"或"正月十五 元宵节"
    """
    lunar = get_lunar_string(date_str)
    term = get_solar_term(date_str)
    festival = get_festival(date_str)

    parts = []
    if lunar:
        parts.append(lunar)
    if term:
        parts.append(term)
    elif festival:
        parts.append(festival)

    return " ".join(parts) if parts else ""


if __name__ == "__main__":
    # 测试
    test_dates = ["2026-04-15", "2026-04-20", "2026-10-01", "2026-02-14", "2026-01-29"]
    for d in test_dates:
        lunar = get_lunar_string(d)
        term = get_solar_term(d)
        festival = get_festival(d)
        info = get_lunar_info(d)
        full = get_lunar_info_full(d)
        print(f"{d}: lunar={lunar}, term={term}, festival={festival}, info={info}, full={full}")
