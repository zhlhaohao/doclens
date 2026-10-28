"""异常兜底写文件：unraisable/线程异常不落 console-only 盲区。

背景（2026-10-28 发行版事故）："Exception ignored in: <async_generator
aiter_raw> / ValueError: async generator already executing" 只打印在控制台，
log 文件里找不到——该输出走解释器 sys.unraisablehook（默认写 stderr，不进
logging），而 setup_logging 只装配了文件 handler。泄漏本身已在 runner /
openai_compat_provider 用 aclosing 修复；本模块是兜底层：任何来源（GC
终结器、线程、__del__、asyncio）的 unraisable 异常都进 log 文件，不再
"控制台一闪而过、事后无凭"。
"""
import logging
import sys
import threading
from types import TracebackType
from typing import Optional

_logger = logging.getLogger("planify.unraisable")

# 单飞抑制：同一异常每会话只记一次（GC 批量回收时同一生成器链可能连发多次）
_logged_keys: set[tuple] = set()


def _fmt(exc_type, exc_value, tb, obj) -> str:
    """格式化 unraisable 异常（对齐 traceback.print_exception 输出）。"""
    import traceback
    lines = ["Exception ignored in: {!r}".format(obj) if obj is not None else "Exception ignored"]
    if exc_value is not None:
        lines.append("".join(traceback.format_exception_only(exc_type, exc_value)).rstrip())
    if tb is not None:
        lines.append("".join(traceback.format_tb(tb)).rstrip())
    return "\n".join(lines)


def _unraisable_hook(unraisable) -> None:
    """sys.unraisablehook 兜底：GC/线程/解释器关闭期吞不掉的异常 → log 文件。

    绝不抛出（hook 内再异常会静默丢失原异常）。
    """
    try:
        exc_type = getattr(unraisable, "exc_type", None) or type(unraisable.exc_value)
        exc_value = unraisable.exc_value
        tb: Optional[TracebackType] = getattr(unraisable, "exc_traceback", None)
        obj = getattr(unraisable, "object", None)
        key = (exc_type.__name__, repr(obj)[:120])
        if key in _logged_keys:
            return
        _logged_keys.add(key)
        _logger.error(
            "unraisable（解释器吞不掉的异常，已兜底进文件）：\n%s",
            _fmt(exc_type, exc_value, tb, obj),
        )
        # logging 不可用（关闭期）时退回 stderr，保留默认可见性
    except Exception:
        try:
            sys.__stderr__.write("planify unraisable hook 自身失败，原始异常丢失\n")
        except Exception:
            pass


def _thread_excepthook(args: threading.ExceptHookArgs) -> None:
    """threading.excepthook 兜底：线程内未捕获异常 → log 文件。"""
    try:
        # ExceptHookArgs 无 .name 属性，线程名从 args.thread 取（3.10+）
        name = getattr(getattr(args, "thread", None), "name", "?") or "?"
        key = ("thread", name, args.exc_type.__name__ if args.exc_type else "")
        if key in _logged_keys:
            return
        _logged_keys.add(key)
        _logger.error(
            "线程 %s 未捕获异常（threading.excepthook 兜底）：\n%s",
            name,
            _fmt(args.exc_type, args.exc_value, args.exc_traceback, None),
        )
    except Exception:
        try:
            sys.__stderr__.write("planify thread excepthook 自身失败\n")
        except Exception:
            pass


def install_unraisable_capture() -> None:
    """安装 unraisable/线程异常兜底（幂等；重复调用只装一次）。"""
    if getattr(sys, "planify_unraisable_capture", False):
        return
    sys.planify_unraisable_capture = True  # type: ignore[attr-defined]
    sys.unraisablehook = _unraisable_hook
    threading.excepthook = _thread_excepthook
