"""从检索工具调用结果提取引用 path（结构化引用卡片的数据源）。

不依赖 AI 正文格式——path 直接从工具 output 提取：
- search_kb / grep：`<path>...</path>`（grep 可能带 `:行号` 后缀，剥掉）
- read_document：首行 `文档: <path>`（错误输出 `文档不存在:` / `文档解析...` 不匹配）
去重保序。这是治本方案：引用可点击性不再依赖 AI 是否守「## 参考资料」格式。
"""
import re
from typing import Any

# 检索类工具（manage_kb 等非检索工具的 output 不含可引用 path，跳过）
_RETRIEVAL_TOOLS = frozenset({"search_kb", "grep", "read_document"})

# search_kb / grep：<path>...</path>（非贪婪，一段 output 可能含多个）
_PATH_TAG_RE = re.compile(r"<path>([^<]+?)</path>")
# grep 行号后缀：末尾 `:数字`（相对路径不含盘符，安全）
_LINE_SUFFIX_RE = re.compile(r":\d+$")
# read_document 成功输出首行 `文档: <path>`；`文档不存在:` / `文档解析...` 不匹配
_DOC_HEADER_RE = re.compile(r"^文档:\s*(.+?)\s*$", re.MULTILINE)


def _clean_path(raw: str) -> str:
    """剥 grep 行号后缀 + 去首尾空白。"""
    return _LINE_SUFFIX_RE.sub("", raw.strip()).strip()


def _extract_paths(name: str, output: str) -> list[str]:
    """按工具类型从 output 提取 path 列表（未去重）。"""
    if name in ("search_kb", "grep"):
        return [_clean_path(m) for m in _PATH_TAG_RE.findall(output)]
    if name == "read_document":
        m = _DOC_HEADER_RE.search(output)
        return [_clean_path(m.group(1))] if m else []
    return []


def extract_references(tool_calls: list[dict[str, Any]]) -> list[dict[str, str]]:
    """从检索工具调用结果提取去重保序的引用 path。

    Args:
        tool_calls: 每项含 ``name`` / ``output``，可选 ``is_error``（True 则跳过）。

    Returns:
        ``[{"path": "rel/path"}, ...]``，按首次出现顺序去重，空 path 过滤。
    """
    seen: set[str] = set()
    refs: list[dict[str, str]] = []
    for tc in tool_calls:
        if tc.get("is_error"):
            continue
        name = tc.get("name", "")
        if name not in _RETRIEVAL_TOOLS:
            continue
        for raw in _extract_paths(name, tc.get("output") or ""):
            path = raw.strip()
            if not path or path in seen:
                continue
            seen.add(path)
            refs.append({"path": path})
    return refs
