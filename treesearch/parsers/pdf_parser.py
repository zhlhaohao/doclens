# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Document parser for TreeSearch (pdfplumber backend).

Uses pdfplumber to extract text from PDF,
then delegates to text_to_tree for structure detection.

Pipeline:
  1. pdfplumber page text extraction with [PAGE N] markers
  2. PDF-specific heading normalization (merge split headings, e.g. "2.\nPRELIMINARIES")
  3. Fallback: if too few headings detected, use [PAGE N] as section boundaries
  4. text_to_tree for tree building
"""
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Backend detection flag
_HAS_PDFPLUMBER = None


def _check_backends():
    """Lazy-check that pdfplumber is available."""
    global _HAS_PDFPLUMBER
    if _HAS_PDFPLUMBER is None:
        try:
            import pdfplumber  # noqa: F401
            _HAS_PDFPLUMBER = True
        except ImportError:
            _HAS_PDFPLUMBER = False
    if not _HAS_PDFPLUMBER:
        raise ImportError(
            "Document parsing (PDF) requires pdfplumber. "
            "Install with: pip install pdfplumber"
        )


# Supported PDF file extensions
PDF_EXTENSIONS = {
    ".pdf",
}

# Regex: a standalone section number like "2." or "3.1" or "3.1." on its own line
_RE_STANDALONE_NUM = re.compile(r"^(\d+(?:\.\d+)*\.?)\s*$")
# Regex: ALL CAPS line (section title)
_RE_ALL_CAPS_LINE = re.compile(r"^[A-Z][A-Z\s\-:,&/()]{2,}$")
# Regex: [PAGE N] marker
_RE_PAGE_MARKER = re.compile(r"^\[PAGE\s+(\d+)\]$")

# Common single-word ALL CAPS headings in academic papers (whitelist)
_ACADEMIC_HEADINGS = {
    "ABSTRACT", "INTRODUCTION", "BACKGROUND", "METHODS", "METHODOLOGY",
    "RESULTS", "DISCUSSION", "CONCLUSION", "CONCLUSIONS", "REFERENCES",
    "ACKNOWLEDGMENT", "ACKNOWLEDGMENTS", "ACKNOWLEDGEMENT", "ACKNOWLEDGEMENTS",
    "APPENDIX", "BIBLIOGRAPHY", "KEYWORDS", "OVERVIEW", "SUMMARY",
    "EVALUATION", "EXPERIMENTS", "IMPLEMENTATION", "LIMITATIONS",
    "MOTIVATION", "CONTRIBUTIONS", "PRELIMINARIES",
}

def extract_pdf_text(file_path: str) -> str:
    """Extract text from a PDF file using pdfplumber.

    Args:
        file_path: path to the PDF file.

    Returns page-aware text with [PAGE N] markers. 同一段落内的视觉硬换行
    会被保留（Markdown 渲染时合并）；段落之间插入空行（\\n\\n），
    以避免 pdfplumber 默认输出把多个段落挤成一段。

    Returns empty string on failure.
    """
    _check_backends()
    try:
        import pdfplumber

        parts = []
        with pdfplumber.open(file_path) as doc:
            for i, page in enumerate(doc.pages):
                page_text = _extract_page_text_with_paragraphs(page)
                if page_text:
                    parts.append(f"\n[PAGE {i + 1}]\n{page_text}")
        return "\n".join(parts)
    except Exception as e:
        logger.error("Error extracting text from %s: %s", file_path, e)
        return ""


def _extract_page_text_with_paragraphs(page) -> str:
    """单页文本提取：保留段落结构。

    Pipeline:
      1. page.extract_words(x_tolerance=1) 拿到词及位置/字号
         - x_tolerance=1 修复学术 PDF 字距调整导致的空格丢失
      2. 过滤噪声词：字号过小（页码/上下标/脚注）、页面边缘（边注/页眉）
      3. 按 top 聚类成视觉行（容差 3 容忍字符轻微 y 抖动）
      4. 用行间距中位数的 1.5x（且至少 +4）作为段落分隔阈值
      5. 段内行保留单 \\n（Markdown 渲染时合并）；段间插入空行

    局限：双栏 PDF 同一 top 的左右栏词会被合并到同一行。这是 PDF 解析的
    固有局限，需要专门的分栏算法；本函数不处理，留给后续优化。
    """
    from collections import Counter, defaultdict
    from statistics import median

    words = page.extract_words(
        x_tolerance=1, y_tolerance=3,
        keep_blank_chars=False, extra_attrs=["size"],
    )
    if not words:
        return ""

    # 主流字号（出现次数最多的 rounding size）
    size_counter = Counter(round(w["size"], 1) for w in words)
    main_size = size_counter.most_common(1)[0][0]

    # 过滤：字号过小（页码/上下标/脚注）+ 页面边缘 5%（页眉/页脚/边注）
    margin_x = page.width * 0.05
    margin_y = page.height * 0.05
    filtered = [
        w for w in words
        if w["size"] >= main_size * 0.85
        and w["x0"] >= margin_x
        and w["top"] >= margin_y
        and w["bottom"] <= page.height - margin_y
    ]
    if not filtered:
        return ""

    # 按 top 聚类成行（容差 3 抖动）
    lines_map: dict = defaultdict(list)
    for w in filtered:
        key = round(w["top"] / 3) * 3
        lines_map[key].append(w)
    line_tops = sorted(lines_map.keys())

    # 行间距中位数 → 段落分隔阈值
    # med_gap+3：段内行距 vs 段间间距的实测分界（如典型 med=12 时段间最小
    # gap=15；med=15 时段间最小 gap=18）。配合 >= 比较处理边界情况。
    gaps = [line_tops[k] - line_tops[k - 1] for k in range(1, len(line_tops))]
    med_gap = median(gaps) if gaps else 10.0
    para_thresh = med_gap + 3

    page_lines: list = []
    for ti, t in enumerate(line_tops):
        ws = sorted(lines_map[t], key=lambda x: x["x0"])
        line_text = " ".join(w["text"] for w in ws).strip()
        if not line_text:
            continue
        if ti > 0 and (t - line_tops[ti - 1]) >= para_thresh:
            page_lines.append("")  # 段落分隔（空行）
        page_lines.append(line_text)
    return "\n".join(page_lines)


def _normalize_pdf_headings(text: str) -> str:
    """Normalize PDF-extracted text to improve heading detection.

    Academic PDFs often have section headings split across lines:
        2.
        PRELIMINARIES
        The Earth Mover's Distance...

    This function merges them into:
        2. PRELIMINARIES
        The Earth Mover's Distance...

    Also handles standalone ALL CAPS headings by adding blank lines around
    them to help the generic heading detector.
    """
    lines = text.split("\n")
    result = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Pattern 1: "2." followed by "ALL CAPS TITLE" on next line
        # Merge into "2. ALL CAPS TITLE"
        m_num = _RE_STANDALONE_NUM.match(line)
        if m_num and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if next_line and _RE_ALL_CAPS_LINE.match(next_line):
                merged = f"{m_num.group(1)} {next_line}"
                result.append("")  # blank line before heading
                result.append(merged)
                result.append("")  # blank line after heading
                i += 2
                continue

        # Pattern 2: Standalone ALL CAPS line that looks like a section heading
        # (ABSTRACT, INTRODUCTION, etc.) — ensure blank lines around it
        # Require at least 6 chars to avoid table labels like "PB-C", "RETINA"
        # Also skip single-word ALL CAPS lines shorter than 12 chars (likely table data)
        # unless they are known academic headings
        if (_RE_ALL_CAPS_LINE.match(line)
                and len(line) >= 6
                and not _RE_PAGE_MARKER.match(line)):
            # Skip short single-word labels (common in PDF tables/figures)
            # but allow known academic section headings
            words = line.split()
            if len(words) == 1 and len(line) < 12 and line not in _ACADEMIC_HEADINGS:
                result.append(lines[i])
                i += 1
                continue
            if not result or result[-1].strip():
                result.append("")  # blank line before
            result.append(line)
            result.append("")  # blank line after
            i += 1
            continue

        result.append(lines[i])  # preserve original indentation
        i += 1

    return "\n".join(result)


def _use_page_fallback(text: str) -> str:
    """Convert [PAGE N] markers into heading markers for page-based splitting.

    Used as fallback when heading detection yields too few sections,
    resulting in oversized nodes.
    """
    lines = text.split("\n")
    result = []
    for line in lines:
        stripped = line.strip()
        m = _RE_PAGE_MARKER.match(stripped)
        if m:
            page_num = m.group(1)
            result.append("")
            result.append(f"## Page {page_num}")
            result.append("")
        else:
            result.append(line)
    return "\n".join(result)


def _check_needs_page_fallback(text: str) -> bool:
    """Check if the text needs page-based splitting as fallback.

    Returns True if heading detection would produce nodes that are too large.
    Heuristic: count headings vs total text length.
    """
    from ..config import get_config
    from ..indexer import _detect_headings, _preprocess_text

    max_node_chars = get_config().max_node_chars
    processed = _preprocess_text(text)
    lines = processed.split("\n")
    headings = _detect_headings(lines)
    total_chars = len(processed)

    if not headings:
        return total_chars > max_node_chars

    # Estimate average node size
    avg_chars_per_node = total_chars / (len(headings) + 1)
    if avg_chars_per_node > max_node_chars:
        logger.debug(
            "PDF heading detection: %d headings for %d chars (avg %.0f chars/node > %d), "
            "falling back to page-based splitting",
            len(headings), total_chars, avg_chars_per_node, max_node_chars
        )
        return True
    return False


async def pdf_to_tree(
    file_path: str = "",
    *,
    pdf_path: str = "",
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """Build a tree index from a PDF file using pdfplumber.

    Pipeline:
      1. Extract page text with [PAGE N] markers
      2. Normalize PDF headings (merge split section numbers + ALL CAPS titles)
      3. If heading detection still yields oversized nodes, fallback to page-based splitting
      4. Delegate to text_to_tree for tree building

    Args:
        file_path: path to document file (preferred parameter name).
        pdf_path: deprecated alias for file_path, kept for backward compatibility.

    Returns:
        {'doc_name': str, 'structure': list, 'source_path': str}
    """
    # Backward compatibility: accept pdf_path as alias
    fp = file_path or pdf_path
    if not fp:
        raise ValueError("file_path (or pdf_path) is required")

    _check_backends()
    doc_name = os.path.splitext(os.path.basename(fp))[0]
    logger.debug("Parsing document: %s", fp)

    # Step 1: Extract text with [PAGE N] markers
    text = extract_pdf_text(fp)

    if not text.strip():
        logger.warning("No text extracted from document: %s", fp)
        from ..tree import assign_node_ids
        structure = [{"title": doc_name, "node_id": "0", "text": "", "nodes": []}]
        if if_add_node_id:
            assign_node_ids(structure)
        return {
            "doc_name": doc_name,
            "structure": structure,
            "source_path": os.path.abspath(fp),
        }

    # Step 2: Normalize PDF headings (merge "2.\nPRELIMINARIES" → "2. PRELIMINARIES")
    text = _normalize_pdf_headings(text)

    # Step 3: Check if heading detection produces reasonable node sizes;
    # if not, fallback to [PAGE N]-based splitting
    if _check_needs_page_fallback(text):
        text = _use_page_fallback(text)

    # Step 4: Delegate to text_to_tree for heading detection and tree building
    from ..indexer import text_to_tree
    result = await text_to_tree(
        text_content=text,
        model=model,
        if_add_node_summary=if_add_node_summary,
        summary_chars_threshold=summary_chars_threshold,
        if_add_doc_description=if_add_doc_description,
        if_add_node_text=if_add_node_text,
        if_add_node_id=if_add_node_id,
        **kwargs,
    )
    result["doc_name"] = doc_name
    result["source_path"] = os.path.abspath(fp)
    return result
