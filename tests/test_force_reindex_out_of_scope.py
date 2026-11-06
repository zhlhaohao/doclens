# -*- coding: utf-8 -*-
"""force 全量重建必须刷新「扫描范围外的已索引文档」。

背景（2026-11-06 真实事故）：``研发项目资料/`` 在后加的 ``.gitignore`` 里被
排除，该目录下的文档早已索引在库。此后再点「强制重建索引」，``resolve_paths``
扫不到它们 → ``to_index`` 里没有 → 旧 ``structure_json`` 永久陈旧，而 UI 报告
重建成功。表现为：docx 解析缺陷修好了、代码也升级了，预览内容却还是旧的。

修复语义：``force=True`` = 刷新**所有已知文档**，而不是把索引范围缩小到本次
扫描结果。库中已有、磁盘仍在、但扫描未覆盖的文件会被补进本次重建队列；
真正的孤儿（磁盘已消失）仍然交给 prune 逻辑。
"""
import asyncio
import json

import pytest


def _write_docx(path, text):
    docx = pytest.importorskip("docx", reason="python-docx not installed")
    doc = docx.Document()
    doc.add_heading("章节", level=1)
    doc.add_paragraph(text)
    doc.save(str(path))


def _index(db_path, path, force=False):
    from treesearch.indexer import build_index

    return asyncio.run(
        build_index([str(path)], db_path=str(db_path), force=force,
                    return_documents=False, respect_gitignore=False)
    )


def _stored_structure(db_path, source_path):
    from treesearch.fts import FTS5Index

    fts = FTS5Index(db_path=str(db_path))
    try:
        doc = fts.load_document_by_source_path(str(source_path))
        return None if doc is None else json.dumps(doc.structure, ensure_ascii=False)
    finally:
        fts.close()


def test_force_reindex_refreshes_ignored_but_indexed_file(tmp_path):
    """文件被 ignore 规则挡在扫描外，force 仍要重建它的内容。"""
    workdir = tmp_path / "work"
    ignored = workdir / "ignored_dir"
    ignored.mkdir(parents=True)
    doc = ignored / "doc.docx"
    _write_docx(doc, "旧内容OLD")

    db_path = tmp_path / "index.db"
    _index(db_path, doc)  # 首次索引（此时目录尚被扫描）

    # 后来新增 ignore 规则：该目录整体从扫描中消失
    (workdir / ".gitignore").write_text("ignored_dir/\n", encoding="utf-8")

    from treesearch.pathutil import resolve_paths
    scanned = resolve_paths([str(workdir)], respect_gitignore=True)
    assert str(doc) not in scanned, "前置条件：该文件已不在扫描范围"

    # 内容变化后强制重建（模拟用户点「强制重建索引」）
    _write_docx(doc, "新内容NEW")
    _index(db_path, workdir, force=True)

    structure = _stored_structure(db_path, doc)
    assert structure is not None, "force 重建不应丢掉已索引文档"
    assert "新内容NEW" in structure, (
        "force 重建必须刷新扫描范围外的已索引文档，否则旧结构永久陈旧"
    )
    assert "旧内容OLD" not in structure


def test_force_reindex_skips_files_missing_from_disk(tmp_path):
    """磁盘已消失的文档不由「补齐」误加回队列（交给 prune），且不产生失败记录。"""
    workdir = tmp_path / "work"
    workdir.mkdir()
    kept = workdir / "kept.md"
    kept.write_text("# 标题\n\n正文", encoding="utf-8")
    gone = workdir / "gone.md"
    gone.write_text("# 标题\n\n临时文本", encoding="utf-8")

    db_path = tmp_path / "index.db"
    _index(db_path, workdir)

    gone.unlink()
    res = _index(db_path, workdir, force=True)  # 不应抛错

    assert res.stats.failed_files == 0
    assert "正文" in (_stored_structure(db_path, kept) or "")


def test_force_reindex_respects_source_type_filter(tmp_path):
    """允许类型过滤仍然生效：补入的跨范围文件也要过扩展名白名单。"""
    from treesearch import config as ts_config

    workdir = tmp_path / "work"
    workdir.mkdir()
    md = workdir / "keep.md"
    md.write_text("# 标题\n\n正文", encoding="utf-8")

    db_path = tmp_path / "index.db"
    _index(db_path, md)

    (workdir / ".gitignore").write_text("keep.md\n", encoding="utf-8")

    old = ts_config.get_config()
    try:
        cfg = ts_config.TreeSearchConfig.from_env()
        cfg.allowed_source_types = frozenset({"pdf"})  # md 不在白名单
        ts_config.set_config(cfg)
        md.write_text("# 标题\n\n新内容NEW", encoding="utf-8")
        _index(db_path, workdir, force=True)
    finally:
        ts_config.set_config(old)

    # 白名单不含 md → 不该被强制解析（ghost 化后结构为空也算「未解析」）
    structure = _stored_structure(db_path, md)
    assert structure is None or "新内容NEW" not in structure
