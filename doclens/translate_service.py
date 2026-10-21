"""PDF 翻译服务（ADR-0039）——vendor pdf2zh 引擎的宿主侧编排层。

职责：
- 任务级串行队列（同一时刻仅一份 PDF 在译；ONNX 布局模型单例非线程安全，
  沿 VisionWorker 全局串行先例）；
- 消费「翻译预设」（presets_store kind=translate）→ 引擎 envs 注入；
- 产物写回知识库源 PDF 同目录，命名 ``<原名>.<目标语言>.pdf``（译本即知识，
  随 FileWatcher 入索引、随 Git 同步）；
- 逐页进度经内存广播 → API 层 SSE 转发；取消 = threading.Event 置位
  （引擎在翻译线程内同步轮询 `is_set()`，跨线程天然可见——AP-39）。

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

from doclens.worker_lifecycle import WorkerStopState, join_thread

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
    # 取消信号（AP-39）：引擎在翻译线程内同步轮询 `is_set()`，所以必须是
    # **threading.Event**（跨线程天然可见、`.set()` 本身线程安全）。
    # 曾用 asyncio.Event + `loop.call_soon_threadsafe`，但那个 loop 从不
    # run_forever → 回调永不执行，取消是空操作。
    _cancellation: Optional[threading.Event] = None


class TranslationQueueFull(Exception):
    """队列已满（防无界堆积）。"""


class PathOutsideWorkdir(ValueError):
    """请求路径越出知识库目录（AP-41；API 层映射为 403）。"""


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
        # 最近一次 _preset() 的降级原因（None = 无问题）。AP-17：配置了却读
        # 不出来时不再静默回落 google，_execute 据此推 toast 告知用户。
        self._preset_error: Optional[str] = None
        self._lifecycle = WorkerStopState()

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def start(self) -> None:
        """启动消费线程（幂等；停止中的旧线程未退出时拒绝，AP-43）。"""
        if not self._lifecycle.can_start("TranslationService", self._thread):
            return
        if self._thread is not None:      # 已自然退出：清残留引用后重启
            self._thread = None
        self._lifecycle.clear()
        self._shutdown = False
        self._thread = threading.Thread(
            target=self._run_loop, name="translate-service", daemon=True
        )
        self._thread.start()
        logger.info("TranslationService started (workdir=%s)", self._workdir)

    @property
    def stopping(self) -> bool:
        """旧线程仍在收尾（stop 超时未退）——此时不得启动新线程（AP-43）。"""
        return self._lifecycle.stopping

    def stop(self, timeout: float = 5.0) -> bool:
        """停止消费线程。

        Returns:
            True = 线程已确认退出；False = 超时仍在跑（在途整本 PDF 翻译可达
            数分钟）。False 时保留 `_thread` 并置 stopping，`start()` 会拒绝
            ——否则切库后旧实例继续把译本写回旧 workdir（AP-43）。
        """
        self._shutdown = True
        self._wake.set()
        if not join_thread(self._thread, timeout):
            self._lifecycle.begin()
            logger.warning(
                "TranslationService stop 超时（%.1fs），旧线程仍在运行：拒绝重启", timeout
            )
            return False
        self._thread = None
        self._lifecycle.clear()
        logger.info("TranslationService stopped")
        return True

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
            if job.status == "running" and job._cancellation is not None:
                # threading.Event：直接置位即可，引擎在翻译线程内轮询
                # `is_set()`（AP-39——曾投递到从不运行的 asyncio loop）
                job._cancellation.set()
                logger.info("translate job %s 收到取消请求", job_id)
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

    def unsubscribe(self, job_id: str, cb: Callable[[dict], None]) -> None:
        """注销进度回调（AP-40）：SSE 断开时必须调用。

        不注销的后果是双向的：死回调继续被 `_emit` 调用（向已取消的队列
        `put_nowait`），且 `_prune` 见 `_subscribers` 非空就跳过删除——
        job 与回调在进程里常驻。
        """
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            try:
                job._subscribers.remove(cb)
            except ValueError:
                pass  # 已注销（幂等）
            terminal = job.status in {"done", "error", "cancelled"} and not job._subscribers
        # 终态且已无订阅者 → 立即回收。_prune 的 10 分钟定时器可能早于
        # 本次注销就已触发（当时还有订阅者，被跳过），不留这条兜底就永久滞留。
        if terminal:
            self._prune(job_id)

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
        # 取消信号必须在起跑前就位：cancel() 可能在 running 事件刚发出、
        # 引擎尚未进入第一轮轮询时到达（AP-39）。
        cancellation = threading.Event()
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

            # AP-17：预设解析一次（原两次），降级原因随 running 事件一并告知
            service_name, translate_envs = self._preset_or_default()
            if self._preset_error:
                self._emit(
                    job,
                    {
                        "type": "toast",
                        "level": "info",
                        "message": self._preset_error,
                    },
                )

            src_abs = str(self._workdir / job.source_path)
            out_dir = str(Path(src_abs).parent)
            results = translate(
                [src_abs],
                output=out_dir,
                pages=job.pages,
                lang_in=job.lang_in,
                lang_out=job.lang_out,
                service=service_name,
                # 非 ultrafast 上游 CLI 默认 4 线程（pdf2zh.py parse_args）；
                # high_level 只对 ultrafast 补默认（16），普通模式传 0 会
                # ThreadPoolExecutor(max_workers=0) 炸——宿主侧显式给值
                thread=16 if job.ultrafast else 4,
                callback=on_progress,
                cancellation_event=cancellation,
                envs=translate_envs,
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
            # 引擎在轮询点抛 asyncio.CancelledError 表示「按要求取消」
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
            job._cancellation = None
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

        降级原因记在 `self._preset_error`（AP-17）：**配了却读不出来**时置
        文案，`_preset_or_default` 的调用方据此推 toast；完全未配置是合法
        默认状态，不置错误。
        """
        self._preset_error = None
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
                        self._preset_error = (
                            f"激活的翻译预设「{active_name}」内容不可读"
                            "（可能已损坏），本次已回退默认引擎 google"
                        )
                        break
                else:
                    # 激活键非空但预设库里没有同名预设（被删/改名）
                    self._preset_error = (
                        f"激活的翻译预设「{active_name}」不存在"
                        "（可能已被删除），本次已回退默认引擎 google"
                    )
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
            self._preset_error = (
                "翻译预设读取失败（详见服务日志），本次已回退默认引擎 google"
            )
        return None

    def _preset_or_default(self) -> tuple[str, dict]:
        """解析一次预设 → (service, envs)，并把降级原因记在 `_preset_error`。

        AP-17：原 `_service_from_preset` / `_envs_from_preset` 各调一次
        `_preset()`（每任务读两遍预设 JSON），且「未配置」与「配了却读不出来」
        无法区分——后者同样静默回落 google，用户只看到结果不对。
        现区分：未配置 = 合法默认（google，无告警）；配置了但读不出来 =
        置 `_preset_error`，由 `_execute` 推 toast 告知后仍降级执行。
        """
        preset = self._preset()
        if not preset:
            return "google", {}
        # 模型统一走 envs 的 *_MODEL 键（引擎 model=None 自动回退各自默认，
        # 2026-10-08 决议：表单不再提供独立的“模型”输入框）
        return (
            preset.get("translate_service") or "google",
            dict(preset.get("translate_envs") or {}),
        )

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
            except Exception as exc:  # noqa: BLE001
                # AP-17：原为纯 pass——订阅端异常导致进度静默丢失且无从排查
                logger.debug("translate event subscriber failed: %s", exc)

    def _prune(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job and job.status in {"done", "error", "cancelled"}:
                # 有订阅者时延迟清理（SSE 还在流）
                if not job._subscribers:
                    self._jobs.pop(job_id, None)

    def _resolve_source(self, source_path: str) -> Path:
        """把请求路径归一为知识库内的绝对路径，**拒绝越界**（AP-41）。

        旧实现允许绝对路径与 `..`：任意可读 PDF 都能被翻译，产物经
        `out_dir = src.parent` 写到知识库之外，`_to_rel` 回落还把绝对路径
        带进 API 响应。这里与 web 侧 `safe_resolve` 同语义：`resolve()` 后
        必须落在 `workdir` 内（符号链接一并展开），越界抛
        ``PathOutsideWorkdir``（API 层 403，与「文件不存在」的 404 区分开
        ——越界是策略拒绝，不是路径打错）。
        """
        base = self._workdir.resolve()
        raw = Path(source_path)
        candidate = (raw if raw.is_absolute() else base / raw).resolve()
        try:
            candidate.relative_to(base)
        except ValueError as exc:
            raise PathOutsideWorkdir(
                f"路径越权（必须在知识库目录内）: {source_path}"
            ) from exc
        return candidate

    def _to_rel(self, p: Path) -> str:
        """知识库相对路径（API/前端契约）。越界时**不**回落绝对路径（AP-41）：
        绝对路径会随响应体泄露本机目录结构，只留文件名并记 warning。"""
        try:
            return p.resolve().relative_to(self._workdir.resolve()).as_posix()
        except ValueError:
            logger.warning("translate path outside workdir: %s", p)
            return p.name


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
    """获取翻译服务单例（懒加载，绑定创建时的工作目录）。"""
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                from doclens.web_v2.deps import get_config

                workdir = get_config().search_path
                _service = TranslationService(workdir)
                _service.start()
    return _service


def reset_translation_service() -> None:
    """丢弃单例（工作目录切换时调用，AP-17）。

    单例在构造时冻结 ``workdir``，此前 `deps.swap_workdir` 不重建它——
    切换后翻译仍读写旧目录（源路径拼接、产物落盘、缓存 DB 全错位）。
    在途任务由各自线程持有 job 引用跑完；新任务按新目录重建。
    """
    global _service
    with _service_lock:
        old = _service
        _service = None
    if old is not None:
        try:
            old.stop()
        except Exception as exc:  # noqa: BLE001
            logger.warning("translate service stop failed: %s", exc)
