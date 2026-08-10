"""视觉解析 Worker —— 常驻后台串行消费 vision_queue（ADR-0001）。

主索引阶段图像文件只进占位节点（见 treesearch/parsers/image_parser.py）；
本 Worker 随 TUI/GUI 进程启动（挂载方式同 FileWatcher），串行（一次一张）
调用独立配置的视觉模型（OpenAI-compat），把返回的结构化 Markdown 复用
``md_to_tree`` 建树后原位替换占位节点。

设计要点：
- 队列持久化在 index.db 的 vision_queue 表，进程崩溃重启后断点续跑；
- 未配置 VISION_API_KEY 时空转（占位节点仍在，文件名可搜索）；
- 配置热生效：每轮循环重新读 config（设置页改完无需重启）；
- 模型/prompt 版本变化时，启动阶段把已完成项重新置为 pending 自动重解析；
- 失败按 max_index_fail_count 连败上限转入 failed，同时记入 failed_files
  以便在 UI 的失败统计中可见（文件变更 / force 重建会自然重置重试）。
"""

import asyncio
import base64
import json
import logging
import os
import threading
import time
import urllib.request

from treesearch.parsers.image_store import _EXT_TO_MEDIA

logger = logging.getLogger(__name__)

# 视觉模型转写 prompt（要求结构化 Markdown，复用 md_to_tree 建树）
VISION_PROMPT = (
    "请将图片内容转写为 Markdown，严格遵循：\n"
    "1) Caption：用 `# ` 开头一句话总结图片的核心主题（caption）；\n"
    "2) 文字完整提取：图片中所有可见文字必须原样提取，不遗漏、不改写——"
    "表格用 GFM Markdown 表格（| 列 | 列 |），标题/层次用 #/##，正文段落原样转写；\n"
    "3) 图像描述（照片/截图/纯图像的视觉内容）：在 caption 之后用**一句话、10-50 个字**"
    "概括「图片拍的是什么」，**必须是连贯的一段话——禁止用 bullet/列表/分点逐项罗列**"
"（例如禁止「前景…／远景…／路边…」式分点），禁止堆砌形容词，禁止重复第 2 步已提取的文字；"
"没有视觉内容可描述时此句可省略；\n"
    "4) 只输出 Markdown 本身，不要解释、前言、后记或 ``` 代码块围栏。"
)

# prompt 版本：修改 VISION_PROMPT 时 +1，已完成项会在下次启动时自动重解析
PROMPT_VERSION = 3

# DashScope 等 OpenAI-compat 端点对 base64 图像的大小限制（防御性上限）
_MAX_IMAGE_BYTES = 10 * 1024 * 1024

# 单次 API 调用超时（视觉识别耗时较长）
_REQUEST_TIMEOUT_S = 180

# 队列空转时的轮询间隔
_POLL_INTERVAL_S = 5.0


def vision_model_tag(config) -> str:
    """模型 + prompt + 协议的复合标签，写入 vision_queue.model 用于变更检测。

    含协议：改 vision_protocol（如 OpenAI-compat → anthropic）会改变 tag，
    触发 vision_requeue_model_changed 把旧协议下的 done/failed 重新入队重解析。
    """
    proto = getattr(config, "vision_protocol", None) or "openai"
    return f"{config.vision_model}|pv{PROMPT_VERSION}|proto={proto}"


def _strip_code_fence(text: str) -> str:
    """防御性剥除模型可能输出的 ```markdown 围栏。"""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        # 去掉首行 ```xxx 与结尾 ```
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped


class VisionWorker:
    """常驻视觉解析消费者（串行，一次一张）。"""

    def __init__(self, idx_manager, get_config, poll_interval: float = _POLL_INTERVAL_S):
        self._idx = idx_manager
        self._get_config = get_config
        self._poll_interval = poll_interval
        self._stop_event = threading.Event()
        self._thread = None
        # 可观测状态（_state_lock 保护：worker 线程写，API/UI 线程读）
        self._state_lock = threading.Lock()
        self._running = False
        self._current_file = None
        self._done_count = 0
        self._failed_count = 0
        self._last_error = ""

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """启动后台消费线程（幂等）。"""
        if self._thread is not None:
            return True
        self._stop_event.clear()
        # 崩溃恢复：上次残留的 processing 重置回 pending
        try:
            fts = self._open_fts()
            try:
                reset = fts.vision_reset_stale_processing()
                if reset:
                    logger.info("VisionWorker: reset %d stale processing item(s)", reset)
                # 模型/prompt 变化 → 已完成项重新入队
                config = self._get_config()
                if config.vision_api_key:
                    requeued = fts.vision_requeue_model_changed(vision_model_tag(config))
                    if requeued:
                        logger.info(
                            "VisionWorker: model/prompt changed, requeued %d item(s)", requeued
                        )
            finally:
                fts.close()
        except Exception as e:
            logger.warning("VisionWorker startup maintenance failed: %s", e)

        self._thread = threading.Thread(target=self._run, name="vision-worker", daemon=True)
        self._thread.start()
        with self._state_lock:
            self._running = True
        logger.info("VisionWorker started (poll=%.1fs)", self._poll_interval)
        return True

    def stop(self) -> None:
        """停止后台线程（等待当前这张图的调用返回，最多 5s）。"""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        with self._state_lock:
            self._running = False
            self._current_file = None

    def status(self) -> dict:
        """状态快照（线程安全）。"""
        with self._state_lock:
            return {
                "running": self._running,
                "current_file": self._current_file,
                "done_count": self._done_count,
                "failed_count": self._failed_count,
                "last_error": self._last_error,
            }

    # ------------------------------------------------------------------
    # 主循环
    # ------------------------------------------------------------------

    def _open_fts(self):
        from treesearch.fts import FTS5Index

        return FTS5Index(db_path=self._idx.index_path)

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                config = self._get_config()
                if not config.vision_api_key:
                    # 未配置视觉 API：占位节点已可搜索文件名，空转即可
                    self._stop_event.wait(self._poll_interval)
                    continue

                fts = self._open_fts()
                try:
                    item = fts.vision_next_pending()
                    if item is None:
                        self._stop_event.wait(self._poll_interval)
                        continue
                    with self._state_lock:
                        self._current_file = item["rel_path"] or item["source_path"]
                    self._process_one(fts, item, config)
                finally:
                    fts.close()
                    with self._state_lock:
                        self._current_file = None
            except Exception as e:  # 兜底：任何意外都不让 worker 线程死掉
                logger.exception("VisionWorker loop error: %s", e)
                self._stop_event.wait(self._poll_interval)

    # ------------------------------------------------------------------
    # 单张处理
    # ------------------------------------------------------------------

    def _process_one(self, fts, item: dict, config) -> None:
        path = item["source_path"]
        rel = item["rel_path"] or os.path.basename(path)
        max_fail = max(1, config.max_index_fail_count)

        def _fail(error: str, *, permanent: bool = False) -> None:
            attempts = item["attempts"] + 1
            final = permanent or attempts >= max_fail
            fts.vision_mark_failed(path, error, final=final)
            with self._state_lock:
                self._failed_count += 1
                self._last_error = f"{rel}: {error}"
            if final:
                # 记入 failed_files，让失败在索引统计/UI 中可见
                try:
                    from treesearch.indexer import _file_hash

                    fts.upsert_failed_file(path, error, _file_hash(path))
                    fts.commit()
                except Exception as e:
                    logger.debug("VisionWorker upsert_failed_file failed: %s", e)
                logger.warning("Vision parse failed (final): %s: %s", rel, error)
            else:
                logger.info("Vision parse failed (will retry): %s: %s", rel, error)
                # 非终态失败：简单退避，避免连续打爆 API
                self._stop_event.wait(min(30.0, 5.0 * (2 ** (attempts - 1))))

        # 1. 文件存在性与大小检查
        if not os.path.isfile(path):
            fts.vision_remove(path)
            fts.commit()
            logger.info("VisionWorker: source gone, dequeued: %s", rel)
            return
        try:
            size = os.path.getsize(path)
        except OSError as e:
            _fail(f"stat failed: {e}")
            return
        if size > _MAX_IMAGE_BYTES:
            _fail(f"image too large ({size} bytes > {_MAX_IMAGE_BYTES})", permanent=True)
            return

        # 2. 调视觉 API
        try:
            md = self._call_vision_api(path, config)
        except Exception as e:
            _fail(str(e))
            return
        md = _strip_code_fence(md)
        if not md:
            _fail("empty response from vision model")
            return

        # 3. Markdown → 树 → 原位替换占位节点
        try:
            self._replace_placeholder(fts, path, md, config)
        except Exception as e:
            _fail(f"replace placeholder failed: {e}")
            return

        tag = vision_model_tag(config)
        if fts.vision_mark_done(path, tag):
            with self._state_lock:
                self._done_count += 1
            logger.info("Vision parsed: %s", rel)
            # 通知索引管理器：内存中的 documents 已过时，下次搜索重新加载
            self._idx.mark_index_dirty()
            self._publish_event("vision_done", rel)
        else:
            # 队列行被并发清掉（如 force 重建），本次结果丢弃，由重建流程兜底
            logger.info("VisionWorker: queue row vanished, result discarded: %s", rel)

    def _call_vision_api(self, path: str, config, *, prompt: str = VISION_PROMPT) -> str:
        """调视觉模型（按 vision_protocol 分流），返回 Markdown。

        复用 diary_worker 的 _vision_openai/_vision_anthropic（同协议细节），
        文档转写 max_tokens=4096（远大于日记照片描述的 512/1024）。

        ``prompt`` 默认走模块常量 ``VISION_PROMPT``（后台 worker 消费队列时用）；
        ``POST /api/vision/reparse`` 端点可传入用户自定义提示词覆盖默认。
        """
        ext = os.path.splitext(path)[1].lower().lstrip(".")
        media = _EXT_TO_MEDIA.get(ext, "application/octet-stream")
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")

        from doclens.diary_worker import _vision_anthropic, _vision_openai

        if getattr(config, "vision_protocol", None) == "anthropic":
            return _vision_anthropic(b64, media, prompt, config, max_tokens=4096)
        return _vision_openai(b64, media, prompt, config, max_tokens=4096)

    def _replace_placeholder(self, fts, path: str, md: str, config, *,
                             model_tag: str | None = None,
                             prompt_version: str | None = None) -> None:
        """把 Markdown 建树并原位替换该文档的占位节点。

        model_tag/prompt_version 默认取当前视觉模型版本（写回元数据 + 版本校验）；
        手动备注传入 ``"manual"`` 以跳过版本过期校验、不被 worker 重解析覆盖。
        """
        from treesearch.indexer import md_to_tree
        from treesearch.tree import Document

        old_doc = fts.load_document_by_source_path(path)
        if old_doc is None:
            # 文档被 prune（如文件移出索引范围），队列行一并清掉
            fts.vision_remove(path)
            fts.commit()
            return

        # 与主索引流水线保持一致的建树开关（尤其 if_add_node_text：
        # 缺省 False 会让 FTS body 列为空，导致正文内容无法被搜索到）
        from treesearch.config import get_config as _get_ts_config

        _tcfg = _get_ts_config()
        result = asyncio.run(
            md_to_tree(
                md_content=md,
                if_add_node_summary=_tcfg.if_add_node_summary,
                if_add_doc_description=_tcfg.if_add_doc_description,
                if_add_node_text=_tcfg.if_add_node_text,
                if_add_node_id=True,
            )
        )
        new_doc = Document(
            doc_id=old_doc.doc_id,
            doc_name=old_doc.doc_name,
            structure=result.get("structure", []),
            doc_description=result.get("doc_description", ""),
            metadata={"source_path": path},
            source_type="image",
        )
        # index_document(force=True) 的节点 diff 以"旧节点为空"为前提（全量重建场景），
        # 不会清理占位阶段留下的旧节点；因此先整体删除旧文档再重建。
        # 注意 delete_documents 会连带删除 index_meta 指纹——先读出、重建时原样写回，
        # 否则下一轮增量索引会把图像当成"新文件"再次生成占位节点并重新入队（死循环）。
        stored_hash = fts.get_all_index_meta().get(path)
        fts.delete_documents([old_doc.doc_id])
        # file_hash 是主索引阶段写入的文件指纹；文件本身没变，原样恢复即可
        fts.index_document(new_doc, force=True, file_hash=stored_hash)

        # 把解读 Markdown 写回图像文件元数据（ADR-0009 / 工单 04）：让解读结果「跟文件走」，
        # 下次 force 重建可从元数据 read_back、不重花 API。写回失败降级（索引已建立）。
        try:
            from treesearch.parsers import image_metadata
            if os.path.splitext(path)[1].lower() in image_metadata.INTERPRETED_IMAGE_EXTS:
                image_metadata.write_back(
                    path, md,
                    model_tag=model_tag or vision_model_tag(config),
                    prompt_version=prompt_version or str(PROMPT_VERSION),
                )
        except Exception as e:
            logger.warning("write_back 失败，索引已建（降级） %s: %s", path, e)

    def _publish_event(self, event_type: str, rel_path: str) -> None:
        """向 EventBus 发布状态事件（TUI/GUI 状态栏可订阅；无订阅者时为空操作）。"""
        try:
            from doclens.event_bus import EventBus

            EventBus.get_instance().publish("status", {
                "event_type": event_type,
                "current_file": rel_path,
                "timestamp": time.time(),
            })
        except Exception as e:
            logger.debug("VisionWorker publish event failed: %s", e)
