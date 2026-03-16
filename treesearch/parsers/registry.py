# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Parser registry and pre-filter routing.

Maps file extensions to source types, parsers, and default pre-filter chains.
"""
import logging
from typing import Optional, Callable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# File extension -> source_type mapping
# ---------------------------------------------------------------------------

SOURCE_TYPE_MAP: dict[str, str] = {
    # Markdown
    ".md": "markdown",
    ".markdown": "markdown",
    # Code (core languages)
    ".py": "code",
    ".java": "code",
    ".ts": "code",
    ".tsx": "code",
    ".js": "code",
    ".jsx": "code",
    ".cpp": "code",
    ".cc": "code",
    ".cxx": "code",
    ".hpp": "code",
    ".h": "code",
    ".c": "code",
    ".cs": "code",
    ".php": "code",
    ".go": "code",
    ".rb": "code",
    ".rs": "code",
    ".swift": "code",
    ".kt": "code",
    # Code (extended languages via tree-sitter)
    ".scala": "code",
    ".lua": "code",
    ".r": "code",
    ".R": "code",
    ".sql": "code",
    ".bash": "code",
    ".sh": "code",
    ".el": "code",
    ".clj": "code",
    ".ex": "code",
    ".exs": "code",
    ".erl": "code",
    ".hs": "code",
    ".jl": "code",
    ".ml": "code",
    ".pl": "code",
    ".m": "code",
    # Structured data
    ".json": "json",
    ".jsonl": "jsonl",
    ".csv": "csv",
    # Web / markup
    ".html": "html",
    ".htm": "html",
    ".xml": "xml",
    ".css": "code",
    # Config
    ".toml": "code",
    ".yaml": "code",
    ".yml": "code",
    ".dockerfile": "code",
    ".mk": "code",
    # Documents
    ".pdf": "pdf",
    ".doc": "doc",
    ".docx": "docx",
    # Spreadsheets (openpyxl)
    ".xlsx": "excel",
    ".xlsm": "excel",
    ".xltx": "excel",
    ".xltm": "excel",
    # Documents (PyMuPDF supported formats, share 'pdf' source_type)
    ".epub": "pdf",
    ".xps": "pdf",
    ".oxps": "pdf",
    ".fb2": "pdf",
    ".cbz": "pdf",
    ".cbr": "pdf",
    # Plain text (fallback)
    ".txt": "text",
    ".log": "text",
    ".rst": "text",
}


def _get_source_type(ext: str) -> str:
    """Get source_type from file extension. Falls back to 'text'."""
    return SOURCE_TYPE_MAP.get(ext.lower(), "text")


# ---------------------------------------------------------------------------
# Pre-filter routing
# ---------------------------------------------------------------------------
# pre_filters: list of PreFilter class names to auto-enable per source_type.

PREFILTER_ROUTING: dict[str, list[str]] = {
    "markdown": ["fts5"],
    "code": ["grep", "fts5"],
    "text": ["fts5"],
    "json": ["grep"],
    "jsonl": ["grep", "fts5"],
    "csv": ["fts5"],
    "html": ["fts5"],
    "xml": ["fts5"],
    "pdf": ["fts5"],
    "doc": ["fts5"],
    "docx": ["fts5"],
    "excel": ["fts5"],
}


def get_prefilters_for_source_type(source_type: str) -> list[str]:
    """Get recommended pre-filter chain for a source_type."""
    return PREFILTER_ROUTING.get(source_type, PREFILTER_ROUTING["text"])


# ---------------------------------------------------------------------------
# Parser registry
# ---------------------------------------------------------------------------

# Registry: extension -> async parser function
_PARSER_REGISTRY: dict[str, Callable] = {}


class ParserRegistry:
    """Registry mapping file extensions to parser functions.

    Built-in parsers are registered at import time.
    Users can register custom parsers for new file types.
    """

    @staticmethod
    def register(ext: str, parser_fn: Callable, source_type: Optional[str] = None) -> None:
        """Register a parser function for a file extension.

        Args:
            ext: file extension including dot (e.g. ".md")
            parser_fn: async function(file_path, **kwargs) -> dict
            source_type: optional source_type override for this extension
        """
        _PARSER_REGISTRY[ext.lower()] = parser_fn
        if source_type:
            SOURCE_TYPE_MAP[ext.lower()] = source_type
        logger.debug("Registered parser for %s", ext)

    @staticmethod
    def get(ext: str) -> Optional[Callable]:
        """Get parser function for a file extension."""
        return _PARSER_REGISTRY.get(ext.lower())

    @staticmethod
    def supported_extensions() -> list[str]:
        """Return all registered file extensions."""
        return list(_PARSER_REGISTRY.keys())


def get_parser(ext: str) -> Optional[Callable]:
    """Shortcut: get parser function for a file extension."""
    return ParserRegistry.get(ext)


# ---------------------------------------------------------------------------
# Built-in parser registration
# ---------------------------------------------------------------------------

def _register_builtin_parsers() -> None:
    """Register all built-in parsers from indexer module.

    Called at module load time. Deferred import avoids circular dependency
    with indexer.py which imports from this module.
    """
    from ..indexer import md_to_tree, text_to_tree, code_to_tree, json_to_tree, csv_to_tree, jsonl_to_tree

    # Markdown
    async def _md_parser(fp, **kw):
        return await md_to_tree(md_path=fp, **kw)

    for ext in (".md", ".markdown"):
        ParserRegistry.register(ext, _md_parser)

    # Plain text
    async def _text_parser(fp, **kw):
        return await text_to_tree(text_path=fp, **kw)

    for ext in (".txt", ".log", ".rst"):
        ParserRegistry.register(ext, _text_parser)

    # Code files (regex-based fallback, registered first)
    async def _code_parser(fp, **kw):
        return await code_to_tree(code_path=fp, **kw)

    _regex_code_exts = (
        ".py", ".java", ".ts", ".tsx", ".js", ".jsx",
        ".cpp", ".cc", ".cxx", ".hpp", ".h", ".c",
        ".cs", ".php", ".go", ".rb", ".rs", ".swift", ".kt",
        ".html", ".htm", ".xml",
    )
    for ext in _regex_code_exts:
        ParserRegistry.register(ext, _code_parser)

    # Tree-sitter code parser (optional, overrides regex for supported languages)
    try:
        from ..parsers.treesitter_parser import treesitter_code_to_tree, EXT_TO_LANGUAGE

        async def _treesitter_parser(fp, **kw):
            return await treesitter_code_to_tree(code_path=fp, **kw)

        # Register tree-sitter parser for all supported extensions
        _ts_exts = list(EXT_TO_LANGUAGE.keys())
        # Exclude .html/.htm (handled by dedicated HTML parser below)
        _ts_exts = [e for e in _ts_exts if e not in (".html", ".htm")]
        for ext in _ts_exts:
            ParserRegistry.register(ext, _treesitter_parser)
            # Register source_type for new extensions not in SOURCE_TYPE_MAP
            if ext not in SOURCE_TYPE_MAP:
                SOURCE_TYPE_MAP[ext] = "code"

        logger.debug("tree-sitter parser registered for %d extensions", len(_ts_exts))
    except ImportError:
        logger.debug("tree-sitter parser not available (install 'tree-sitter-languages' for multi-language support)")

    # JSON
    async def _json_parser(fp, **kw):
        return await json_to_tree(json_path=fp, **kw)

    ParserRegistry.register(".json", _json_parser)

    # JSONL
    async def _jsonl_parser(fp, **kw):
        return await jsonl_to_tree(jsonl_path=fp, **kw)

    ParserRegistry.register(".jsonl", _jsonl_parser)

    # CSV
    async def _csv_parser(fp, **kw):
        return await csv_to_tree(csv_path=fp, **kw)

    ParserRegistry.register(".csv", _csv_parser)

    # PDF and other PyMuPDF-supported document formats (optional dependency)
    try:
        from ..parsers.pdf_parser import pdf_to_tree, PYMUPDF_EXTENSIONS

        async def _pdf_parser(fp, **kw):
            return await pdf_to_tree(file_path=fp, **kw)

        for ext in sorted(PYMUPDF_EXTENSIONS):
            ParserRegistry.register(ext, _pdf_parser)
        logger.debug("PyMuPDF parser registered for %d extensions: %s",
                      len(PYMUPDF_EXTENSIONS), ", ".join(sorted(PYMUPDF_EXTENSIONS)))
    except ImportError:
        logger.debug("Document parser not available (install 'pymupdf' for PDF/EPUB/XPS support)")

    # DOCX (optional dependency)
    try:
        from ..parsers.docx_parser import docx_to_tree

        async def _docx_parser(fp, **kw):
            return await docx_to_tree(docx_path=fp, **kw)

        ParserRegistry.register(".docx", _docx_parser)
    except ImportError:
        logger.debug("DOCX parser not available (install 'python-docx' for DOCX support)")

    # DOC (Word 97-2003, uses system tools: textutil/antiword/catdoc/LibreOffice)
    from ..parsers.doc_parser import doc_to_tree

    async def _doc_parser(fp, **kw):
        return await doc_to_tree(doc_path=fp, **kw)

    ParserRegistry.register(".doc", _doc_parser)

    # Excel/Spreadsheet (optional dependency, uses openpyxl)
    try:
        from ..parsers.excel_parser import excel_to_tree, EXCEL_EXTENSIONS

        async def _excel_parser(fp, **kw):
            return await excel_to_tree(excel_path=fp, **kw)

        for ext in sorted(EXCEL_EXTENSIONS):
            ParserRegistry.register(ext, _excel_parser)
        logger.debug("Excel parser registered for %d extensions: %s",
                      len(EXCEL_EXTENSIONS), ", ".join(sorted(EXCEL_EXTENSIONS)))
    except ImportError:
        logger.debug("Excel parser not available (install 'openpyxl' for Excel support)")

    # HTML (optional dependency, uses BeautifulSoup)
    try:
        from ..parsers.html_parser import html_to_tree

        async def _html_parser(fp, **kw):
            return await html_to_tree(html_path=fp, **kw)

        # Override the code_parser registration for .html/.htm
        ParserRegistry.register(".html", _html_parser)
        ParserRegistry.register(".htm", _html_parser)
    except ImportError:
        logger.debug("HTML parser not available (install 'beautifulsoup4' for HTML support)")


# Auto-register built-in parsers on import
_register_builtin_parsers()
