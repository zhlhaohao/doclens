"""POST/GET/DELETE /api/translate — PDF 翻译任务（ADR-0039）。

- POST /api/translate：提交翻译任务（串行队列），返回 job 概要；
- GET /api/translate/{job_id}：任务状态轮询（SSE 不可用时的降级面）；
- DELETE /api/translate/{job_id}：取消（排队中直接移除；运行中置取消事件）；
- GET /api/translate/{job_id}/events：SSE 逐页进度流（running/progress/done/
  error/cancelled 事件，任务终态后流自动关闭）。
"""
import asyncio
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from doclens.translate_service import (
    TranslationQueueFull,
    get_translation_service,
)
from doclens.web_v2.api.errors import CortexAPIError
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger(__name__)
router = APIRouter()


class TranslateRequest(BaseModel):
    """提交翻译任务请求体。"""

    path: str = Field(..., min_length=1, description="知识库内 PDF 相对路径")
    lang_in: str = Field(default="en", max_length=16, description="源语言")
    lang_out: str = Field(default="zh", max_length=16, description="目标语言")
    outputs: str = Field(
        default="both",
        pattern="^(mono|dual|both)$",
        description="产物形态：mono 纯译文 / dual 逐页对照 / both 双产出",
    )
    pages: str | None = Field(
        default=None,
        max_length=200,
        description="页码区间（1-based，如 '1-3,5'；空=全文）",
    )
    ultrafast: bool = Field(default=False, description="极速模式（原生文本 PDF，跳过布局模型）")
    ignore_cache: bool = Field(default=False, description="绕过翻译缓存（读与写都跳过）")


class TranslateJobView(BaseModel):
    """任务概要（提交响应与轮询共用）。"""

    job_id: str
    status: str
    progress_done: int = 0
    progress_total: int = 0
    error: str | None = None
    result_paths: list[str] = []
    created_at: float
    finished_at: float | None = None


def _view(job) -> TranslateJobView:
    return TranslateJobView(
        job_id=job.job_id,
        status=job.status,
        progress_done=job.progress_done,
        progress_total=job.progress_total,
        error=job.error,
        result_paths=job.result_paths,
        created_at=job.created_at,
        finished_at=job.finished_at,
    )


def _parse_pages(spec: str | None) -> list[int] | None:
    """'1-3,5' → [0,1,2,4]（0-based）；None/空 → None（全文）。"""
    if not spec or not spec.strip():
        return None
    result: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, _, hi = part.partition("-")
            try:
                lo_i, hi_i = int(lo), int(hi)
            except ValueError:
                raise CortexAPIError(400, "BAD_PAGES", f"无效页码区间: {part}")
            if lo_i < 1 or hi_i < lo_i:
                raise CortexAPIError(400, "BAD_PAGES", f"无效页码区间: {part}")
            result.extend(range(lo_i - 1, hi_i))
        else:
            try:
                n = int(part)
            except ValueError:
                raise CortexAPIError(400, "BAD_PAGES", f"无效页码: {part}")
            if n < 1:
                raise CortexAPIError(400, "BAD_PAGES", f"无效页码: {part}")
            result.append(n - 1)
    return result or None


@router.post("/translate", response_model=TranslateJobView)
async def submit_translation(req: TranslateRequest):
    svc = get_translation_service()
    try:
        job = svc.submit(
            source_path=req.path,
            lang_in=req.lang_in,
            lang_out=req.lang_out,
            outputs=req.outputs,
            pages=_parse_pages(req.pages),
            ultrafast=req.ultrafast,
            ignore_cache=req.ignore_cache,
        )
    except FileNotFoundError as e:
        raise CortexAPIError(404, "FILE_NOT_FOUND", str(e))
    except TranslationQueueFull as e:
        raise CortexAPIError(409, "QUEUE_FULL", str(e))
    except ValueError as e:
        raise CortexAPIError(400, "BAD_REQUEST", str(e))
    return _view(job)


@router.get("/translate/{job_id}", response_model=TranslateJobView)
async def get_translation(job_id: str):
    job = get_translation_service().get(job_id)
    if job is None:
        raise CortexAPIError(404, "JOB_NOT_FOUND", f"任务不存在或已过期: {job_id}")
    return _view(job)


@router.delete("/translate/{job_id}", response_model=TranslateJobView)
async def cancel_translation(job_id: str):
    svc = get_translation_service()
    job = svc.get(job_id)
    if job is None:
        raise CortexAPIError(404, "JOB_NOT_FOUND", f"任务不存在或已过期: {job_id}")
    svc.cancel(job_id)
    return _view(job)


@router.get("/translate/{job_id}/events")
async def translation_events(job_id: str):
    """SSE 进度流：立即推一次当前状态快照，此后逐事件推送至终态。"""
    import json

    svc = get_translation_service()
    job = svc.get(job_id)
    if job is None:
        raise CortexAPIError(404, "JOB_NOT_FOUND", f"任务不存在或已过期: {job_id}")

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def on_event(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    svc.subscribe(job_id, on_event)

    async def event_stream():
        # 先推快照（订阅前的状态变化补发）
        yield {
            "event": "status",
            "data": json.dumps(
                {
                    "type": job.status,
                    "done": job.progress_done,
                    "total": job.progress_total,
                    "error": job.error,
                    "paths": job.result_paths,
                },
                ensure_ascii=False,
            ),
        }
        terminal = {"done", "error", "cancelled"}
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}
                continue
            yield {
                "event": event.get("type", "progress"),
                "data": json.dumps(event, ensure_ascii=False),
            }
            if event.get("type") in terminal:
                break

    return EventSourceResponse(event_stream())

