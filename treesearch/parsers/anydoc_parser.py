# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: anydoc-based parser for TreeSearch.

Uses Firecrawl's ``anydoc`` (pure Rust, PyPI: firecrawl-anydoc) to convert
legacy/office-adjacent documents to Markdown, then feeds the result into the
existing ``md_to_tree`` pipeline.

Covers: .doc/.docm (Word 97-2003), .ppt/.pps/.pot (PowerPoint 97-2003),
.xls (Excel 97-2003), .rtf, .epub.

Requires dependency: ``pip install firecrawl-anydoc``（主依赖，ADR-0013）。

Notes:
- anydoc 按内容识别格式（扩展名标错也能转），无需显式 format 参数。
- ppt 老格式输出为扁平段落（无 slide 边界/标题），直接走 md_to_tree，
  不做 pptx 式的根节点包裹（markitdown 每 slide 一个 ``#`` 标题才可包裹）。
- anydoc 的 Markdown 序列化器不输出图片引用（仅保留 alt 文本），内嵌图片
  经 ``to_document().assets`` 提取落盘后统一附加到文档末尾。
"""

import io
import logging
import os
import re
import zipfile
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .image_store import ImagePart, ImageStore

logger = logging.getLogger(__name__)

# Extensions handled by anydoc
ANYDOC_EXTENSIONS = {
    ".doc", ".docm",                    # Word 97-2003
    ".ppt", ".pps", ".pot",             # PowerPoint 97-2003
    ".xls",                             # Excel 97-2003
    ".rtf",
    ".epub",
}

# anydoc Asset.media_type → 落盘扩展名（仅 image/* 会落盘，其余跳过）
_MEDIA_TYPE_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/svg+xml": "svg",
    "image/x-emf": "emf",
    "image/x-wmf": "wmf",
}


def _convert(data: bytes) -> tuple[str, object]:
    """anydoc 转换：(markdown, document)。ConvertError 记具体原因后抛出。"""
    import anydoc

    try:
        md_content = anydoc.to_markdown_bytes(data)
        document = anydoc.to_document(data)
    except anydoc.EncryptedError as e:
        logger.warning("anydoc: encrypted document, skipped: %s", e)
        raise
    except anydoc.ConvertError as e:
        logger.warning("anydoc conversion failed (%s): %s", type(e).__name__, e)
        raise
    return md_content or "", document


def _check_epub_drm(data: bytes) -> None:
    """epub(zip) 含 META-INF/encryption.xml → 全书 DRM 加密，抛清晰错误。

    anydoc 对加密 epub 只会报误导性的 "malformed document: no rootfile entry"
    （container.xml 本身也是密文）。此处预检给出真实原因；error message 会被
    indexer 记入 failed_files.last_error 并在 UI 展示。
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            if "META-INF/encryption.xml" not in z.namelist():
                return
            vendor = ""
            try:
                enc_xml = z.read("META-INF/encryption.xml").decode("utf-8", errors="replace")
                m = re.search(r"<Proprietary>([^<]+)</Proprietary>", enc_xml)
                if m:
                    vendor = f"（{m.group(1)}）"
            except Exception:  # noqa: BLE001
                pass
    except zipfile.BadZipFile:
        return  # 非 zip 留给 anydoc 自己报错
    raise RuntimeError(f"EPUB 含 DRM 加密{vendor}，内容为密文，不支持解析")


def _extract_images(document: object, image_store: "ImageStore", rel_path: str) -> list[str]:
    """提取 assets 中的图片落盘，返回 inline_md 列表（文档序）。

    仅 image/* 媒体类型落盘；OLE 对象等非图 asset 跳过。
    anydoc 不提供图片在正文中的位置，disp_w 未知（前端退回 naturalWidth）。
    """
    from .image_store import ImagePart

    parts: list["ImagePart"] = []
    for asset in document.assets:
        media_type = (asset.media_type or "").lower()
        if not media_type.startswith("image/"):
            logger.debug("skip non-image asset: %s (%s)", asset.origin_part, media_type)
            continue
        parts.append(
            ImagePart(
                blob=asset.data,
                ext=_MEDIA_TYPE_TO_EXT.get(media_type, "png"),
                source_ref=str(asset.id),
                disp_w=None,
            )
        )
    if not parts:
        return []
    refs = image_store.extract_for_doc(rel_path, parts)
    return [refs[p.source_ref].inline_md for p in parts if p.source_ref in refs]


async def anydoc_to_tree(
    file_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    image_store: "ImageStore | None" = None,
    rel_path: str | None = None,
    **kwargs,
) -> dict:
    """Build a tree index from a document via anydoc.

    Converts the document to Markdown using ``anydoc``, extracts embedded
    images to ImageStore, then delegates to ``md_to_tree`` for structure
    extraction.

    Returns:
        {'doc_name': str, 'structure': list, 'source_path': str}
    """
    try:
        import anydoc  # noqa: F401
    except ImportError:
        raise ImportError(
            "anydoc support requires 'firecrawl-anydoc'. "
            "Install with: pip install firecrawl-anydoc"
        )

    doc_name = os.path.splitext(os.path.basename(file_path))[0]
    logger.debug("Parsing with anydoc: %s", file_path)

    with open(file_path, "rb") as f:
        data = f.read()

    if file_path.lower().endswith(".epub"):
        _check_epub_drm(data)

    md_content, document = _convert(data)
    if not md_content.strip():
        logger.warning("anydoc returned empty content for: %s", file_path)
        md_content = ""

    # 内嵌图片提取：anydoc 的 md 不含图片位置，统一附加到文档末尾
    if image_store is not None and rel_path:
        try:
            image_mds = _extract_images(document, image_store, rel_path)
            if image_mds:
                md_content = md_content.rstrip() + "\n\n" + "\n\n".join(image_mds)
        except Exception as e:  # noqa: BLE001
            logger.warning("anydoc image extraction failed for %s: %s", file_path, e)

    from ..indexer import md_to_tree

    tree_result = await md_to_tree(
        md_content=md_content,
        model=model,
        if_add_node_summary=if_add_node_summary,
        summary_chars_threshold=summary_chars_threshold,
        if_add_doc_description=if_add_doc_description,
        if_add_node_text=if_add_node_text,
        if_add_node_id=if_add_node_id,
        **kwargs,
    )
    tree_result["doc_name"] = doc_name
    tree_result["source_path"] = os.path.abspath(file_path)
    return tree_result
