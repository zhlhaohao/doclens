# -*- coding: utf-8 -*-
"""build_index 端到端集成 ImageStore 图片提取与生命周期管理。"""
import asyncio

from pathlib import Path

from tests.conftest_image_fixtures import make_docx_with_image


def _run(coro):
    return asyncio.run(coro)


def test_build_index_extracts_docx_images(tmp_path: Path):
    from treesearch.indexer import build_index

    workdir = tmp_path / "kb"
    workdir.mkdir()
    make_docx_with_image(str(workdir / "报告.docx"))
    db_path = workdir / ".cortex" / "index.db"

    docs = _run(build_index([str(workdir)], db_path=str(db_path), if_add_node_text=True))

    images_root = db_path.parent / "images"
    # 至少一个图片子目录被创建
    assert images_root.exists() and any(images_root.iterdir())
    # 文档节点 text 含图片引用
    all_text = []

    def walk(n):
        all_text.append(n.get("text") or "")
        for c in n.get("nodes") or []:
            walk(c)

    for d in docs:
        for n in d.structure:
            walk(n)
    assert any("/api/preview/asset?path=" in t and "id=1" in t for t in all_text)


def test_build_index_force_purges_all(tmp_path: Path):
    from treesearch.indexer import build_index

    workdir = tmp_path / "kb"
    workdir.mkdir()
    make_docx_with_image(str(workdir / "a.docx"))
    db_path = workdir / ".cortex" / "index.db"
    images_root = db_path.parent / "images"

    _run(build_index([str(workdir)], db_path=str(db_path), if_add_node_text=True))
    assert images_root.exists() and any(images_root.iterdir())

    # force 重建前先制造一个"孤儿"子目录，验证 purge_all 清空
    orphan = images_root / "deadbeefdead"
    orphan.mkdir(parents=True)
    (orphan / "1.png").write_bytes(b"x")

    _run(build_index([str(workdir)], db_path=str(db_path), force=True, if_add_node_text=True))
    assert not orphan.exists()  # force 清空了全部


def test_build_index_indexes_code_file_not_dropped(tmp_path: Path):
    """Regression: image_store kwargs must not cause treesitter parser TypeError.

    build_index forwards image_store + rel_path to ALL parsers via **common.
    treesitter_code_to_tree previously lacked **kwargs, raising TypeError that
    was silently caught -> code files (.py/.go/.ts/...) were dropped from index.
    """
    from treesearch.indexer import build_index

    workdir = tmp_path / "kb"
    workdir.mkdir()
    (workdir / "add.py").write_text("def add(a, b):\n    return a + b\n", encoding="utf-8")
    db_path = workdir / ".cortex" / "index.db"

    docs = _run(build_index([str(workdir)], db_path=str(db_path), if_add_node_text=True))

    assert len(docs) >= 1  # .py file indexed, NOT silently dropped
