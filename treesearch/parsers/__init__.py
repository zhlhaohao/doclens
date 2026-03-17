# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Parser registry for file-type-aware indexing and pre-filter routing.

Provides a unified interface for file parsers and automatic routing of
file types to appropriate parser + pre-filter combinations.
"""
from .registry import (
    ParserRegistry,
    get_parser,
    SOURCE_TYPE_MAP,
    PREFILTER_ROUTING,
    get_prefilters_for_source_type,
)
from .ast_parser import parse_python_structure
from .pdf_parser import extract_pdf_text, PYMUPDF_EXTENSIONS
from .doc_parser import extract_doc_text

# Excel parser (optional)
try:
    from .excel_parser import excel_to_tree, EXCEL_EXTENSIONS
    _has_excel = True
except ImportError:
    _has_excel = False

# Tree-sitter parser (optional)
try:
    from .treesitter_parser import (
        parse_treesitter_structure,
        treesitter_code_to_tree,
        EXT_TO_LANGUAGE,
    )
    _has_treesitter = True
except ImportError:
    _has_treesitter = False

__all__ = [
    "ParserRegistry",
    "get_parser",
    "SOURCE_TYPE_MAP",
    "PREFILTER_ROUTING",
    "get_prefilters_for_source_type",
    "parse_python_structure",
    "extract_pdf_text",
    "extract_doc_text",
    "PYMUPDF_EXTENSIONS",
]

if _has_excel:
    __all__ += ["excel_to_tree", "EXCEL_EXTENSIONS"]

if _has_treesitter:
    __all__ += ["parse_treesitter_structure", "treesitter_code_to_tree", "EXT_TO_LANGUAGE"]
