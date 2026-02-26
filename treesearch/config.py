# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Unified configuration management for TreeSearch.

Provides sensible defaults with environment variable overrides.
"""
import os
import logging
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


@dataclass
class SearchConfig:
    """Configuration for search operations."""
    strategy: str = "best_first"
    max_nodes_per_doc: int = 5
    top_k_docs: int = 3
    value_threshold: float = 0.3
    max_llm_calls: int = 30
    use_bm25: bool = True
    mcts_iterations: int = 10


@dataclass
class IndexConfig:
    """Configuration for index building."""
    if_add_node_summary: bool = True
    if_add_doc_description: bool = True
    if_add_node_text: bool = True
    if_add_node_id: bool = True
    if_thinning: bool = False
    min_token_threshold: int = 5000
    summary_token_threshold: int = 200
    max_concurrency: int = 5


@dataclass
class AnswerConfig:
    """Configuration for answer generation."""
    answer_mode: str = "extractive"
    max_context_tokens: int = 8000


@dataclass
class TreeSearchConfig:
    """Top-level configuration for TreeSearch."""
    # LLM settings
    model: str = os.getenv("TREESEARCH_MODEL", "gpt-4o-mini")
    api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    base_url: Optional[str] = os.getenv("OPENAI_BASE_URL")

    # Embedding settings (optional)
    embedding_model: str = os.getenv("TREESEARCH_EMBEDDING_MODEL", "text-embedding-3-small")
    use_embedding: bool = False

    # Sub-configs
    search: SearchConfig = field(default_factory=SearchConfig)
    index: IndexConfig = field(default_factory=IndexConfig)
    answer: AnswerConfig = field(default_factory=AnswerConfig)

    @classmethod
    def from_env(cls) -> "TreeSearchConfig":
        """Create config from environment variables."""
        config = cls()

        # Override from env
        if os.getenv("TREESEARCH_STRATEGY"):
            config.search.strategy = os.getenv("TREESEARCH_STRATEGY")
        if os.getenv("TREESEARCH_MAX_LLM_CALLS"):
            config.search.max_llm_calls = int(os.getenv("TREESEARCH_MAX_LLM_CALLS"))
        if os.getenv("TREESEARCH_THRESHOLD"):
            config.search.value_threshold = float(os.getenv("TREESEARCH_THRESHOLD"))
        if os.getenv("TREESEARCH_USE_EMBEDDING"):
            config.use_embedding = os.getenv("TREESEARCH_USE_EMBEDDING").lower() in ("1", "true", "yes")
        if os.getenv("TREESEARCH_ANSWER_MODE"):
            config.answer.answer_mode = os.getenv("TREESEARCH_ANSWER_MODE")

        return config


# Global default config (lazy singleton)
_default_config: Optional[TreeSearchConfig] = None


def get_config() -> TreeSearchConfig:
    """Get the global default configuration."""
    global _default_config
    if _default_config is None:
        _default_config = TreeSearchConfig.from_env()
    return _default_config


def set_config(config: TreeSearchConfig) -> None:
    """Set the global default configuration."""
    global _default_config
    _default_config = config
