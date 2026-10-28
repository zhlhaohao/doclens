"""即梦配置探测端点测试（POST /api/config/probe-jimeng）。

mock Ark HTTP 层（不真实联网），验证：占位/空 key 回退已保存值、
未配置报错、成功/失败消息格式。
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest import mock

import pytest
from fastapi.testclient import TestClient

from doclens.jimeng import client as jm


@pytest.fixture
def client(tmp_path, monkeypatch):
    """最小 FastAPI app（只挂 probe_jimeng 路由）+ 隔离全局 env 目录。"""
    monkeypatch.setattr(
        "doclens.web_v2.config_store.get_global_cortex_dir", lambda: Path(tmp_path)
    )
    from doclens.web_v2.api.probe_jimeng import router
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router, prefix="/api")
    return TestClient(app)


def _fake_ok(payload: dict):
    r = mock.MagicMock()
    r.read.return_value = json.dumps(payload).encode()
    r.__enter__.return_value = r
    return r


def test_probe_no_key(client):
    r = client.post("/api/config/probe-jimeng", json={"api_key": "", "model": ""})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert "API Key" in body["message"]


def test_probe_form_key_success(client):
    resp = _fake_ok({"data": [{"url": "https://x/1.png"}]})
    with mock.patch.object(jm.urllib.request, "urlopen", return_value=resp):
        r = client.post(
            "/api/config/probe-jimeng",
            json={"api_key": "form-key", "model": ""},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "1 张" in body["message"]
    assert body["model"] == "doubao-seedream-4-0"


def test_probe_mask_falls_back_to_saved(client, tmp_path):
    """表单 key=***（未改动占位）→ 回退已保存全局 .env 值。"""
    (tmp_path / ".env").write_text(
        "JIMENG_API_KEY=saved-key\nJIMENG_MODEL=my-model\n", encoding="utf-8"
    )
    resp = _fake_ok({"data": [{"url": "https://x/1.png"}]})
    with mock.patch.object(jm.urllib.request, "urlopen", return_value=resp) as m:
        r = client.post(
            "/api/config/probe-jimeng",
            json={"api_key": "***", "model": ""},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["model"] == "my-model"
    req = m.call_args[0][0]
    assert req.headers["Authorization"] == "Bearer saved-key"


def test_probe_api_error(client):
    resp = _fake_ok({"error": {"code": "AuthFailure", "message": "bad key"}})
    with mock.patch.object(jm.urllib.request, "urlopen", return_value=resp):
        r = client.post(
            "/api/config/probe-jimeng",
            json={"api_key": "bad", "model": ""},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert "AuthFailure" in body["message"]
