"""日记 tab 显隐与写防护（ADR-0030）测试。

覆盖：
- D2/D4 核心语义：_require_diary_dir——无目录 409 / 空目录放行
  （空目录也算启用：入口先于内容，避免首篇录入死锁）
- 五个写端点全部挂闸（无目录时一律 409，无一能触达 diary 域层——
  目录诞生权只属于用户的文件系统动作）
- /api/status 的 diary_enabled 字段（目录存在性，含空目录）
"""
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.web_v2.api import diary as diary_api
from doclens.web_v2.api.errors import CortexAPIError


def _idx(tmp_path: Path) -> SimpleNamespace:
    return SimpleNamespace(search_path=str(tmp_path))


class TestRequireDiaryDir:
    def test_missing_dir_raises_409(self, tmp_path):
        with pytest.raises(CortexAPIError) as ei:
            diary_api._require_diary_dir(_idx(tmp_path))
        assert ei.value.status == 409
        assert ei.value.code == "DIARY_NOT_ENABLED"

    def test_empty_dir_passes(self, tmp_path):
        """D2：空目录也算启用——入口先于内容。"""
        (tmp_path / "diary").mkdir()
        diary_api._require_diary_dir(_idx(tmp_path))  # 不抛即为通过


class TestWriteEndpointsGated:
    """无 diary 目录时五个写端点全部 409（D4：API 副作用不得伪造事实源）。

    直调 endpoint 协程（闸在函数体首行，后续依赖不会触达）；
    add_photo_fragment 的 file 参数不会被读取。
    """

    def _assert_409(self, coro_factory):
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(coro_factory())
        assert ei.value.status == 409
        assert ei.value.code == "DIARY_NOT_ENABLED"

    def test_set_city(self, tmp_path):
        idx = _idx(tmp_path)
        self._assert_409(lambda: diary_api.set_city("2026-09-17", "北京", idx))

    def test_add_text_fragment(self, tmp_path):
        idx = _idx(tmp_path)
        req = SimpleNamespace(text="片段")
        self._assert_409(lambda: diary_api.add_text_fragment(req, idx))

    def test_add_photo_fragment(self, tmp_path):
        idx = _idx(tmp_path)
        self._assert_409(
            lambda: diary_api.add_photo_fragment(None, None, "", idx)
        )

    def test_delete_fragment(self, tmp_path):
        idx = _idx(tmp_path)
        self._assert_409(
            lambda: diary_api.delete_fragment("090000-x", "2026-09-17", idx)
        )

    def test_update_text_fragment(self, tmp_path):
        idx = _idx(tmp_path)
        req = SimpleNamespace(text="改后")
        self._assert_409(
            lambda: diary_api.update_text_fragment("090000-x", req, "2026-09-17", idx)
        )

    def test_read_endpoints_not_gated(self, tmp_path):
        """读端点不挂闸（自然空态），无目录时正常返回而非 409。"""
        from doclens import diary

        idx = _idx(tmp_path)
        resp = asyncio.run(diary_api.get_today(idx))
        assert diary.get_day(Path(idx.search_path), resp.today).state == "empty"


class TestStatusDiaryEnabled:
    def test_status_field_reflects_dir_presence(self, tmp_path):
        from doclens.web_v2.api import status as status_api

        def _fake_idx(workdir: Path) -> SimpleNamespace:
            return SimpleNamespace(
                search_path=str(workdir),
                index_path=str(workdir / ".cortex" / "index.db"),
                indexed_doc_count=lambda: 0,
                last_failed_count=0,
                file_stats=lambda: (0, {}),
                vision_status=lambda: {},
            )

        # 无目录 → False
        data = asyncio.run(status_api.status(_fake_idx(tmp_path)))
        assert data["diary_enabled"] is False
        # 空目录 → True（D2）
        (tmp_path / "diary").mkdir()
        data = asyncio.run(status_api.status(_fake_idx(tmp_path)))
        assert data["diary_enabled"] is True
