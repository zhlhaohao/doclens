# -*- coding: utf-8 -*-
"""AP-49：日记年度文件必须原子替换。

就地 ``write_text`` 是「先截断再写」——写窗口内并发的 GitSync ``git add -A``
会提交半截 ``2026.md`` 并推送；进程崩溃也会留下截断文件。修复为同目录
tmp + ``os.replace``，读者只可能看到完整旧版或完整新版。

目录级的 `_FILE_LOCK` 已由各调用点持有（进程内不会两写者互截），本文件
守住的是「其他读者（git 线程 / 崩溃恢复）」看到的中间态。
"""
import os
import threading
import time
from pathlib import Path

import pytest

from doclens import diary


def _big_content(tag: str, lines: int = 4000) -> str:
    return f"# 2026 日记\n\n## 2026-08-01 星期六\n" + "".join(
        f"- 09:15 {tag} 第 {i} 行 <!-- fid:{i:06d}-aaaa -->\n" for i in range(lines)
    )


class TestAtomicReplace:
    def test_write_uses_os_replace(self, tmp_path: Path, monkeypatch):
        """替换而非就地重写：os.replace 被调用，且源是同目录 tmp。"""
        calls = []
        real = os.replace

        def spy(src, dst):
            calls.append((Path(src).name, Path(dst).name))
            return real(src, dst)

        monkeypatch.setattr(diary.os, "replace", spy)
        target = tmp_path / "2026.md"
        diary._write(target, "# 2026 日记\n")

        assert calls == [("2026.md.tmp", "2026.md")]
        assert target.read_text(encoding="utf-8") == "# 2026 日记\n"
        assert not (tmp_path / "2026.md.tmp").exists()

    def test_failed_write_keeps_old_content(self, tmp_path: Path, monkeypatch):
        """写 tmp 失败时目标文件保持完整旧内容，不留半截。"""
        target = tmp_path / "2026.md"
        original = _big_content("旧")
        target.write_text(original, encoding="utf-8")

        def boom(self, data, **kwargs):
            raise OSError("disk full")

        monkeypatch.setattr(Path, "write_text", boom)
        with pytest.raises(OSError, match="disk full"):
            diary._write(target, _big_content("新"))

        assert target.read_text(encoding="utf-8") == original
        assert not (tmp_path / "2026.md.tmp").exists(), "失败后不留 tmp 残骸"

    def test_creates_parent_dirs(self, tmp_path: Path):
        target = tmp_path / "日记" / "2026.md"
        diary._write(target, "x")
        assert target.read_text(encoding="utf-8") == "x"


class TestConcurrentReaderNeverSeesTruncation:
    def test_reader_always_sees_complete_file(self, tmp_path: Path):
        """并发读线程只会读到完整旧版或完整新版——绝不读到截断。

        读侧带极短间隔（模拟 git/预览的断续访问）；Windows 上原子替换需要
        目标未被打开，持续独占会撞共享冲突，见下一个用例。
        """
        target = tmp_path / "2026.md"
        old = _big_content("旧")
        new = _big_content("新")
        target.write_text(old, encoding="utf-8")

        stop = threading.Event()
        problems: list[str] = []

        def reader() -> None:
            while not stop.is_set():
                try:
                    text = target.read_text(encoding="utf-8")
                except FileNotFoundError:
                    problems.append("文件消失")
                    return
                except PermissionError:
                    # Windows：替换瞬间打开会短暂拒绝访问（不是内容问题）
                    time.sleep(0.001)
                    continue
                if not (text == old or text == new):
                    problems.append(
                        f"读到半截: {len(text)} 字符（完整 = {len(old)}/{len(new)}）"
                    )
                    return
                time.sleep(0.001)

        t = threading.Thread(target=reader)
        t.start()
        try:
            for _ in range(30):
                diary._write(target, new)
                diary._write(target, old)
        finally:
            stop.set()
            t.join()

        assert problems == []
        assert target.read_text(encoding="utf-8") == old

    def test_open_reader_blocks_replace_without_corrupting(self, tmp_path: Path):
        """Windows 语义：目标被独占打开时替换失败——但旧内容必须完好。

        「失败并保住旧文件」远好于「就地截断留下半截」，这正是本条要守住的不变量。
        """
        target = tmp_path / "2026.md"
        original = _big_content("旧")
        target.write_text(original, encoding="utf-8")

        with open(target, "r", encoding="utf-8"):
            with pytest.raises(PermissionError):
                diary._write(target, _big_content("新"))

        assert target.read_text(encoding="utf-8") == original
        assert not (tmp_path / "2026.md.tmp").exists()


class TestEndToEndThroughDomainLayer:
    def test_append_fragment_keeps_file_parseable(self, tmp_path: Path):
        """真实入口（append_fragment）走原子写后内容仍完整可读。"""
        diary.append_text(tmp_path, "2026-08-01", "09:15", "091500-aaaa", "第一条")
        diary.append_text(tmp_path, "2026-08-01", "10:20", "102000-bbbb", "第二条")

        year = diary.year_path(tmp_path, 2026)
        content = year.read_text(encoding="utf-8")
        assert "第一条" in content and "第二条" in content
        assert content.startswith("# 2026 日记")
        assert not list(year.parent.glob("*.tmp"))
