"""日记合成 Worker —— 常驻后台，把「片段态」的过去日小节确定性合成为成品（ADR-0007）。

触发模型：每日 00:05 定点合成前一天（避开零点整）；启动时补扫一次——
进程在 00:05 未运行而错过的合成立即补上。状态即队列——
年度 md 中小节头部的 <!-- diary:raw --> 标记就是待合成信号，
无需额外数据库表；进程崩溃重启后重扫文件即可恢复。

单日消息处理（无对话模型参与，合成结果完全确定）：
1. 重读文件确认仍为片段态（防双设备/重入重复合成，见 ADR-0008 Consequences）；
2. 图片片段逐张调视觉模型描述（复用 VISION_* 配置）；
   单张失败/未配置 → 仅该图退化为用备注（逐图降级，不阻塞整日）；
3. compose_day_body 把片段按时间逐条拼接为时间线（- HH:MM 内容，
   照片行附视觉描述），信息零丢失、无改写；
4. diary.rewrite_day 整体替换小节并移除 raw 标记 → 触发重建索引。

失败策略：整日保留片段态，指数退避重试（上限 6 小时；唤醒点取
「下一个 00:05」与「最近重试时间」的较早者），
绝不覆盖原文、不标 failed（原文必须保留到合成成功）。
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import date as date_type
from datetime import datetime as datetime_type
from datetime import timedelta
from pathlib import Path

from doclens import diary
from doclens.vision_client import call_vision, encode_image

logger = logging.getLogger(__name__)

# 每日定点合成时刻：00:05（零点过 5 分钟）
_DAILY_RUN_HOUR = 0
_DAILY_RUN_MINUTE = 5


def seconds_until_next_run(now: datetime_type) -> float:
    """距下一个 00:05 的秒数。00:05 整点也算「已过」，排到下一天。"""
    target = now.replace(
        hour=_DAILY_RUN_HOUR, minute=_DAILY_RUN_MINUTE, second=0, microsecond=0
    )
    if now >= target:
        target += timedelta(days=1)
    return (target - now).total_seconds()

# 整日合成失败的重试退避：5min 起步指数增长，上限 6h
_RETRY_BASE_S = 300.0
_RETRY_MAX_S = 6 * 3600.0

# 图片描述 prompt（供日记归纳用，与 vision_worker 的文档转写 prompt 不同）
_PHOTO_PROMPT = (
    "请用一两句话描述这张照片的内容（场景、人物、动作、氛围），"
    "供整理日记时引用。只输出描述本身，不要标题、不要解释。"
)

# 照片备注 prompt（上传时自动生成 caption，比合成用的描述更精简；供上传端点用）
CAPTION_PROMPT = (
    "请根据图片类型生成简短备注：\n"
    "如果是文字/截图/文档/资料类图片，只输出一个简短的标题"
    "（如「补钾资料」「日记功能设计稿」），不要描述内容；\n"
    "如果是风景/人物/食物/生活类图片，用不超过20个字概括"
    "（如「珠海晚霞」「麦当劳吃早餐」）。\n"
    "只输出备注文字本身，不要解释、不要引号。"
)


def describe_photo(path: Path, config, *, prompt: str = _PHOTO_PROMPT) -> str:
    """调视觉模型描述一张照片（协议分流见 doclens.vision_client）。

    prompt 参数：默认用 _PHOTO_PROMPT（详细描述，供合成引用）；
    上传自动备注时传 CAPTION_PROMPT（简短标题/≤20字）。
    """
    b64, media = encode_image(path)
    return call_vision(b64, media, prompt, config)


def compose_day_body(fragments: list[diary.Fragment], photo_descriptions: dict[str, str]) -> str:
    """确定性拼接片段为逐条时间线（无对话模型参与，输出完全确定）。

    每个片段一行「- HH:MM 内容」。照片行：用户备注优先（只写备注，不插
    AI 视觉描述）；无备注时才附 AI 描述。不聚类、不改写，信息零丢失。
    """
    lines = []
    for f in fragments:
        if f.kind == "photo":
            caption = "" if f.text == "照片" else f.text
            ref = f"![{caption or '照片'}]({f.image})"
            if caption:
                # 用户手动备注为主：不再追加 AI 视觉解读，避免成文里重复/冲突
                lines.append(f"- {f.time} {ref}")
            else:
                desc = photo_descriptions.get(f.fid, "")
                lines.append(f"- {f.time} {ref}" + (f" {desc}" if desc else ""))
        else:
            lines.append(f"- {f.time} {f.text}")
    return "\n".join(lines)


class DiaryWorker:
    """常驻日记合成消费者（串行，一次一天）。"""

    def __init__(self, idx_manager, get_config):
        self._idx = idx_manager
        self._get_config = get_config
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        # 每个失败日的 (attempts, 下次可重试时间)
        self._retry_after: dict[str, tuple[int, float]] = {}
        # 可观测状态（_state_lock 保护：worker 线程写，其他线程读）
        self._state_lock = threading.Lock()
        self._running = False
        self._current_date: str | None = None
        self._summarized_count = 0
        self._last_error = ""

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """启动后台线程（幂等）。启动即补扫一次，之后每日 00:05 定点合成。"""
        if self._thread is not None:
            return True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="diary-worker", daemon=True)
        self._thread.start()
        with self._state_lock:
            self._running = True
        logger.info(
            "DiaryWorker started (daily at %02d:%02d)", _DAILY_RUN_HOUR, _DAILY_RUN_MINUTE
        )
        return True

    def stop(self) -> None:
        """停止后台线程（最多等 5s）。"""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        with self._state_lock:
            self._running = False
            self._current_date = None

    def status(self) -> dict:
        """状态快照（线程安全）。"""
        with self._state_lock:
            return {
                "running": self._running,
                "current_date": self._current_date,
                "summarized_count": self._summarized_count,
                "last_error": self._last_error,
            }

    # ------------------------------------------------------------------
    # 主循环
    # ------------------------------------------------------------------

    def _workdir(self) -> Path:
        return Path(self._idx.search_path)

    def _run(self) -> None:
        # 启动即补扫一次：进程在 00:05 未运行而错过的合成立即补上
        self._scan_safely()
        while not self._stop_event.is_set():
            if self._stop_event.wait(self._next_wakeup_s()):
                break
            self._scan_safely()

    def _scan_safely(self) -> None:
        try:
            self._scan_once()
        except Exception as e:  # 兜底：任何意外都不让 worker 线程死掉
            logger.exception("DiaryWorker loop error: %s", e)

    def _next_wakeup_s(self) -> float:
        """距下次扫描的秒数：下一个 00:05；有退避中的失败日则取两者较早。"""
        wait = seconds_until_next_run(datetime_type.now())
        if self._retry_after:
            earliest = min(deadline for _, deadline in self._retry_after.values())
            wait = min(wait, max(0.0, earliest - time.monotonic()))
        return wait

    def _scan_once(self) -> None:
        config = self._get_config()
        today = date_type.today()
        pending = diary.find_pending_raw(self._workdir(), today)
        now = time.monotonic()
        for date_str in pending:
            if self._stop_event.is_set():
                return
            # 退避中的日跳过
            retry = self._retry_after.get(date_str)
            if retry and now < retry[1]:
                continue
            with self._state_lock:
                self._current_date = date_str
            try:
                self._summarize_day(date_str, config)
                self._retry_after.pop(date_str, None)
            except Exception as e:  # noqa: BLE001
                attempts = (retry[0] if retry else 0) + 1
                backoff = min(_RETRY_MAX_S, _RETRY_BASE_S * (2 ** (attempts - 1)))
                self._retry_after[date_str] = (attempts, time.monotonic() + backoff)
                with self._state_lock:
                    self._last_error = f"{date_str}: {e}"
                logger.warning(
                    "Diary summarize failed (attempt %d, retry in %.0fs): %s: %s",
                    attempts, backoff, date_str, e,
                )
            finally:
                with self._state_lock:
                    self._current_date = None

    # ------------------------------------------------------------------
    # 单日合成
    # ------------------------------------------------------------------

    def _summarize_day(self, date_str: str, config) -> None:
        workdir = self._workdir()
        entry = diary.get_day(workdir, date_str)
        if entry.state != "raw":
            return  # 已被（另一进程/设备）合成，或小节消失

        # 1. 逐图视觉描述（逐图降级：失败仅该图退化为备注）
        descriptions: dict[str, str] = {}
        if config.vision_api_key:
            for f in entry.fragments:
                if f.kind != "photo" or not f.image or self._stop_event.is_set():
                    continue
                img_path = diary.diary_dir(workdir) / f.image
                if not img_path.is_file():
                    continue
                try:
                    descriptions[f.fid] = describe_photo(img_path, config)
                except Exception as e:  # noqa: BLE001
                    logger.info("Diary photo description degraded to caption: %s: %s", f.image, e)

        # 2. 确定性拼接为逐条时间线（无对话模型参与）
        body = compose_day_body(list(entry.fragments), descriptions)
        if not body:
            raise RuntimeError("empty composed body")

        # 天气前缀（从当天 raw 小节的缓存标记读，blockquote 加在成文首行）
        weather = diary.get_weather_of_day(workdir, date_str)
        if weather:
            body = f"> {weather}\n\n{body}"

        # 3. 整体替换小节（rewrite_day 内部再确认仍为片段态）
        if not diary.rewrite_day(workdir, date_str, body):
            logger.info("Diary day already summarized elsewhere, result discarded: %s", date_str)
            return

        with self._state_lock:
            self._summarized_count += 1
        logger.info("Diary summarized: %s", date_str)
        self._idx.mark_index_dirty()
        try:
            self._idx.trigger_background_reindex()
        except Exception as e:  # noqa: BLE001
            logger.warning("DiaryWorker reindex failed: %s", e)
        self._publish_event(date_str)

    def _publish_event(self, date_str: str) -> None:
        """向 EventBus 发布状态事件（无订阅者时为空操作）。"""
        try:
            from doclens.event_bus import EventBus

            EventBus.get_instance().publish("status", {
                "event_type": "diary_summarized",
                "current_file": date_str,
                "timestamp": time.time(),
            })
        except Exception as e:  # noqa: BLE001
            logger.debug("DiaryWorker publish event failed: %s", e)
