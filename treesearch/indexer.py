# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Async-first document indexer. Builds tree structure from Markdown or plain text.

Supports batch indexing via ``build_index()`` which accepts glob patterns and
processes multiple files concurrently.
"""
import asyncio
import glob as globmod
import json
import logging
import os
import re
from typing import Optional

from .tree import (
    Document, assign_node_ids, flatten_tree, format_structure, remove_fields,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Shared helpers
# ============================================================================

def _children_indices(node_list: list[dict], parent_idx: int, parent_level: int) -> list[int]:
    """Return indices of all descendants of node_list[parent_idx]."""
    indices = []
    for j in range(parent_idx + 1, len(node_list)):
        if node_list[j]["level"] <= parent_level:
            break
        indices.append(j)
    return indices


# ============================================================================
# Summary generation (shared by MD and Text)
# ============================================================================

def _summarize_node(node: dict, threshold: int = 200) -> str:
    """Generate a summary for a single node. Short nodes use their own text.

    For long nodes: head 250 chars + tail 100 chars (captures intro and conclusion).
    Uses character-length heuristic (~4 chars/token) to avoid expensive tiktoken calls.
    """
    text = node.get("text", "")
    # ~4 chars per token for English, ~2 for CJK; use 3 as balanced estimate
    if len(text) < threshold * 3:
        return text
    head = text[:250].replace("\n", " ").strip()
    tail = text[-100:].replace("\n", " ").strip()
    return f"{head} ... {tail}"


def generate_summaries(structure, threshold: int = 200):
    """Generate summaries for all nodes in a tree."""
    nodes = flatten_tree(structure)
    summaries = [_summarize_node(n, threshold=threshold) for n in nodes]

    for node, summary in zip(nodes, summaries):
        if node.get("nodes"):
            node["prefix_summary"] = summary
        else:
            node["summary"] = summary
    return structure


def generate_doc_description(structure) -> str:
    """Generate a document description from its tree structure (no LLM).

    Extracts top-level titles and first substantial text paragraph.
    """
    nodes = flatten_tree(structure)
    titles = [n.get("title", "") for n in nodes if n.get("title")][:5]
    title_str = " > ".join(titles)
    text = ""
    for n in nodes:
        t = n.get("text", "")
        if t and len(t) > 20:
            text = t[:200]
            break
    return f"{title_str}. {text}" if text else title_str


def _finalize_tree(
    tree,
    doc_name: str,
    source_path: str = "",
    source_type: str = "",
    *,
    if_add_node_id: bool = True,
    if_add_node_summary: bool = True,
    summary_token_threshold: int = 200,
    if_add_node_text: bool = False,
    if_add_doc_description: bool = False,
) -> dict:
    """Common post-processing for all *_to_tree functions.

    Steps: assign_node_ids -> format_structure -> generate_summaries -> doc_description.
    """
    if if_add_node_id:
        assign_node_ids(tree)

    base_order = ["title", "node_id", "summary", "prefix_summary"]
    text_fields = ["text"] if if_add_node_text or if_add_node_summary else []
    tail_fields = ["line_start", "line_end", "nodes"]
    order = base_order + text_fields + tail_fields

    tree = format_structure(tree, order=order)

    if if_add_node_summary:
        logger.info("Generating summaries...")
        tree = generate_summaries(tree, threshold=summary_token_threshold)
        if not if_add_node_text:
            order_no_text = [f for f in order if f != "text"]
            tree = format_structure(tree, order=order_no_text)

    result = {"doc_name": doc_name, "structure": tree}
    if source_path:
        result["source_path"] = source_path
    if source_type:
        result["source_type"] = source_type

    if if_add_doc_description:
        logger.info("Generating document description...")
        result["doc_description"] = generate_doc_description(tree)

    return result


# ============================================================================
# Markdown indexer
# ============================================================================

def _extract_md_headings(content: str) -> tuple[list[dict], list[str]]:
    """Extract heading markers from Markdown content."""
    header_re = re.compile(r"^(#{1,6})\s+(.+)$")
    code_fence = re.compile(r"^```")
    markers = []
    lines = content.split("\n")
    in_code = False

    for num, line in enumerate(lines, 1):
        stripped = line.strip()
        if code_fence.match(stripped):
            in_code = not in_code
            continue
        if in_code or not stripped:
            continue
        m = header_re.match(stripped)
        if m:
            markers.append({
                "title": m.group(2).strip(),
                "line_num": num,
                "level": len(m.group(1)),
            })
    return markers, lines


def _cut_md_text(markers: list[dict], lines: list[str]) -> list[dict]:
    """Cut text content between headings."""
    nodes = []
    for i, mk in enumerate(markers):
        start = mk["line_num"] - 1
        end = markers[i + 1]["line_num"] - 1 if i + 1 < len(markers) else len(lines)
        nodes.append({
            "title": mk["title"],
            "line_num": mk["line_num"],
            "line_start": mk["line_num"],
            "line_end": end,
            "level": mk["level"],
            "text": "\n".join(lines[start:end]).strip(),
        })
    return nodes


def _update_token_counts(node_list: list[dict]) -> list[dict]:
    """Compute cumulative token counts (self + descendants) for thinning."""
    from .utils import count_tokens
    for i in range(len(node_list) - 1, -1, -1):
        text = node_list[i].get("text", "")
        for ci in _children_indices(node_list, i, node_list[i]["level"]):
            ct = node_list[ci].get("text", "")
            if ct:
                text += "\n" + ct
        node_list[i]["text_token_count"] = count_tokens(text)
    return node_list


def _thin_tree(node_list: list[dict], min_tokens: int) -> list[dict]:
    """Merge small sub-trees into their parent nodes."""
    from .utils import count_tokens
    to_remove = set()
    for i in range(len(node_list) - 1, -1, -1):
        if i in to_remove:
            continue
        if node_list[i].get("text_token_count", 0) < min_tokens:
            children = _children_indices(node_list, i, node_list[i]["level"])
            merged_parts = []
            for ci in sorted(children):
                if ci not in to_remove:
                    ct = node_list[ci].get("text", "")
                    if ct.strip():
                        merged_parts.append(ct)
                    to_remove.add(ci)
            if merged_parts:
                base = node_list[i].get("text", "")
                node_list[i]["text"] = base + "\n\n" + "\n\n".join(merged_parts) if base else "\n\n".join(merged_parts)
                node_list[i]["text_token_count"] = count_tokens(node_list[i]["text"])

    for idx in sorted(to_remove, reverse=True):
        node_list.pop(idx)
    return node_list


def _build_tree(node_list: list[dict]) -> list[dict]:
    """Build hierarchical tree from flat node list using a stack algorithm."""
    if not node_list:
        return []
    stack = []
    roots = []
    counter = 1

    for node in node_list:
        level = node["level"]
        tree_node = {
            "title": node["title"],
            "node_id": str(counter),
            "text": node.get("text", ""),
            "line_start": node.get("line_start", node.get("line_num")),
            "line_end": node.get("line_end"),
            "nodes": [],
        }
        counter += 1

        while stack and stack[-1][1] >= level:
            stack.pop()

        if not stack:
            roots.append(tree_node)
        else:
            stack[-1][0]["nodes"].append(tree_node)

        stack.append((tree_node, level))
    return roots


async def md_to_tree(
    md_path: Optional[str] = None,
    md_content: Optional[str] = None,
    *,
    if_thinning: bool = False,
    min_token_threshold: int = 5000,
    if_add_node_summary: bool = True,
    summary_token_threshold: int = 200,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """
    Build a tree index from a Markdown file or string.

    Returns: {'doc_name': str, 'structure': list, 'doc_description'?: str}
    """
    if md_path and md_content:
        raise ValueError("Specify only one of md_path or md_content")
    if not md_path and not md_content:
        raise ValueError("Must specify md_path or md_content")

    if md_path:
        with open(md_path, "r", encoding="utf-8", errors="replace") as f:
            md_content = f.read()
        doc_name = os.path.splitext(os.path.basename(md_path))[0]
    else:
        doc_name = "untitled"

    logger.info("Extracting headings from markdown...")
    markers, lines = _extract_md_headings(md_content)
    nodes = _cut_md_text(markers, lines)

    if if_thinning and min_token_threshold:
        nodes = _update_token_counts(nodes)
        logger.info("Thinning tree (threshold=%d)...", min_token_threshold)
        nodes = _thin_tree(nodes, min_token_threshold)

    logger.info("Building tree from %d nodes...", len(nodes))
    tree = _build_tree(nodes)

    return _finalize_tree(
        tree, doc_name,
        source_path=os.path.abspath(md_path) if md_path else "",
        if_add_node_id=if_add_node_id,
        if_add_node_summary=if_add_node_summary,
        summary_token_threshold=summary_token_threshold,
        if_add_node_text=if_add_node_text,
        if_add_doc_description=if_add_doc_description,
    )


# ============================================================================
# Plain text indexer
# ============================================================================

# --- Heading detection patterns ---

_RE_NUMERIC = re.compile(r"^(?P<prefix>(?:\d+\.)+\d*)\s+(?P<title>.+)$")
_RE_PAREN_NUM = re.compile(r"^(?:\(?\d+\))\s+(?P<title>.+)$")
_RE_ROMAN = re.compile(r"^(?P<prefix>[IVXLCDM]+)\.\s+(?P<title>.+)$")
_RE_LETTER = re.compile(r"^(?P<prefix>[A-Z])[.)]\s+(?P<title>.+)$")
_RE_CN_SECTION = re.compile(r"^(?:第[一二三四五六七八九十百千万零\d]+[章节篇部])\s*(?P<title>.*)$")
_RE_CN_NUM = re.compile(r"^(?P<prefix>[一二三四五六七八九十百千万零]+)[、.．]\s*(?P<title>.+)$")
_RE_CN_PAREN = re.compile(r"^[（(](?P<prefix>[一二三四五六七八九十百千万零\d]+)[)）]\s*(?P<title>.+)$")
_RE_RST_UNDERLINE = re.compile(r"^[=\-~^+#]{3,}$")
_RE_ALL_CAPS = re.compile(r"^[A-Z][A-Z\s\-:,&/]{2,}$")

_ROMAN_VALID = {
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
}


def _is_short(line: str, limit: int = 80) -> bool:
    return 0 < len(line.strip()) < limit


def _has_blank_neighbor(lines: list, idx: int) -> bool:
    prev_blank = (idx == 0) or (not lines[idx - 1].strip())
    next_blank = (idx >= len(lines) - 1) or (not lines[idx + 1].strip())
    return prev_blank or next_blank


def _detect_headings(lines: list[str]) -> list[dict]:
    """Detect headings from raw text lines using pattern matching."""
    headings = []
    in_code = False

    for idx, raw in enumerate(lines):
        line = raw.strip()
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line:
            continue
        num = idx + 1

        # Chinese chapter/section
        m = _RE_CN_SECTION.match(line)
        if m:
            level = 1 if any(c in line for c in "章篇部") else 2
            headings.append({"title": line, "line_num": num, "level": level})
            continue

        m = _RE_CN_NUM.match(line)
        if m:
            headings.append({"title": line, "line_num": num, "level": 1})
            continue

        m = _RE_CN_PAREN.match(line)
        if m:
            headings.append({"title": line, "line_num": num, "level": 2})
            continue

        # Numeric hierarchical
        m = _RE_NUMERIC.match(line)
        if m:
            level = len(m.group("prefix").rstrip(".").split("."))
            headings.append({"title": line, "line_num": num, "level": level})
            continue

        # Parenthesized number
        m = _RE_PAREN_NUM.match(line)
        if m:
            headings.append({"title": line, "line_num": num, "level": 2})
            continue

        # Roman numeral
        m = _RE_ROMAN.match(line)
        if m and m.group("prefix") in _ROMAN_VALID:
            headings.append({"title": line, "line_num": num, "level": 1})
            continue

        # Letter heading
        m = _RE_LETTER.match(line)
        if m:
            headings.append({"title": line, "line_num": num, "level": 2})
            continue

        # RST underline style
        if idx > 0 and _RE_RST_UNDERLINE.match(line):
            prev = lines[idx - 1].strip()
            if prev and _is_short(prev):
                if not headings or headings[-1]["line_num"] != idx:
                    level = {"=": 1, "-": 2, "~": 3, "^": 4}.get(line[0], 2)
                    headings.append({"title": prev, "line_num": idx, "level": level})
                continue

        # ALL CAPS
        if _RE_ALL_CAPS.match(line) and _is_short(line) and _has_blank_neighbor(lines, idx):
            headings.append({"title": line, "line_num": num, "level": 1})

    return headings


def _preprocess_text(text: str) -> str:
    """Normalize line endings and collapse excessive blank lines."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\f", "\n")
    return re.sub(r"\n{3,}", "\n\n", text)



async def text_to_tree(
    text_path: Optional[str] = None,
    text_content: Optional[str] = None,
    *,
    if_thinning: bool = False,
    min_token_threshold: int = 5000,
    if_add_node_summary: bool = True,
    summary_token_threshold: int = 200,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """
    Build a tree index from plain text (pure rule-based, no LLM).

    Args:
        text_path: path to a .txt file
        text_content: raw text string (alternative to text_path)
    Returns:
        {'doc_name': str, 'structure': list, 'doc_description'?: str}
    """
    if text_path and text_content:
        raise ValueError("Specify only one of text_path or text_content")
    if not text_path and not text_content:
        raise ValueError("Must specify text_path or text_content")

    if text_path:
        with open(text_path, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read()
        doc_name = os.path.splitext(os.path.basename(text_path))[0]
    else:
        raw = text_content
        doc_name = "untitled"

    text = _preprocess_text(raw)
    lines = text.split("\n")
    logger.info("Text loaded: %d lines", len(lines))

    # Step 1: heading detection (pure rule-based)
    headings = _detect_headings(lines)
    markers = [{"title": h["title"], "line_num": h["line_num"], "level": h["level"]} for h in headings]
    logger.info("Rule-based detection: %d headings", len(markers))

    # Fallback: single root node if no headings detected
    if not markers:
        markers = [{"title": doc_name, "line_num": 1, "level": 1}]

    # Step 2: extract text
    nodes = _cut_md_text(markers, lines)

    # Step 3: thinning
    if if_thinning and min_token_threshold:
        nodes = _update_token_counts(nodes)
        logger.info("Thinning tree (threshold=%d)...", min_token_threshold)
        nodes = _thin_tree(nodes, min_token_threshold)

    # Step 4: build tree
    logger.info("Building tree from %d nodes...", len(nodes))
    tree = _build_tree(nodes)

    return _finalize_tree(
        tree, doc_name,
        source_path=os.path.abspath(text_path) if text_path else "",
        if_add_node_id=if_add_node_id,
        if_add_node_summary=if_add_node_summary,
        summary_token_threshold=summary_token_threshold,
        if_add_node_text=if_add_node_text,
        if_add_doc_description=if_add_doc_description,
    )


# ============================================================================
# Code file indexer
# ============================================================================

def _detect_code_headings(lines: list[str], ext: str, source: str = "") -> list[dict]:
    """Detect classes and methods from code lines.

    For ``.py`` files, tries AST-based parsing first (richer signatures),
    falling back to regex if AST fails (e.g. syntax errors).
    """
    # Python: use AST parser for accurate structure extraction
    if ext == ".py" and source:
        from .parsers.ast_parser import parse_python_structure
        headings = parse_python_structure(source)
        if headings:
            return headings
        # AST failed, fall through to regex

    headings = []
    patterns = []
    if ext == ".py":
        patterns = [
            (re.compile(r"^(class\s+\w+.*)"), 1),
            (re.compile(r"^(\s*def\s+\w+.*)"), 2)
        ]
    elif ext in (".java", ".ts", ".js", ".cpp", ".cc", ".cs", ".php"):
        patterns = [
            (re.compile(r"^(\s*(?:public|private|protected|static|abstract|final\s+)*class\s+\w+.*)"), 1),
            (re.compile(r"^(\s*(?:public|private|protected|static|abstract|final\s+)*interface\s+\w+.*)"), 1),
            (re.compile(r"^(\s*(?:public|private|protected|static|abstract|final\s+)*(?:[\w<>\[\]]+\s+)+\w+\s*\(.*)"), 2),
            (re.compile(r"^(\s*function\s+\w+.*)"), 2)
        ]
    elif ext == ".go":
        patterns = [
            (re.compile(r"^(\s*type\s+\w+\s+struct.*)"), 1),
            (re.compile(r"^(\s*type\s+\w+\s+interface.*)"), 1),
            (re.compile(r"^(\s*func\s+(?:\([^)]+\)\s+)?\w+.*)"), 2)
        ]
    elif ext == ".html":
        patterns = [
            (re.compile(r"^\s*<h1.*>(.*)</h1>"), 1),
            (re.compile(r"^\s*<h2.*>(.*)</h2>"), 2),
            (re.compile(r"^\s*<h3.*>(.*)</h3>"), 3),
            (re.compile(r"^\s*<div.*id=\"(.*)\".*>"), 2),
            (re.compile(r"^\s*<section.*id=\"(.*)\".*>"), 2)
        ]
    elif ext == ".xml":
        patterns = [
            (re.compile(r"^\s*<(\w+).*>\s*$"), 1),
        ]

    if not patterns:
        return []

    for idx, raw in enumerate(lines):
        line = raw.rstrip()
        if not line:
            continue
        num = idx + 1

        for pat, level in patterns:
            m = pat.match(line)
            if m:
                title = m.group(1).strip().rstrip(":{").strip()[:100]
                headings.append({"title": title, "line_num": num, "level": level})
                break

    return headings


async def code_to_tree(
    code_path: str,
    *,
    if_thinning: bool = False,
    min_token_threshold: int = 5000,
    if_add_node_summary: bool = True,
    summary_token_threshold: int = 200,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """
    Build a tree index from a code file.

    Returns:
        {'doc_name': str, 'structure': list, 'doc_description'?: str}
    """
    with open(code_path, "r", encoding="utf-8", errors="replace") as f:
        raw = f.read()
    doc_name = os.path.splitext(os.path.basename(code_path))[0]
    ext = os.path.splitext(code_path)[1].lower()

    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    logger.info("Code loaded: %d lines", len(lines))

    headings = _detect_code_headings(lines, ext, source=text)
    markers = [{"title": h["title"], "line_num": h["line_num"], "level": h["level"]} for h in headings]
    logger.info("Code structure detection: %d methods/classes", len(markers))

    if not markers:
        markers = [{"title": doc_name, "line_num": 1, "level": 1}]

    nodes = _cut_md_text(markers, lines)

    if if_thinning and min_token_threshold:
        nodes = _update_token_counts(nodes)
        logger.info("Thinning tree (threshold=%d)...", min_token_threshold)
        nodes = _thin_tree(nodes, min_token_threshold)

    logger.info("Building tree from %d nodes...", len(nodes))
    tree = _build_tree(nodes)

    return _finalize_tree(
        tree, doc_name,
        source_path=os.path.abspath(code_path),
        if_add_node_id=if_add_node_id,
        if_add_node_summary=if_add_node_summary,
        summary_token_threshold=summary_token_threshold,
        if_add_node_text=if_add_node_text,
        if_add_doc_description=if_add_doc_description,
    )


# ============================================================================
# JSON file indexer
# ============================================================================

def _json_to_nodes(data, prefix: str = "", level: int = 1) -> list[dict]:
    """Recursively convert JSON data into flat node list."""
    nodes = []
    if isinstance(data, dict):
        for key, value in data.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, (dict, list)):
                nodes.append({"title": path, "level": level, "text": ""})
                nodes.extend(_json_to_nodes(value, prefix=path, level=level + 1))
            else:
                nodes.append({"title": path, "level": level, "text": f"{key}: {value}"})
    elif isinstance(data, list):
        for i, item in enumerate(data):
            path = f"{prefix}[{i}]"
            if isinstance(item, (dict, list)):
                nodes.append({"title": path, "level": level, "text": ""})
                nodes.extend(_json_to_nodes(item, prefix=path, level=level + 1))
            else:
                nodes.append({"title": path, "level": level, "text": str(item)})
    return nodes


async def json_to_tree(
    json_path: str,
    *,
    if_add_node_summary: bool = True,
    summary_token_threshold: int = 200,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """Build a tree index from a JSON file."""
    with open(json_path, "r", encoding="utf-8", errors="replace") as f:
        data = json.load(f)
    doc_name = os.path.splitext(os.path.basename(json_path))[0]

    flat_nodes = _json_to_nodes(data)
    if not flat_nodes:
        flat_nodes = [{"title": doc_name, "level": 1, "text": json.dumps(data, ensure_ascii=False)[:500]}]

    # Assign line_num for _build_tree compatibility
    for i, node in enumerate(flat_nodes):
        node["line_num"] = i + 1
        node["line_start"] = i + 1
        node["line_end"] = i + 1

    tree = _build_tree(flat_nodes)

    return _finalize_tree(
        tree, doc_name,
        source_path=os.path.abspath(json_path),
        if_add_node_id=if_add_node_id,
        if_add_node_summary=if_add_node_summary,
        summary_token_threshold=summary_token_threshold,
        if_add_node_text=if_add_node_text,
        if_add_doc_description=if_add_doc_description,
    )


# ============================================================================
# CSV file indexer
# ============================================================================

async def csv_to_tree(
    csv_path: str,
    *,
    if_add_node_summary: bool = True,
    summary_token_threshold: int = 200,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """Build a tree index from a CSV file. Each row becomes a leaf node under a header node."""
    import csv as csvmod

    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csvmod.reader(f)
        rows = list(reader)

    doc_name = os.path.splitext(os.path.basename(csv_path))[0]
    if not rows:
        return {"doc_name": doc_name, "structure": [{"title": doc_name, "node_id": "0001", "nodes": []}]}

    headers = rows[0]
    flat_nodes = [{"title": doc_name, "level": 1, "text": f"Columns: {', '.join(headers)}", "line_num": 1, "line_start": 1, "line_end": 1}]

    for i, row in enumerate(rows[1:], start=2):
        row_text = "; ".join(f"{h}: {v}" for h, v in zip(headers, row) if v.strip())
        title = row_text[:80] if row_text else f"Row {i}"
        flat_nodes.append({"title": title, "level": 2, "text": row_text, "line_num": i, "line_start": i, "line_end": i})

    tree = _build_tree(flat_nodes)

    return _finalize_tree(
        tree, doc_name,
        source_path=os.path.abspath(csv_path),
        if_add_node_id=if_add_node_id,
        if_add_node_summary=if_add_node_summary,
        summary_token_threshold=summary_token_threshold,
        if_add_node_text=if_add_node_text,
        if_add_doc_description=if_add_doc_description,
    )


# ============================================================================
# Batch indexing API
# ============================================================================

def _file_hash(fp: str) -> str:
    """Compute a fast fingerprint for incremental indexing.

    Uses (mtime_ns, size) as a lightweight proxy instead of reading the
    entire file for MD5.  This is orders-of-magnitude faster on network
    filesystems (NFS / CIFS) and still catches all real edits.

    Returns empty string if the file does not exist (e.g. deleted after glob).
    """
    try:
        st = os.stat(fp)
    except (FileNotFoundError, OSError):
        return ""
    return f"{st.st_mtime_ns}:{st.st_size}"


async def build_index(
    paths: list[str],
    output_dir: str = "./indexes",
    *,
    db_path: str = "",
    if_add_node_summary: Optional[bool] = None,
    if_add_doc_description: Optional[bool] = None,
    if_add_node_text: Optional[bool] = None,
    if_add_node_id: Optional[bool] = None,
    max_concurrency: Optional[int] = None,
    force: bool = False,
    **kwargs,
) -> list[Document]:
    """
    Build tree indexes for multiple files. Returns list of Document objects ready for search.

    All parameters default to ``get_config()`` values when not explicitly set.

    Args:
        paths: list of file paths or glob patterns (e.g. ["docs/*.md", "paper.txt"])
        output_dir: directory for the database file (used to derive db_path if db_path is empty)
        db_path: path to the SQLite database file. If empty, defaults to ``{output_dir}/index.db``.
        max_concurrency: max concurrent indexing tasks
        force: force re-index even if file unchanged (default: False)
        **kwargs: passed through to individual parsers

    Returns:
        list of Document objects (directly usable with search())
    """
    from .config import get_config
    from .fts import FTS5Index
    cfg = get_config()

    # Resolve defaults from config
    if if_add_node_summary is None:
        if_add_node_summary = cfg.if_add_node_summary
    if if_add_doc_description is None:
        if_add_doc_description = cfg.if_add_doc_description
    if if_add_node_text is None:
        if_add_node_text = cfg.if_add_node_text
    if if_add_node_id is None:
        if_add_node_id = cfg.if_add_node_id
    if max_concurrency is None:
        max_concurrency = cfg.max_concurrency

    # Resolve db_path
    if not db_path:
        db_path = os.path.join(output_dir, "index.db")
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

    # Expand globs
    expanded = []
    for p in paths:
        matches = sorted(globmod.glob(p))
        if matches:
            expanded.extend(matches)
        elif os.path.isfile(p):
            expanded.append(p)
        else:
            logger.warning("No files matched: %s", p)
    expanded = list(dict.fromkeys(expanded))  # deduplicate, preserve order

    if not expanded:
        raise FileNotFoundError(f"No files found for patterns: {paths}")

    # Incremental indexing: batch check file hashes via DB
    fts = FTS5Index(db_path=db_path)
    to_index = []
    skipped = []
    file_hashes = {}

    if not force:
        # Batch fetch all stored hashes in one query (instead of N queries)
        all_meta = fts.get_all_index_meta()
    else:
        all_meta = {}

    for fp in expanded:
        abs_fp = os.path.abspath(fp)
        fh = _file_hash(abs_fp)
        if not fh:
            # File disappeared after glob expansion (e.g. broken symlink)
            logger.debug("Skipping missing file: %s", abs_fp)
            continue
        file_hashes[abs_fp] = fh
        if not force:
            stored_hash = all_meta.get(abs_fp)
            if stored_hash == fh:
                name = os.path.splitext(os.path.basename(fp))[0]
                if fts.is_document_indexed(name):
                    skipped.append(fp)
                    continue
        to_index.append(fp)

    if skipped:
        logger.info("Skipped %d unchanged file(s)", len(skipped))
    logger.info("Building indexes for %d file(s) (concurrency=%d)...", len(to_index), max_concurrency)

    semaphore = asyncio.Semaphore(max_concurrency)

    async def _index_one(fp: str) -> dict | None:
        async with semaphore:
            try:
                ext = os.path.splitext(fp)[1].lower()
                common = dict(
                    if_add_node_summary=if_add_node_summary,
                    if_add_doc_description=if_add_doc_description,
                    if_add_node_text=if_add_node_text,
                    if_add_node_id=if_add_node_id,
                    **kwargs,
                )

                # Use ParserRegistry for dispatch (built-in parsers auto-registered)
                from .parsers import get_parser, SOURCE_TYPE_MAP
                parser_fn = get_parser(ext)
                if parser_fn is not None:
                    result = await parser_fn(fp, **common)
                else:
                    # Unknown extension: fall back to text_to_tree
                    result = await text_to_tree(text_path=fp, **common)

                # Tag source_type for search routing
                result["source_type"] = SOURCE_TYPE_MAP.get(ext, "text")
                return result
            except Exception as e:
                logger.warning("Failed to index %s: %s", fp, e)
                return None

    raw_results = await asyncio.gather(*(_index_one(fp) for fp in to_index))

    # Save results to DB and collect Document objects
    result_map = {fp: r for fp, r in zip(to_index, raw_results) if r is not None}
    documents = []

    # Batch load all skipped documents in one query (instead of N individual loads)
    if skipped:
        all_docs_from_db = {d.doc_id: d for d in fts.load_all_documents()}
    else:
        all_docs_from_db = {}

    for fp in expanded:
        name = os.path.splitext(os.path.basename(fp))[0]
        if fp in result_map:
            result = result_map[fp]
            doc = Document(
                doc_id=name,
                doc_name=result.get("doc_name", name),
                structure=result.get("structure", []),
                doc_description=result.get("doc_description", ""),
                metadata={"source_path": result.get("source_path", "")},
                source_type=result.get("source_type", ""),
            )
            fts.save_document(doc)
            fts.index_document(doc, force=True)
            logger.info("Indexed: %s -> %s (doc_id=%s)", fp, db_path, name)
        else:
            # Skipped file: use batch-loaded docs
            doc = all_docs_from_db.get(name)
            if doc is None:
                logger.warning("Skipped file %s but document not found in DB, re-indexing", fp)
                continue
        documents.append(doc)

    # Batch update metadata only for changed files (single transaction)
    changed_hashes = {os.path.abspath(fp): file_hashes[os.path.abspath(fp)] for fp in to_index if os.path.abspath(fp) in file_hashes}
    if changed_hashes:
        fts.set_index_meta_batch(changed_hashes)

    fts.close()
    return documents
