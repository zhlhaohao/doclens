"""GET /api/vision/prompt + POST /api/vision/reparse —— 图像视觉重新解析。

reparse 用用户自定义提示词同步调视觉模型（asyncio.to_thread 包阻塞调用），
原位复用 VisionWorker._call_vision_api / _replace_placeholder 替换占位/旧解读，
不经过 vision_queue（自定义提示词是一次性用户动作，不入队）。
"""
import asyncio
import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends

from doclens.index_manager import IndexManager
from doclens.vision_worker import (
    VISION_PROMPT,
    VisionWorker,
    _strip_code_fence,
)
from doclens.web_v2 import deps
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api.preview import _safe_resolve
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.vision import (
    NoteRequest,
    PromptResponse,
    ReparseRequest,
    ReparseResponse,
)
from treesearch.parsers.image_metadata import INTERPRETED_IMAGE_EXTS

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/vision/prompt", response_model=PromptResponse)
async def get_vision_prompt() -> PromptResponse:
    """返回默认 VISION_PROMPT，供前端对话框预填（单一真相源）。"""
    return PromptResponse(prompt=VISION_PROMPT)


@router.post("/vision/reparse", response_model=ReparseResponse)
async def reparse_image(
    req: ReparseRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> ReparseResponse:
    """用自定义提示词重新解析一张图像，原位替换占位/旧解读。"""
    config = deps.get_config()

    # 1. 视觉模型 API Key 已配
    if not getattr(config, "vision_api_key", None):
        raise CortexAPIError(400, "VISION_NOT_CONFIGURED", "未配置视觉模型 API Key")
    # 2. 提示词非空
    if not req.prompt or not req.prompt.strip():
        raise CortexAPIError(400, "EMPTY_PROMPT", "提示词不能为空")
    # 3. 越权 + 存在性 + 扩展名（仅 jpg/jpeg/png/webp 可解读）
    base = Path(idx.search_path)
    full = _safe_resolve(base, req.path)
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {req.path}")
    if full.suffix.lower() not in INTERPRETED_IMAGE_EXTS:
        raise CortexAPIError(
            400, "NOT_IMAGE",
            f"仅支持图像文件（jpg/jpeg/png/webp）: {req.path}",
        )
    abs_path = str(full)

    # 4. 并发护栏：后台 worker 正在处理同一张图 → 409（防并发写 FTS）
    _check_not_processing(idx, abs_path)

    # 5. 阻塞调用丢线程池（视觉 API 5-60s，不能卡住事件循环）
    try:
        markdown = await asyncio.to_thread(
            _run_reparse_blocking, idx, abs_path, config, req.prompt
        )
    except CortexAPIError:
        raise
    except Exception as e:
        logger.exception("vision reparse failed: %s", abs_path)
        raise CortexAPIError(500, "PARSE_FAILED", f"视觉解析失败: {e}") from e

    return ReparseResponse(path=req.path, markdown=markdown)


def _check_not_processing(idx: IndexManager, abs_path: str) -> None:
    """后台 VisionWorker 正在处理同一张图时拒绝（409），避免并发写 FTS。"""
    from treesearch.fts import FTS5Index

    fts = FTS5Index(db_path=idx.index_path)
    try:
        row = fts._conn.execute(
            "SELECT status FROM vision_queue WHERE source_path = ?",
            (abs_path,),
        ).fetchone()
    finally:
        fts.close()
    if row and row[0] == "processing":
        raise CortexAPIError(
            409, "VISION_BUSY",
            "该图像正在后台解析中，请稍后重试",
        )


def _run_reparse_blocking(
    idx: IndexManager, abs_path: str, config, prompt: str
) -> str:
    """在线程中执行：调视觉模型 → 剥围栏 → 原位替换 → mark_index_dirty。

    复用 VisionWorker 的 _call_vision_api / _replace_placeholder（不依赖实例
    运行状态）；单例不存在时建临时实例（仅用方法，不启动消费线程）。
    """
    from treesearch.fts import FTS5Index

    worker = deps.get_vision_worker()
    if worker is None:
        worker = VisionWorker(idx, deps.get_config)  # 不调 start()，仅复用方法

    md = worker._call_vision_api(abs_path, config, prompt=prompt)
    md = _strip_code_fence(md)
    if not md:
        raise CortexAPIError(500, "PARSE_FAILED", "视觉模型返回空内容")

    fts = FTS5Index(db_path=idx.index_path)
    try:
        worker._replace_placeholder(fts, abs_path, md, config)
    finally:
        fts.close()

    # 与 _process_one 一致：通知内存 documents 已过期，下次搜索重新加载
    idx.mark_index_dirty()
    return md


@router.post("/vision/note", response_model=ReparseResponse)
async def set_manual_note(
    req: NoteRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> ReparseResponse:
    """手动输入备注 markdown，直接覆盖 AI 解读（不调视觉模型，持久保留）。"""
    config = deps.get_config()
    if not req.markdown or not req.markdown.strip():
        raise CortexAPIError(400, "EMPTY_NOTE", "备注不能为空")
    base = Path(idx.search_path)
    full = _safe_resolve(base, req.path)
    if not full.exists() or not full.is_file():
        raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {req.path}")
    if full.suffix.lower() not in INTERPRETED_IMAGE_EXTS:
        raise CortexAPIError(
            400, "NOT_IMAGE",
            f"仅支持图像文件（jpg/jpeg/png/webp）: {req.path}",
        )
    abs_path = str(full)
    try:
        markdown = await asyncio.to_thread(
            _run_note_blocking, idx, abs_path, config, req.markdown
        )
    except CortexAPIError:
        raise
    except Exception as e:
        logger.exception("vision manual note failed: %s", abs_path)
        raise CortexAPIError(500, "NOTE_FAILED", f"保存备注失败: {e}") from e
    return ReparseResponse(path=req.path, markdown=markdown)


def _run_note_blocking(
    idx: IndexManager, abs_path: str, config, markdown: str
) -> str:
    """手动备注：直接用用户 markdown 替换解读（不调 AI），并标记 vision_queue
    model='manual' 使其持久（read_back 不校验过期、requeue 排除 manual）。

    用户原文原样写入，不剥代码围栏（区别于 AI 输出的 _strip_code_fence）。
    """
    from treesearch.fts import FTS5Index

    worker = deps.get_vision_worker()
    if worker is None:
        worker = VisionWorker(idx, deps.get_config)

    fts = FTS5Index(db_path=idx.index_path)
    try:
        worker._replace_placeholder(
            fts, abs_path, markdown, config,
            model_tag="manual", prompt_version="manual",
        )
        # 标记该图视觉队列为手动备注：worker 启动 requeue 排除 manual，不被重解析覆盖
        fts._conn.execute(
            "UPDATE vision_queue SET model='manual', status='done', "
            "attempts=0, last_error='', updated_at=? WHERE source_path=?",
            (time.time(), abs_path),
        )
        fts.commit()
    finally:
        fts.close()

    idx.mark_index_dirty()
    return markdown
