"""把 treesearch Document.structure 合成为 markdown 字符串。

供 /api/preview 在二进制文档（pdf/docx/xlsx/csv）场景下使用：
DB 里已存结构化树，本模块把它拍平为 md 字符串，复用前端 <md-viewer> 渲染。
"""
import re
from typing import Any, Iterable

# 后缀 → 渲染分支的 source_type 判断键
_TABLE_SOURCE_TYPES = frozenset({"csv", "excel"})

_COLS_RE = re.compile(r"^Columns:\s*(.+)$")


def render_tree_to_md(structure: Any, source_type: str) -> tuple[str, dict[int, int]]:
    """把 Document.structure（list 或 dict）合成为 markdown 字符串。

    Args:
        structure: treesearch 的树结构根节点列表（或单根 dict）。
        source_type: Document.source_type，决定节点 text 走段落还是 table。

    Returns:
        (md_str, line_map):
        - md_str: 合成的 markdown 源字符串。
        - line_map: {node.line_start: heading 在 md 中的实际行号(1-indexed)}。
          二进制文档的 node.line_start 是原始解析体系（docx 段落索引/pdf 行号），
          与合成 md 的行号体系不一致（body 段落用 \\n\\n 分段会膨胀行数）。
          前端 <md-viewer> 的 data-source-line 基于 md 实际行号，因此需要
          此映射把搜索结果的 r.line(=node.line_start) 换算成 md 实际行号，
          才能正确定位到对应 heading。
    """
    out: list[str] = []
    line_map: dict[int, int] = {}
    roots: Iterable[dict]
    if isinstance(structure, dict):
        roots = [structure]
    elif isinstance(structure, list):
        roots = structure
    else:
        return "", {}
    for root in roots:
        _emit_node(out, root, depth=0, source_type=source_type, line_map=line_map)
    return "\n".join(out), line_map


def _emit_node(
    out: list[str],
    node: dict,
    depth: int,
    source_type: str,
    line_map: dict[int, int],
) -> None:
    """DFS 把单个节点输出为 heading + body。"""
    line_start = node.get("line_start") or 1
    title = node.get("title", "") or ""
    text = node.get("text") or ""
    children = node.get("nodes") or []

    # 行号对齐：填白让 heading 出现在第 line_start 行（1-indexed）
    while len(out) + 1 < line_start:
        out.append("")

    # PDF 目录项：降级为普通段落，避免与正文 heading 重复渲染
    if _is_toc_entry(title, text):
        body = _strip_trailing_pagenum(title)
        if body:
            out.append("")
            out.append(body)
            out.append("")
        for child in children:
            _emit_node(out, child, depth + 1, source_type=source_type, line_map=line_map)
        return

    # PDF 列表项（被 indexer 误识别为顶级章节）：降级为有序列表项
    m_list = _RE_LIST_ITEM.match(title.strip()) if title else None
    if m_list:
        _emit_list_item(out, title, text, m_list, children, depth, source_type, line_map)
        return

    level = min(depth + 1, 6)  # md 只有 h1-h6
    out.append("#" * level + " " + title)
    # 记录 heading 实际所在的 md 行号（1-indexed），供前端定位。
    # key 用 node.line_start（与搜索结果 r.line 同源），value 为 md 实际行号。
    line_map[line_start] = len(out)

    # csv 根节点：聚合子节点，table 块负责，短路递归避免重复 heading
    if source_type == "csv" and children and text.lstrip().startswith("Columns:"):
        _emit_table_block(out, text, children, source_type)
        return

    if source_type in _TABLE_SOURCE_TYPES:
        _emit_table_block(out, text, children, source_type)
    elif text:
        body = _strip_leading_title(text, title)
        if body:
            out.append("")
            out.extend(body.split("\n"))
            out.append("")

    for child in children:
        _emit_node(out, child, depth + 1, source_type=source_type, line_map=line_map)


# PDF 目录项模式：章节号 + 内容 + 末尾页码，如 "1.1 Definition and Scope of Deep Research 4"
_RE_TOC_ENTRY = re.compile(r"^\d+(?:\.\d+)*\.?\s+\S.*\s+\d+\s*$")


def _is_toc_entry(title: str, text: str) -> bool:
    """识别 PDF 目录项节点。

    TOC 行特征（双重条件，避免误判正文 heading）：
    1. title 形如 '1.1 Foo Bar 4'（章节号 + 内容 + 末尾页码）
    2. text 为空，或 text 的每一行都符合 TOC 模式（indexer 有时会把
       连续多个 TOC 行合并到同一个节点的 text 里）

    正文章节节点的 text 含 title + 多段正文，第二行起就不是 TOC 模式，
    被条件 2 排除。
    """
    if not title or not _RE_TOC_ENTRY.match(title.strip()):
        return False
    text_clean = (text or "").strip()
    if not text_clean:
        return True
    for line in text_clean.split("\n"):
        if line.strip() and not _RE_TOC_ENTRY.match(line.strip()):
            return False
    return True


def _strip_trailing_pagenum(s: str) -> str:
    """剥除字符串末尾的孤立数字（页码）。"""
    return _TRAILING_NUM_RE.sub("", s).strip()


# PDF 列表项模式：(N) 后跟内容，如 "(1) Intelligent Knowledge Discovery: ..."
_RE_LIST_ITEM = re.compile(r"^\((?P<num>\d+)\)\s+(?P<body>\S.*)$")


def _emit_list_item(
    out: list[str],
    title: str,
    text: str,
    m: re.Match,
    children: list,
    depth: int,
    source_type: str,
    line_map: dict[int, int],
) -> None:
    """把 (N) 开头的列表项节点渲染为 markdown 有序列表项。

    indexer 把 PDF 列表项识别为顶级章节节点（与父章节同级），渲染为 # heading
    会导致 "(1) Foo" 和 "1.1 Foo" 并列为 H1。本函数把它降级为 markdown 有序列表项
    "N. body"，并处理 PDF 行尾续接 + 连字符断词：
      - title 末尾是连字符（如 'lan-'）→ 与 text 首行直接拼接（'language'）
      - 否则用空格续接（'pattern' + ' ' + 'recognition'）

    text 剩余内容（多段正文）以缩进段落保留。
    """
    num = m.group("num")
    body = m.group("body").strip()

    # 剥除 text 首行（title 重复）后的内容
    body_text = _strip_leading_title(text, title)

    rest = ""
    if body_text:
        lines = body_text.split("\n")
        # 找第一个非空行作为续接
        i = 0
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i < len(lines):
            cont = lines[i].strip()
            # 连字符断词：去 - 直接拼；否则空格续接
            if body.endswith("-"):
                body = body[:-1] + cont
            else:
                body = f"{body} {cont}"
            rest = "\n".join(lines[i + 1 :]).strip()

    out.append(f"{num}. {body}")
    if rest:
        out.append("")
        out.extend(rest.split("\n"))
        out.append("")

    for child in children or []:
        _emit_node(out, child, depth + 1, source_type=source_type, line_map=line_map)


# 标题尾部页码/行号：如 "Introduction 12" / "2.1 Foundation... 7"
_TRAILING_NUM_RE = re.compile(r"\s+\d+\s*$")


def _normalize_title(s: str) -> str:
    """归一化标题用于相似性比较：
    - 去除 markdown # 前缀
    - strip 空白
    - 去除尾随数字（页码/行号，如 "Introduction 12" → "Introduction"）
    """
    return _TRAILING_NUM_RE.sub("", s.strip().lstrip("#").strip())


def _strip_leading_title(text: str, title: str) -> str:
    """剥除 text 第一行如果它与 title 归一化后相等。

    修复 indexer 把 heading 行同时塞进 node.text 首行导致的 title 重复显示：
    原 text="2.1 Foundation...\\n\\n<正文>" + 渲染时已输出 "# 2.1 Foundation..."
    → 剥掉首行后只保留 <正文>。

    若 text 不以 title 开头则原样返回，避免误剥。
    """
    if not title.strip():
        return text.strip()
    lines = text.split("\n")
    if not lines or _normalize_title(lines[0]) != _normalize_title(title):
        return text.strip()
    return "\n".join(lines[1:]).strip()


def _emit_table_block(
    out: list[str],
    text: str,
    children: list[dict],
    source_type: str,
) -> None:
    """csv/xlsx: text 解析为 md table。

    - xlsx: text 自带 header + 所有数据行（单节点自包含）
    - csv:  text 只有 header，数据在 level-2 子节点 text 里，需聚合
    """
    body_lines = text.split("\n") if text else []

    # csv 根节点聚合所有子节点 text
    if source_type == "csv" and children:
        body_lines = body_lines + [
            line
            for c in children
            for line in (c.get("text") or "").split("\n")
            if line.strip()
        ]

    if not body_lines or not body_lines[0].strip():
        return

    m = _COLS_RE.match(body_lines[0].strip())
    if not m:
        # 退化兜底：text 不匹配 Columns 模式 → 段落输出，不阻塞渲染
        out.append("")
        out.extend(body_lines)
        out.append("")
        return

    headers = [h.strip() for h in m.group(1).split(",") if h.strip()]
    out.append("")
    out.append("| " + " | ".join(headers) + " |")
    out.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row_line in body_lines[1:]:
        if not row_line.strip():
            continue
        cells = _parse_kv_row(row_line)
        out.append("| " + " | ".join(_escape_md_cell(cells.get(h, "")) for h in headers) + " |")
    out.append("")


def _parse_kv_row(line: str) -> dict[str, str]:
    """把 'h: v; h: v' 解析成 dict；缺失列留空。

    例：'a: 1; b: 2' → {'a': '1', 'b': '2'}
    """
    result: dict[str, str] = {}
    for pair in line.split(";"):
        if ":" not in pair:
            continue
        k, v = pair.split(":", 1)
        result[k.strip()] = v.strip()
    return result


def _escape_md_cell(s: str) -> str:
    """md table 单元格转义：| → \\|，换行 → 空格，回车删除。"""
    return s.replace("|", "\\|").replace("\n", " ").replace("\r", "")
