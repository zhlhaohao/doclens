"""搜索结果的文件分组与命中行提取（/api/search 与 /api/grep 共用）。

统一窗口模型下节点 snippet 是「节点前 N 行」，命中词未必在其中；
「一行一命中」需要后端对节点文本重新扫描，产出 (行号, 行文本, 命中区间)。
分组单位 = 文件（按最佳命中分排序），分页单位 = 文件数。
"""

from __future__ import annotations

import re
from typing import Callable, Optional

from doclens.web_v2.models.search import FileGroup, MatchItem

# 单行命中文本的显示上限（字符）；超长以首命中为中心截断
MATCH_ROW_MAX_CHARS = 200
# 每文件下发的命中行上限；total_matches 记真实总数，超出置 truncated
MATCHES_PER_FILE_CAP = 50

# 行匹配器：line -> 命中字符区间列表 [(start, end)]（start/end 为该行内偏移）
LineMatcher = Callable[[str], list[tuple[int, int]]]


def build_substring_matchers(words: list[str]) -> list[LineMatcher]:
    """关键词（字面子串，大小写不敏感）匹配器。CJK 词 lower() 无副作用。"""
    matchers = []
    for w in words:
        if not w:
            continue

        def _make(kw: str) -> LineMatcher:
            kw_low = kw.lower()

            def match(line: str) -> list[tuple[int, int]]:
                low = line.lower()
                spans: list[tuple[int, int]] = []
                start = 0
                while kw_low:
                    i = low.find(kw_low, start)
                    if i < 0:
                        break
                    spans.append((i, i + len(kw_low)))
                    start = i + len(kw_low)
                return spans

            return match

        matchers.append(_make(w))
    return matchers


def build_regex_matchers(terms: list[str]) -> list[LineMatcher]:
    """正则词项匹配器（grep）；非法正则退化为字面子串。"""
    matchers = []
    for t in terms:
        if not t:
            continue

        def _make(term: str) -> LineMatcher:
            try:
                pat = re.compile(term, re.IGNORECASE)
            except re.error:
                return build_substring_matchers([term])[0]

            def match(line: str) -> list[tuple[int, int]]:
                return [(m.start(), m.end()) for m in pat.finditer(line)]

            return match

        matchers.append(_make(t))
    return matchers


def _merge_spans(spans: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """合并重叠/相邻命中区间，排序稳定。"""
    if not spans:
        return []
    spans = sorted(spans)
    merged = [list(spans[0])]
    for s, e in spans[1:]:
        if s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged]


def _truncate_row(line: str, spans: list[tuple[int, int]], max_chars: int) -> tuple[str, list[tuple[int, int]]]:
    """超长行以首命中为中心截断，命中区间同步换算到截断后坐标系。"""
    if len(line) <= max_chars:
        return line, spans
    first = spans[0][0] if spans else 0
    last = spans[0][1] if spans else first
    hit_len = last - first
    # 首命中完整入窗，左右均分剩余空间
    room = max(0, max_chars - hit_len)
    cut_start = max(0, first - room // 2)
    cut_end = min(len(line), cut_start + max_chars)
    cut_start = max(0, cut_end - max_chars)  # 尾部不足时回拉起点
    prefix = "…" if cut_start > 0 else ""
    suffix = "…" if cut_end < len(line) else ""
    # span 坐标换算：截断后文本 = prefix + line[cut_start:cut_end] + suffix
    new_spans = []
    for s, e in spans:
        s2, e2 = max(s, cut_start), min(e, cut_end)
        if s2 < e2:
            new_spans.append((s2 - cut_start + len(prefix), e2 - cut_start + len(prefix)))
    return prefix + line[cut_start:cut_end] + suffix, _merge_spans(new_spans)


def extract_match_rows(
    text: str,
    line_start: Optional[int],
    matchers: list[LineMatcher],
    row_max_chars: int = MATCH_ROW_MAX_CHARS,
) -> list[MatchItem]:
    """从节点文本提取命中行。

    行号口径：node.line_start + 行内偏移（节点文本与文件行线性对应；
    rg 合成节点的词窗可能截断首行，行号为近似值——预览侧本就以行区间
    展示，可接受）。line_start 为空时行号置 None（LIKE 源）。
    """
    rows: list[MatchItem] = []
    if not text or not matchers:
        return rows
    for i, ln in enumerate(text.split("\n")):
        spans: list[tuple[int, int]] = []
        for m in matchers:
            spans.extend(m(ln))
        if not spans:
            continue
        merged = _merge_spans(spans)
        display, disp_spans = _truncate_row(ln, merged, row_max_chars)
        rows.append(MatchItem(
            line=(line_start + i) if line_start else None,
            text=display,
            spans=disp_spans,
        ))
    return rows


def extract_like_rows(
    text: str,
    matchers: list[LineMatcher],
    row_max_chars: int = MATCH_ROW_MAX_CHARS,
) -> list[MatchItem]:
    """LIKE 源（无行号）：退化为单行卡——取首个命中行，无命中取首个非空行。"""
    if not text:
        return []
    for ln in text.split("\n"):
        spans: list[tuple[int, int]] = []
        for m in matchers:
            spans.extend(m(ln))
        if spans:
            merged = _merge_spans(spans)
            display, disp_spans = _truncate_row(ln, merged, row_max_chars)
            return [MatchItem(line=None, text=display, spans=disp_spans)]
    first = next((ln for ln in text.split("\n") if ln.strip()), "")
    if not first:
        return []
    display, _ = _truncate_row(first, [], row_max_chars)
    return [MatchItem(line=None, text=display, spans=[])]


def group_and_paginate(
    items: list[tuple[str, float, list[MatchItem]]],
    offset: int,
    limit: int,
    path_items: Optional[list[tuple[str, float, list[MatchItem]]]] = None,
) -> tuple[list[FileGroup], int, int, int]:
    """把 (path, score, rows) 项按文件分组、排序、分页。

    items: 内容命中（kind=content）；path_items: 路径命中（kind=path，
    仅当该文件无内容命中时才单独成组——文件组内已有内容命中时路径
    命中不再重复出现）。
    返回 (page, total_files, total_matches, safe_offset)。
    """
    groups: dict[str, dict] = {}
    for path, score, rows in items:
        g = groups.get(path)
        if g is None:
            g = {"best": 0.0, "rows": [], "total": 0, "kind": "content"}
            groups[path] = g
        g["best"] = max(g["best"], score)
        g["rows"].extend(rows)
        g["total"] += len(rows)

    path_groups: list[tuple[str, float, list[MatchItem]]] = []
    for path, score, rows in path_items or []:
        if path in groups:
            continue  # 已有内容命中的文件不重复入组
        path_groups.append((path, score, rows))

    def _build(path: str, g: dict) -> FileGroup:
        # 组内排序：有行号按行号升序；无行号稳定殿后（保持原相对顺序）。
        # 容错：rows 可能混入裸 dict（调用方手拼占位行）——统一取值。
        rows = [
            r if isinstance(r, MatchItem) else MatchItem(**r)
            for r in g["rows"]
        ]
        indexed = sorted(
            range(len(rows)),
            key=lambda i: (rows[i].line is None, rows[i].line or 0),
        )
        rows = [rows[i] for i in indexed]
        total = g["total"]
        return FileGroup(
            path=path,
            best_score=round(g["best"], 4),
            total_matches=total,
            matches=rows[:MATCHES_PER_FILE_CAP],
            kind=g["kind"],
            truncated=total > MATCHES_PER_FILE_CAP,
        )

    file_groups = [_build(p, g) for p, g in groups.items()]
    # 内容组按最佳命中分降序；路径组（无分数语义）稳定排在内容组之后
    file_groups.sort(key=lambda fg: -fg.best_score)
    file_groups.extend(_build(p, {"best": s, "rows": r, "total": len(r), "kind": "path"}) for p, s, r in path_groups)

    total_files = len(file_groups)
    total_matches = sum(fg.total_matches for fg in file_groups)
    safe_offset = min(offset, max(0, total_files - 1)) if total_files > 0 else 0
    page = file_groups[safe_offset: safe_offset + limit]
    return page, total_files, total_matches, safe_offset
