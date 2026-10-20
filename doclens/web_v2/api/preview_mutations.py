"""预览变更端点（P1-3 拆分自 api/preview.py）：保存 / 旋转 / 上传。

写路径三端点 + hash 反查工具。路径解析与越权校验复用 preview_common。
P2-1：save/rotate/probe 同步 def（threadpool 执行，事件循环不被写盘
阻塞）；upload 因 multipart 流式 read 保留 async，写盘包 to_thread。
"""
import asyncio
import hashlib
import logging
import os
import re
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, Query, UploadFile

from doclens.config import data_dirname
from doclens.image_orienter import ORIENTABLE_IMAGE_EXTS, rotate_image_inplace
from doclens.index_manager import IndexManager
from doclens.web_v2.api._auto_rotate import broadcast_rotated, drop_vision_queue_row
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api.preview_common import compute_writable, resolve_path, safe_resolve
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.preview import (
    PreviewRotateResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
    PreviewUploadResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# 5MB 上限（防御性，避免 OOM）
_MAX_SAVE_BYTES = 5 * 1024 * 1024


@router.put("/preview", response_model=PreviewSaveResponse)
def save_preview(
    path: str = Query(..., description="相对路径"),
    body: PreviewSaveRequest = Body(...),
    idx: IndexManager = Depends(get_index_manager),
):
    """保存（P2-1：同步 def 进 threadpool——write_bytes 最多 5MB，
    慢盘上可达百 ms 级，async def 会阻塞事件循环）。"""
    base = Path(idx.search_path)
    full = safe_resolve(base, path)

    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    if not compute_writable(full, base):
        raise CortexAPIError(403, "NOT_WRITABLE", f"该文件不可编辑: {path}")

    encoded = body.content.encode("utf-8")
    if len(encoded) > _MAX_SAVE_BYTES:
        raise CortexAPIError(413, "CONTENT_TOO_LARGE", f"content 超过 {_MAX_SAVE_BYTES // 1024 // 1024}MB 上限")

    try:
        full.write_bytes(encoded)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 触发后台增量重索引（不阻塞响应）
    try:
        idx.trigger_background_reindex()
    except Exception as e:
        # 索引失败不阻断保存成功
        logging.getLogger(__name__).warning("Save reindex failed: %s", e)

    return PreviewSaveResponse(
        path=path,
        content=body.content,
        bytes_written=len(encoded),
        reindex_triggered=True,
    )


@router.post("/preview/rotate", response_model=PreviewRotateResponse)
def rotate_image(
    path: str = Query(..., description="图像文件相对路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    """预览期手动顺时针旋转 90° 并落盘（ADR-0029）。

    复用判向自动旋转（ADR-0017）的像素旋转与收尾管线（同格式重编码 →
    清视觉队列残留 → FileWatcher 自然重建重转写），但**无条件可用**——
    纯像素操作，不依赖视觉 API 配置与 VISION_AUTO_ROTATE 开关。
    同步 def 端点（threadpool 执行），PIL 单图操作耗时可接受。
    """
    base = Path(idx.search_path)
    full, resolved_rel = resolve_path(base, path, idx)
    if full.suffix.lower() not in ORIENTABLE_IMAGE_EXTS:
        raise CortexAPIError(400, "NOT_ROTATABLE", f"该格式不支持旋转: {path}")
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {path}")
    if not rotate_image_inplace(full, 90):
        raise CortexAPIError(500, "ROTATE_FAILED", f"旋转失败: {path}")
    # 收尾与判向旋转一致（ADR-0017 §6）；manual 标志驱动前端 toast 措辞
    drop_vision_queue_row(full, idx.index_path)
    broadcast_rotated(resolved_rel, manual=True)
    return PreviewRotateResponse(path=resolved_rel, rotated=True)


_UPLOAD_FILENAME_RE = re.compile(
    # 可选的 " (N)" 容忍浏览器下载去重后缀（Chrome/Edge: file (1).ext）
    r"^(?P<stem>.+)_(?P<hash>[a-f0-9]{6})(?: \(\d+\))?(?P<suffix>\.[^./\\]+)$"
)


def _parse_upload_filename(filename: str):
    """解析上传文件名 → (stem, hash6, suffix)。

    格式：{stem}_{hash6}[ (N)]{suffix}，其中 hash6 必须是 6 位小写十六进制。
    可选的 " (N)" 是浏览器下载重名时自动添加的去重后缀，解析时容忍并忽略。

    Returns:
        (stem, hash6, suffix) 元组；不匹配返回 None。
    """
    m = _UPLOAD_FILENAME_RE.match(filename)
    if not m:
        return None
    return (m.group("stem"), m.group("hash"), m.group("suffix"))


class _HashCollisionError(Exception):
    """多个索引文档命中同一 (stem, hash6) 时抛出。"""


def _resolve_upload_target(idx, stem: str, hash6: str):
    """遍历索引文档，按 (stem, sha256(rel_path)[:6]) 双因素匹配。

    - IndexManager.documents[*].metadata["source_path"] 存的是绝对路径，
      需先转相对 search_path 的 POSIX 路径再算 hash
    - 命中 0 → None
    - 命中 1 → 相对路径字符串
    - 命中 ≥2 → raise _HashCollisionError
    """
    base = Path(idx.search_path)
    matches = []
    for abs_path in idx.indexed_source_paths():
        if not abs_path:
            continue
        try:
            rel = os.path.relpath(abs_path, base).replace(os.sep, "/")
        except ValueError:
            # Windows 跨盘符 relpath 会抛 ValueError
            continue
        if Path(rel).stem != stem:
            continue
        h = hashlib.sha256(rel.encode("utf-8")).hexdigest()[:6]
        if h == hash6:
            matches.append(rel)
    if len(matches) == 0:
        return None
    if len(matches) > 1:
        raise _HashCollisionError(
            f"hash+stem 命中多个文件：{matches}"
        )
    return matches[0]


# 50MB 上限（防御性，避免 OOM；允许二进制大文件）
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@router.get("/preview/upload-target")
def probe_upload_target(
    filename: str = Query(..., description="上传文件名"),
    idx: IndexManager = Depends(get_index_manager),
):
    """只读探测：文件名带 hash6（doclens 下载产物）时反查知识库原文件路径。

    供 files 页上传分流（「覆盖原文件 / 存入当前目录」用户确认）——
    复用 POST /preview/upload 的文件名解析与反查逻辑，不做任何写入。
    hash 冲突（命中多个）按无匹配处理（与静默目录上传的旧行为一致）。
    """
    parsed = _parse_upload_filename(filename)
    if parsed is None:
        return {"match": False}
    stem, hash6, _suffix = parsed
    try:
        rel = _resolve_upload_target(idx, stem, hash6)
    except _HashCollisionError:
        return {"match": False}
    if rel is None:
        return {"match": False}
    return {"match": True, "path": rel}


@router.post("/preview/upload", response_model=PreviewUploadResponse)
async def upload(
    file: UploadFile = File(..., description="要上传的文件"),
    idx: IndexManager = Depends(get_index_manager),
):
    """上传文件，按文件名 hash 反查目标路径并覆盖原文件。"""
    # 1. 解析文件名
    parsed = _parse_upload_filename(file.filename or "")
    if parsed is None:
        raise CortexAPIError(
            400, "BAD_FILENAME",
            "文件名不符合 {stem}_{hash6}{suffix} 格式",
        )
    stem, hash6, _suffix = parsed

    # 2. 反查目标相对路径
    try:
        rel = _resolve_upload_target(idx, stem, hash6)
    except _HashCollisionError as e:
        raise CortexAPIError(409, "HASH_COLLISION", str(e)) from e
    if rel is None:
        raise CortexAPIError(
            404, "NOT_INDEXED",
            f"hash+stem 在索引中找不到匹配：{file.filename}",
        )

    # 3. 越权与可写性检查
    base = Path(idx.search_path)
    full = safe_resolve(base, rel)
    # 显式拒绝数据目录子目录（开发 .cortex / 发行版 .doclens）
    try:
        full.relative_to(base / data_dirname())
        raise CortexAPIError(403, "NOT_WRITABLE", "禁止覆盖索引元数据")
    except ValueError:
        pass

    # 4. 读字节 + 大小检查（file.read 是真异步——multipart 流式读取）
    data = await file.read(_MAX_UPLOAD_BYTES + 1)
    if len(data) > _MAX_UPLOAD_BYTES:
        raise CortexAPIError(
            413, "CONTENT_TOO_LARGE",
            f"文件超过 {_MAX_UPLOAD_BYTES // 1024 // 1024}MB 上限",
        )

    # 5. 写盘（P2-1：50MB 级同步写盘包 to_thread，不阻塞事件循环）
    try:
        await asyncio.to_thread(full.write_bytes, data)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 触发后台增量重索引（不阻塞响应；失败不阻断上传成功）
    try:
        idx.trigger_background_reindex()
    except Exception as e:
        logging.getLogger(__name__).warning("Upload reindex failed: %s", e)

    return PreviewUploadResponse(
        path=rel,
        bytes_written=len(data),
        reindex_triggered=True,
    )
