"""模型预设存储层 + 物化映射测试（ADR-0009）。

每个用例用独立临时目录隔离 model_presets.json，互不污染真实配置。
"""
from pathlib import Path

import pytest

from doclens.web_v2 import presets_store
from doclens.web_v2.api.presets import _materialize


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    """把全局预设目录重定向到临时目录。"""
    monkeypatch.setattr(presets_store, "get_global_cortex_dir", lambda: Path(tmp_path))
    yield


def _llm(**over):
    base = {
        "name": "MiniMax",
        "kind": "llm",
        "protocol": "openai_compat",
        "base_url": "https://x",
        "model_id": "M1",
        "api_key": "sk-1",
        "context_window": 200000,
    }
    base.update(over)
    return base


def _vision(**over):
    base = {
        "name": "vl",
        "kind": "vision",
        "protocol": "openai_compat",
        "base_url": "https://u",
        "model_id": "vl-max",
        "api_key": "sk-v",
    }
    base.update(over)
    return base


def test_create_masks_api_key():
    p = presets_store.create_preset(_llm())
    assert p["api_key"] == "***"
    assert presets_store.get_preset_raw(p["id"])["api_key"] == "sk-1"


def test_list_filter_by_kind():
    presets_store.create_preset(_llm())
    presets_store.create_preset(_vision())
    assert len(presets_store.list_presets()) == 2
    assert len(presets_store.list_presets("llm")) == 1
    assert len(presets_store.list_presets("vision")) == 1


def test_dup_name_case_insensitive_conflict():
    presets_store.create_preset(_llm(name="MiniMax"))
    with pytest.raises(presets_store.PresetError):
        presets_store.create_preset(_llm(name="minimax"))


def test_same_name_different_kind_ok():
    presets_store.create_preset(_llm(name="Main"))
    p2 = presets_store.create_preset(_vision(name="Main"))
    assert p2["id"]


def test_update_mask_keeps_key():
    p = presets_store.create_preset(_llm())
    u = presets_store.update_preset(p["id"], {"model_id": "M2", "api_key": "***"})
    assert u["model_id"] == "M2"
    assert presets_store.get_preset_raw(p["id"])["api_key"] == "sk-1"


def test_update_change_key():
    p = presets_store.create_preset(_llm())
    presets_store.update_preset(p["id"], {"api_key": "sk-new"})
    assert presets_store.get_preset_raw(p["id"])["api_key"] == "sk-new"


def test_update_rename_conflict():
    p1 = presets_store.create_preset(_llm(name="A"))
    presets_store.create_preset(_llm(name="B"))
    with pytest.raises(presets_store.PresetError):
        presets_store.update_preset(p1["id"], {"name": "b"})


def test_update_nonexistent_raises():
    with pytest.raises(presets_store.PresetError):
        presets_store.update_preset("nope", {"name": "x"})


def test_delete_idempotent():
    p = presets_store.create_preset(_llm())
    assert presets_store.delete_preset(p["id"]) is True
    assert presets_store.delete_preset(p["id"]) is False


def test_materialize_llm():
    out = _materialize({
        "kind": "llm",
        "protocol": "openai_compat",
        "base_url": "https://x",
        "model_id": "M1",
        "api_key": "sk",
        "name": "N",
        "context_window": 128000,
    })
    assert out["PLANIFY_PROTOCOL"] == "openai_compat"
    assert out["PLANIFY_API_KEY"] == "sk"
    assert out["PLANIFY_CONTEXT_WINDOW"] == "128000"
    assert out["CORTEX_ACTIVE_LLM_PRESET"] == "N"


def test_materialize_vision_openai_compat_writes_empty_protocol():
    out = _materialize({
        "kind": "vision",
        "protocol": "openai_compat",
        "base_url": "https://x",
        "model_id": "vl",
        "api_key": "sk",
        "name": "N",
    })
    # 向后兼容：openai_compat → 空串（vision_protocol 空串语义即 OpenAI 兼容，
    # 且避免 vision_model_tag 的 proto 段无谓变化触发全量重解析）
    assert out["VISION_PROTOCOL"] == ""
    assert out["VISION_MODEL"] == "vl"
    assert out["CORTEX_ACTIVE_VISION_PRESET"] == "N"
    assert "PLANIFY_CONTEXT_WINDOW" not in out


def test_materialize_vision_anthropic():
    out = _materialize({
        "kind": "vision",
        "protocol": "anthropic",
        "base_url": "https://x",
        "model_id": "vl",
        "api_key": "sk",
        "name": "N",
    })
    assert out["VISION_PROTOCOL"] == "anthropic"


def test_materialize_llm_without_context_window_omits_key():
    out = _materialize({
        "kind": "llm",
        "protocol": "anthropic",
        "base_url": "",
        "model_id": "M",
        "api_key": "sk",
        "name": "N",
        "context_window": None,
    })
    assert "PLANIFY_CONTEXT_WINDOW" not in out
