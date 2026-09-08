"""image_orienter 单元测试（ADR-0017）：严格解析、旋转重编码、组合入口降级。

视觉 API 调用一律 monkeypatch 掉，不触网。
"""
from __future__ import annotations

import io

import pytest
from PIL import Image

from doclens import image_orienter
from doclens.image_orienter import (
    auto_rotate_image,
    detect_rotation,
    parse_orientation_answer,
    rotate_image_inplace,
)


def _make_image(path, size=(40, 20), fmt=None, color=(200, 30, 30)) -> None:
    """造一张宽>高的纯色图（40×20 横向），供旋转后断言尺寸互换。"""
    img = Image.new("RGB", size, color)
    img.save(path, format=fmt)


class _FakeConfig:
    vision_api_key = "fake"
    vision_model = "fake-vl"
    vision_base_url = ""
    vision_protocol = None


# ---------------------------------------------------------------- 严格解析

@pytest.mark.parametrize("text,expected", [
    ("0", 0), ("90", 90), ("180", 180), ("270", 270),
    (" 90 ", 90), ("\n180\n", 180),
])
def test_parse_accepts_exact_angles(text, expected):
    assert parse_orientation_answer(text) == expected


@pytest.mark.parametrize("text", [
    "", "旋转90度", "90°", "90 度", "```\n90\n```", "0.", "45", "-90", "360",
    "图片是正向的", "90180",
])
def test_parse_rejects_anything_else(text):
    """宁可漏转不可错转：非精确 0/90/180/270 一律 None。"""
    assert parse_orientation_answer(text) is None


# ---------------------------------------------------------------- 判向调用

def test_detect_rotation_call_failure_returns_none(monkeypatch, tmp_path):
    """调用失败（网络/限流）不重试，返回 None。"""
    p = tmp_path / "a.jpg"
    _make_image(p)

    def _boom(b64, media, prompt, config, **kw):
        raise RuntimeError("network down")

    monkeypatch.setattr(image_orienter, "call_vision", _boom)
    assert detect_rotation(p, _FakeConfig()) is None


def test_detect_rotation_unparsable_returns_none(monkeypatch, tmp_path):
    p = tmp_path / "a.jpg"
    _make_image(p)
    monkeypatch.setattr(image_orienter, "call_vision",
                        lambda *a, **kw: "我觉得应该转90度")
    assert detect_rotation(p, _FakeConfig()) is None


def test_detect_rotation_ok(monkeypatch, tmp_path):
    p = tmp_path / "a.jpg"
    _make_image(p)
    monkeypatch.setattr(image_orienter, "call_vision", lambda *a, **kw: "90")
    assert detect_rotation(p, _FakeConfig()) == 90


# ---------------------------------------------------------------- 旋转落盘

@pytest.mark.parametrize("ext", [".jpg", ".png", ".webp"])
def test_rotate_inplace_swaps_dimensions(tmp_path, ext):
    """90° 旋转后宽高互换，格式保持不变，原文件被覆盖。"""
    p = tmp_path / f"a{ext}"
    _make_image(p, size=(40, 20))
    assert rotate_image_inplace(p, 90) is True
    with Image.open(p) as img:
        assert img.size == (20, 40)
        expected_fmt = {".jpg": "JPEG", ".png": "PNG", ".webp": "WEBP"}[ext]
        assert img.format == expected_fmt


def test_rotate_180_keeps_dimensions(tmp_path):
    p = tmp_path / "a.jpg"
    _make_image(p, size=(40, 20))
    assert rotate_image_inplace(p, 180) is True
    with Image.open(p) as img:
        assert img.size == (40, 20)


def test_rotate_failure_keeps_original(tmp_path):
    """解码失败不动原文件（字节原样保留）。"""
    p = tmp_path / "a.jpg"
    p.write_bytes(b"not an image")
    before = p.read_bytes()
    assert rotate_image_inplace(p, 90) is False
    assert p.read_bytes() == before


# ---------------------------------------------------------------- 组合入口

def test_auto_rotate_skips_zero_and_none(monkeypatch, tmp_path):
    """0 度与判向失败都不动文件。"""
    p = tmp_path / "a.jpg"
    _make_image(p)
    before = p.read_bytes()
    monkeypatch.setattr(image_orienter, "detect_rotation",
                        lambda path, config: 0)
    assert auto_rotate_image(p, _FakeConfig()) is False
    monkeypatch.setattr(image_orienter, "detect_rotation",
                        lambda path, config: None)
    assert auto_rotate_image(p, _FakeConfig()) is False
    assert p.read_bytes() == before


def test_auto_rotate_skips_non_orientable_ext(monkeypatch, tmp_path):
    p = tmp_path / "a.gif"
    _make_image(p, fmt="GIF")
    called = []
    monkeypatch.setattr(image_orienter, "detect_rotation",
                        lambda path, config: called.append(1) or 90)
    assert auto_rotate_image(p, _FakeConfig()) is False
    assert called == []  # 非判向格式连视觉调用都不发


def test_auto_rotate_applies(monkeypatch, tmp_path):
    p = tmp_path / "a.jpg"
    _make_image(p, size=(40, 20))
    monkeypatch.setattr(image_orienter, "detect_rotation",
                        lambda path, config: 270)
    assert auto_rotate_image(p, _FakeConfig()) is True
    with Image.open(p) as img:
        assert img.size == (20, 40)
