# -*- coding: utf-8 -*-
"""/files/documents 全量清单构建回归（2026-10-25 下拉刷新卡死事故）。

背景：7860 开发环境（EnterpriseRAG slack 语料，285,605 docs）下拉刷新一直
转圈——旧 `_indexed_documents` 走 indexed_source_paths + 逐条 is_file/stat
（57 万次系统调用），50 万级语料实测 ~110s。重写为：
① 单条 SQL 直取 name/source_path/node_count（ghost 谓词下推 node_count=0）；
② scandir 按父目录批量取存在性 + size/mtime（285k 文件实测 1.4s）。

本测试用 stub IndexManager（真 sqlite 库 + 真文件）锁行为契约：
- 常规行：path/name/size/mtime 正确，ghost=False；
- ghost 行（node_count=0）：包含且 ghost=True；
- DB 有但磁盘缺失的文件：跳过；
- 库外路径（relative_to 抛 ValueError）：跳过；
- doc_name 空：回退磁盘文件名；
- 大小写 name 排序由端点做（_work），此处只验证构建本身。
"""
from datetime import datetime, timezone
from pathlib import Path

from doclens.web_v2.api import files as files_api


class _StubIndex:
    """只暴露 index_path / search_path 的最小 stub。"""

    def __init__(self, workdir: Path, db_path: Path):
        self.index_path = str(db_path)
        self.search_path = str(workdir)


def _make_db(db_path: Path, rows: list[tuple[str, str, int]]) -> None:
    import sqlite3

    conn = sqlite3.connect(db_path)
    conn.execute(
        """CREATE TABLE documents (
            doc_id TEXT, doc_name TEXT, doc_description TEXT,
            source_path TEXT, source_type TEXT, structure_json TEXT,
            node_count INTEGER, index_hash TEXT, page_starts TEXT
        )"""
    )
    conn.executemany(
        "INSERT INTO documents (doc_name, source_path, node_count) VALUES (?,?,?)",
        rows,
    )
    conn.commit()
    conn.close()


def _indexed_documents(idx, base):
    """函数内取私有成员（架构红线：tests 不模块级 import _name）。"""
    return files_api._indexed_documents(idx, base)  # noqa: SLF001


def test_basic_rows_and_fields(tmp_path: Path):
    f1 = tmp_path / "a.md"
    f1.write_text("# a", encoding="utf-8")
    f2 = tmp_path / "sub" / "b.md"
    f2.parent.mkdir()
    f2.write_text("# b", encoding="utf-8")
    db = tmp_path / "index.db"
    _make_db(db, [
        ("a.md", str(f1), 5),
        ("b.md", str(f2), 3),
    ])
    docs = _indexed_documents(_StubIndex(tmp_path, db), tmp_path)
    by_path = {d.path: d for d in docs}
    assert set(by_path) == {"a.md", "sub/b.md"}
    d1 = by_path["a.md"]
    assert d1.name == "a.md"
    assert d1.ghost is False
    assert d1.size == f1.stat().st_size
    assert isinstance(d1.modified_at, datetime)
    assert d1.modified_at.tzinfo == timezone.utc


def test_ghost_rows_tagged_and_included(tmp_path: Path):
    f = tmp_path / "ghost.md"
    f.write_text("g", encoding="utf-8")
    db = tmp_path / "index.db"
    _make_db(db, [("ghost.md", str(f), 0)])
    docs = _indexed_documents(_StubIndex(tmp_path, db), tmp_path)
    assert len(docs) == 1
    assert docs[0].ghost is True


def test_missing_file_skipped(tmp_path: Path):
    gone = tmp_path / "gone.md"  # DB 有记录、磁盘不存在
    db = tmp_path / "index.db"
    _make_db(db, [("gone.md", str(gone), 2)])
    assert _indexed_documents(_StubIndex(tmp_path, db), tmp_path) == []


def test_outside_base_skipped(tmp_path: Path):
    outside = tmp_path.parent / "_outside_测试.md"
    outside.write_text("x", encoding="utf-8")
    try:
        inside = tmp_path / "in.md"
        inside.write_text("y", encoding="utf-8")
        db = tmp_path / "index.db"
        _make_db(db, [
            ("in.md", str(inside), 1),
            ("out.md", str(outside), 1),
        ])
        docs = _indexed_documents(_StubIndex(tmp_path, db), tmp_path)
        assert [d.path for d in docs] == ["in.md"]
    finally:
        outside.unlink(missing_ok=True)


def test_empty_doc_name_falls_back_to_disk_name(tmp_path: Path):
    f = tmp_path / "named.md"
    f.write_text("n", encoding="utf-8")
    db = tmp_path / "index.db"
    _make_db(db, [("", str(f), 1)])
    docs = _indexed_documents(_StubIndex(tmp_path, db), tmp_path)
    assert docs and docs[0].name == "named.md"


def test_duplicate_rel_paths_deduped(tmp_path: Path):
    f = tmp_path / "dup.md"
    f.write_text("d", encoding="utf-8")
    db = tmp_path / "index.db"
    _make_db(db, [
        ("dup.md", str(f), 1),
        ("dup.md", str(f), 1),  # 完全重复行
    ])
    docs = _indexed_documents(_StubIndex(tmp_path, db), tmp_path)
    assert len(docs) == 1


def test_broken_db_returns_empty(tmp_path: Path):
    # 非 sqlite 文件 → 连接/查询失败 → 空列表（不抛）
    bad = tmp_path / "bad.db"
    bad.write_bytes(b"not a sqlite file")
    assert _indexed_documents(_StubIndex(tmp_path, bad), tmp_path) == []


def test_directory_entry_skipped(tmp_path: Path):
    # source_path 指向目录：entry.is_file() False → 跳过
    d = tmp_path / "adir"
    d.mkdir()
    db = tmp_path / "index.db"
    _make_db(db, [("adir", str(d), 1)])
    assert _indexed_documents(_StubIndex(tmp_path, db), tmp_path) == []


def test_missing_dir_skips_group(tmp_path: Path):
    # 整个父目录被移走：该组全部跳过，不抛
    f = tmp_path / "vanished" / "x.md"
    db = tmp_path / "index.db"
    _make_db(db, [("x.md", str(f), 1)])
    assert _indexed_documents(_StubIndex(tmp_path, db), tmp_path) == []
