"""AP-8 回归：kb_tools 索引读失败与「未入索引」显式分离（AP-45 口径）。

修复前三处吞异常改变行为分支：
1. _load_doc_by_source_path 裸 except → None：DB 损坏伪装成「未入索引」；
2. _is_ghost_registered → False：ghost 闸门静默放行，read_document 改走
   现场解析——路径漂移不可察觉；
3. _kb_stats 的 OSError: pass：文件总大小静默少算。

修复后契约：IndexReadError 上抛，handler 输出显式报错 + 修复指引，
不静默降级现场解析。
"""
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.kb_tools import (
    IndexReadError,
    handle_file_info,
    handle_read_document,
)


def _broken_idx(tmp_path: Path, monkeypatch, **over):
    """DB 读路径必然失败的替身：FTS5Index 构造即抛（模拟库损坏/锁死）。

    通过拦截 treesearch.fts 模块上的 FTS5Index 符号注入（from-import 在
    函数内每次执行，拦模块属性即拦到构造调用）。
    """
    import treesearch.fts

    class _Broken:
        def __init__(self, *a, **k):
            raise RuntimeError("database disk image is malformed")

    monkeypatch.setattr(treesearch.fts, "FTS5Index", _Broken)

    base = dict(
        path_map={},
        ts=object(),  # 非 None：逼 _is_ghost_registered 走 DB 查询
        max_read_words=4000,
        read_doc_show_toc=False,
        index_path=str(tmp_path / "index.db"),
    )
    base.update(over)
    return SimpleNamespace(**base)


class TestIndexReadFailure:
    @pytest.fixture()
    def kb(self, tmp_path: Path) -> Path:
        p = tmp_path / "doc.md"
        p.write_text("# 标题\n\n正文内容", encoding="utf-8")
        return tmp_path

    def _with_broken_db(self, monkeypatch, tmp_path, fn, *args, **kw):
        idx = _broken_idx(tmp_path, monkeypatch)
        return fn(idx, tmp_path, *args, **kw)

    def test_read_document_reports_db_failure(self, kb, tmp_path, monkeypatch):
        """DB 读失败必须显式报错——不得伪装成现场解析成功（路径漂移）。"""
        out = self._with_broken_db(
            monkeypatch, tmp_path, handle_read_document, path="doc.md",
        )
        assert "索引库读取失败" in out
        assert "reindex" in out  # 给出修复指引
        assert "malformed" in out  # 保留真实失败原因
        # 关键：不能静默走现场解析然后当成功返回正文
        assert "正文内容" not in out

    def test_file_info_reports_db_failure(self, kb, tmp_path, monkeypatch):
        out = self._with_broken_db(
            monkeypatch, tmp_path, handle_file_info, path="doc.md",
        )
        assert "索引库读取失败" in out
        assert "词数" not in out.split("索引库读取失败")[0]  # 不是正常概况输出

    def test_is_ghost_raises_not_false(self, kb, tmp_path, monkeypatch):
        """闸门判定：DB 坏 → 上抛，不得返回 False（伪装「非 ghost」放行）。"""
        from doclens import kb_tools as kt

        idx = _broken_idx(tmp_path, monkeypatch)
        with pytest.raises(IndexReadError):
            kt._is_ghost_registered(idx, str(tmp_path / "doc.md"))

    def test_load_doc_distinguishes_missing_vs_broken(self, kb, tmp_path, monkeypatch):
        """未命中 → None（正常语义保留）；读失败 → IndexReadError。"""
        from doclens import kb_tools as kt

        idx = _broken_idx(tmp_path, monkeypatch)
        with pytest.raises(IndexReadError):
            kt._load_doc_by_source_path(idx, str(tmp_path / "doc.md"))

    def test_kb_stats_notes_unreadable_files(self, tmp_path):
        """统计遇不可读文件：输出带警告标注，不静默少算。"""
        from doclens import kb_tools as kt

        gone = str(tmp_path / "deleted.bin")

        idx = SimpleNamespace(
            ts=object(),
            index_path=str(tmp_path / "index.db"),
            indexed_source_paths=lambda: [gone, str(tmp_path / "ok.md")],
        )
        out = kt._kb_stats(idx)
        assert "不可读" in out
        assert "deleted.bin" in out


class TestNormalPathUnchanged:
    def test_unindexed_md_still_parses_on_site(self, tmp_path):
        """正常路径回归：未入索引的 md 仍走现场解析（None → 回退不受影响）。"""
        idx = SimpleNamespace(
            path_map={}, ts=None,
            max_read_words=4000, read_doc_show_toc=False,
            index_path=str(tmp_path / "none.db"),
        )
        (tmp_path / "free.md").write_text("# 自由\n\n内容", encoding="utf-8")
        out = handle_read_document(idx, tmp_path, path="free.md")
        assert "内容" in out
        assert "索引库读取失败" not in out
