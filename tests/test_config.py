# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.config module.
"""
import os
from unittest.mock import patch

import pytest
from treesearch.config import (
    SearchConfig,
    IndexConfig,
    AnswerConfig,
    TreeSearchConfig,
    get_config,
    set_config,
)


# ---------------------------------------------------------------------------
# SearchConfig
# ---------------------------------------------------------------------------

class TestSearchConfig:
    def test_defaults(self):
        c = SearchConfig()
        assert c.strategy == "best_first"
        assert c.max_nodes_per_doc == 5
        assert c.top_k_docs == 3
        assert c.value_threshold == 0.3
        assert c.max_llm_calls == 30
        assert c.use_bm25 is True
        assert c.mcts_iterations == 10


# ---------------------------------------------------------------------------
# IndexConfig
# ---------------------------------------------------------------------------

class TestIndexConfig:
    def test_defaults(self):
        c = IndexConfig()
        assert c.if_add_node_summary is True
        assert c.if_add_doc_description is True
        assert c.max_concurrency == 5
        assert c.min_token_threshold == 5000


# ---------------------------------------------------------------------------
# AnswerConfig
# ---------------------------------------------------------------------------

class TestAnswerConfig:
    def test_defaults(self):
        c = AnswerConfig()
        assert c.answer_mode == "extractive"
        assert c.max_context_tokens == 8000


# ---------------------------------------------------------------------------
# TreeSearchConfig
# ---------------------------------------------------------------------------

class TestTreeSearchConfig:
    def test_defaults(self):
        c = TreeSearchConfig()
        assert isinstance(c.search, SearchConfig)
        assert isinstance(c.index, IndexConfig)
        assert isinstance(c.answer, AnswerConfig)
        assert c.use_embedding is False

    def test_from_env(self):
        env = {
            "TREESEARCH_MODEL": "gpt-4o",
            "TREESEARCH_STRATEGY": "mcts",
            "TREESEARCH_MAX_LLM_CALLS": "50",
            "TREESEARCH_THRESHOLD": "0.5",
            "TREESEARCH_USE_EMBEDDING": "true",
            "TREESEARCH_ANSWER_MODE": "generative",
        }
        with patch.dict(os.environ, env, clear=False):
            c = TreeSearchConfig.from_env()

        assert c.search.strategy == "mcts"
        assert c.search.max_llm_calls == 50
        assert c.search.value_threshold == 0.5
        assert c.use_embedding is True
        assert c.answer.answer_mode == "generative"

    def test_from_env_no_overrides(self):
        """Without env vars set, defaults should apply."""
        # Temporarily remove any TREESEARCH_ env vars
        env_keys = [k for k in os.environ if k.startswith("TREESEARCH_")]
        with patch.dict(os.environ, {k: "" for k in env_keys}, clear=False):
            # Remove them entirely
            for k in env_keys:
                os.environ.pop(k, None)
            c = TreeSearchConfig.from_env()

        assert c.search.strategy == "best_first"
        assert c.search.max_llm_calls == 30


# ---------------------------------------------------------------------------
# get_config / set_config
# ---------------------------------------------------------------------------

class TestConfigSingleton:
    def test_get_config_returns_instance(self):
        import treesearch.config as cfg_mod
        cfg_mod._default_config = None  # Reset
        c = get_config()
        assert isinstance(c, TreeSearchConfig)

    def test_set_config(self):
        import treesearch.config as cfg_mod
        custom = TreeSearchConfig(model="custom-model")
        set_config(custom)
        assert get_config().model == "custom-model"
        # Reset
        cfg_mod._default_config = None

    def test_singleton_returns_same_instance(self):
        import treesearch.config as cfg_mod
        cfg_mod._default_config = None
        c1 = get_config()
        c2 = get_config()
        assert c1 is c2
        cfg_mod._default_config = None
