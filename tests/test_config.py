# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.config module.
"""
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import yaml
from treesearch.config import (
    SearchConfig,
    BestFirstConfig,
    IndexConfig,
    FTSConfig,
    TreeSearchConfig,
    get_config,
    set_config,
    reset_config,
    _coerce_value,
    _apply_yaml_to_dataclass,
)


# ---------------------------------------------------------------------------
# SearchConfig
# ---------------------------------------------------------------------------

class TestSearchConfig:
    def test_defaults(self):
        c = SearchConfig()
        assert c.strategy == "fts5_only"
        assert c.max_nodes_per_doc == 5
        assert c.top_k_docs == 3
        assert c.value_threshold == 0.15
        assert c.max_llm_calls == 30
        assert c.use_bm25 is True


# ---------------------------------------------------------------------------
# BestFirstConfig
# ---------------------------------------------------------------------------

class TestBestFirstConfig:
    def test_defaults(self):
        c = BestFirstConfig()
        assert c.threshold == 0.15
        assert c.max_llm_calls == 30
        assert c.max_results == 5
        assert c.bm25_weight == 0.5
        assert c.depth_penalty == 0.02
        assert c.text_excerpt_len == 800
        assert c.adaptive_depth_threshold == 0
        assert c.dynamic_threshold is True
        assert c.min_threshold == 0.1
        assert c.max_prompt_tokens == 60000


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
# FTSConfig
# ---------------------------------------------------------------------------

class TestFTSConfig:
    def test_defaults(self):
        c = FTSConfig()
        assert c.enabled is True
        assert c.db_path == ""
        assert c.title_weight == 5.0
        assert c.summary_weight == 2.0
        assert c.body_weight == 10.0
        assert c.code_weight == 1.0
        assert c.front_matter_weight == 2.0
        assert c.auto_index is True


# ---------------------------------------------------------------------------
# TreeSearchConfig
# ---------------------------------------------------------------------------

class TestTreeSearchConfig:
    def test_defaults(self):
        c = TreeSearchConfig()
        assert c.model == "gpt-4o-mini"
        assert c.api_key is None
        assert c.base_url is None
        assert isinstance(c.search, SearchConfig)
        assert isinstance(c.best_first, BestFirstConfig)
        assert isinstance(c.index, IndexConfig)
        assert isinstance(c.fts, FTSConfig)


# ---------------------------------------------------------------------------
# Type coercion
# ---------------------------------------------------------------------------

class TestCoerceValue:
    def test_bool_from_string(self):
        assert _coerce_value("true", bool, "test") is True
        assert _coerce_value("yes", bool, "test") is True
        assert _coerce_value("1", bool, "test") is True
        assert _coerce_value("false", bool, "test") is False
        assert _coerce_value("no", bool, "test") is False

    def test_int_from_string(self):
        assert _coerce_value("42", int, "test") == 42

    def test_float_from_string(self):
        assert _coerce_value("0.5", float, "test") == 0.5

    def test_invalid_int_returns_none(self):
        assert _coerce_value("abc", int, "test") is None

    def test_invalid_float_returns_none(self):
        assert _coerce_value("not_a_float", float, "test") is None

    def test_none_input_returns_none(self):
        assert _coerce_value(None, int, "test") is None

    def test_correct_type_passes_through(self):
        assert _coerce_value(42, int, "test") == 42
        assert _coerce_value(0.5, float, "test") == 0.5
        assert _coerce_value(True, bool, "test") is True


class TestApplyYamlToDataclass:
    def test_apply_known_fields(self):
        sc = SearchConfig()
        _apply_yaml_to_dataclass(sc, {"strategy": "best_first", "max_llm_calls": 50})
        assert sc.strategy == "best_first"
        assert sc.max_llm_calls == 50

    def test_unknown_keys_ignored(self):
        sc = SearchConfig()
        _apply_yaml_to_dataclass(sc, {"unknown_field": "ignored", "strategy": "best_first"})
        assert sc.strategy == "best_first"
        assert not hasattr(sc, "unknown_field") or sc.strategy == "best_first"

    def test_invalid_type_keeps_default(self):
        sc = SearchConfig()
        _apply_yaml_to_dataclass(sc, {"max_llm_calls": "not_a_number"})
        assert sc.max_llm_calls == 30  # default

    def test_string_to_int_coercion(self):
        sc = SearchConfig()
        _apply_yaml_to_dataclass(sc, {"max_llm_calls": "50"})
        assert sc.max_llm_calls == 50

    def test_non_dict_input(self):
        """Non-dict input is silently ignored."""
        sc = SearchConfig()
        _apply_yaml_to_dataclass(sc, "not_a_dict")
        assert sc.strategy == "fts5_only"

    def test_auto_iterate_all_fields(self):
        """All SearchConfig fields can be set from YAML without hardcoding."""
        sc = SearchConfig()
        yaml_data = {
            "strategy": "best_first",
            "max_nodes_per_doc": 10,
            "top_k_docs": 5,
            "value_threshold": 0.5,
            "max_llm_calls": 50,
            "use_bm25": False,
        }
        _apply_yaml_to_dataclass(sc, yaml_data)
        assert sc.strategy == "best_first"
        assert sc.max_nodes_per_doc == 10
        assert sc.top_k_docs == 5
        assert sc.value_threshold == 0.5
        assert sc.max_llm_calls == 50
        assert sc.use_bm25 is False


# ---------------------------------------------------------------------------
# from_env: env vars (TREESEARCH_LLM_* > OPENAI_* fallback)
# ---------------------------------------------------------------------------

class TestFromEnvVars:
    """Secrets and model names come from env vars."""

    def test_treesearch_llm_env_preferred(self):
        """TREESEARCH_LLM_API_KEY takes priority over OPENAI_API_KEY."""
        env = {
            "TREESEARCH_LLM_API_KEY": "sk-treesearch",
            "OPENAI_API_KEY": "sk-openai-fallback",
            "TREESEARCH_LLM_BASE_URL": "https://ts.api.com",
            "OPENAI_BASE_URL": "https://openai-fallback.api.com",
        }
        with patch.dict(os.environ, env, clear=False):
            c = TreeSearchConfig.from_env()
        assert c.api_key == "sk-treesearch"
        assert c.base_url == "https://ts.api.com"

    def test_openai_env_fallback(self):
        """Without TREESEARCH_LLM_*, falls back to OPENAI_*."""
        keys_to_clear = ["TREESEARCH_LLM_API_KEY", "TREESEARCH_LLM_BASE_URL"]
        env = {
            "OPENAI_API_KEY": "sk-openai",
            "OPENAI_BASE_URL": "https://openai.api.com",
        }
        with patch.dict(os.environ, env, clear=False):
            for k in keys_to_clear:
                os.environ.pop(k, None)
            c = TreeSearchConfig.from_env()
        assert c.api_key == "sk-openai"
        assert c.base_url == "https://openai.api.com"

    def test_embedding_env(self):
        """Embedding env vars are no longer used (removed)."""
        pass

    def test_model_from_env(self):
        env = {
            "TREESEARCH_MODEL": "gpt-4o",
        }
        with patch.dict(os.environ, env, clear=False):
            c = TreeSearchConfig.from_env()
        assert c.model == "gpt-4o"

    def test_search_overrides_from_env(self):
        env = {
            "TREESEARCH_STRATEGY": "best_first",
            "TREESEARCH_MAX_LLM_CALLS": "50",
            "TREESEARCH_THRESHOLD": "0.5",
        }
        with patch.dict(os.environ, env, clear=False):
            c = TreeSearchConfig.from_env()
        assert c.search.strategy == "best_first"
        assert c.search.max_llm_calls == 50
        assert c.search.value_threshold == 0.5

    def test_invalid_env_max_llm_calls_keeps_default(self):
        """Invalid env value for max_llm_calls falls back to default."""
        env = {"TREESEARCH_MAX_LLM_CALLS": "not_a_number"}
        with patch.dict(os.environ, env, clear=False):
            c = TreeSearchConfig.from_env()
        assert c.search.max_llm_calls == 30  # default

    def test_invalid_env_threshold_keeps_default(self):
        """Invalid env value for threshold falls back to default."""
        env = {"TREESEARCH_THRESHOLD": "invalid"}
        with patch("treesearch.config._load_yaml_config", return_value={}):
            with patch.dict(os.environ, env, clear=False):
                c = TreeSearchConfig.from_env()
        assert c.search.value_threshold == 0.15  # default

    def test_no_env_uses_defaults(self):
        """Without env vars, defaults apply."""
        keys_to_clear = [k for k in os.environ if k.startswith(("TREESEARCH_", "OPENAI_"))]
        with patch("treesearch.config._load_yaml_config", return_value={}):
            with patch.dict(os.environ, {}, clear=False):
                for k in keys_to_clear:
                    os.environ.pop(k, None)
                c = TreeSearchConfig.from_env()
        assert c.model == "gpt-4o-mini"
        assert c.api_key is None
        assert c.search.strategy == "fts5_only"
        assert c.search.max_llm_calls == 30


# ---------------------------------------------------------------------------
# from_env: YAML (optional, non-secret tuning)
# ---------------------------------------------------------------------------

class TestFromEnvWithYaml:
    """YAML provides tuning parameters, env vars override secrets/models."""

    def test_yaml_tuning(self):
        """YAML sets tuning params, no secrets."""
        yaml_data = {
            "model": "gpt-4o",
            "search": {"strategy": "best_first", "max_llm_calls": 50},
            "fts": {"enabled": True, "db_path": "/tmp/test.db", "title_weight": 15.0},
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(yaml_data, f)
            tmp_path = f.name
        try:
            keys_to_clear = [k for k in os.environ if k.startswith("TREESEARCH_MODEL")]
            with patch.dict(os.environ, {}, clear=False):
                for k in keys_to_clear:
                    os.environ.pop(k, None)
                c = TreeSearchConfig.from_env(yaml_path=tmp_path)
            assert c.model == "gpt-4o"
            assert c.search.strategy == "best_first"
            assert c.search.max_llm_calls == 50
            assert c.fts.enabled is True
            assert c.fts.db_path == "/tmp/test.db"
            assert c.fts.title_weight == 15.0
            # Unset fields keep defaults
            assert c.search.top_k_docs == 3
        finally:
            os.unlink(tmp_path)

    def test_env_overrides_yaml_model(self):
        """Env var TREESEARCH_MODEL takes priority over YAML model."""
        yaml_data = {"model": "gpt-4o-from-yaml"}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(yaml_data, f)
            tmp_path = f.name
        try:
            with patch.dict(os.environ, {"TREESEARCH_MODEL": "gpt-4o-from-env"}, clear=False):
                c = TreeSearchConfig.from_env(yaml_path=tmp_path)
            assert c.model == "gpt-4o-from-env"
        finally:
            os.unlink(tmp_path)

    def test_env_overrides_yaml_strategy(self):
        """Env var TREESEARCH_STRATEGY takes priority over YAML search.strategy."""
        yaml_data = {"search": {"strategy": "best_first"}}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(yaml_data, f)
            tmp_path = f.name
        try:
            with patch.dict(os.environ, {"TREESEARCH_STRATEGY": "best_first"}, clear=False):
                c = TreeSearchConfig.from_env(yaml_path=tmp_path)
            assert c.search.strategy == "best_first"
        finally:
            os.unlink(tmp_path)

    def test_secrets_not_from_yaml(self):
        """Even if YAML has api_key, it is ignored -- secrets come from env only."""
        yaml_data = {"api_key": "sk-from-yaml-should-be-ignored"}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(yaml_data, f)
            tmp_path = f.name
        try:
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("TREESEARCH_LLM_API_KEY", None)
                c = TreeSearchConfig.from_env(yaml_path=tmp_path)
            assert c.api_key is None
        finally:
            os.unlink(tmp_path)

    def test_yaml_bad_type_keeps_default(self):
        """YAML with wrong type value falls back to default."""
        yaml_data = {"search": {"max_llm_calls": "not_a_number"}}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(yaml_data, f)
            tmp_path = f.name
        try:
            c = TreeSearchConfig.from_env(yaml_path=tmp_path)
            assert c.search.max_llm_calls == 30
        finally:
            os.unlink(tmp_path)

    def test_nonexistent_yaml(self):
        """Non-existent YAML is silently skipped."""
        c = TreeSearchConfig.from_env(yaml_path="/tmp/nonexistent_treesearch_config.yaml")
        assert c.model == "gpt-4o-mini"

    def test_empty_yaml(self):
        """Empty YAML file uses defaults."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("")
            tmp_path = f.name
        try:
            c = TreeSearchConfig.from_env(yaml_path=tmp_path)
            assert c.model == "gpt-4o-mini"
        finally:
            os.unlink(tmp_path)

    def test_global_yaml_path(self):
        """from_env() without yaml_path tries ~/.treesearch/config.yaml."""
        with patch("treesearch.config._load_yaml_config", return_value={"model": "from-global"}):
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop("TREESEARCH_MODEL", None)
                c = TreeSearchConfig.from_env()
            assert c.model == "from-global"


# ---------------------------------------------------------------------------
# get_config / set_config / reset_config / reload
# ---------------------------------------------------------------------------

class TestConfigSingleton:
    def test_get_config_returns_instance(self):
        reset_config()
        c = get_config()
        assert isinstance(c, TreeSearchConfig)
        reset_config()

    def test_set_config(self):
        custom = TreeSearchConfig(model="custom-model")
        set_config(custom)
        assert get_config().model == "custom-model"
        reset_config()

    def test_singleton_returns_same_instance(self):
        reset_config()
        c1 = get_config()
        c2 = get_config()
        assert c1 is c2
        reset_config()

    def test_reset_config(self):
        """reset_config() forces re-initialization on next get_config()."""
        c1 = get_config()
        reset_config()
        c2 = get_config()
        assert c1 is not c2
        reset_config()

    def test_reload_forces_reinit(self):
        """get_config(reload=True) re-reads env + YAML."""
        reset_config()
        c1 = get_config()
        c2 = get_config(reload=True)
        assert c1 is not c2
        reset_config()

    def test_reload_picks_up_new_env(self):
        """get_config(reload=True) picks up newly set env vars."""
        reset_config()
        keys_to_clear = [k for k in os.environ if k.startswith(("TREESEARCH_", "OPENAI_"))]
        with patch.dict(os.environ, {}, clear=False):
            for k in keys_to_clear:
                os.environ.pop(k, None)
            c1 = get_config()
            assert c1.api_key is None
            os.environ["TREESEARCH_LLM_API_KEY"] = "sk-new-key"
            c2 = get_config(reload=True)
            assert c2.api_key == "sk-new-key"
            os.environ.pop("TREESEARCH_LLM_API_KEY", None)
        reset_config()
