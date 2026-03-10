# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Unified configuration management for TreeSearch.

This is the SINGLE source of truth for all configuration defaults.
Other modules (llm.py, etc.) should import from here instead of
calling os.getenv() directly.

Configuration loading priority (high -> low):
    1. Programmatic: set_config(TreeSearchConfig(...))
    2. Environment variables (for secrets & model names)
       - .env file in project root is auto-loaded if python-dotenv is installed
    3. YAML file ~/.treesearch/config.yaml (optional, for tuning parameters)
    4. Built-in defaults

Environment variable naming:
    - LLM secrets: TREESEARCH_LLM_API_KEY > OPENAI_API_KEY (fallback)
                   TREESEARCH_LLM_BASE_URL > OPENAI_BASE_URL (fallback)

Design principles:
    - env vars are the PRIMARY config channel (always supported, zero setup)
    - YAML is OPTIONAL (advanced users who want to persist tuning parameters)
    - Secrets (api_key, base_url) are NEVER written to / read from YAML
    - YAML is never auto-created; users opt-in by creating it themselves
    - Sub-config fields are auto-iterated from dataclass definitions (zero maintenance)
"""
import logging
import os
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Any, Dict, Optional, get_type_hints

import yaml

logger = logging.getLogger(__name__)

# Auto-load .env from project root (best-effort, python-dotenv is optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Global config file path: ~/.treesearch/config.yaml (optional)
CONFIG_DIR = Path.home() / ".treesearch"
CONFIG_FILE = CONFIG_DIR / "config.yaml"


def _load_yaml_config(yaml_path: Optional[str] = None) -> Dict[str, Any]:
    """Load configuration from YAML file if it exists.

    Args:
        yaml_path: Explicit path. If None, tries ~/.treesearch/config.yaml.
    """
    path = Path(yaml_path) if yaml_path else CONFIG_FILE
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        logger.debug("Loaded config from %s", path)
        return data
    except Exception as e:
        logger.warning("Failed to load config from %s: %s", path, e)
        return {}


# ---------------------------------------------------------------------------
# Environment variable names
# ---------------------------------------------------------------------------
# LLM secrets: TREESEARCH_LLM_* preferred, OPENAI_* as fallback
_ENV_LLM_API_KEY = "TREESEARCH_LLM_API_KEY"
_ENV_LLM_BASE_URL = "TREESEARCH_LLM_BASE_URL"
_ENV_API_KEY_FALLBACK = "OPENAI_API_KEY"
_ENV_BASE_URL_FALLBACK = "OPENAI_BASE_URL"

# Model names (env, overridable by YAML)
_ENV_MODEL = "TREESEARCH_MODEL"

# Search overrides (env, overridable by YAML)
_ENV_STRATEGY = "TREESEARCH_STRATEGY"
_ENV_MAX_LLM_CALLS = "TREESEARCH_MAX_LLM_CALLS"
_ENV_THRESHOLD = "TREESEARCH_THRESHOLD"
_ENV_THINKING_TYPE = "TREESEARCH_THINKING_TYPE"


# ---------------------------------------------------------------------------
# Type-safe YAML value coercion
# ---------------------------------------------------------------------------

def _coerce_value(value: Any, target_type: type, field_name: str) -> Any:
    """Coerce a YAML value to the expected dataclass field type.

    Returns the coerced value on success, or None on failure (with a warning).
    """
    if value is None:
        return None

    # Unwrap Optional[X] -> X
    origin = getattr(target_type, "__origin__", None)
    if origin is type(None):
        return None
    # Handle Optional (Union[X, None])
    args = getattr(target_type, "__args__", None)
    if args and type(None) in args:
        inner_types = [a for a in args if a is not type(None)]
        if inner_types:
            target_type = inner_types[0]

    # Already correct type
    if isinstance(value, target_type):
        return value

    try:
        if target_type is bool:
            if isinstance(value, str):
                return value.lower() in ("1", "true", "yes")
            return bool(value)
        if target_type is int:
            return int(value)
        if target_type is float:
            return float(value)
        if target_type is str:
            return str(value)
        return value
    except (ValueError, TypeError) as e:
        logger.warning("YAML field '%s': cannot convert %r to %s, using default. Error: %s",
                       field_name, value, target_type.__name__, e)
        return None


def _apply_yaml_to_dataclass(instance: Any, yaml_dict: Dict[str, Any]) -> None:
    """Apply YAML dict values to a dataclass instance with type coercion.

    Automatically iterates all fields from the dataclass definition.
    Unknown keys in YAML are silently ignored.
    """
    if not isinstance(yaml_dict, dict):
        return
    for f in fields(instance):
        if f.name not in yaml_dict:
            continue
        coerced = _coerce_value(yaml_dict[f.name], f.type, f.name)
        if coerced is not None:
            setattr(instance, f.name, coerced)


# ---------------------------------------------------------------------------
# Sub-config dataclasses
# ---------------------------------------------------------------------------

@dataclass
class BestFirstConfig:
    """Configuration for best-first tree search.

    Controls text excerpts, adaptive depth, dynamic threshold, and context window.
    """
    threshold: float = 0.15
    max_llm_calls: int = 30
    max_results: int = 5
    bm25_weight: float = 0.5
    depth_penalty: float = 0.02
    text_excerpt_len: int = 800
    adaptive_depth_threshold: int = 0
    dynamic_threshold: bool = True
    min_threshold: float = 0.1
    max_prompt_tokens: int = 60000


@dataclass
class SearchConfig:
    """Configuration for search operations."""
    strategy: str = "fts5_only"
    max_nodes_per_doc: int = 5
    top_k_docs: int = 3
    value_threshold: float = 0.15
    max_llm_calls: int = 30
    use_bm25: bool = True


@dataclass
class FTSConfig:
    """Configuration for SQLite FTS5 full-text search engine.

    Controls whether FTS5 is used as the pre-filter backend,
    database path for persistent indexing, and column weights.
    """
    enabled: bool = True
    db_path: str = ""  # empty = in-memory, set path for persistent index
    title_weight: float = 5.0
    summary_weight: float = 2.0
    body_weight: float = 10.0
    code_weight: float = 1.0
    front_matter_weight: float = 2.0
    auto_index: bool = True  # auto-index documents on first search


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


# ---------------------------------------------------------------------------
# Top-level config
# ---------------------------------------------------------------------------

@dataclass
class TreeSearchConfig:
    """Top-level configuration for TreeSearch.

    Loading order per field:
        secrets  -> env only
                    LLM: TREESEARCH_LLM_API_KEY > OPENAI_API_KEY
                         TREESEARCH_LLM_BASE_URL > OPENAI_BASE_URL
        models   -> env > YAML > default
        tuning   -> YAML > default  (search, index sub-configs)
    """
    # LLM settings (secrets from env, model from env/YAML)
    model: str = "gpt-4o-mini"
    api_key: Optional[str] = None
    base_url: Optional[str] = None

    # LLM thinking mode: "disabled" | "enabled" | "auto"
    thinking_type: str = "disabled"

    # Sub-configs (tuning, from YAML)
    search: SearchConfig = field(default_factory=SearchConfig)
    best_first: BestFirstConfig = field(default_factory=BestFirstConfig)
    index: IndexConfig = field(default_factory=IndexConfig)
    fts: FTSConfig = field(default_factory=FTSConfig)

    @classmethod
    def from_env(cls, yaml_path: Optional[str] = None) -> "TreeSearchConfig":
        """Create config by merging: env vars > YAML file > built-in defaults.

        Args:
            yaml_path: Optional path to YAML config. If None, tries ~/.treesearch/config.yaml.

        Secrets (api_key, base_url) come from env vars ONLY.
        Model names come from env vars first, then YAML, then defaults.
        Tuning parameters come from YAML first, then defaults.
        """
        yaml_data = _load_yaml_config(yaml_path)
        config = cls()

        # --- Secrets: env only (TREESEARCH_LLM_* > OPENAI_* fallback) ---
        config.api_key = os.getenv(_ENV_LLM_API_KEY) or os.getenv(_ENV_API_KEY_FALLBACK)
        config.base_url = os.getenv(_ENV_LLM_BASE_URL) or os.getenv(_ENV_BASE_URL_FALLBACK)

        # --- Model names: env > YAML > default ---
        config.model = os.getenv(_ENV_MODEL) or yaml_data.get("model") or cls.model

        # --- thinking_type: env > YAML > default ---
        env_thinking = os.getenv(_ENV_THINKING_TYPE)
        if env_thinking is not None:
            config.thinking_type = env_thinking.strip().lower()
        elif "thinking_type" in yaml_data:
            config.thinking_type = str(yaml_data["thinking_type"]).strip().lower()

        # --- Sub-configs: YAML > default (auto-iterate dataclass fields) ---
        _apply_yaml_to_dataclass(config.search, yaml_data.get("search", {}))
        _apply_yaml_to_dataclass(config.best_first, yaml_data.get("best_first", {}))
        _apply_yaml_to_dataclass(config.index, yaml_data.get("index", {}))
        _apply_yaml_to_dataclass(config.fts, yaml_data.get("fts", {}))

        # --- Env overrides for search (highest priority after set_config) ---
        env_strategy = os.getenv(_ENV_STRATEGY)
        if env_strategy:
            config.search.strategy = env_strategy
        env_max_llm = os.getenv(_ENV_MAX_LLM_CALLS)
        if env_max_llm:
            coerced = _coerce_value(env_max_llm, int, "TREESEARCH_MAX_LLM_CALLS")
            if coerced is not None:
                config.search.max_llm_calls = coerced
        env_threshold = os.getenv(_ENV_THRESHOLD)
        if env_threshold:
            coerced = _coerce_value(env_threshold, float, "TREESEARCH_THRESHOLD")
            if coerced is not None:
                config.search.value_threshold = coerced

        return config


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------
_default_config: Optional[TreeSearchConfig] = None


def get_config(reload: bool = False) -> TreeSearchConfig:
    """Get the global default configuration (lazy singleton).

    First call merges: env vars > ~/.treesearch/config.yaml > built-in defaults.

    Args:
        reload: If True, force re-read from env + YAML (same as reset + get).
    """
    global _default_config
    if reload or _default_config is None:
        _default_config = TreeSearchConfig.from_env()
    return _default_config


def set_config(config: TreeSearchConfig) -> None:
    """Set the global default configuration (highest priority)."""
    global _default_config
    _default_config = config


def reset_config() -> None:
    """Reset global config to None, forcing re-initialization on next get_config() call."""
    global _default_config
    _default_config = None
