"""套餐额度查询（quota_probe）解析与端点测试（2026-10-27）。

覆盖：base_url 供应商识别、GLM/Kimi/MiniMax/DeepSeek 响应解析、
异步端点密钥回源与失败语义（502）、未知供应商 kind=none。
"""
import pytest

from doclens.web_v2 import quota_probe
from doclens.web_v2.quota_probe import (
    QuotaProbeError,
    detect_endpoint,
    fetch_quota,
)


# ---------------------------------------------------------------------------
# 供应商识别
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "base_url,provider",
    [
        ("https://open.bigmodel.cn/api/paas/v4", "glm"),
        ("https://api.z.ai/api/paas/v4", "glm"),
        ("https://api.kimi.com/coding", "kimi"),
        ("https://www.minimaxi.com/v1", "minimax"),
        ("https://api.minimaxi.com/anthropic", "minimax"),
        ("https://api.minimax.cn/v1", "minimax"),
        ("https://api.deepseek.com", "deepseek"),
        ("https://api.deepseek.com/v1", "deepseek"),
    ],
)
def test_detect_endpoint(base_url, provider):
    ep = detect_endpoint(base_url)
    assert ep is not None and ep.provider == provider


@pytest.mark.parametrize(
    "base_url",
    [
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "https://one-api.example.com/v1",
        "",
    ],
)
def test_detect_endpoint_unknown(base_url):
    assert detect_endpoint(base_url) is None


# ---------------------------------------------------------------------------
# 解析
# ---------------------------------------------------------------------------


def _glm_payload():
    return {
        "data": {
            "level": "pro",
            "limits": [
                {  # 5h Token
                    "type": "TOKENS_LIMIT",
                    "unit": 3,
                    "number": 5,
                    "percentage": 62.4,
                    "nextResetTime": 1760000000000,
                },
                {  # 每周 Token
                    "type": "TOKENS_LIMIT",
                    "unit": 6,
                    "number": 1,
                    "percentage": 35.1,
                },
                {  # 每月 MCP —— 不展示（Q9）
                    "type": "TIME_LIMIT",
                    "percentage": 12.0,
                },
            ],
        }
    }


def test_parse_glm_windows():
    info = quota_probe._parse_glm(_glm_payload())
    assert info.kind == "windows"
    labels = [w.label for w in info.windows]
    assert labels == ["5 小时", "每周"]
    assert info.windows[0].percentage == pytest.approx(62.4)
    assert info.windows[0].next_reset_ms == 1760000000000


def test_parse_glm_empty_limits():
    info = quota_probe._parse_glm({"data": {"limits": []}})
    assert info.kind == "none"


def test_parse_kimi_old_member():
    """老会员：5h 窗口 + usage 每周额度。"""
    payload = {
        "usage": {"limit": 100, "used": 35, "remaining": 65, "resetTime": "2026-11-01T00:00:00Z"},
        "limits": [
            {
                "window": {"duration": 300, "timeUnit": "TIME_UNIT_MINUTE"},
                "detail": {"limit": 50, "used": 31, "resetTime": "2026-10-27T15:00:00Z"},
            }
        ],
    }
    info = quota_probe._parse_kimi(payload)
    assert info.kind == "windows"
    labels = [w.label for w in info.windows]
    assert "5 小时" in labels
    assert "每周" in labels
    w5 = next(w for w in info.windows if w.label == "5 小时")
    assert w5.percentage == pytest.approx(62.0)
    assert w5.next_reset_ms is not None


def test_parse_kimi_new_member_no_weekly():
    """新会员：取消每周额度，只显示 5h（Q13 修正版）。"""
    payload = {
        "limits": [
            {
                "window": {"duration": 5, "timeUnit": "TIME_UNIT_HOUR"},
                "detail": {"limit": 50, "used": 10},
            }
        ]
    }
    info = quota_probe._parse_kimi(payload)
    assert info.kind == "windows"
    assert [w.label for w in info.windows] == ["5 小时"]


def test_parse_kimi_no_5h_window():
    """无 5h 窗口但有 usage → 只显示每周。"""
    payload = {"usage": {"limit": 100, "used": 40}}
    info = quota_probe._parse_kimi(payload)
    assert info.kind == "windows"
    assert [w.label for w in info.windows] == ["每周"]


def test_parse_kimi_empty():
    assert quota_probe._parse_kimi({}).kind == "none"


def test_parse_minimax_general_only():
    """只取 general 组（Q10），接口返回剩余百分比转已用。"""
    payload = {
        "base_resp": {"status_code": 0},
        "model_remains": [
            {
                "model_name": "general",
                "current_interval_remaining_percent": 38.0,  # → 已用 62%
                "current_weekly_remaining_percent": 65.0,  # → 已用 35%
                "end_time": 1760000000000,
            },
            {"model_name": "video", "current_interval_remaining_percent": 100.0},
        ],
    }
    info = quota_probe._parse_minimax(payload)
    assert info.kind == "windows"
    labels = [w.label for w in info.windows]
    assert labels == ["5 小时", "每周"]
    assert info.windows[0].percentage == pytest.approx(62.0)
    assert info.windows[1].percentage == pytest.approx(35.0)


def test_parse_minimax_no_general():
    payload = {
        "base_resp": {"status_code": 0},
        "model_remains": [{"model_name": "video", "current_interval_remaining_percent": 100.0}],
    }
    assert quota_probe._parse_minimax(payload).kind == "none"


def test_parse_minimax_api_error():
    payload = {"base_resp": {"status_code": 1002, "status_msg": "invalid key"}}
    with pytest.raises(QuotaProbeError, match="invalid key"):
        quota_probe._parse_minimax(payload)


def test_parse_deepseek():
    payload = {
        "is_available": True,
        "balance_infos": [
            {"currency": "CNY", "total_balance": "108.50", "granted_balance": "8.50", "topped_up_balance": "100.00"}
        ],
    }
    info = quota_probe._parse_deepseek(payload)
    assert info.kind == "balance"
    assert info.balances == (("CNY", "108.50"),)
    assert info.is_available is True


def test_parse_deepseek_unavailable():
    payload = {"is_available": False, "balance_infos": [{"currency": "CNY", "total_balance": "0.00"}]}
    info = quota_probe._parse_deepseek(payload)
    assert info.kind == "balance" and info.is_available is False


# ---------------------------------------------------------------------------
# fetch_quota 集成（mock httpx）
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class _FakeClient:
    """捕获请求的假 httpx.AsyncClient。"""

    captured: dict = {}
    response: _FakeResponse = _FakeResponse()
    exc: Exception | None = None

    def __init__(self, timeout=None):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, headers=None):
        type(self).captured = {"url": url, "headers": headers}
        if type(self).exc:
            raise type(self).exc
        return type(self).response


@pytest.fixture
def fake_client(monkeypatch):
    _FakeClient.captured = {}
    _FakeClient.response = _FakeResponse()
    _FakeClient.exc = None
    monkeypatch.setattr(quota_probe.httpx, "AsyncClient", _FakeClient)
    return _FakeClient


@pytest.mark.asyncio
async def test_fetch_unknown_base_url_returns_none():
    info = await fetch_quota("https://one-api.example.com/v1", "sk-x")
    assert info.kind == "none" and info.provider is None


@pytest.mark.asyncio
async def test_fetch_glm_raw_auth(fake_client):
    """GLM 认证直接放 key，不加 Bearer。"""
    _FakeClient.response = _FakeResponse(200, _glm_payload())
    info = await fetch_quota("https://open.bigmodel.cn/api/paas/v4", "glm-key")
    assert info.kind == "windows" and info.provider == "glm"
    assert fake_client.captured["headers"]["Authorization"] == "glm-key"


@pytest.mark.asyncio
async def test_fetch_deepseek_bearer_auth(fake_client):
    _FakeClient.response = _FakeResponse(
        200, {"is_available": True, "balance_infos": [{"currency": "CNY", "total_balance": "5.00"}]}
    )
    info = await fetch_quota("https://api.deepseek.com/v1", "ds-key")
    assert info.kind == "balance" and info.provider == "deepseek"
    assert fake_client.captured["headers"]["Authorization"] == "Bearer ds-key"


@pytest.mark.asyncio
async def test_fetch_401_raises(fake_client):
    _FakeClient.response = _FakeResponse(401)
    with pytest.raises(QuotaProbeError, match="401"):
        await fetch_quota("https://api.deepseek.com", "bad-key")


@pytest.mark.asyncio
async def test_fetch_http_500_raises(fake_client):
    _FakeClient.response = _FakeResponse(500)
    with pytest.raises(QuotaProbeError, match="500"):
        await fetch_quota("https://api.deepseek.com", "k")


@pytest.mark.asyncio
async def test_fetch_timeout_raises(fake_client):
    import httpx

    _FakeClient.exc = httpx.TimeoutException("slow")
    with pytest.raises(QuotaProbeError, match="超时"):
        await fetch_quota("https://api.deepseek.com", "k")


@pytest.mark.asyncio
async def test_fetch_empty_key_raises():
    with pytest.raises(QuotaProbeError, match="API Key"):
        await fetch_quota("https://api.deepseek.com", "")
