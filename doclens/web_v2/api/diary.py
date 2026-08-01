"""GET/POST/DELETE /api/diary/* — 日记录入与回顾（ADR-0007）。

录入永远只写「今天」（服务器本地日期）；已总结的日子不可变。
写文件走 doclens.diary 领域模块，成功后触发后台重建索引。
"""
import logging
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from doclens import diary
from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.diary import (
    AddTextRequest,
    CalendarResponse,
    DayEntryResponse,
    DeleteFragmentResponse,
    FragmentModel,
    FragmentResponse,
    TodayResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_MAX_PHOTO_BYTES = 30 * 1024 * 1024  # 30 MB（压缩前的手机原图上限）

_MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\((images/[^)]+)\)")


def _image_url(rel: str) -> str:
    """md 内相对路径 images/<date>/<file> → 可直接渲染的图片 URL。"""
    kb_path = f"{diary.DIARY_DIRNAME}/{rel}"
    return f"/api/preview/raw?path={quote(kb_path)}"


def _to_fragment_model(f: diary.Fragment) -> FragmentModel:
    return FragmentModel(
        fid=f.fid,
        time=f.time,
        kind=f.kind,
        text=f.text,
        image_url=_image_url(f.image) if f.image else None,
    )


def _to_entry_response(entry: diary.DayEntry) -> DayEntryResponse:
    content = entry.content
    if entry.state == "summarized":
        # 成品 md 中的图片相对路径重写为可渲染 URL
        content = _MD_IMAGE_RE.sub(
            lambda m: f"![{m.group(1)}]({_image_url(m.group(2))})", content
        )
    return DayEntryResponse(
        date=entry.date,
        state=entry.state,
        fragments=[_to_fragment_model(f) for f in entry.fragments],
        content=content,
    )


def _workdir(idx: IndexManager) -> Path:
    return Path(idx.search_path)


def _trigger_reindex(idx: IndexManager) -> None:
    try:
        idx.trigger_background_reindex()
    except Exception as e:  # noqa: BLE001
        logger.warning("reindex failed: %s", e)


def _now() -> datetime:
    return datetime.now()


def _bad_request(e: ValueError) -> CortexAPIError:
    return CortexAPIError(400, "INVALID_INPUT", str(e))


# --- GET /diary/today ---

@router.get("/diary/today", response_model=TodayResponse)
async def get_today(idx: IndexManager = Depends(get_index_manager)) -> TodayResponse:
    today = _now().date().isoformat()
    return TodayResponse(today=today, entry=_to_entry_response(diary.get_day(_workdir(idx), today)))


# --- GET /diary/entry?date= ---

@router.get("/diary/entry", response_model=DayEntryResponse)
async def get_entry(
    date: str = Query(..., description="YYYY-MM-DD"),
    idx: IndexManager = Depends(get_index_manager),
) -> DayEntryResponse:
    try:
        return _to_entry_response(diary.get_day(_workdir(idx), date))
    except ValueError as e:
        raise _bad_request(e) from e


# --- GET /diary/calendar?month= ---

@router.get("/diary/calendar", response_model=CalendarResponse)
async def get_calendar(
    month: str = Query(..., description="YYYY-MM"),
    idx: IndexManager = Depends(get_index_manager),
) -> CalendarResponse:
    try:
        return CalendarResponse(month=month, dates=diary.list_month_dates(_workdir(idx), month))
    except ValueError as e:
        raise _bad_request(e) from e


# --- POST /diary/fragments ---

@router.post("/diary/fragments", response_model=FragmentResponse)
async def add_text_fragment(
    req: AddTextRequest,
    idx: IndexManager = Depends(get_index_manager),
) -> FragmentResponse:
    now = _now()
    try:
        frag = diary.append_text(
            _workdir(idx), now.date().isoformat(), now.strftime("%H:%M"), now.strftime("%H%M%S"), req.text
        )
    except ValueError as e:
        raise _bad_request(e) from e
    _trigger_reindex(idx)
    return FragmentResponse(fragment=_to_fragment_model(frag))


# --- POST /diary/photos ---

@router.post("/diary/photos", response_model=FragmentResponse)
async def add_photo_fragment(
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    idx: IndexManager = Depends(get_index_manager),
) -> FragmentResponse:
    data = await file.read(_MAX_PHOTO_BYTES + 1)
    if len(data) > _MAX_PHOTO_BYTES:
        raise CortexAPIError(413, "CONTENT_TOO_LARGE", f"超过 {_MAX_PHOTO_BYTES // 1024 // 1024}MB 上限")
    now = _now()
    date_str = now.date().isoformat()
    try:
        rel = diary.save_photo(_workdir(idx), date_str, now.strftime("%H%M%S"), data)
    except Exception as e:  # noqa: BLE001 — PIL 解码失败等统一按非法图片处理
        raise CortexAPIError(400, "INVALID_IMAGE", f"图片无法解析: {e}") from e
    try:
        frag = diary.append_photo(
            _workdir(idx), date_str, now.strftime("%H:%M"), now.strftime("%H%M%S"), rel, caption
        )
    except ValueError as e:
        raise _bad_request(e) from e
    _trigger_reindex(idx)
    return FragmentResponse(fragment=_to_fragment_model(frag))


# --- DELETE /diary/fragments/{fid}?date= ---

@router.delete("/diary/fragments/{fid}", response_model=DeleteFragmentResponse)
async def delete_fragment(
    fid: str,
    date: str = Query(..., description="片段所属日期 YYYY-MM-DD"),
    idx: IndexManager = Depends(get_index_manager),
) -> DeleteFragmentResponse:
    try:
        deleted = diary.remove_fragment(_workdir(idx), date, fid)
    except ValueError as e:
        raise _bad_request(e) from e
    if not deleted:
        raise CortexAPIError(404, "FRAGMENT_NOT_FOUND", f"片段不存在: {fid}")
    _trigger_reindex(idx)
    return DeleteFragmentResponse(deleted=True)
