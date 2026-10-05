"""probe_vision 行为学探测测试（ADR-0034 增补）。"""
from unittest.mock import patch

import pytest

from doclens.web_v2.probe_vision import (
    ProbeError,
    _gen_code,
    _normalize,
    _render_probe_image,
    probe_vision,
)


class _FakeContent:
    def __init__(self, text: str):
        self.text = text


class _FakeResp:
    def __init__(self, text: str):
        self.content = [_FakeContent(text)]


def _fake_provider(resp=None, error=None):
    calls = {}

    class _P:
        def chat(self, **kwargs):
            calls["kwargs"] = kwargs
            if error is not None:
                raise error
            return resp

    return _P(), calls


def test_render_probe_image_basic():
    jpeg, b64 = _render_probe_image("VQ7XK")
    assert 3000 < len(jpeg) < 60000
    assert len(b64) > len(jpeg)
    # 确定性：同密码串两次渲染字节一致（无随机噪声）
    assert _render_probe_image("VQ7XK")[0] == jpeg


def test_gen_code_no_confusables():
    for _ in range(50):
        c = _gen_code()
        assert len(c) == 5
        assert not (set(c) & set("0O1I"))


def test_normalize_variants():
    assert "VQ7XK" in _normalize("The sequence is: vq7xk.")
    assert "VQ7XK" in _normalize("V Q 7 X K")
    assert "VQ7XK" not in _normalize("I cannot see any image")


def test_probe_supported_reads_code():
    code_holder = {}
    orig_render = _render_probe_image

    def _capture(code):
        code_holder["code"] = code
        return orig_render(code)

    p, calls = _fake_provider(resp=_FakeResp("unused"))

    def _answer(**kw):
        calls["kwargs"] = kw
        return _FakeResp(f"The answer is {code_holder['code']}")

    p.chat = _answer
    with patch("doclens.web_v2.probe_vision._render_probe_image", side_effect=_capture):
        with patch("planify.core.llm.create_provider", return_value=p):
            assert probe_vision("openai_compat", "https://x", "m1", "k") is True
    # 请求形态：image block + text 块，max_tokens=1024（思考型模型思维链预算）
    kw = calls["kwargs"]
    blocks = kw["messages"][0]["content"]
    assert blocks[0]["type"] == "image"
    assert blocks[0]["source"]["media_type"] == "image/jpeg"
    assert blocks[-1]["type"] == "text"


def test_probe_retry_until_success():
    """思考型模型思维链波动导致偶发空响应（2026-10-05 glm-5.3-flash 4/6 失败
    复现）：N 次尝试内任一次读出密码串即判支持。"""
    code_holder = {}
    orig_render = _render_probe_image

    def _capture(code):
        code_holder["code"] = code
        return orig_render(code)

    class _P:
        def __init__(self):
            self.n = 0

        def chat(self, **kw):
            self.n += 1
            if self.n == 1:
                return _FakeResp("")
            return _FakeResp(f"The answer is {code_holder['code']}")

    with patch("doclens.web_v2.probe_vision._render_probe_image", side_effect=_capture):
        with patch("planify.core.llm.create_provider", return_value=_P()):
            assert probe_vision("anthropic", "https://x", "glm-flash", "k") is True


def test_probe_silent_swallow_means_unsupported():
    """静默吞图（正常返回但读不出）= 不支持——按报错判定测不出的关键类。"""
    p, _ = _fake_provider(resp=_FakeResp("I cannot see any image in your message."))
    with patch("planify.core.llm.create_provider", return_value=p):
        assert probe_vision("", "https://x", "m1", "k") is False


def test_probe_api_rejection_means_unsupported():
    p, _ = _fake_provider(error=RuntimeError("400 invalid content type: image is not supported"))
    with patch("planify.core.llm.create_provider", return_value=p):
        assert probe_vision("openai_compat", "https://x", "m1", "k") is False


def test_probe_connection_error_aborts():
    p, _ = _fake_provider(error=ConnectionError("connection timed out"))
    with patch("planify.core.llm.create_provider", return_value=p):
        with pytest.raises(ProbeError):
            probe_vision("", "https://x", "m1", "k")


def test_probe_auth_error_aborts():
    p, _ = _fake_provider(error=RuntimeError("401 unauthorized: invalid api key"))
    with patch("planify.core.llm.create_provider", return_value=p):
        with pytest.raises(ProbeError):
            probe_vision("", "https://x", "m1", "k")
