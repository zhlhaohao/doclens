"""doclens.diary 领域模块单元测试（ADR-0007 数据模型）。"""
import io
from datetime import date
from pathlib import Path

import pytest

from doclens import diary


@pytest.fixture()
def workdir(tmp_path: Path) -> Path:
    return tmp_path


class TestTextFragments:
    def test_append_and_get_day(self, workdir: Path):
        f = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "早上喝了咖啡")
        assert f.kind == "text"
        assert f.fid.startswith("091500-")

        day = diary.get_day(workdir, "2026-08-01")
        assert day.state == "raw"
        assert len(day.fragments) == 1
        assert day.fragments[0].text == "早上喝了咖啡"
        assert day.fragments[0].time == "09:15"

    def test_year_file_created_with_header(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:15", "091500", "x")
        content = diary.year_path(workdir, 2026).read_text(encoding="utf-8")
        assert content.startswith("# 2026 日记")
        assert "## 2026-08-01 星期六" in content  # 2026-08-01 是星期六
        assert diary.RAW_MARKER in content

    def test_multiline_text_roundtrip(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:15", "091500", "第一行\n第二行")
        day = diary.get_day(workdir, "2026-08-01")
        assert day.fragments[0].text == "第一行\n第二行"
        # 仍然是一条片段，不是两条
        assert len(day.fragments) == 1

    def test_multiple_fragments_same_day(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        diary.append_text(workdir, "2026-08-01", "18:30", "183000", "b")
        day = diary.get_day(workdir, "2026-08-01")
        assert [f.text for f in day.fragments] == ["a", "b"]

    def test_empty_text_rejected(self, workdir: Path):
        with pytest.raises(ValueError):
            diary.append_text(workdir, "2026-08-01", "09:15", "091500", "   ")

    def test_invalid_date_rejected(self, workdir: Path):
        with pytest.raises(ValueError):
            diary.get_day(workdir, "2026-13-01")
        with pytest.raises(ValueError):
            diary.get_day(workdir, "not-a-date")

    def test_empty_day(self, workdir: Path):
        assert diary.get_day(workdir, "2026-08-01").state == "empty"


class TestRemoveFragment:
    def test_remove_by_fid(self, workdir: Path):
        f1 = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        diary.append_text(workdir, "2026-08-01", "18:30", "183000", "b")
        assert diary.remove_fragment(workdir, "2026-08-01", f1.fid) is True
        day = diary.get_day(workdir, "2026-08-01")
        assert [f.text for f in day.fragments] == ["b"]

    def test_remove_multiline_keeps_others(self, workdir: Path):
        f1 = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a\n续行")
        diary.append_text(workdir, "2026-08-01", "18:30", "183000", "b")
        assert diary.remove_fragment(workdir, "2026-08-01", f1.fid) is True
        day = diary.get_day(workdir, "2026-08-01")
        assert [f.text for f in day.fragments] == ["b"]

    def test_remove_multiline_after_others_keeps_them(self, workdir: Path):
        """回归：多行片段在最后、前方有片段时，删多行不能吞掉前方片段。

        旧正则 (?ms)^- HH:MM .*?<!-- fid:xxx --> 的 .*? 跨行（s 模式）会从
        更早的片段行起点跨越匹配到目标 fid，误删中间所有片段。
        """
        diary.append_text(workdir, "2026-08-01", "08:08", "080800", "第一段")
        diary.append_text(workdir, "2026-08-01", "09:11", "091100", "第二段")
        f3 = diary.append_text(workdir, "2026-08-01", "09:12", "091200", "多行\n第二行\n第三行")
        assert diary.remove_fragment(workdir, "2026-08-01", f3.fid) is True
        day = diary.get_day(workdir, "2026-08-01")
        assert day.state == "raw"
        assert [f.text for f in day.fragments] == ["第一段", "第二段"]

    def test_remove_missing_returns_false(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        assert diary.remove_fragment(workdir, "2026-08-01", "999999-none") is False
        assert diary.remove_fragment(workdir, "2026-08-02", "x") is False

    def test_remove_last_fragment_drops_section(self, workdir: Path):
        """删光片段后空小节整体移除：状态回到 empty，不进入待总结队列。"""
        f = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        assert diary.remove_fragment(workdir, "2026-08-01", f.fid) is True
        assert diary.get_day(workdir, "2026-08-01").state == "empty"
        content = diary.year_path(workdir, 2026).read_text(encoding="utf-8")
        assert "2026-08-01" not in content
        assert diary.RAW_MARKER not in content
        assert diary.find_pending_raw(workdir, date(2026, 8, 2)) == []

    def test_remove_last_fragment_keeps_other_sections(self, workdir: Path):
        """空小节移除不影响其他日期的小节（含已总结成品）。"""
        f = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        diary.append_text(workdir, "2026-08-02", "09:15", "091500", "b")
        diary.rewrite_day(workdir, "2026-08-02", "成品")
        diary.remove_fragment(workdir, "2026-08-01", f.fid)
        day2 = diary.get_day(workdir, "2026-08-02")
        assert day2.state == "summarized" and day2.content == "成品"

    def test_find_pending_raw_ignores_legacy_empty_section(self, workdir: Path):
        """防御性：旧版本留下的空 raw 小节不进入待总结队列。"""
        diary.append_text(workdir, "2026-07-31", "09:15", "091500", "a")
        path = diary.year_path(workdir, 2026)
        path.write_text(
            "# 2026 日记\n\n## 2026-07-30 星期四\n<!-- diary:raw -->\n\n"
            + path.read_text(encoding="utf-8").split("\n", 1)[1],
            encoding="utf-8",
        )
        assert diary.find_pending_raw(workdir, date(2026, 8, 1)) == ["2026-07-31"]


class TestUpdateFragment:
    def test_update_text_keeps_others(self, workdir: Path):
        f1 = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "第一段")
        diary.append_text(workdir, "2026-08-01", "18:30", "183000", "第二段")
        assert diary.update_fragment(workdir, "2026-08-01", f1.fid, "改后的第一段") is True
        day = diary.get_day(workdir, "2026-08-01")
        assert [f.text for f in day.fragments] == ["改后的第一段", "第二段"]
        assert day.fragments[0].time == "09:15"   # 时间戳保留
        assert day.fragments[0].fid == f1.fid     # fid 保留

    def test_update_single_to_multiline(self, workdir: Path):
        f = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "单行")
        assert diary.update_fragment(workdir, "2026-08-01", f.fid, "第一行\n第二行") is True
        assert diary.get_day(workdir, "2026-08-01").fragments[0].text == "第一行\n第二行"

    def test_update_multiline_to_single(self, workdir: Path):
        f = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "多行\n第二行")
        assert diary.update_fragment(workdir, "2026-08-01", f.fid, "改成单行") is True
        assert diary.get_day(workdir, "2026-08-01").fragments[0].text == "改成单行"

    def test_update_photo_caption(self, workdir: Path):
        import io
        from PIL import Image
        img = Image.new("RGB", (100, 80), (1, 2, 3))
        buf = io.BytesIO()
        img.save(buf, "JPEG")
        rel = diary.save_photo(workdir, "2026-08-01", "183012", buf.getvalue())
        f = diary.append_photo(workdir, "2026-08-01", "18:30", "183012", rel, "原备注")
        assert diary.update_fragment(workdir, "2026-08-01", f.fid, "新备注") is True
        frag = diary.get_day(workdir, "2026-08-01").fragments[0]
        assert frag.kind == "photo"
        assert frag.text == "新备注"  # caption 更新
        assert frag.image == rel       # 图片路径保留

    def test_update_summarized_rejected(self, workdir: Path):
        f = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        diary.rewrite_day(workdir, "2026-08-01", "成品")
        assert diary.update_fragment(workdir, "2026-08-01", f.fid, "改") is False

    def test_update_empty_rejected(self, workdir: Path):
        f = diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        with pytest.raises(ValueError):
            diary.update_fragment(workdir, "2026-08-01", f.fid, "   ")

    def test_update_missing_returns_false(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        assert diary.update_fragment(workdir, "2026-08-01", "999999-none", "x") is False


class TestRewriteDay:
    def test_rewrite_replaces_section_and_removes_marker(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        assert diary.rewrite_day(workdir, "2026-08-01", "今天过得不错。") is True
        day = diary.get_day(workdir, "2026-08-01")
        assert day.state == "summarized"
        assert day.content == "今天过得不错。"
        content = diary.year_path(workdir, 2026).read_text(encoding="utf-8")
        assert diary.RAW_MARKER not in content

    def test_rewrite_twice_rejected(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:15", "091500", "a")
        assert diary.rewrite_day(workdir, "2026-08-01", "第一版") is True
        assert diary.rewrite_day(workdir, "2026-08-01", "第二版") is False
        assert diary.get_day(workdir, "2026-08-01").content == "第一版"

    def test_rewrite_missing_day(self, workdir: Path):
        assert diary.rewrite_day(workdir, "2026-08-01", "x") is False


class TestScanAndCalendar:
    def test_find_pending_raw_only_past_days(self, workdir: Path):
        diary.append_text(workdir, "2026-07-30", "09:00", "090000", "前天")
        diary.append_text(workdir, "2026-07-31", "09:00", "090000", "昨天")
        diary.append_text(workdir, "2026-08-01", "09:00", "090000", "今天")
        diary.rewrite_day(workdir, "2026-07-30", "已总结")
        pending = diary.find_pending_raw(workdir, date(2026, 8, 1))
        assert pending == ["2026-07-31"]  # 今天的不算；已总结的不算

    def test_find_pending_raw_cross_year(self, workdir: Path):
        """12-31 的片段在 1-1 总结：去年文件也要扫到（跨年归属）。"""
        diary.append_text(workdir, "2025-12-31", "23:50", "235000", "跨年夜")
        pending = diary.find_pending_raw(workdir, date(2026, 1, 1))
        assert pending == ["2025-12-31"]

    def test_list_month_dates(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:00", "090000", "a")
        diary.rewrite_day(workdir, "2026-08-01", "成文内容")  # → summarized
        diary.append_text(workdir, "2026-08-15", "09:00", "090000", "b")  # 仍 raw
        diary.append_text(workdir, "2026-09-01", "09:00", "090000", "c")  # raw
        # 回顾打点只标成文日；raw 的 08-15 / 09-01 不计入
        assert diary.list_month_dates(workdir, "2026-08") == ["2026-08-01"]
        assert diary.list_month_dates(workdir, "2026-10") == []

    def test_list_month_invalid(self, workdir: Path):
        with pytest.raises(ValueError):
            diary.list_month_dates(workdir, "2026-8")


class TestPhoto:
    def _make_jpeg(self, size=(3000, 2000)) -> bytes:
        from PIL import Image

        img = Image.new("RGB", size, (200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=95)
        return buf.getvalue()

    def test_save_photo_compresses(self, workdir: Path):
        raw = self._make_jpeg()
        rel = diary.save_photo(workdir, "2026-08-01", "183012", raw)
        assert rel.startswith("images/2026-08-01/")
        assert rel.endswith(".webp")
        out = diary.diary_dir(workdir) / rel
        assert out.exists()
        assert out.stat().st_size < len(raw)
        from PIL import Image

        with Image.open(out) as img:
            assert max(img.size) <= diary.IMAGE_MAX_EDGE

    def test_photo_fragment_roundtrip(self, workdir: Path):
        rel = diary.save_photo(workdir, "2026-08-01", "183012", self._make_jpeg())
        diary.append_photo(workdir, "2026-08-01", "18:30", "183012", rel, "晚霞真美")
        day = diary.get_day(workdir, "2026-08-01")
        f = day.fragments[0]
        assert f.kind == "photo"
        assert f.text == "晚霞真美"
        assert f.image == rel

    def test_photo_empty_caption_default(self, workdir: Path):
        rel = diary.save_photo(workdir, "2026-08-01", "183012", self._make_jpeg())
        diary.append_photo(workdir, "2026-08-01", "18:30", "183012", rel, "")
        assert diary.get_day(workdir, "2026-08-01").fragments[0].text == "照片"


class TestWeather:
    def test_set_and_get_weather(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:00", "090000", "a")
        assert diary.set_weather(workdir, "2026-08-01", "☀️晴 25℃") is True
        assert diary.get_weather_of_day(workdir, "2026-08-01") == "☀️晴 25℃"
        # weather 标记不干扰片段解析
        day = diary.get_day(workdir, "2026-08-01")
        assert day.state == "raw"
        assert day.fragments[0].text == "a"

    def test_set_weather_replaces(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:00", "090000", "a")
        diary.set_weather(workdir, "2026-08-01", "旧天气")
        diary.set_weather(workdir, "2026-08-01", "新天气")
        assert diary.get_weather_of_day(workdir, "2026-08-01") == "新天气"

    def test_set_weather_summarized_rejected(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:00", "090000", "a")
        diary.rewrite_day(workdir, "2026-08-01", "成品")
        assert diary.set_weather(workdir, "2026-08-01", "晴") is False  # 成品不设标记
        assert diary.get_weather_of_day(workdir, "2026-08-01") == ""

    def test_get_weather_empty(self, workdir: Path):
        diary.append_text(workdir, "2026-08-01", "09:00", "090000", "a")
        assert diary.get_weather_of_day(workdir, "2026-08-01") == ""
