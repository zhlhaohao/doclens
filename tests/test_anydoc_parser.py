"""anydoc_parser 五格式 e2e 测试（doc/ppt/xls/rtf/epub，ADR-0013）。

fixtures 取自 anydoc 仓库 tests/fixtures（MIT 协议），另含真实中文 xls 样例。
anydoc 是本地 Rust 库（无网络、毫秒级），测试中直接真实调用。
anydoc 未安装（如 win_arm64 无 wheel）时整个模块 skip。
"""
from pathlib import Path

import pytest

anydoc = pytest.importorskip("anydoc", reason="firecrawl-anydoc not installed")

from treesearch.parsers import SOURCE_TYPE_MAP, get_parser  # noqa: E402
from treesearch.parsers.anydoc_parser import ANYDOC_EXTENSIONS, anydoc_to_tree  # noqa: E402
from treesearch.parsers.image_store import ImageStore  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures" / "anydoc"

# (fixture 文件, 解析后正文应包含的关键词)
E2E_CASES = [
    ("text.doc", "Fixture Document"),
    ("pres.ppt", "Speaker note"),
    ("sheet.xls", "fifteen and a half"),
    ("text.rtf", "Fixture Document"),
    ("book.epub", "Bolts"),
]

EXPECTED_SOURCE_TYPES = {
    ".doc": "doc", ".docm": "doc",
    ".ppt": "ppt", ".pps": "ppt", ".pot": "ppt",
    ".xls": "excel",
    ".rtf": "rtf",
    ".epub": "epub",
}


def _collect_text(nodes: list[dict]) -> str:
    """递归收集树中所有 title + text。"""
    parts = []
    for node in nodes:
        parts.append(node.get("title") or "")
        parts.append(node.get("text") or "")
        parts.append(_collect_text(node.get("nodes") or []))
    return "\n".join(parts)


@pytest.mark.parametrize("filename,keyword", E2E_CASES)
async def test_anydoc_e2e(filename, keyword):
    """五格式真实文件解析：树结构非空且关键词进入索引语料。"""
    result = await anydoc_to_tree(str(FIXTURES / filename), if_add_node_text=True)
    assert result["structure"], f"{filename} 解析出空结构"
    assert keyword in _collect_text(result["structure"])
    assert result["source_path"].endswith(filename)


async def test_real_world_chinese_xls():
    """真实中文 xls 样例（test_work_dir 经济/全球科技与健康数据.xls）可解析。"""
    sample = Path(__file__).parent.parent / "test_work_dir" / "经济" / "全球科技与健康数据.xls"
    if not sample.exists():
        pytest.skip("真实样例不在本仓库（在 cortex 知识库）")
    result = await anydoc_to_tree(str(sample), if_add_node_text=True)
    assert "中国" in _collect_text(result["structure"])


def test_registry_routing():
    """8 个扩展名全部注册 parser 且 source_type 映射正确。"""
    for ext, source_type in EXPECTED_SOURCE_TYPES.items():
        assert ext in ANYDOC_EXTENSIONS
        assert get_parser(ext) is not None, f"{ext} 未注册 parser"
        assert SOURCE_TYPE_MAP[ext] == source_type


def test_source_types_allowed_by_default():
    """anydoc 各 source_type 必须在 doclens 默认 allowed_source_types 内。

    回归防护：曾因默认白名单（markdown,csv,pdf,doc,docx,pptx,excel,...）缺
    ppt/rtf/epub，导致扫描阶段直接过滤这些文件——parser 注册了也永远扫不到。
    """
    from doclens.config import CortexConfig

    allowed = set(CortexConfig().allowed_source_types)
    for source_type in set(EXPECTED_SOURCE_TYPES.values()):
        assert source_type in allowed, (
            f"source_type {source_type!r} 不在 CORTEX_ALLOWED_SOURCE_TYPES 默认值内，"
            "该类型文件会在扫描阶段被过滤"
        )


async def test_embedded_image_extracted_to_store(tmp_path):
    """book.epub 内嵌 png → ImageStore 落盘 + inline_md 附加到文档末尾。"""
    store = ImageStore(tmp_path / "images")
    result = await anydoc_to_tree(
        str(FIXTURES / "book.epub"),
        image_store=store,
        rel_path="books/book.epub",
        if_add_node_text=True,
    )
    text = _collect_text(result["structure"])
    assert "![图片" in text, "inline_md 未注入解析结果"
    # 图片实际落盘（store root 下有文件）
    written = [p for p in store.root.rglob("*") if p.is_file()]
    assert written, "ImageStore 无落盘文件"


async def test_malformed_file_raises(tmp_path):
    """垃圾内容伪装 .doc → anydoc UnsupportedError 抛出（由 indexer 记入 failed_files）。"""
    fake = tmp_path / "fake.doc"
    fake.write_bytes(b"not a real ole file at all")
    with pytest.raises(anydoc.UnsupportedError):
        await anydoc_to_tree(str(fake))


async def test_drm_epub_raises_clear_error(tmp_path):
    """含 META-INF/encryption.xml 的 epub（DRM 加密）→ 抛清晰中文错误而非误导性 malformed。"""
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("mimetype", "application/epub+zip")
        z.writestr("META-INF/container.xml", b"\x9ewG&b\xa4")  # 密文
        z.writestr(
            "META-INF/encryption.xml",
            '<encryption><enc:EncryptionKey><zy:KeyInfo>'
            "<Proprietary>ZhangYue.Inc</Proprietary>"
            "</zy:KeyInfo></enc:EncryptionKey></encryption>",
        )
    fake = tmp_path / "drm.epub"
    fake.write_bytes(buf.getvalue())

    with pytest.raises(RuntimeError, match="DRM 加密（ZhangYue.Inc）"):
        await anydoc_to_tree(str(fake))
