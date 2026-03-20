# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Document parser for TreeSearch (PyMuPDF backend).

Uses PyMuPDF (pymupdf) to extract text from PDF/XPS/EPUB/FB2/CBZ/CBR,
then delegates to text_to_tree for structure detection.

Pipeline:
  1. PyMuPDF page text extraction with [PAGE N] markers
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
_HAS_PYMUPDF = None


def _check_backends():
    """Lazy-check that PyMuPDF is available."""
    global _HAS_PYMUPDF
    if _HAS_PYMUPDF is None:
        try:
            import pymupdf  # noqa: F401
            _HAS_PYMUPDF = True
        except ImportError:
            _HAS_PYMUPDF = False
    if not _HAS_PYMUPDF:
        raise ImportError(
            "Document parsing (PDF/EPUB/XPS/FB2/CBZ/CBR) requires PyMuPDF. "
            "Install with: pip install pymupdf"
        )


# All file extensions that PyMuPDF can open natively
PYMUPDF_EXTENSIONS = {
    ".pdf", ".xps", ".oxps", ".epub", ".fb2", ".cbz", ".cbr",
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

# Max average characters per node before triggering page-based fallback
_MAX_NODE_CHARS_THRESHOLD = 8000


def extract_pdf_text(file_path: str) -> str:
    """Extract text from a document file using PyMuPDF.

    Supports: PDF, XPS, OpenXPS, EPUB, FB2, CBZ, CBR.

    Args:
        file_path: path to the document file.

    Returns page-aware text with [PAGE N] markers.
    Returns empty string on failure.
    """
    _check_backends()
    try:
        import pymupdf
        doc = pymupdf.open(file_path)
        parts = []
        for i, page in enumerate(doc):
            text = page.get_text().strip()
            if text:
                parts.append(f"\n[PAGE {i + 1}]\n{text}")
        doc.close()
        return "\n".join(parts)
    except Exception as e:
        logger.error("Error extracting text from %s: %s", file_path, e)
        return ""


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
    from ..indexer import _detect_headings, _preprocess_text

    processed = _preprocess_text(text)
    lines = processed.split("\n")
    headings = _detect_headings(lines)
    total_chars = len(processed)

    if not headings:
        return total_chars > _MAX_NODE_CHARS_THRESHOLD

    # Estimate average node size
    avg_chars_per_node = total_chars / (len(headings) + 1)
    if avg_chars_per_node > _MAX_NODE_CHARS_THRESHOLD:
        logger.debug(
            "PDF heading detection: %d headings for %d chars (avg %.0f chars/node > %d), "
            "falling back to page-based splitting",
            len(headings), total_chars, avg_chars_per_node, _MAX_NODE_CHARS_THRESHOLD
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
    """Build a tree index from a document file using PyMuPDF.

    Supports: PDF, XPS, OpenXPS, EPUB, FB2, CBZ, CBR.

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
