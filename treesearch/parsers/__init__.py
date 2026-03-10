# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Parser registry for file-type-aware indexing and search routing.

Provides a unified interface for file parsers and automatic routing of
file types to appropriate parser + search strategy combinations.
"""
from .registry import (
    ParserRegistry,
    get_parser,
    SOURCE_TYPE_MAP,
    STRATEGY_ROUTING,
    get_strategy_for_source_type,
)
from .ast_parser import parse_python_structure

__all__ = [
    "ParserRegistry",
    "get_parser",
    "SOURCE_TYPE_MAP",
    "STRATEGY_ROUTING",
    "get_strategy_for_source_type",
    "parse_python_structure",
]
