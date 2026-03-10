# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Parser registry and search strategy routing.

Maps file extensions to source types, parsers, and default search strategies.
All strategies default to fts5_only (no LLM cost). Users opt-in to best_first.
"""
import logging
from typing import Optional, Callable, Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# File extension -> source_type mapping
# ---------------------------------------------------------------------------

SOURCE_TYPE_MAP: dict[str, str] = {
    # Markdown
    ".md": "markdown",
    ".markdown": "markdown",
    # Code
    ".py": "code",
    ".java": "code",
    ".ts": "code",
    ".js": "code",
    ".cpp": "code",
    ".cc": "code",
    ".cs": "code",
    ".php": "code",
    ".go": "code",
    ".rb": "code",
    ".rs": "code",
    ".swift": "code",
    ".kt": "code",
    # Structured data
    ".json": "json",
    ".csv": "csv",
    # Web / markup
    ".html": "html",
    ".htm": "html",
    ".xml": "xml",
    # Documents
    ".pdf": "pdf",
    ".docx": "docx",
    # Plain text (fallback)
    ".txt": "text",
    ".log": "text",
    ".rst": "text",
}


def _get_source_type(ext: str) -> str:
    """Get source_type from file extension. Falls back to 'text'."""
    return SOURCE_TYPE_MAP.get(ext.lower(), "text")


# ---------------------------------------------------------------------------
# Search strategy routing
# ---------------------------------------------------------------------------
# All defaults are fts5_only (zero LLM cost).
# pre_filters: list of PreFilter class names to auto-enable.
# Users can override strategy to "best_first" via config/kwargs.

STRATEGY_ROUTING: dict[str, dict[str, Any]] = {
    "markdown": {
        "strategy": "fts5_only",
        "pre_filters": ["fts5"],
    },
    "code": {
        "strategy": "fts5_only",
        "pre_filters": ["grep", "fts5"],
    },
    "text": {
        "strategy": "fts5_only",
        "pre_filters": ["fts5"],
    },
    "json": {
        "strategy": "fts5_only",
        "pre_filters": ["grep"],
    },
    "csv": {
        "strategy": "fts5_only",
        "pre_filters": ["fts5"],
    },
    "html": {
        "strategy": "fts5_only",
        "pre_filters": ["fts5"],
    },
    "xml": {
        "strategy": "fts5_only",
        "pre_filters": ["fts5"],
    },
    "pdf": {
        "strategy": "fts5_only",
        "pre_filters": ["fts5"],
    },
    "docx": {
        "strategy": "fts5_only",
        "pre_filters": ["fts5"],
    },
}


def get_strategy_for_source_type(source_type: str) -> dict[str, Any]:
    """Get recommended search strategy config for a source_type."""
    return STRATEGY_ROUTING.get(source_type, STRATEGY_ROUTING["text"])


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
    from ..indexer import md_to_tree, text_to_tree, code_to_tree, json_to_tree, csv_to_tree

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

    # Code files
    async def _code_parser(fp, **kw):
        return await code_to_tree(code_path=fp, **kw)

    for ext in (".py", ".java", ".ts", ".js", ".cpp", ".cc", ".cs", ".php", ".go",
                ".rb", ".rs", ".swift", ".kt", ".html", ".htm", ".xml"):
        ParserRegistry.register(ext, _code_parser)

    # JSON
    async def _json_parser(fp, **kw):
        return await json_to_tree(json_path=fp, **kw)

    ParserRegistry.register(".json", _json_parser)

    # CSV
    async def _csv_parser(fp, **kw):
        return await csv_to_tree(csv_path=fp, **kw)

    ParserRegistry.register(".csv", _csv_parser)

    # PDF (optional dependency)
    try:
        from ..parsers.pdf_parser import pdf_to_tree

        async def _pdf_parser(fp, **kw):
            return await pdf_to_tree(pdf_path=fp, **kw)

        ParserRegistry.register(".pdf", _pdf_parser)
    except ImportError:
        logger.debug("PDF parser not available (install 'pageindex' for PDF support)")

    # DOCX (optional dependency)
    try:
        from ..parsers.docx_parser import docx_to_tree

        async def _docx_parser(fp, **kw):
            return await docx_to_tree(docx_path=fp, **kw)

        ParserRegistry.register(".docx", _docx_parser)
    except ImportError:
        logger.debug("DOCX parser not available (install 'python-docx' for DOCX support)")

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
