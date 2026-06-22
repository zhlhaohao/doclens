"""GET/POST/DELETE /api/files/* — 工作目录文件管理。

所有写操作成功后调用 idx.trigger_background_reindex()。
路径安全 + 点文件保护统一走 path_safety 模块。
"""
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from cortex.index_manager import IndexManager
from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.deps import get_index_manager
from cortex.web_v2.models.files import (
    AttrsResponse,
    DirStatsResponse,
    Entry,
    ListDirResponse,
    MkdirRequest,
    MoveRequest,
    MoveResponse,
    RenameRequest,
    SkippedItem,
    UploadResponse,
)
from cortex.web_v2.path_safety import (
    assert_not_protected,
    assert_not_root,
    compute_writable,
    is_protected,
    safe_resolve,
    validate_move_target,
    validate_name,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


def _posix_rel(full: Path, base: Path) -> str:
    """绝对路径 → 相对 base 的 POSIX 字符串。"""
    rel = full.relative_to(base.resolve())
    return "/".join(rel.parts) if rel.parts else ""


def _has_child_dirs(full: Path, base: Path) -> bool:
    """目录是否包含至少一个非受保护的子目录（向前看一层，用于树形控件的箭头显示）。"""
    try:
        for child in full.iterdir():
            if child.is_dir() and not is_protected(child, base):
                return True
    except (PermissionError, OSError):
        return False
    return False


def _build_entry(full: Path, base: Path, indexed_paths: set) -> Entry:
    stat = full.stat()
    rel = _posix_rel(full, base)
    is_dir = full.is_dir()
    has_child_dirs = _has_child_dirs(full, base) if is_dir else False
    return Entry(
        name=full.name,
        path=rel,
        is_dir=is_dir,
        size=0 if is_dir else stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        indexed=(not is_dir) and (rel in indexed_paths),
        writable=compute_writable(full, base),
        has_child_dirs=has_child_dirs,
    )


def _indexed_paths(idx: IndexManager, base: Path) -> set:
    """从 idx.documents 构建"相对 POSIX 路径"集合（仅文件）。"""
    result = set()
    for doc in idx.documents or []:
        abs_path = doc.metadata.get("source_path", "") if hasattr(doc, "metadata") else ""
        if not abs_path:
            continue
        try:
            p = Path(abs_path)
            rel = p.relative_to(base.resolve())
            result.add("/".join(rel.parts) if rel.parts else "")
        except (ValueError, OSError):
            continue
    return result


def _trigger_reindex(idx: IndexManager) -> bool:
    try:
        idx.trigger_background_reindex()
        return True
    except Exception as e:
        logger.warning("reindex failed: %s", e)
        return False


def _walk_for_stats(root: Path, base: Path) -> tuple:
    """递归统计（跳过点文件子目录）。"""
    files = 0
    dirs = 0
    total = 0
    for child in root.iterdir():
        if is_protected(child, base):
            continue
        if child.is_dir():
            dirs += 1
            f, d, s = _walk_for_stats(child, base)
            files += f
            dirs += d
            total += s
        elif child.is_file():
            files += 1
            try:
                total += child.stat().st_size
            except OSError:
                pass
    return files, dirs, total


# --- GET /files/list ---

@router.get("/files/list", response_model=ListDirResponse)
async def list_dir(
    path: str = Query(default=""),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    idx: IndexManager = Depends(get_index_manager),
) -> ListDirResponse:
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    assert_not_protected(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    if not full.is_dir():
        raise CortexAPIError(400, "INVALID_PATH", f"不是目录: {path}")

    indexed = _indexed_paths(idx, base)
    all_entries = []
    for child in full.iterdir():
        if is_protected(child, base):
            continue
        all_entries.append(_build_entry(child, base, indexed))
    all_entries.sort(key=lambda e: (not e.is_dir, e.name.lower()))
    page = all_entries[offset:offset + limit]
    return ListDirResponse(path=path, entries=page, total=len(all_entries))


# --- GET /files/stats ---

@router.get("/files/stats", response_model=DirStatsResponse)
async def stats(
    path: str = Query(...),
    idx: IndexManager = Depends(get_index_manager),
) -> DirStatsResponse:
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    assert_not_protected(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    if not full.is_dir():
        raise CortexAPIError(400, "INVALID_PATH", f"不是目录: {path}")
    files, dirs, total = _walk_for_stats(full, base)
    return DirStatsResponse(path=path, file_count=files, dir_count=dirs, total_size_bytes=total)


# --- GET /files/attrs ---

@router.get("/files/attrs", response_model=AttrsResponse)
async def attrs(
    path: str = Query(...),
    idx: IndexManager = Depends(get_index_manager),
) -> AttrsResponse:
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    assert_not_protected(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    indexed = _indexed_paths(idx, base)
    stat = full.stat()
    return AttrsResponse(
        name=full.name,
        path=_posix_rel(full, base),
        is_dir=full.is_dir(),
        size=0 if full.is_dir() else stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        indexed=(not full.is_dir()) and (_posix_rel(full, base) in indexed),
        writable=compute_writable(full, base),
        created_at=datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc),
        extension=full.suffix.lower() if full.suffix else None,
        is_protected=False,
    )


# --- POST /files/mkdir ---

@router.post("/files/mkdir")
async def mkdir(
    req: MkdirRequest,
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    target = safe_resolve(base, req.path)
    assert_not_protected(target, base)
    parent = target.parent
    if not parent.exists() or not parent.is_dir():
        raise CortexAPIError(400, "INVALID_PATH", f"父目录不存在: {parent}")
    validate_name(target.name)
    if target.exists():
        raise CortexAPIError(409, "ALREADY_EXISTS", f"路径已存在: {req.path}")
    try:
        target.mkdir(parents=False)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"创建失败: {e}") from e
    return {"ok": True, "path": _posix_rel(target, base), "reindex_triggered": _trigger_reindex(idx)}


# --- DELETE /files ---

@router.delete("/files")
async def delete(
    path: str = Query(...),
    idx: IndexManager = Depends(get_index_manager),
):
    base = Path(idx.search_path)
    full = safe_resolve(base, path)
    assert_not_protected(full, base)
    assert_not_root(full, base)
    if not full.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
    try:
        if full.is_dir():
            shutil.rmtree(full)
        else:
            full.unlink()
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"删除失败: {e}") from e
    return {"ok": True, "deleted": path, "reindex_triggered": _trigger_reindex(idx)}


# --- POST /files/move ---

@router.post("/files/move", response_model=MoveResponse)
async def move(
    req: MoveRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> MoveResponse:
    base = Path(idx.search_path)
    dest_dir = safe_resolve(base, req.dest_dir)
    assert_not_protected(dest_dir, base)
    if not dest_dir.exists() or not dest_dir.is_dir():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"目标目录不存在: {req.dest_dir}")

    moved = []
    skipped = []

    for from_path_str in req.from_paths:
        src = safe_resolve(base, from_path_str)
        # 受保护源路径直接整体 403（与其他端点的保护语义一致）
        assert_not_protected(src, base)
        if not src.exists():
            skipped.append(SkippedItem(from_path=from_path_str, reason="NOT_FOUND"))
            continue
        # 移动到自身/子目录属于请求级硬错误（无法继续处理剩余条目）
        validate_move_target(src, dest_dir)

        target = dest_dir / src.name
        # 目标受保护也属于硬错误
        assert_not_protected(target, base)
        if target.exists():
            if not req.overwrite:
                skipped.append(SkippedItem(from_path=from_path_str, reason="ALREADY_EXISTS"))
                continue
            try:
                if target.is_dir():
                    shutil.rmtree(target)
                else:
                    target.unlink()
            except OSError as e:
                skipped.append(SkippedItem(from_path=from_path_str, reason=f"WRITE_FAILED:{e}"))
                continue
        try:
            shutil.move(str(src), str(target))
            moved.append(_posix_rel(target, base))
        except OSError as e:
            skipped.append(SkippedItem(from_path=from_path_str, reason=f"WRITE_FAILED:{e}"))

    if moved:
        _trigger_reindex(idx)
    return MoveResponse(moved=moved, skipped=skipped)


# --- POST /files/rename ---

@router.post("/files/rename", response_model=Entry)
async def rename(
    req: RenameRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> Entry:
    base = Path(idx.search_path)
    src = safe_resolve(base, req.path)
    assert_not_protected(src, base)
    if not src.exists():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {req.path}")
    validate_name(req.new_name)
    target = src.parent / req.new_name
    assert_not_protected(target, base)
    if target.exists():
        raise CortexAPIError(409, "ALREADY_EXISTS", f"目标已存在: {req.new_name}")
    try:
        src.rename(target)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"重命名失败: {e}") from e
    _trigger_reindex(idx)
    indexed = _indexed_paths(idx, base)
    return _build_entry(target, base, indexed)


# --- POST /files/upload ---

@router.post("/files/upload", response_model=UploadResponse)
async def upload(
    file: UploadFile = File(...),
    dest_dir: str = Form(default=""),
    overwrite: bool = Form(default=False),
    idx: IndexManager = Depends(get_index_manager),
) -> UploadResponse:
    base = Path(idx.search_path)
    dest_full = safe_resolve(base, dest_dir)
    assert_not_protected(dest_full, base)
    if not dest_full.exists() or not dest_full.is_dir():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"目标目录不存在: {dest_dir}")

    filename = file.filename or ""
    validate_name(filename)

    target = dest_full / filename
    assert_not_protected(target, base)
    overwritten = False
    if target.exists():
        if not overwrite:
            raise CortexAPIError(409, "ALREADY_EXISTS", f"已存在: {filename}")
        overwritten = True

    data = await file.read(_MAX_UPLOAD_BYTES + 1)
    if len(data) > _MAX_UPLOAD_BYTES:
        raise CortexAPIError(413, "CONTENT_TOO_LARGE", f"超过 {_MAX_UPLOAD_BYTES // 1024 // 1024}MB 上限")

    try:
        target.write_bytes(data)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    return UploadResponse(
        path=_posix_rel(target, base),
        bytes_written=len(data),
        overwritten=overwritten,
        reindex_triggered=_trigger_reindex(idx),
    )
