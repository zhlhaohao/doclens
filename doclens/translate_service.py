"""PDF 翻译服务（ADR-0039）——vendor pdf2zh 引擎的宿主侧编排层。

职责：
- 任务级串行队列（同一时刻仅一份 PDF 在译；ONNX 布局模型单例非线程安全，
  沿 VisionWorker 全局串行先例）；
- 消费「翻译预设」（presets_store kind=translate）→ 引擎 envs 注入；
- 产物写回知识库源 PDF 同目录，命名 ``<原名>.<目标语言>.pdf``（译本即知识，
  随 FileWatcher 入索引、随 Git 同步）；
- 逐页进度经内存广播 → API 层 SSE 转发；取消 = asyncio.Event 置位。

不持久化任务状态（进程内存态）：崩溃即丢，用户重开弹框重译——翻译缓存
（translate_cache.db）保证已译段落秒回。
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger(__name__)

# 任务状态机：queued → running → done | error | cancelled
_VALID_STATUS = {"queued", "running", "done", "error", "cancelled"}


@dataclass
class TranslateJob:
    """一次翻译请求的全部状态（内存态）。"""

    job_id: str
    source_path: str  # 知识库内相对路径（.pdf）
    lang_in: str
    lang_out: str
    outputs: str  # "mono" | "dual" | "both"
    pages: Optional[list[int]] = None  # 0-based 页号；None = 全文
    ultrafast: bool = False
    ignore_cache: bool = False
    # 运行态
    status: str = "queued"
    progress_done: int = 0
    progress_total: int = 0
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    result_paths: list[str] = field(default_factory=list)
    # 进度/事件订阅（SSE 消费者注册回调；翻译线程调用）
    _subscribers: list[Callable[[dict], None]] = field(default_factory=list)
    _cancellation: "asyncio.Event | None" = None
    _loop: Optional[asyncio.AbstractEventLoop] = None


class TranslationQueueFull(Exception):
    """队列已满（防无界堆积）。"""


class TranslationService:
    """翻译任务串行队列 + 引擎调用（进程单例）。"""

    MAX_QUEUE = 4  # 排队上限（含运行中）

    def __init__(self, workdir: str):
        self._workdir = Path(workdir)
        self._jobs: dict[str, TranslateJob] = {}
        self._order: list[str] = []  # FIFO
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._shutdown = False
        self._engine_started = False

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._shutdown = False
        self._thread = threading.Thread(
            target=self._run_loop, name="translate-service", daemon=True
        )
        self._thread.start()
        logger.info("TranslationService started (workdir=%s)", self._workdir)

    def stop(self) -> None:
        self._shutdown = True
        self._wake.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("TranslationService stopped")

    # ------------------------------------------------------------------
    # 任务提交 / 查询 / 取消
    # ------------------------------------------------------------------

    def submit(
        self,
        source_path: str,
        lang_in: str,
        lang_out: str,
        outputs: str = "both",
        pages: Optional[list[int]] = None,
        ultrafast: bool = False,
        ignore_cache: bool = False,
    ) -> TranslateJob:
        full = self._resolve_source(source_path)
        if not full.exists():
            raise FileNotFoundError(f"source pdf not found: {source_path}")
        if outputs not in {"mono", "dual", "both"}:
            raise ValueError(f"invalid outputs: {outputs}")
        rel = self._to_rel(full)
        import uuid

        job = TranslateJob(
            job_id=uuid.uuid4().hex[:12],
            source_path=rel,
            lang_in=lang_in,
            lang_out=lang_out,
            outputs=outputs,
            pages=pages,
            ultrafast=ultrafast,
            ignore_cache=ignore_cache,
        )
        with self._lock:
            if len(self._order) >= self.MAX_QUEUE:
                raise TranslationQueueFull(
                    f"translation queue is full ({self.MAX_QUEUE})"
                )
            self._jobs[job.job_id] = job
            self._order.append(job.job_id)
        self._wake.set()
        return job

    def get(self, job_id: str) -> Optional[TranslateJob]:
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self) -> list[TranslateJob]:
        with self._lock:
            return [self._jobs[j] for j in self._order if j in self._jobs]

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            if job.status == "queued":
                job.status = "cancelled"
                job.finished_at = time.time()
                self._order.remove(job_id)
                self._emit(job, {"type": "cancelled"})
                return True
            if job.status == "running" and job._cancellation and job._loop:
                job._loop.call_soon_threadsafe(job._cancellation.set)
                return True
            return False

    def subscribe(self, job_id: str, cb: Callable[[dict], None]) -> bool:
        """注册进度回调（SSE 端点用）；返回是否注册成功。"""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False
            job._subscribers.append(cb)
            return True

    # ------------------------------------------------------------------
    # 工作线程
    # ------------------------------------------------------------------

    def _run_loop(self) -> None:
        while not self._shutdown:
            self._wake.wait(timeout=1.0)
            self._wake.clear()
            job_id = self._next_queued()
            if not job_id:
                continue
            self._execute(self._jobs.get(job_id))

    def _next_queued(self) -> Optional[str]:
        with self._lock:
            for jid in self._order:
                job = self._jobs.get(jid)
                if job and job.status == "queued":
                    return jid
            return None

    def _execute(self, job: Optional[TranslateJob]) -> None:
        if not job:
            return
        self._ensure_engine()
        job.status = "running"
        self._emit(job, {"type": "running"})
        loop = asyncio.new_event_loop()
        cancellation = asyncio.Event()
        job._loop = loop
        job._cancellation = cancellation
        started = time.time()
        try:
            # 进度 callback 在翻译线程被调（同步）；total/done 语义沿上游
            # tqdm progress 对象
            def on_progress(progress) -> None:
                job.progress_total = getattr(progress, "total", 0) or 0
                job.progress_done = getattr(progress, "n", 0) or 0
                self._emit(
                    job,
                    {
                        "type": "progress",
                        "done": job.progress_done,
                        "total": job.progress_total,
                    },
                )

            from doclens.vendor_pdf2zh.high_level import translate

            src_abs = str(self._workdir / job.source_path)
            out_dir = str(Path(src_abs).parent)
            results = translate(
                [src_abs],
                output=out_dir,
                pages=job.pages,
                lang_in=job.lang_in,
                lang_out=job.lang_out,
                service=self._service_from_preset(),
                # 非 ultrafast 上游 CLI 默认 4 线程（pdf2zh.py parse_args）；
                # high_level 只对 ultrafast 补默认（16），普通模式传 0 会
                # ThreadPoolExecutor(max_workers=0) 炸——宿主侧显式给值
                thread=16 if job.ultrafast else 4,
                callback=on_progress,
                cancellation_event=cancellation,
                envs=self._envs_from_preset(),
                ignore_cache=job.ignore_cache,
                ultrafast=job.ultrafast,
                model=self._load_model() if not job.ultrafast else None,
            )
            # 引擎产物 <名>-mono.pdf / <名>-dual.pdf → 按用户选择改名保留
            keep = self._finalize_outputs(job, results)
            job.result_paths = keep
            job.status = "done"
            job.finished_at = time.time()
            self._emit(
                job,
                {
                    "type": "done",
                    "paths": keep,
                    "seconds": round(time.time() - started, 1),
                },
            )
            logger.info(
                "translate job %s done (%.1fs): %s",
                job.job_id,
                time.time() - started,
                keep,
            )
        except asyncio.CancelledError:
            job.status = "cancelled"
            job.finished_at = time.time()
            self._emit(job, {"type": "cancelled"})
        except ImportError as exc:
            job.status = "error"
            job.error = str(exc)
            job.finished_at = time.time()
            self._emit(job, {"type": "error", "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            logger.exception("translate job %s failed", job.job_id)
            job.status = "error"
            job.error = str(exc)
            job.finished_at = time.time()
            self._emit(job, {"type": "error", "error": str(exc)})
        finally:
            loop.close()
            with self._lock:
                if job.job_id in self._order:
                    self._order.remove(job.job_id)
            # 完成/失败的任务保留 10 分钟供查询，之后由 _prune 清理
            threading.Timer(600.0, lambda: self._prune(job.job_id)).start()

    # ------------------------------------------------------------------
    # 引擎装配
    # ------------------------------------------------------------------

    def _ensure_engine(self) -> None:
        """懒初始化：翻译缓存 DB + （非 ultrafast）ONNX 模型单例。"""
        if self._engine_started:
            return
        from doclens.vendor_pdf2zh.cache import init_db

        init_db(str(self._data_dir() / "translate_cache.db"))
        self._engine_started = True

    def _data_dir(self) -> Path:
        from doclens.config import data_dirname

        return self._workdir / data_dirname()

    def _load_model(self):
        """普通模式的 ONNX 布局模型（单例，随服务进程常驻）。"""
        from doclens.vendor_pdf2zh.doclayout import DocLayoutModel, ModelInstance

        if ModelInstance.value is None:
            ModelInstance.value = DocLayoutModel.load_available()
        return ModelInstance.value

    def _preset(self) -> Optional[dict]:
        """激活的翻译预设（kind=translate）；无激活返回 None（引擎默认 google）。

        优先读激活预设（presets_store 按 CORTEX_ACTIVE_TRANSLATE_PRESET 名匹配）；
        激活键指向的预设被删时回退读 global .env 的物化值。
        """
        try:
            from doclens.web_v2 import presets_store
            from doclens.config import get_global_cortex_dir

            active_name = os.environ.get("CORTEX_ACTIVE_TRANSLATE_PRESET", "")
            if active_name:
                for p in presets_store.list_presets("translate"):
                    if p.get("name", "").strip().lower() == active_name.strip().lower():
                        # list 是脱敏的——密钥需 raw 读
                        for raw_id in [p.get("id")]:
                            raw = presets_store.get_preset_raw(raw_id) if raw_id else None
                            if raw and raw.get("kind") == "translate":
                                return raw
            # 回退：物化到 global .env 的值（激活预设已删但仍留有 env 键）
            service = os.environ.get("CORTEX_TRANSLATE_SERVICE", "")
            if service:
                import json as _json

                try:
                    envs = _json.loads(os.environ.get("CORTEX_TRANSLATE_ENVS") or "{}")
                except (ValueError, TypeError):
                    envs = {}
                return {
                    "translate_service": service,
                    "model_id": os.environ.get("CORTEX_TRANSLATE_MODEL", ""),
                    "translate_envs": envs,
                    "lang_default_out": os.environ.get("CORTEX_TRANSLATE_LANG_OUT", ""),
                }
        except Exception:  # noqa: BLE001
            logger.exception("translate preset resolution failed")
        return None

    def _service_from_preset(self) -> str:
        preset = self._preset()
        if not preset:
            return "google"
        # 模型统一走 envs 的 *_MODEL 键（引擎 model=None 自动回退各自默认，
        # 2026-10-08 决议：表单不再提供独立的“模型”输入框）
        return preset.get("translate_service") or "google"

    def _envs_from_preset(self) -> dict:
        preset = self._preset()
        if not preset:
            return {}
        return dict(preset.get("translate_envs") or {})

    # ------------------------------------------------------------------
    # 产物落盘
    # ------------------------------------------------------------------

    def _finalize_outputs(self, job: TranslateJob, results: list) -> list[str]:
        """引擎固定产出 <名>-mono.pdf/-dual.pdf 两份 → 按用户选择（job.outputs）
        只保留所选形态并改名；未选中的那份删除（2026-10-09 决议：选择即生效，
        废弃 2026-10-08「两份都保留、选择只影响提示」的旧口径）。

        目标命名：``<原名>.<目标语言>.pdf``（mono，单语纯译文）与
        ``<原名>.<目标语言>.dual.pdf``（dual，双语逐页对照）。
        """
        src = Path(self._workdir / job.source_path)
        stem = src.stem
        out_dir = src.parent
        keep: list[str] = []
        mono_path = dual_path = None
        for pair in results:
            mono_path, dual_path = pair
        want_mono = job.outputs in ("mono", "both")
        want_dual = job.outputs in ("dual", "both")
        if mono_path:
            if want_mono and Path(mono_path).exists():
                kept_mono = out_dir / f"{stem}.{job.lang_out}.pdf"
                _replace(Path(mono_path), kept_mono)
                keep.append(self._to_rel(kept_mono))
            else:
                Path(mono_path).unlink(missing_ok=True)
        if dual_path:
            if want_dual and Path(dual_path).exists():
                kept_dual = out_dir / f"{stem}.{job.lang_out}.dual.pdf"
                _replace(Path(dual_path), kept_dual)
                keep.append(self._to_rel(kept_dual))
            else:
                Path(dual_path).unlink(missing_ok=True)
        return keep

    # ------------------------------------------------------------------
    # 杂项
    # ------------------------------------------------------------------

    def _emit(self, job: TranslateJob, event: dict) -> None:
        for cb in list(job._subscribers):
            try:
                cb(event)
            except Exception:  # noqa: BLE001
                pass

    def _prune(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job and job.status in {"done", "error", "cancelled"}:
                # 有订阅者时延迟清理（SSE 还在流）
                if not job._subscribers:
                    self._jobs.pop(job_id, None)

    def _resolve_source(self, source_path: str) -> Path:
        p = Path(source_path)
        if p.is_absolute():
            return p
        return self._workdir / p

    def _to_rel(self, p: Path) -> str:
        try:
            return p.resolve().relative_to(self._workdir.resolve()).as_posix()
        except ValueError:
            return str(p)


def _replace(src: Path, dst: Path) -> None:
    """移动并覆盖（重译同名产物场景幂等）。"""
    import shutil

    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    shutil.move(str(src), str(dst))


# ------------------------------------------------------------------
# 进程单例
# ------------------------------------------------------------------

_service: Optional[TranslationService] = None
_service_lock = threading.Lock()


def get_translation_service() -> TranslationService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                from doclens.web_v2.deps import get_config

                workdir = get_config().search_path
                _service = TranslationService(workdir)
                _service.start()
    return _service
