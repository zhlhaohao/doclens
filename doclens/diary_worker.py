"""日记总结 Worker —— 常驻后台，把「片段态」的过去日小节交给 AI 归纳重写（ADR-0007）。

触发模型：每日 00:05 定点总结前一天（避开零点整）；启动时补扫一次——
进程在 00:05 未运行而错过的总结立即补上。状态即队列——
年度 md 中小节头部的 <!-- diary:raw --> 标记就是待总结信号，
无需额外数据库表；进程崩溃重启后重扫文件即可恢复。

单日消息处理：
1. 重读文件确认仍为片段态（防双设备/重入重复总结，见 ADR-0008 Consequences）；
2. 图片片段逐张调视觉模型描述（复用 VISION_* 配置）；
   单张失败/未配置 → 仅该图退化为用备注（逐图降级，不阻塞整日）；
3. 「文字片段 + 备注 + 图片描述」交对话模型（复用 PLANIFY_* 配置），
   以第一人称叙事体归纳成文；
4. diary.rewrite_day 整体替换小节并移除 raw 标记 → 触发重建索引。

失败策略：整日保留片段态，指数退避重试（上限 6 小时；唤醒点取
「下一个 00:05」与「最近重试时间」的较早者），
绝不覆盖原文、不标 failed（原文必须保留到总结成功）。
未配置 PLANIFY_API_KEY 时空转（日记停在片段态，原文保底）。
"""
from __future__ import annotations

import base64
import json
import logging
import re
import threading
import time
import urllib.request
from datetime import date as date_type
from datetime import datetime as datetime_type
from datetime import timedelta
from pathlib import Path

from doclens import diary
from treesearch.parsers.image_store import _EXT_TO_MEDIA

logger = logging.getLogger(__name__)

# 每日定点总结时刻：00:05（零点过 5 分钟）
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

# 整日总结失败的重试退避：5min 起步指数增长，上限 6h
_RETRY_BASE_S = 300.0
_RETRY_MAX_S = 6 * 3600.0

# 视觉调用超时（与 vision_worker 一致，视觉识别耗时长）
_VISION_TIMEOUT_S = 180

# 图片描述 prompt（供日记归纳用，与 vision_worker 的文档转写 prompt 不同）
_PHOTO_PROMPT = (
    "请用一两句话描述这张照片的内容（场景、人物、动作、氛围），"
    "供整理日记时引用。只输出描述本身，不要标题、不要解释。"
)

_SUMMARY_SYSTEM = (
    "你是日记整理助手。用户给你一天中按时间聚类好的记录条目（1 小时内连续的文字片段"
    "已合并为同一编号条目，照片片段各自独立成一个条目）。请整理成一篇日记。要求：\n"
    "1) 忠实于片段原意，绝不虚构、补充、渲染或扩写——目标只是把零散片段串成通顺的文字；\n"
    "2) 严格保留输入的编号结构：每个「条目N」输出为一个编号项（1. 2. 3. …），"
    "以该条目的时间点开头（单条片段用 HH:MM，合并组用 HH:MM~HH:MM 范围），"
    "按输入顺序，不要把多个条目合并成一个无编号的故事段落；\n"
    "3) 文字条目：把组内片段串成通顺的一句话或几句话即可，不要添加片段里没有的内容；\n"
    "4) 照片条目：原样保留图片引用 ![备注](图片路径)（路径不得修改），可附一句话说明；\n"
    "5) 只输出编号列表的 Markdown，不要标题（如「## 某日」）、不要解释、不要代码围栏。"
)

_SUMMARY_MAX_TOKENS = 4000

# 推理模型经 OpenAI-compat 网关时，常把 <think>…</think> 内联进正文
_THINK_RE = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>", re.S | re.I)
_THINK_OPEN_RE = re.compile(r"<think(?:ing)?>", re.I)


def _strip_thinking(text: str) -> str:
    """剥除推理模型泄漏进正文的思考段（闭合的 <think>…</think> 与未闭合的尾部 <think>…）。"""
    text = _THINK_RE.sub("", text)
    m = _THINK_OPEN_RE.search(text)
    if m:
        # 响应被 max_tokens 截断导致思考段未闭合：思考在前正文在后，
        # 未闭合即正文没写出来，只能整体丢弃（上层按空响应重试）
        text = text[: m.start()]
    return text.strip()


def describe_photo(path: Path, config) -> str:
    """调视觉模型描述一张照片（OpenAI-compat，base64 内联）。

    与 VisionWorker._call_vision_api 同构，但 prompt 面向日记场景。
    """
    ext = path.suffix.lower().lstrip(".")
    media = _EXT_TO_MEDIA.get(ext, "application/octet-stream")
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")

    base_url = (config.vision_base_url or "").rstrip("/")
    body = {
        "model": config.vision_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{media};base64,{b64}"}},
                    {"type": "text", "text": _PHOTO_PROMPT},
                ],
            }
        ],
        "max_tokens": 512,
    }
    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {config.vision_api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=_VISION_TIMEOUT_S) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    try:
        return _strip_thinking(payload["choices"][0]["message"]["content"] or "")
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"unexpected vision API response shape: {e}") from e


def build_summary_input(fragments: list[diary.Fragment], photo_descriptions: dict[str, str]) -> str:
    """把片段聚类成编号条目（相邻间隔 ≤60min 的文字片段合为一组；照片独立成条目并
    中断文字组），组装给对话模型。

    输出按时间顺序的「条目N」结构，prompt 据此输出带编号的日记——保留结构、不塌成
    无编号故事。聚类在后端做（而非交给 LLM）以保证 1 小时规则可控。
    """
    def _to_min(hhmm: str) -> int:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)

    entries: list[dict] = []
    text_group: dict | None = None
    for f in fragments:
        if f.kind == "photo":
            if text_group is not None:
                entries.append(text_group)
                text_group = None
            caption = f.text if f.text != "照片" else ""
            entries.append({
                "type": "photo",
                "time": f.time,
                "image": f.image,
                "caption": caption,
                "desc": photo_descriptions.get(f.fid, ""),
            })
        else:
            t = _to_min(f.time)
            if text_group is not None and t - text_group["last_min"] <= 60:
                text_group["items"].append((f.time, f.text))
                text_group["last_min"] = t
            else:
                if text_group is not None:
                    entries.append(text_group)
                text_group = {"type": "text_group", "items": [(f.time, f.text)], "last_min": t}
    if text_group is not None:
        entries.append(text_group)

    lines = []
    for i, e in enumerate(entries, 1):
        if e["type"] == "text_group":
            times = [it[0] for it in e["items"]]
            span = times[0] if len(times) == 1 else f"{times[0]}~{times[-1]}"
            lines.append(f"条目{i}（文字，{span}）：")
            for t, text in e["items"]:
                lines.append(f"  {t} {text}")
        else:
            lines.append(f"条目{i}（照片，{e['time']}）：")
            lines.append(f"  图片：![{e['caption'] or '照片'}]({e['image']})")
            if e["caption"]:
                lines.append(f"  备注：{e['caption']}")
            if e["desc"]:
                lines.append(f"  照片内容：{e['desc']}")
    header = (
        "以下是这一天的记录，已按时间聚类（1 小时内连续的文字片段合并为同一编号项，"
        "照片各自独立成项）。请整理成日记：\n\n"
    )
    return header + "\n".join(lines)


def summarize_day_text(user_input: str, config) -> str:
    """一次性调对话模型归纳成文（仿 planify/context/compact.py 的最小调用）。"""
    from planify.core.llm import create_provider

    provider = create_provider({
        "provider_name": getattr(config, "planify_provider", "anthropic"),
        "protocol": getattr(config, "planify_protocol", "") or "",
        "api_key": config.planify_api_key,
        "model_id": config.planify_model_id,
        "base_url": config.planify_base_url,
    })
    resp = provider.chat(
        messages=[{"role": "user", "content": user_input}],
        system=_SUMMARY_SYSTEM,
        tools=[],
        max_tokens=_SUMMARY_MAX_TOKENS,
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    text = _strip_thinking(text)
    # 防御性剥除模型可能输出的 ```markdown 围栏
    if text.startswith("```"):
        lines = text.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


class DiaryWorker:
    """常驻日记总结消费者（串行，一次一天）。"""

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
        """启动后台线程（幂等）。启动即补扫一次，之后每日 00:05 定点总结。"""
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
        # 启动即补扫一次：进程在 00:05 未运行而错过的总结立即补上
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
        if not config.planify_api_key:
            # 未配置对话模型：日记停在片段态（原文保底），空转
            return
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
    # 单日总结
    # ------------------------------------------------------------------

    def _summarize_day(self, date_str: str, config) -> None:
        workdir = self._workdir()
        entry = diary.get_day(workdir, date_str)
        if entry.state != "raw":
            return  # 已被（另一进程/设备）总结，或小节消失

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

        # 2. 对话模型归纳成文
        user_input = build_summary_input(list(entry.fragments), descriptions)
        body = summarize_day_text(user_input, config)
        if not body:
            raise RuntimeError("empty response from chat model")

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
