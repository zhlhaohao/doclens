"""从检索工具调用结果提取引用 path（结构化引用卡片的数据源）。

不依赖 AI 正文格式——path 直接从工具 output 提取：
- search_kb / grep：`<path>...</path>`（grep 可能带 `:行号` 后缀，剥掉）
- read_document：首行 `文档: <path>`（错误输出 `文档不存在:` / `文档解析...` 不匹配）
去重保序。这是治本方案：引用可点击性不再依赖 AI 是否守「## 参考资料」格式。
"""
import re
from pathlib import Path
from typing import Any

# 检索类工具（manage_kb 等非检索工具的 output 不含可引用 path，跳过）。
# 公开供 refs_retry.evaluate_round 复用，避免两处定义漂移。
RETRIEVAL_TOOLS = frozenset({"search_kb", "grep", "read_document"})

# search_kb / grep：<path>...</path>（非贪婪，一段 output 可能含多个）
_PATH_TAG_RE = re.compile(r"<path>([^<]+?)</path>")
# search_kb / grep 的 <result> 条目：path + 对应 content 片段（DOTALL 跨行）。
# search_kb 的 path 在 <meta> 内、content 在其后；grep 的 path 带可选 :行号 后缀。
_RESULT_SNIP_RE = re.compile(
    r"<result\b.*?<path>([^<]+?)</path>.*?<content>(.*?)</content>", re.DOTALL
)
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
        if name not in RETRIEVAL_TOOLS:
            continue
        for raw in _extract_paths(name, tc.get("output") or ""):
            path = raw.strip()
            if not path or path in seen:
                continue
            seen.add(path)
            refs.append({"path": path})
    return refs


def extract_paths_by_tool(
    tool_calls: list[dict[str, Any]], workdir: Path
) -> dict[str, list[str]]:
    """按工具类型分组提取归一化 path（各组内去重保序）。

    供 refs_curator 分级兜底用：read_document（AI 主动深读）相关性信号强于
    search_kb/grep 命中，需分组以便排序。path 统一为相对 workdir 的正斜杠形式。
    """
    by_tool: dict[str, list[str]] = {}
    for tc in tool_calls:
        if tc.get("is_error"):
            continue
        name = tc.get("name", "")
        if name not in RETRIEVAL_TOOLS:
            continue
        paths = normalize_paths(_extract_paths(name, tc.get("output") or ""), workdir)
        group = by_tool.setdefault(name, [])
        for p in paths:
            if p not in group:
                group.append(p)
    return by_tool


def extract_snippets_by_path(
    tool_calls: list[dict[str, Any]], workdir: Path
) -> dict[str, list[str]]:
    """提取每个 path 对应的内容片段（供 refs_curator 内容佐证评分）。

    - search_kb / grep：``<result>`` 条目内 ``<content>`` 片段（path 归一化，
      grep 的 ``:行号`` 后缀剥掉；同 path 多条目合并为多个片段）
    - read_document：整个 output 作为该 path 的片段
    path 统一为相对 workdir 的正斜杠形式。
    """
    snippets: dict[str, list[str]] = {}
    for tc in tool_calls:
        if tc.get("is_error"):
            continue
        name = tc.get("name", "")
        output = tc.get("output") or ""
        if name in ("search_kb", "grep"):
            for m in _RESULT_SNIP_RE.finditer(output):
                path = to_relative_path(_clean_path(m.group(1)), workdir)
                snippet = m.group(2).strip()
                if path and snippet:
                    snippets.setdefault(path, []).append(snippet)
        elif name == "read_document":
            m = _DOC_HEADER_RE.search(output)
            if m:
                path = to_relative_path(_clean_path(m.group(1)), workdir)
                if path and output.strip():
                    snippets.setdefault(path, []).append(output)
    return snippets


def validate_paths(paths: list[str], workdir: Path) -> list[str]:
    """返回 workdir 下不存在的路径子集（首次出现顺序，去重）。

    Args:
        paths: 待校验的相对路径列表。
        workdir: 知识库根目录，path 相对它解析。

    Returns:
        不存在的路径列表（去重保序）。空列表表示全部存在。
    """
    seen: set[str] = set()
    missing: list[str] = []
    for raw in paths:
        path = raw.strip()
        if not path or path in seen:
            continue
        seen.add(path)
        if not (workdir / path).exists():
            missing.append(path)
    return missing


def to_relative_path(path: str, workdir: Path) -> str:
    """转绝对/反斜杠路径为相对 workdir 的正斜杠路径。

    search_kb/grep/read_document 返回的 path 可能是绝对路径或反斜杠分隔（Windows），
    统一转为相对 workdir 的正斜杠 —— 否则 marked 会把 ``\\`` 当转义符吃掉，
    导致前端 data-path 损坏、点击打不开。
    """
    try:
        p = Path(path)
        if p.is_absolute():
            return str(p.relative_to(workdir)).replace("\\", "/")
    except ValueError:
        # 绝对路径不在 workdir 下：降级为仅替换斜杠
        pass
    return str(path).replace("\\", "/")


def normalize_paths(paths: list[str], workdir: Path) -> list[str]:
    """normalize 为相对正斜杠 + 去重保序。

    工具结果可能用绝对/相对、正/反斜杠混指同一文件（如 read_document 返回绝对、
    search_kb 返回相对），统一为相对 workdir 的正斜杠路径并去重，避免 marked 转义
    + 重复展示。
    """
    seen: set[str] = set()
    result: list[str] = []
    for p in paths:
        rel = to_relative_path(p, workdir)
        if rel and rel not in seen:
            seen.add(rel)
            result.append(rel)
    return result
