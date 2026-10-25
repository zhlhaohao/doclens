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

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, Response, Query, UploadFile

from doclens.index_manager import IndexManager
from doclens.web_v2.api._auto_rotate import schedule_auto_rotate
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api.image_compress import compress_image_bytes
from doclens.web_v2.deps import get_config, get_index_manager
from doclens.web_v2.models.files import (
    AttrsResponse,
    CreateFileRequest,
    CreateFileResponse,
    DirStatsResponse,
    Entry,
    IndexedDocument,
    IndexedDocumentsResponse,
    FilenameSearchHit,
    FilenameSearchResponse,
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
    ".log",
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
                 ghost_children: set[str] | None = None,
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
    # 三态徽标第二态（ADR-0034）：仅登记（ghost 行）——已索引优先，未索引时才判
    if not indexed:
        if ghost_children is not None:
            registered = full.name in ghost_children
        elif idx is not None and not is_dir:
            registered = idx.is_path_registered(str(full))
        else:
            registered = False
    else:
        registered = False
    return Entry(
        name=full.name,
        path=rel,
        is_dir=is_dir,
        size=0 if is_dir else stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        indexed=indexed,
        registered=registered,
        writable=compute_writable(full, base),
        has_child_dirs=has_child_dirs,
    )


def _indexed_documents(idx: IndexManager, base: Path) -> list[IndexedDocument]:
    """从索引库构建 IndexedDocument 列表（去重、跳过缺失文件）。

    ghost 行（仅登记，ADR-0034）包含在内并打 ghost=True 标——文件名搜索
    可见，前端据此降级展示（不提供「索引内」语义的交互）。

    性能（2026-10-25，285k 文档语料实测）：
    - 旧实现（indexed_source_paths + 逐条 is_file/stat）在 50 万级语料上
      ~110s——/files/documents 是下拉刷新路径，指示器全程转圈。
    - 现实现：① 单条 SQL 直接取 name/source_path（免 index_probe 中转与
      Python 侧去重排序往返）；② 存在性 + size/mtime 用 scandir 按父目录
      批量取（Windows 枚举即带 stat 信息；285k 文件/39 目录实测 1.4s，
      对比逐条 stat 17.7s）。总体 <5s。
    """
    import sqlite3
    from collections import defaultdict

    # ghost 谓词下推：node_count=0 即 ghost 行，不再单独跑 ghost_source_paths()
    try:
        conn = sqlite3.connect(idx.index_path)
        try:
            rows = conn.execute(
                "SELECT doc_name, source_path, node_count FROM documents"
            ).fetchall()
        finally:
            conn.close()
    except Exception:  # noqa: BLE001
        return []

    base_resolved = base.resolve()
    # 按父目录分组，scandir 一遍拿齐 exists/size/mtime（批量，免逐条 stat）
    by_dir: dict[str, set[str]] = defaultdict(set)
    name_of: dict[str, str] = {}
    ghost_of: dict[str, bool] = {}
    for doc_name, abs_path, node_count in rows:
        if not abs_path:
            continue
        try:
            rel_parts = Path(abs_path).relative_to(base_resolved).parts
        except ValueError:
            continue
        rel = "/".join(rel_parts)
        if rel in name_of:
            continue  # 去重（同 rel path 只留一条）
        name_of[rel] = doc_name or Path(abs_path).name
        ghost_of[rel] = node_count == 0
        head, _, tail = rel.rpartition("/")
        by_dir[head].add(tail)

    result: list[IndexedDocument] = []
    for head, names in by_dir.items():
        dir_abs = base_resolved.joinpath(head) if head else base_resolved
        try:
            with os.scandir(dir_abs) as it:
                for entry in it:
                    if entry.name not in names:
                        continue
                    rel = f"{head}/{entry.name}" if head else entry.name
                    if not entry.is_file():
                        continue
                    try:
                        st = entry.stat()
                    except OSError:
                        continue
                    result.append(IndexedDocument(
                        path=rel,
                        name=name_of[rel],
                        size=st.st_size,
                        modified_at=datetime.fromtimestamp(st.st_mtime, tz=timezone.utc),
                        ghost=ghost_of[rel],
                    ))
        except OSError:
            continue  # 目录被移走/不可访问：该组全部视为缺失，跳过
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

        # 两段式：scandir 的名字+类型信息先排序分页，只对当页条目做重探测
        # （stat / 索引判定 / 可写性 / has_child_dirs）。此前对全目录每个
        # 条目都跑 _build_entry（含 stat + resolve + 2×os.access）再丢弃
        # 非当页的——16,898 文件的目录实测 ~3.7s，其中 99% 花在 200 条以外。
        names: list[tuple[str, bool]] = []  # (name, is_dir)
        with os.scandir(full) as it:
            for child in it:
                try:
                    is_dir = child.is_dir()
                except OSError:
                    continue
                # 点开头组件受保护——父链已由 assert_not_protected 保证，
                # 这里只过滤本层隐藏项（与旧 is_protected(child) 语义等价）
                if child.name.startswith("."):
                    continue
                names.append((child.name, is_dir))
        names.sort(key=lambda t: (not t[1], t[0].lower()))
        total = len(names)
        page_names = names[offset:offset + limit]
        # 索引/ghost 徽标也只探测当页：点查版 probe_*（μs/条）。原
        # indexed_children_of 的 DISTINCT 全扫成本 ∝ 子树总行数——工作
        # 目录根页匹配整库（28.5 万行 ~1s+），点查版只花 len(page) 次索引
        # 下潜（实测 81 子项 2ms、200 子项 ~10ms）。
        page_paths = [str(full / n) for n, _ in page_names]
        hit_paths = idx.probe_indexed_paths(page_paths)
        ghost_paths = idx.probe_ghost_paths(
            [p for p in page_paths if p not in hit_paths])
        indexed_children = {Path(p).name for p in hit_paths}
        ghost_children = {Path(p).name for p in ghost_paths}
        page_entries = [
            _build_entry(
                full / name, base,
                indexed_children=indexed_children, ghost_children=ghost_children,
            )
            for name, _ in page_names
        ]
        return ListDirResponse(path=path, entries=page_entries, total=total)

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
        registered=(
            False if full.is_dir()
            else idx.is_path_registered(str(full))
        ),
        writable=compute_writable(full, base),
        created_at=datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc),
        extension=full.suffix.lower() if full.suffix else None,
        is_protected=False,
    )


# --- GET /files/documents ---

@router.get("/files/documents", response_model=IndexedDocumentsResponse)
async def list_indexed_documents(
    response: Response,
    idx: IndexManager = Depends(get_index_manager),
    if_none_match: str | None = Header(default=None, alias="If-None-Match"),
) -> Response:
    """返回所有已索引文档的扁平列表（用于前端文件名搜索）。

    全量语义。2026-10-25 优化后 285k 文档语料实测 <5s（见 _indexed_documents），
    但大库仍非瞬时——必须走线程池：曾在事件循环上同步跑，期间所有请求
    （含 /files/list）冻结，前端 currentDir 已切换 + treeCache 未写入
    → 永久显示「目录为空」。

    ETag/304（同日追加）：大库上即使 <5s 的重建 + 20MB 级 JSON 序列化/传输
    也是下拉刷新的主要等待。ETag = 库内容指纹（doc 行数 + 行内容聚合散列 +
    文件 stat 指纹），客户端带 If-None-Match 命中时直接 304——内容未变的
    重复刷新近乎零成本。弱验证器（W/）语义：资源「语义等价」即可，mtime
    变化但内容同构时允许命中。
    """
    import hashlib

    def _etag():
        """内容指纹：documents 行 + 文件 stat 敏感（改动任一即失效）。

        构建走 _indexed_documents 同一条 scandir 路径（顺路产出清单，
        不额外扫盘）——即 ETag 计算与清单构建合一：304 判定发生在
        构建之后，因此 304 省的是序列化/传输（大库的主要成本，实测
        285k 库序列化+传输 ~18s）而非扫描（~2s）。要再省扫描需库侧
        增量版本号，未做。
        """
        base = Path(idx.search_path)
        docs = _indexed_documents(idx, base)
        docs.sort(key=lambda d: d.name.lower())
        h = hashlib.sha256()
        h.update(str(len(docs)).encode())
        for d in docs:
            h.update(f"{d.path}|{d.size}|{d.modified_at.timestamp()}|{d.ghost}".encode())
        return f'W/"{h.hexdigest()[:32]}"', docs

    def _work():
        etag, docs = _etag()
        return etag, IndexedDocumentsResponse(documents=docs, total=len(docs))

    etag, payload = await asyncio.to_thread(_work)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-cache"  # 304 协商缓存，不落磁盘缓存
    if if_none_match and if_none_match == etag:
        # 直接返回 Response：FastAPI 对显式 Response 跳过 response_model 序列化
        return Response(status_code=304)
    return payload


# --- GET /files/search（文件名搜索服务端化，2026-10-25）---

@router.get("/files/search", response_model=FilenameSearchResponse)
async def search_filenames(
    q: str = Query(..., min_length=1, description="文件名子串（大小写不敏感）"),
    limit: int = Query(100, ge=1, le=500),
    idx: IndexManager = Depends(get_index_manager),
) -> FilenameSearchResponse:
    """按文件名子串搜索已索引文档（files 页搜索框的服务端实现）。

    背景：旧方案前端拉全量清单（/files/documents，285k 库 79MB/16s+）在
    浏览器本地 filter——把「一个搜索框」的成本抬到了整库传输。此端点把
    过滤下推到 SQL：lower(doc_name) LIKE '%q%'（子串无法走 B-tree 索引，
    全表扫 285k 行实测 ~0.5s），只回 top N 命中（几 KB）。

    与旧前端行为对齐：name 大小写不敏感 contains；ghost 行包含并打标。
    排序用 doc_name 的 COLLATE NOCASE（旧前端是 localeCompare zh，
    服务端无 locale 时退化为码点序，展示差异可接受）。
    size/modified_at 仅对 top N 命中补（scandir 单目录批量 stat，百条
    级成本可忽略）——结果行「大小 · 修改」列需要。
    """
    import sqlite3

    pattern = f"%{q.lower()}%"

    def _work() -> FilenameSearchResponse:
        base = Path(idx.search_path)
        base_resolved = base.resolve()
        conn = sqlite3.connect(idx.index_path)
        try:
            rows = conn.execute(
                """SELECT doc_name, source_path, node_count FROM documents
                   WHERE lower(doc_name) LIKE ?
                   ORDER BY doc_name COLLATE NOCASE
                   LIMIT ?""",
                (pattern, limit),
            ).fetchall()
            total = conn.execute(
                "SELECT count(*) FROM documents WHERE lower(doc_name) LIKE ?",
                (pattern,),
            ).fetchone()[0]
        finally:
            conn.close()
        hits: list[FilenameSearchHit] = []
        for doc_name, abs_path, node_count in rows:
            if not abs_path:
                continue
            try:
                rel = "/".join(Path(abs_path).relative_to(base_resolved).parts)
            except ValueError:
                continue
            size, mtime = 0, None
            try:
                st = os.stat(abs_path)
                size, mtime = st.st_size, datetime.fromtimestamp(st.st_mtime, tz=timezone.utc)
            except OSError:
                pass  # 缺失文件仍列出（path 可定位），仅缺 size/mtime
            hits.append(FilenameSearchHit(
                path=rel,
                name=doc_name or Path(abs_path).name,
                size=size,
                modified_at=mtime,
                ghost=node_count == 0,
            ))
        return FilenameSearchResponse(results=hits, total=total)

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


# --- POST /files/create ---

@router.post("/files/create", response_model=CreateFileResponse)
async def create_file(
    req: CreateFileRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> CreateFileResponse:
    """在当前目录新建空文本文件（如 笔记.md）。校验与 mkdir 同口径。"""
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
        target.touch()
    except OSError as e:
        raise CortexAPIError(500, "WRITE_FAILED", f"创建失败: {e}") from e
    return CreateFileResponse(
        path=_posix_rel(target, base),
        reindex_triggered=_trigger_reindex(idx),
    )


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
