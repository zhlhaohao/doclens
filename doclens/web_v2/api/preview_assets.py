"""预览字节流端点（P1-3 拆分自 api/preview.py）。

四个端点直接服务原始字节（不经 DB 合成），路径解析与越权校验复用
api/preview.py 的共享工具（_safe_resolve/_lookup_rel_via_path_map）。
"""
import hashlib
import os
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api.files_browse import (
    is_absolute_browse_path,
    normalize_browse_path,
)
from doclens.web_v2.api.preview_common import (
    ERR_FILE_MOVED,
    ERR_FILE_NOT_FOUND,
    resolve_path,
    resolve_path_optional,
    resolve_rel_best_effort,
    safe_resolve,
)
from doclens.web_v2.deps import get_index_manager
from treesearch.parsers.image_store import ImageStore, doc_hash_for, EXT_TO_MEDIA
from treesearch.parsers.image_parser import IMAGE_EXTENSIONS

router = APIRouter()


@router.get("/preview/download")
def download(
    path: str = Query(..., description="文件相对路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    """以附件形式下载任意知识库文件。

    下载文件名带 sha256(rel_path) 前 6 位后缀——上传时按它反查原路径
    覆盖原文件（hash 回写闭环，见 preview_mutations.py）。

    点文件保护与 files API 一致（AP-32）：本端点直传字节、不经 DB，
    若不拦 `.env` / `.git/config` / `.cortex/index.db` 等于给保护面开了
    整文件下载侧门。

    ADR-0049 整机浏览：绝对路径直读（外部只读下载）；hash6 后缀对绝对
    路径串照算——hash 反查闭环只在 workdir 索引内命中，外部文件上传
    回写场景自然走常规上传，不破坏既有行为。
    """
    if is_absolute_browse_path(path):
        norm = normalize_browse_path(path)
        full = Path(norm)
        if not full.exists() or not full.is_file():
            raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")
        digest = hashlib.sha256(norm.encode("utf-8")).hexdigest()[:6]
        return FileResponse(
            path=str(full),
            filename=f"{full.stem}_{digest}{full.suffix}",
            media_type="application/octet-stream",
        )
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")
    stem = full.stem
    digest = hashlib.sha256(path.replace(os.sep, "/").encode("utf-8")).hexdigest()[:6]
    return FileResponse(
        path=str(full),
        filename=f"{stem}_{digest}{full.suffix}",
        media_type="application/octet-stream",
    )


@router.get("/preview/asset")
def preview_asset(
    path: str = Query(..., description="文档相对路径"),
    id: int = Query(..., ge=1, description="图片序号（1-indexed）"),
    idx: IndexManager = Depends(get_index_manager),
):
    """返回文档内某张图片的字节流。

    path 经越权校验（必须在 search_path 内）；图片从
    ``<index_path>.parent/images/<doc_hash>/<seq>.<ext>`` 读取。
    """
    base = Path(idx.search_path)
    # AP-20：先归一为相对路径再算 doc_hash_for——图片按 rel 落盘，用原始
    # path 算 hash 在「AI 只给文件名」时必然 404（同域 preview_raw 走
    # resolve_path 已是归一后的路径，两端口径此前分叉）。
    rel = resolve_rel_best_effort(base, path, idx)

    images_root = Path(idx.index_path).parent / "images"
    store = ImageStore(images_root)
    resolved = store.resolve(doc_hash_for(rel), id)
    if resolved is None:
        raise CortexAPIError(404, "IMAGE_NOT_FOUND", f"图片不存在: {path} #{id}")
    file_path, media_type = resolved
    return FileResponse(path=str(file_path), media_type=media_type)


@router.get("/preview/raw")
def preview_raw(
    path: str = Query(..., description="图像文件相对路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    """直接返回独立图像文件的字节流（供图像预览顶部嵌入原图）。

    仅限图像扩展名（IMAGE_EXTENSIONS）；path 经越权校验。

    ADR-0049：绝对路径直读字节——外部图像预览的原图源（图像本体渲染
    不依赖索引，依赖索引的只是 vision 解读）。
    """
    if is_absolute_browse_path(path):
        norm = normalize_browse_path(path)
        full = Path(norm)
        ext = full.suffix.lower()
        if ext not in IMAGE_EXTENSIONS:
            raise CortexAPIError(400, "NOT_AN_IMAGE", f"非图像文件: {path}")
        if not (full.exists() and full.is_file()):
            raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")
        media_type = EXT_TO_MEDIA.get(ext.lstrip("."), "application/octet-stream")
        return FileResponse(path=str(full), media_type=media_type)
    base = Path(idx.search_path)
    full, _resolved_rel = resolve_path(base, path, idx)
    ext = full.suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        raise CortexAPIError(400, "NOT_AN_IMAGE", f"非图像文件: {path}")
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, ERR_FILE_NOT_FOUND, f"文件不存在: {path}")
    media_type = EXT_TO_MEDIA.get(ext.lstrip("."), "application/octet-stream")
    return FileResponse(path=str(full), media_type=media_type)


@router.get("/preview/pdf")
def preview_pdf(
    path: str = Query(..., description="PDF 文件相对路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    """PDF 原生预览字节流（ADR-0031）：inline 返回原始 PDF。

    只做越权校验与磁盘存在性——**不查 DB**（预览与索引解耦：未索引文件
    照常可看）。文件不在磁盘（含「已索引但被移走」——搜索仍命中的场景）
    → FILE_MOVED 明确报错，不回退合成 md（单路径决议）。

    ADR-0049 整机浏览：绝对路径直读字节（外部 PDF 只读预览）。
    """
    if is_absolute_browse_path(path):
        full = Path(normalize_browse_path(path))
        if full.suffix.lower() != ".pdf":
            raise CortexAPIError(400, "NOT_A_PDF", f"非 PDF 文件: {path}")
        if not (full.exists() and full.is_file()):
            raise CortexAPIError(
                404, ERR_FILE_MOVED,
                f"PDF 文件不在磁盘（可能已被移动或删除），无法预览: {path}",
            )
        return FileResponse(path=str(full), media_type="application/pdf")
    base = Path(idx.search_path)
    # AP-20：统一走 resolve_path_optional（原此处手抄一份反查）。
    # 不用 resolve_path——它对不存在文件抛 FILE_NOT_FOUND，会绕过本端点
    # 「已索引/曾存在但文件被移走」的 FILE_MOVED 区分语义。
    resolved = resolve_path_optional(base, path, idx)
    full = resolved[0] if resolved is not None else safe_resolve(base, path)
    if full.suffix.lower() != ".pdf":
        raise CortexAPIError(400, "NOT_A_PDF", f"非 PDF 文件: {path}")
    if not (full.exists() and full.is_file()):
        raise CortexAPIError(
            404, ERR_FILE_MOVED,
            f"PDF 文件不在磁盘（可能已被移动或删除），无法预览: {path}",
        )
    return FileResponse(path=str(full), media_type="application/pdf")
