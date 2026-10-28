"""即梦余额查询测试（GET /api/config/jimeng-balance + ark_balance 模块）。

mock httpx 层（不真实联网），验证：未配置 AK/SK 的 no_credentials、
成功解析余额字段、V4 错误结构报错。
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest import mock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    """最小 FastAPI app（只挂 probe_jimeng 路由）+ 隔离全局 env 目录。"""
    monkeypatch.setattr(
        "doclens.web_v2.config_store.get_global_cortex_dir", lambda: Path(tmp_path)
    )
    from doclens.web_v2.api.errors import register_error_handlers
    from doclens.web_v2.api.probe_jimeng import router
    from fastapi import FastAPI

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router, prefix="/api")
    return TestClient(app)


def _write_env(tmp_path: Path, values: dict[str, str]):
    (tmp_path / ".env").write_text(
        "\n".join(f"{k}={v}" for k, v in values.items()), encoding="utf-8"
    )


class _FakeResp:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


def test_balance_no_credentials(client, tmp_path):
    """未配置 AK/SK → kind=no_credentials（前端显示配置引导）。"""
    r = client.get("/api/config/jimeng-balance")
    assert r.status_code == 200
    assert r.json()["kind"] == "no_credentials"


def test_balance_success(client, tmp_path):
    """配置 AK/SK + 接口正常 → 解析余额字段。"""
    _write_env(
        tmp_path,
        {"JIMENG_ACCESS_KEY": "ak-test", "JIMENG_SECRET_KEY": "sk-test"},
    )
    payload = {
        "ResponseMetadata": {"RequestId": "x"},
        "Result": {
            "AccountID": 2100,
            "ArrearsBalance": "0.00",
            "AvailableBalance": "77.01",
            "CashBalance": "83.01",
            "CreditLimit": "0.01",
            "FreezeAmount": "5.01",
        },
    }
    with mock.patch(
        "doclens.jimeng.ark_balance.httpx.AsyncClient"
    ) as cli:
        instance = cli.return_value.__aenter__.return_value
        instance.get.return_value = _FakeResp(200, payload)
        r = client.get("/api/config/jimeng-balance")
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "balance"
    assert body["available"] == pytest.approx(77.01)
    assert body["cash"] == pytest.approx(83.01)
    assert body["credit_limit"] == pytest.approx(0.01)
    assert body["frozen"] == pytest.approx(5.01)
    assert body["arrears"] == pytest.approx(0.0)


def test_balance_api_error(client, tmp_path):
    """V4 错误结构（ResponseMetadata.Error）→ 502 BALANCE_FAILED。"""
    _write_env(
        tmp_path,
        {"JIMENG_ACCESS_KEY": "ak-test", "JIMENG_SECRET_KEY": "sk-test"},
    )
    payload = {
        "ResponseMetadata": {
            "Error": {"Code": "SignatureDoesNotMatch", "Message": "bad sig"}
        }
    }
    with mock.patch(
        "doclens.jimeng.ark_balance.httpx.AsyncClient"
    ) as cli:
        instance = cli.return_value.__aenter__.return_value
        instance.get.return_value = _FakeResp(400, payload)
        r = client.get("/api/config/jimeng-balance")
    assert r.status_code == 502
    assert "bad sig" in r.json()["detail"]


def test_sign_v4_structure():
    """签名函数冒烟：产出 HMAC-SHA256 Credential 头，含 canonical scope。"""
    from doclens.jimeng.ark_balance import _sign_v4_get

    auth, x_date = _sign_v4_get(
        ak="AKTEST",
        sk="SKTEST",
        host="billing.volcengineapi.com",
        region="cn-beijing",
        service="billing",
        action="QueryBalanceAcct",
        version="2022-01-01",
        x_date="20261028T120000Z",
    )
    assert auth.startswith("HMAC-SHA256 Credential=AKTEST/20261028/cn-beijing/billing/request")
    assert "SignedHeaders=host;x-date" in auth
    assert len(auth.split("Signature=")[1]) == 64  # sha256 hex
    assert x_date == "20261028T120000Z"
