"""LLM 追踪（LLM Trace）——每次 LLM 调用的实发/实收原文落盘为 Markdown。

用途：人工审视调试 + 离线计算前缀缓存命中率（usage 在收节响应 JSON 里）。

配置（env，宿主经环境注入，本模块不读宿主配置）：
- ``PLANIFY_LLM_TRACE``：开关（"1"/"true"/"on" 开，默认关）
- ``PLANIFY_LLM_TRACE_DIR``：输出目录（默认 ``{workdir}/.planify/llm_trace/``）

文件组织：每聊天会话一个 md。宿主传入会话键（``session_key``）时跨进程 /
跨天追加同文件（按 ``*-{会话键}.md`` glob 复用）；无会话键按启动时间戳命名。
轮次 = 每次 LLM 调用，文件内自增（新建 tracer 时扫文件尾续接）。

内容纪律：文本全量不压缩（不截断不用省略号代内容）；图像 base64 换占位符
（图像 token 按尺寸计，与 base64 内容无关，人工审视不被乱码墙淹没）。

健壮性红线：tracer 是调试设施，任何落盘失败只 warning，绝不影响主调用链。
"""
from __future__ import annotations

import dataclasses
import json
import logging
import os
import re
import threading
import time
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_TRUTHY = {"1", "true", "on", "yes"}
_TURN_HEADER_RE = re.compile(r"^## 轮 (\d+) ", re.MULTILINE)
_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9_.-]+")
_BASE64_URL_SPLIT = "base64,"

# 轮次续接时只扫文件尾部（长会话单文件几十 MB，全读浪费）
_TAIL_SCAN_BYTES = 64 * 1024

# 跨 tracer 实例（同会话键多次请求 / 并发流）写同一文件的互斥
_path_locks: dict[str, threading.Lock] = {}
_path_locks_guard = threading.Lock()


def _lock_for(path: str) -> threading.Lock:
    """取某文件路径的写锁（不存在则建；进程内互斥）。"""
    with _path_locks_guard:
        lock = _path_locks.get(path)
        if lock is None:
            lock = threading.Lock()
            _path_locks[path] = lock
        return lock


def _is_enabled(lookup: Any) -> bool:
    return str(lookup.get("PLANIFY_LLM_TRACE", "")).strip().lower() in _TRUTHY


class LLMTracer:
    """单会话的 LLM 调用追踪器（发/收两节追加写一个 md 文件）。

    生命周期跟随「会话」而非 provider：provider 是进程级单例、跨会话共享，
    tracer 由调用方（宿主会话入口 / 子代理 / teammate / vision）按需创建，
    经 provider 方法可选参数传入。
    """

    def __init__(
        self,
        *,
        label: str,
        trace_dir: Path,
        session_key: Optional[str] = None,
    ) -> None:
        self.label = label
        self.session_key = session_key
        self.trace_dir = trace_dir
        self.trace_dir.mkdir(parents=True, exist_ok=True)
        self._path = self._resolve_path()
        self._turn = 0
        self._t0: dict[int, float] = {}
        self._state_lock = threading.Lock()
        self._write_header_once()

    # ---------- 工厂 ----------

    @classmethod
    def create(
        cls,
        *,
        label: str,
        session_key: Optional[str] = None,
        workdir: Optional[Any] = None,
        env: Optional[dict] = None,
    ) -> Optional["LLMTracer"]:
        """按配置创建 tracer；开关关闭时返回 None（调用方无脑传 None 即不记录）。

        Args:
            label: 调用方标签（main / cli / subagent / teammate / vision …），
                写进触发源摘要行，无会话键时也参与文件名。
            session_key: 会话键（宿主聊天会话 id 等）——同键追加同文件。
            workdir: 工作目录（默认目录的锚点；缺省用 cwd）。
            env: 环境变量字典（测试注入；缺省读 os.environ）。
        """
        lookup = env if env is not None else os.environ
        if not _is_enabled(lookup):
            return None
        base = str(lookup.get("PLANIFY_LLM_TRACE_DIR", "")).strip()
        if base:
            trace_dir = Path(base)
        else:
            root = Path(workdir) if workdir is not None else Path.cwd()
            trace_dir = root / ".planify" / "llm_trace"
        try:
            return cls(label=label, session_key=session_key, trace_dir=trace_dir)
        except Exception:  # noqa: BLE001
            logger.warning("LLM trace: tracer 初始化失败", exc_info=True)
            return None

    # ---------- 记录 API ----------

    def trace_request(self, kwargs: dict) -> int:
        """记「发」节（实发请求体，含缓存断点）。返回轮次号（供收节配对）。"""
        with self._state_lock:
            # 文件尾扫描只在实例首笔做（跨 tracer 续接同会话文件的轮次号）；
            # 此后信任内存计数——同实例的 agent 工具循环每次 LLM 调用都
            # 走这里，重扫文件尾（64KB read + regex）是纯浪费。并发 tracer
            # 实例间轮次号可能撞号（各编各的），只影响 trace 文件内标题
            # 排序，不影响内容完整性——调试设施可接受。
            if self._turn == 0:
                self._turn = self._existing_last_turn()
            self._turn += 1
            turn = self._turn
            self._t0[turn] = time.monotonic()
        try:
            tools = kwargs.get("tools") or []
            lines = [
                f"## 轮 {turn} · 发 · {_now_hms()}",
                f"- 模型: {kwargs.get('model', '?')} · "
                f"max_tokens: {kwargs.get('max_tokens', '?')} · 工具: {len(tools)} 个",
                f"- 触发源[{self.label}]: {_trigger_summary(kwargs.get('messages'))}",
                "",
            ]
            body = _fenced_json(_redact_images(_jsonable(kwargs)))
            _append_text(self._path, "\n".join(lines) + "\n" + body + "\n")
        except Exception:  # noqa: BLE001
            logger.warning("LLM trace: 发节落盘失败 (turn=%d)", turn, exc_info=True)
        return turn

    def trace_response(self, turn: int, native_response: Any) -> None:
        """记「收」节（实收原生响应完整 dump，usage 在其中）。"""
        try:
            header = (
                f"## 轮 {turn} · 收 · {_now_hms()}"
                f"（耗时 {self._elapsed(turn):.1f}s）\n"
            )
            body = _fenced_json(_redact_images(_jsonable(native_response)))
            _append_text(self._path, header + body + "\n")
        except Exception:  # noqa: BLE001
            logger.warning("LLM trace: 收节落盘失败 (turn=%d)", turn, exc_info=True)

    def trace_error(self, turn: int, error: Any) -> None:
        """记「收」节的异常形态（调用异常 / 流中断——发节已写，收侧不缺席）。"""
        try:
            header = (
                f"## 轮 {turn} · 收 · {_now_hms()}"
                f"（耗时 {self._elapsed(turn):.1f}s · 异常/中断）\n"
            )
            body = _fenced_json(
                {"error": str(error), "type": type(error).__name__}
                if not isinstance(error, str)
                else {"error": error, "type": "interrupted"}
            )
            _append_text(self._path, header + body + "\n")
        except Exception:  # noqa: BLE001
            logger.warning("LLM trace: 异常节落盘失败 (turn=%d)", turn, exc_info=True)

    # ---------- 内部 ----------

    def _elapsed(self, turn: int) -> float:
        with self._state_lock:
            t0 = self._t0.pop(turn, None)
        return max(0.0, time.monotonic() - t0) if t0 is not None else 0.0

    def _existing_last_turn(self) -> int:
        """文件里已有的最大轮次号（新建 tracer 续接同会话文件用；只扫尾部）。"""
        try:
            with open(self._path, "rb") as f:
                f.seek(0, 2)
                size = f.tell()
                f.seek(max(0, size - _TAIL_SCAN_BYTES))
                tail = f.read().decode("utf-8", errors="replace")
        except OSError:
            return 0
        return max((int(m) for m in _TURN_HEADER_RE.findall(tail)), default=0)

    def _resolve_path(self) -> Path:
        """会话键 → 复用（取最新）或新建 ``{日期}-{键}.md``；无键 → 时间戳命名。"""
        if self.session_key:
            safe = _FILENAME_SAFE_RE.sub("-", str(self.session_key)) or "session"
            candidates = sorted(self.trace_dir.glob(f"*-{safe}.md"))
            if candidates:
                return candidates[-1]
            return self.trace_dir / f"{datetime.now():%Y%m%d}-{safe}.md"
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        return self.trace_dir / f"{stamp}-{self.label}.md"

    def _write_header_once(self) -> None:
        try:
            if self._path.exists() and self._path.stat().st_size > 0:
                return
            header = (
                "# LLM Trace\n\n"
                f"- 标签: {self.label}\n"
                f"- 会话: {self.session_key or '(时间戳命名)'}\n"
                f"- 创建: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
                "- 说明: 每轮 = 一次 LLM 调用（发 = 实发请求体，收 = 实收响应体，"
                "含 cache_control 断点与 usage）；文本原样不压缩，"
                "图像 base64 已换占位符。轮次号跨输入连续。\n\n"
            )
            _append_text(self._path, header)
        except Exception:  # noqa: BLE001
            logger.warning("LLM trace: 文件头落盘失败", exc_info=True)


# =============================================================================
# 序列化 / 脱敏 / 摘要工具（模块级函数，便于单测）
# =============================================================================


def _append_text(path: Path, text: str) -> None:
    """append 写整块（per-path 锁互斥；每次开合文件，防句柄随会话累积）。"""
    lock = _lock_for(str(path))
    with lock:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text)


def _now_hms() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _jsonable(obj: Any) -> Any:
    """任意对象 → JSON 可序列化结构（pydantic/dataclass/enum/datetime/Path…）。"""
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set, frozenset)):
        return [_jsonable(x) for x in obj]
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Enum):
        return obj.value
    if hasattr(obj, "model_dump"):  # pydantic v2（anthropic/openai SDK 响应对象）
        try:
            return _jsonable(obj.model_dump())
        except Exception:  # noqa: BLE001
            pass
    if hasattr(obj, "__dataclass_fields__"):
        return _jsonable(dataclasses.asdict(obj))
    return str(obj)


def _redact_images(node: Any) -> Any:
    """图像 base64 → 占位符（返回新结构，不改入参）。

    覆盖两种实发形态：Anthropic image source block 与 OpenAI image_url
    的 data URL。文本内容一概不动（原样不压缩纪律）。
    """
    if isinstance(node, dict):
        # Anthropic：{"type":"image","source":{"type":"base64","data":…}}
        src = node.get("source")
        if (
            node.get("type") == "image"
            and isinstance(src, dict)
            and src.get("type") == "base64"
            and isinstance(src.get("data"), str)
        ):
            data = src["data"]
            return {**node, "source": {**src, "data": f"[base64 略，{len(data)} 字符]"}}
        # OpenAI：{"type":"image_url","image_url":{"url":"data:…;base64,…"}}
        iu = node.get("image_url")
        if (
            node.get("type") == "image_url"
            and isinstance(iu, dict)
            and isinstance(iu.get("url"), str)
            and iu["url"].startswith("data:")
            and _BASE64_URL_SPLIT in iu["url"]
        ):
            prefix, _, b64 = iu["url"].partition(_BASE64_URL_SPLIT)
            return {
                **node,
                "image_url": {**iu, "url": f"{prefix}{_BASE64_URL_SPLIT}[略，{len(b64)} 字符]"},
            }
        return {k: _redact_images(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_redact_images(x) for x in node]
    return node


def _fenced_json(payload: Any) -> str:
    """JSON dump 进代码块；fence 长度压过内容里最长的反引号串，防裂块。"""
    text = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    longest = max((len(m.group(0)) for m in re.finditer(r"`+", text)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}json\n{text}\n{fence}"


def _excerpt(text: str, limit: int = 100) -> str:
    """折叠空白后截断（只用于触发源摘要行，正文不受影响）。"""
    folded = " ".join(text.split())
    return folded if len(folded) <= limit else folded[:limit] + "…"


def _trigger_summary(messages: Any) -> str:
    """触发源摘要：最后一条 user/tool 消息的角色化概览（定位用，非内容本体）。

    兼容两种实发形态：Anthropic 风格（tool_result 混在 user content list）
    与 OpenAI 风格（独立 role=tool 消息）。
    """
    if not isinstance(messages, list) or not messages:
        return "(无消息)"
    target = None
    for m in reversed(messages):
        if isinstance(m, dict) and m.get("role") in ("user", "tool"):
            target = m
            break
    if target is None:
        target = messages[-1] if isinstance(messages[-1], dict) else {}
    role = target.get("role", "?")
    content = target.get("content")

    if isinstance(content, str):
        return f"({role}) {_excerpt(content)}" if content else f"({role}) (空)"
    if isinstance(content, list):
        parts: list[str] = []
        tool_results = sum(
            1 for b in content if isinstance(b, dict) and b.get("type") == "tool_result"
        )
        images = sum(
            1 for b in content if isinstance(b, dict) and b.get("type") in ("image", "image_url")
        )
        if tool_results:
            parts.append(f"[工具结果×{tool_results}]")
        if images:
            parts.append(f"[图像×{images}]")
        texts = [
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        ]
        joined = " ".join(t for t in texts if t)
        if joined:
            parts.append(_excerpt(joined))
        return f"({role}) " + (" ".join(parts) or "(空)")
    return f"({role}) {type(content).__name__}"
