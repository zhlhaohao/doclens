"""GET/POST/DELETE /api/files/* — 工作目录文件管理。

所有写操作成功后调用 idx.trigger_background_reindex()。
路径安全 + 点文件保护统一走 path_safety 模块。
"""
import asyncio
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile

from doclens.index_manager import IndexManager
from doclens.web_v2.api._auto_rotate import schedule_auto_rotate
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api.image_compress import compress_image_bytes
from doclens.web_v2.deps import get_config, get_index_manager
from doclens.web_v2.models.files import (
    AttrsResponse,
    DirStatsResponse,
    Entry,
    IndexedDocument,
    IndexedDocumentsResponse,
    ListDirResponse,
    MkdirRequest,
    MoveRequest,
    MoveResponse,
    RenameRequest,
    SkippedItem,
    UploadResponse,
)
from doclens.web_v2.path_safety import (
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

# 上传扩展名白名单（V4）：覆盖知识库支持的文档/图片类型，拒绝可执行脚本等。
# 不含 .svg（SVG 可携带 <script>，存在 XSS 风险）。
# doc/docm/ppt/pps/pot/xls/rtf/epub 由 anydoc 解析（ADR-0013）。
_ALLOWED_UPLOAD_EXT = frozenset({
    ".md", ".markdown", ".txt", ".pdf", ".docx", ".doc", ".docm",
    ".pptx", ".ppt", ".pps", ".pot",
    ".xlsx", ".xls", ".xlsm", ".csv", ".rtf", ".epub", ".html", ".htm",
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff",
})


def _posix_rel(full: Path, base: Path) -> str:
    """绝对路径 → 相对 base 的 POSIX 字符串。"""
    rel = full.relative_to(base.resolve())
    return "/".join(rel.parts) if rel.parts else ""


def _has_child_dirs(full: Path, base: Path) -> bool:
    """目录是否包含至少一个非受保护的子目录（向前看一层，用于树形控件的箭头显示）。

    os.scandir 读目录项自带的类型信息（零额外 stat）——pathlib 的
    iterdir().is_dir() 每条一次 stat，50 万文件大目录上一层扫描从
    ~0.2s/目录恶化到分钟级（ADR-0018 后续修复实测 81 目录 17.7s → <0.5s）。
    """
    try:
        with os.scandir(full) as it:
            for entry in it:
                try:
                    if entry.is_dir() and not is_protected(Path(entry.path), base):
                        return True
                except OSError:
                    continue
    except (PermissionError, OSError):
        return False
    return False


def _build_entry(full: Path, base: Path, indexed_children: set[str] | None = None,
                 idx: IndexManager | None = None) -> Entry:
    stat = full.stat()
    rel = _posix_rel(full, base)
    is_dir = full.is_dir()
    has_child_dirs = _has_child_dirs(full, base) if is_dir else False
    # ADR-0018：目录页传 indexed_children（单次前缀查询单，~0.3s/页）；
    # 单条目场景（rename 回包等）传 idx 逐条探测
    if indexed_children is not None:
        indexed = full.name in indexed_children
    elif idx is not None:
        indexed = idx.is_path_indexed(str(full), is_dir=is_dir)
    else:
        indexed = False
    return Entry(
        name=full.name,
        path=rel,
        is_dir=is_dir,
        size=0 if is_dir else stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        indexed=indexed,
        writable=compute_writable(full, base),
        has_child_dirs=has_child_dirs,
    )


def _indexed_documents(idx: IndexManager, base: Path) -> list[IndexedDocument]:
    """从索引库构建 IndexedDocument 列表（去重、跳过缺失文件；DB 轻量查询）。"""
    result: list[IndexedDocument] = []
    seen: set[str] = set()
    for abs_path in idx.indexed_source_paths():
        if not abs_path:
            continue
        try:
            p = Path(abs_path)
            rel_parts = p.relative_to(base.resolve()).parts
            rel = "/".join(rel_parts) if rel_parts else ""
            if rel in seen or not p.is_file():
                continue
            seen.add(rel)
            stat = p.stat()
            result.append(IndexedDocument(
                path=rel,
                name=p.name,
                size=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
            ))
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
    def _work() -> ListDirResponse:
        base = Path(idx.search_path)
        full = safe_resolve(base, path)
        assert_not_protected(full, base)
        if not full.exists():
            raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
        if not full.is_dir():
            raise CortexAPIError(400, "INVALID_PATH", f"不是目录: {path}")

        all_entries = []
        indexed_children = idx.indexed_children_of(str(full))
        for child in full.iterdir():
            if is_protected(child, base):
                continue
            all_entries.append(_build_entry(child, base, indexed_children=indexed_children))
        all_entries.sort(key=lambda e: (not e.is_dir, e.name.lower()))
        page = all_entries[offset:offset + limit]
        return ListDirResponse(path=path, entries=page, total=len(all_entries))

    # 同步重 IO（目录扫描 + stat + DB 探测）丢线程池——async handler 里直接跑
    # 会阻塞事件循环，冻结期间所有请求（子目录「目录为空」bug 根因之一）
    return await asyncio.to_thread(_work)


# --- GET /files/stats ---

@router.get("/files/stats", response_model=DirStatsResponse)
async def stats(
    path: str = Query(...),
    idx: IndexManager = Depends(get_index_manager),
) -> DirStatsResponse:
    def _work() -> DirStatsResponse:
        base = Path(idx.search_path)
        full = safe_resolve(base, path)
        assert_not_protected(full, base)
        if not full.exists():
            raise CortexAPIError(404, "FILE_NOT_FOUND", f"路径不存在: {path}")
        if not full.is_dir():
            raise CortexAPIError(400, "INVALID_PATH", f"不是目录: {path}")
        files, dirs, total = _walk_for_stats(full, base)
        return DirStatsResponse(path=path, file_count=files, dir_count=dirs, total_size_bytes=total)

    # 递归整棵子树的 walk + stat——同 to_thread 理由（见 /files/list）
    return await asyncio.to_thread(_work)


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
    stat = full.stat()
    return AttrsResponse(
        name=full.name,
        path=_posix_rel(full, base),
        is_dir=full.is_dir(),
        size=0 if full.is_dir() else stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        indexed=idx.is_path_indexed(str(full), is_dir=full.is_dir()),
        writable=compute_writable(full, base),
        created_at=datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc),
        extension=full.suffix.lower() if full.suffix else None,
        is_protected=False,
    )


# --- GET /files/documents ---

@router.get("/files/documents", response_model=IndexedDocumentsResponse)
async def list_indexed_documents(
    idx: IndexManager = Depends(get_index_manager),
) -> IndexedDocumentsResponse:
    """返回所有已索引文档的扁平列表（用于前端文件名搜索）。

    全量语义：50 万语料上 51 万次 is_file+stat，实测 ~110s。必须走线程池
    ——曾在事件循环上同步跑，期间所有请求（含 /files/list）冻结，前端
    currentDir 已切换 + treeCache 未写入 → 永久显示「目录为空」。
    """
    def _work() -> IndexedDocumentsResponse:
        base = Path(idx.search_path)
        docs = _indexed_documents(idx, base)
        docs.sort(key=lambda d: d.name.lower())
        return IndexedDocumentsResponse(documents=docs, total=len(docs))

    return await asyncio.to_thread(_work)


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
    return _build_entry(target, base, idx=idx)


# --- POST /files/upload ---

@router.post("/files/upload", response_model=UploadResponse)
async def upload(
    background_tasks: BackgroundTasks,
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
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_UPLOAD_EXT:
        raise CortexAPIError(400, "INVALID_TYPE", f"不允许的文件类型: {ext or '(无后缀)'}")

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

    # 图像超阈值（9MB）先压缩再落盘：防止落盘文件超过 VisionWorker 的 10MB
    # base64 上限而 permanent failed（上传即死路）。失败降级写原图。
    data, recompressed = compress_image_bytes(data, ext)

    try:
        target.write_bytes(data)
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"写入失败: {e}") from e

    # 图像后台判向自动转正（ADR-0017）：开关/密钥/格式不满足时静默跳过
    schedule_auto_rotate(
        background_tasks, target, _posix_rel(target, base), idx.index_path, get_config()
    )

    return UploadResponse(
        path=_posix_rel(target, base),
        bytes_written=len(data),
        overwritten=overwritten,
        recompressed=recompressed,
        reindex_triggered=_trigger_reindex(idx),
    )
