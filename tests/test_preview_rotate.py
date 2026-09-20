# -*- coding: utf-8 -*-
"""预览期手动旋转端点测试（ADR-0029）。

覆盖：
- 成功旋转：png 2x1 → 1x2（顺时针 90° 尺寸互换 + 像素落位），
  收尾（清 vision 队列残留 / 广播 manual 标志）被调用；
- 格式拒绝：gif → 400 NOT_ROTATABLE（ORIENTABLE_IMAGE_EXTS 之外）；
- 不存在 → 404 FILE_NOT_FOUND；
- 路径越权（../）→ 404。
"""
from pathlib import Path
from types import SimpleNamespace

import pytest
from PIL import Image

from doclens.web_v2.api import preview as preview_api
from doclens.web_v2.api.errors import CortexAPIError


def _make_png(p: Path, left=(255, 0, 0), right=(0, 0, 255)) -> None:
    """造一张 2x1 双色 png（左红右蓝），旋转后像素落位可断言。"""
    img = Image.new("RGB", (2, 1))
    img.putpixel((0, 0), left)
    img.putpixel((1, 0), right)
    img.save(p, "PNG")


def _fake_idx(tmp_path: Path) -> SimpleNamespace:
    return SimpleNamespace(
        search_path=str(tmp_path), path_map={}, index_path=str(tmp_path / "index.db")
    )


def test_rotate_success_rotates_pixels_and_runs_cleanup(tmp_path, monkeypatch):
    p = tmp_path / "photo.png"
    _make_png(p)
    calls = {}
    monkeypatch.setattr(preview_api, "drop_vision_queue_row",
                        lambda abs_path, index_path: calls.setdefault("dropped", str(abs_path)))
    monkeypatch.setattr(preview_api, "broadcast_rotated",
                        lambda rel, manual=False: calls.update(broadcast=(rel, manual)))

    resp = preview_api.rotate_image(path="photo.png", idx=_fake_idx(tmp_path))

    assert resp.path == "photo.png"
    assert resp.rotated is True
    # 顺时针 90°：2x1 → 1x2，原左上(红) → 新 (0,0)，原右上(蓝) → 新 (0,1)
    with Image.open(p) as r:
        assert r.size == (1, 2)
        assert r.getpixel((0, 0)) == (255, 0, 0)
        assert r.getpixel((0, 1)) == (0, 0, 255)
    # 收尾与判向自动旋转（ADR-0017 §6）一致，且 manual=True
    assert calls["dropped"] == str(p)
    assert calls["broadcast"] == ("photo.png", True)


def test_rotate_rejects_unrotatable_format(tmp_path):
    p = tmp_path / "anim.gif"
    Image.new("RGB", (2, 1)).save(p, "GIF")
    with pytest.raises(CortexAPIError) as ei:
        preview_api.rotate_image(path="anim.gif", idx=_fake_idx(tmp_path))
    assert ei.value.status == 400
    assert ei.value.code == "NOT_ROTATABLE"
    # 拒绝时不动文件
    with Image.open(p) as r:
        assert r.size == (2, 1)


def test_rotate_missing_file_404(tmp_path):
    with pytest.raises(CortexAPIError) as ei:
        preview_api.rotate_image(path="nope.png", idx=_fake_idx(tmp_path))
    assert ei.value.status == 404
    assert ei.value.code == "FILE_NOT_FOUND"


def test_rotate_rejects_path_traversal(tmp_path):
    (tmp_path / "photo.png").write_bytes(b"")  # 触发存在性判断前的越权校验
    with pytest.raises(CortexAPIError) as ei:
        preview_api.rotate_image(path="../evil.png", idx=_fake_idx(tmp_path))
    assert ei.value.status == 404
