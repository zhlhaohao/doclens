"""即梦文生图模块测试（2026-10-28 决议实现）。

覆盖：slug 清洗、Ark 请求组装/响应解析（mock HTTP）、落盘 + prompt 元数据
写回-读回、内置注册（配/不配 key）、CLI 参数注册。
不发真实网络请求。
"""
from __future__ import annotations

import base64
import json
from pathlib import Path
from unittest import mock

import pytest

from doclens.jimeng import client as jm


# ---------- slug ----------

@pytest.mark.parametrize("prompt,expect", [
    ("一只猫", "一只猫"),
    ("  hello   world!! ", "hello-world"),
    ("a/b\\c:d*e?f", "a-b-c-d-e-f"),
    ("!!!???---", "jimeng"),
])
def test_slugify(prompt, expect):
    got = jm._slugify(prompt)
    assert got == expect.strip("-") or got == expect
    assert len(got) <= 30
    assert all(c not in got for c in '\\/:*?"<>|')


def test_slugify_truncates_long_prompt():
    got = jm._slugify("很长的提示词" * 20)
    assert got == "很长的提示词" * 5  # 30 字符截断（6 字 × 5）
    assert len(got) == 30


# ---------- 请求体组装 ----------

def test_build_request_body_basic():
    body = jm._build_request_body("一只猫", "doubao-seedream-4-0", None, None, False, None)
    assert body == {
        "model": "doubao-seedream-4-0",
        "prompt": "一只猫",
        "response_format": "url",
        "watermark": False,
    }


def test_build_request_body_full():
    body = jm._build_request_body(
        "一只猫", "m1", size="1024x1024", seed=42, watermark=True,
        ref_images_b64=["AAA=", "BBB="],
    )
    assert body["size"] == "1024x1024"
    assert body["seed"] == 42
    assert body["watermark"] is True
    assert body["image"] == ["AAA=", "BBB="]


# ---------- Ark 调用（mock urlopen） ----------

def _fake_response(payload: dict):
    r = mock.MagicMock()
    r.read.return_value = json.dumps(payload).encode("utf-8")
    r.__enter__.return_value = r
    return r


def test_call_ark_generations_ok():
    resp = _fake_response({"data": [{"url": "https://x/1.png"}, {"url": "https://x/2.png"}]})
    with mock.patch.object(jm.urllib.request, "urlopen", return_value=resp) as m:
        urls = jm.call_ark_generations("KEY", "一只猫", "doubao-seedream-4-0")
    assert urls == ["https://x/1.png", "https://x/2.png"]
    req = m.call_args[0][0]
    assert req.headers["Authorization"] == "Bearer KEY"
    sent = json.loads(req.data.decode("utf-8"))
    assert sent["prompt"] == "一只猫"


def test_call_ark_generations_api_error():
    resp = _fake_response({"error": {"code": "InvalidParameter", "message": "bad"}})
    with mock.patch.object(jm.urllib.request, "urlopen", return_value=resp):
        with pytest.raises(jm.JimengError, match="InvalidParameter"):
            jm.call_ark_generations("KEY", "p", "m")


def test_call_ark_generations_no_url():
    resp = _fake_response({"data": [{}]})
    with mock.patch.object(jm.urllib.request, "urlopen", return_value=resp):
        with pytest.raises(jm.JimengError, match="未返回图片"):
            jm.call_ark_generations("KEY", "p", "m")


def test_call_ark_generations_http_error():
    import urllib.error
    err = urllib.error.HTTPError(
        "url", 401, "Unauthorized", {},  # type: ignore[arg-type]
        __import__("io").BytesIO(b'{"error":{"code":"AuthFailure"}}'),
    )
    with mock.patch.object(jm.urllib.request, "urlopen", side_effect=err):
        with pytest.raises(jm.JimengError, match="401"):
            jm.call_ark_generations("BAD", "p", "m")


# ---------- size 校验（Seedream 4.0 语义） ----------

def test_validate_size_ok():
    for ok in ("2K", "1k", "4K", "adaptive", "2048x2048", "1280x720",
               "1024x1024", "2560x1440", "960x960", None, ""):
        jm._validate_size(ok)  # 不抛


def test_validate_size_too_small():
    with pytest.raises(jm.JimengError, match="1280x720"):
        jm._validate_size("512x512")
    with pytest.raises(jm.JimengError, match="1280x720"):
        jm._validate_size("900x900")  # 810000 < 921600


def test_validate_size_over_limit():
    with pytest.raises(jm.JimengError, match="4096"):
        jm._validate_size("8192x2048")


def test_validate_size_bad_format():
    with pytest.raises(jm.JimengError, match="size 不合法"):
        jm._validate_size("large")


def test_call_ark_rejects_small_size_locally():
    """512x512 本地拦截，不发请求（远端 400 友好化）。"""
    with mock.patch.object(jm.urllib.request, "urlopen") as m:
        with pytest.raises(jm.JimengError, match="1280x720"):
            jm.call_ark_generations("K", "p", "m", size="512x512")
    m.assert_not_called()


_PNG_1PX = base64.b64decode(
    # 1x1 灰 PNG（可被 piexif/PIL 识别的最小合法文件）
    b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQAB"
    b"h6FO1AAAAABJRU5ErkJggg=="
)


def _run_generate(tmp_path: Path, **kw) -> dict:
    """mock Ark 返回 2 张图 + 下载返回 1px png，跑完整管线。"""
    workdir = tmp_path / "kb"
    workdir.mkdir(exist_ok=True)

    resp = _fake_response({"data": [{"url": "https://x/1.png"}, {"url": "https://x/2.png"}]})
    dl = mock.MagicMock()
    dl.read.return_value = _PNG_1PX
    dl.__enter__.return_value = dl
    with mock.patch.object(jm.urllib.request, "urlopen", side_effect=[resp, dl, dl]):
        return jm.generate_and_save(
            api_key="KEY", prompt="赛博朋克城市夜景！", workdir=workdir, **kw
        )


def test_generate_and_save_paths_and_metadata(tmp_path):
    result = _run_generate(tmp_path)
    assert len(result["paths"]) == 2
    for p in result["paths"]:
        assert Path(p).exists()
        assert Path(p).suffix == ".png"
        assert Path(p).parent == tmp_path / "kb" / "图片" / "AI"
        assert "赛博朋克城市夜景" in Path(p).name
    # 元数据写回 + 读回（model_tag=jimeng 命名空间）
    from treesearch.parsers import image_metadata

    payload = image_metadata.read_back(result["paths"][0])
    assert payload is not None
    assert "赛博朋克城市夜景" in payload["markdown"]
    assert payload["model_tag"] == jm.JIMENG_MODEL_TAG


def test_generate_and_save_output_dir_override(tmp_path):
    result = _run_generate(tmp_path, output_dir="插图/夜曲")
    assert result["output_dir"] == "插图/夜曲"
    assert Path(result["paths"][0]).parent == tmp_path / "kb" / "插图" / "夜曲"


def test_generate_and_save_ref_image_missing(tmp_path):
    workdir = tmp_path / "kb"
    workdir.mkdir(exist_ok=True)
    with pytest.raises(jm.JimengError, match="参考图不存在"):
        jm.generate_and_save(
            api_key="KEY", prompt="p", workdir=workdir,
            ref_images=["nope.png"],
        )


def test_generate_and_save_ref_image_b64(tmp_path):
    workdir = tmp_path / "kb"
    workdir.mkdir(exist_ok=True)
    ref = workdir / "ref.png"
    ref.write_bytes(_PNG_1PX)

    captured: dict = {}

    def fake_call(api_key, prompt, model, *, ref_images_b64=None, **kw):
        captured["b64"] = ref_images_b64
        return ["https://x/1.png"]

    dl = mock.MagicMock()
    dl.read.return_value = _PNG_1PX
    dl.__enter__.return_value = dl
    with mock.patch.object(jm, "call_ark_generations", side_effect=fake_call), \
         mock.patch.object(jm.urllib.request, "urlopen", return_value=dl):
        jm.generate_and_save(
            api_key="KEY", prompt="p", workdir=workdir, ref_images=["ref.png"],
        )
    assert captured["b64"] == [base64.b64encode(_PNG_1PX).decode("ascii")]


def test_generate_and_save_no_key(tmp_path):
    with pytest.raises(jm.JimengError, match="JIMENG_API_KEY"):
        jm.generate_and_save(api_key="", prompt="p", workdir=tmp_path)


def test_generate_and_save_describe_enqueues(tmp_path):
    """describe=True 时调 fts.vision_enqueue；默认不调。"""
    fts = mock.MagicMock()
    result = _run_generate(tmp_path, describe=True, fts=fts)
    assert fts.vision_enqueue.call_count == 2

    fts2 = mock.MagicMock()
    _run_generate(tmp_path, fts=fts2)
    fts2.vision_enqueue.assert_not_called()


# ---------- 内置注册 ----------

def test_builtin_server_configs_no_key(monkeypatch, tmp_path):
    from doclens import mcp_client
    from doclens.config import CortexConfig

    monkeypatch.setattr(CortexConfig, "load", classmethod(lambda cls: cls()))
    configs = mcp_client.builtin_server_configs()
    assert configs == []


def test_builtin_server_configs_with_key(monkeypatch):
    from doclens import mcp_client
    from doclens.config import CortexConfig

    cfg = CortexConfig(jimeng_api_key="K", jimeng_model="m1")
    monkeypatch.setattr(CortexConfig, "load", classmethod(lambda cls: cfg))
    configs = mcp_client.builtin_server_configs()
    assert len(configs) == 1
    c = configs[0]
    assert c["name"] == "jimeng"
    assert c["transport"] == "stdio"
    assert c["args"] == ["-m", "doclens.jimeng"]
    assert c["timeout"] == 120.0
    assert c["id"].startswith("builtin-")


# ---------- CLI 参数注册 ----------

def test_cli_parser_registered():
    from doclens.cortex_cli import _build_parser

    parser = _build_parser()
    args = parser.parse_args(["jimeng", "generate", "一只", "猫", "--n", "2"])
    assert args.command == "jimeng"
    assert args.jimeng_action == "generate"
    assert args.prompt == ["一只", "猫"]
    assert args.n == 2
