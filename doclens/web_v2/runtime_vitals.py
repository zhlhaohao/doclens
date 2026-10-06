"""运行情况（Runtime Vitals）采集 —— 关于弹窗健康面板的数据源（ADR-0037）。

核心六项：运行时长 / 内存 RSS / 线程数 / 对象数 / 错误数 / GC 回收次数。

- 错误数 = **本次运行累计**：全局 logging 记录工厂计数 ERROR/CRITICAL 条数，
  对所有 logger 生效（含被降级的第三方），零 I/O、随进程生灭。
  （否决当日日志文件 grep：每次打开扫最多 20MB，且多进程写同一文件
  混入 TUI/MCP 的错误——见 ADR-0037。）
- 内存/线程优先 psutil（缺库时 RSS 报 None、线程退标准库）；
  对象数 `sys.getallocatedblocks`、GC `gc.get_stats` 恒可用。
- 只反映本进程；不聚合 MCP stdio 子进程（弹窗语义 = 本应用进程）。
"""
from __future__ import annotations

import gc
import logging
import sys
import threading
import time
from typing import Any, Dict, Optional

try:  # psutil 为可选依赖（ADR-0037）：缺失不 crash，前端显示「不可用」
    import psutil

    _PSUTIL = psutil
except ImportError:  # pragma: no cover - 依赖存在性随环境
    _PSUTIL = None

# 进程启动时刻（模块导入时）——运行时长 = now - 此值
_T0 = time.monotonic()

# 错误计数器（记录工厂持引用，见 install_error_counter）
_error_count = 0
_counter_installed = False


def install_error_counter() -> None:
    """安装全局错误计数器（幂等）——包一层 logging 记录工厂，ERROR/CRITICAL +1。

    doclens 宿主侧安装（app.py 模块导入时），不动 planify 分层；
    早于 setup_logging 调用也能生效（basicConfig 不覆盖已设工厂）。
    """
    global _counter_installed
    if _counter_installed:
        return
    factory = logging.getLogRecordFactory()

    def counting_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
        record = factory(*args, **kwargs)
        if record.levelno >= logging.ERROR:
            global _error_count
            _error_count += 1
        return record

    logging.setLogRecordFactory(counting_factory)
    _counter_installed = True


def error_count() -> int:
    """本次运行累计 ERROR/CRITICAL 条数。"""
    return _error_count


def _rss_mb() -> Optional[float]:
    """进程 RSS（MB）；psutil 缺席或查询失败返回 None。"""
    if _PSUTIL is None:
        return None
    try:
        return round(_PSUTIL.Process().memory_info().rss / 1024 / 1024, 1)
    except Exception:  # pragma: no cover - psutil 平台差异兜底
        return None


def _gc_collections() -> int:
    """三代 GC 累计回收次数总和（gc.get_stats 恒可用）。"""
    try:
        return sum(g.get("collections", 0) for g in gc.get_stats())
    except Exception:  # pragma: no cover - 标准库兜底
        return 0


def snapshot() -> Dict[str, Any]:
    """当前运行情况快照（/api/health 消费；键名即前端契约）。"""
    rss = _rss_mb()
    return {
        "uptime_sec": int(time.monotonic() - _T0),
        "rss_mb": rss,
        "threads": threading.active_count(),
        "objects": sys.getallocatedblocks(),
        "errors": error_count(),
        "gc_collections": _gc_collections(),
    }
