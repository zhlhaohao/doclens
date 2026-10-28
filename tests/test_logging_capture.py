"""unraisable 兜底捕获测试（logging_capture）。

背景：发行版 "Exception ignored in: <async_generator aiter_raw> /
ValueError: async generator already executing" 只在控制台可见、log 文件缺失
——该输出走 sys.unraisablehook（stderr），不进 logging。install 后必须落文件。

私有成员（_unraisable_hook / _logged_keys）一律函数内 import——架构红线禁止
tests 模块级引用私有成员。
"""
import gc
import logging
import sys

import pytest


@pytest.fixture()
def capture(tmp_path):
    """装钩子 + 文件 handler，返回读取 log 内容的函数。"""
    from planify.core.logging_capture import _logged_keys, _logger
    from planify.core.logging_capture import install_unraisable_capture

    log_file = tmp_path / "cap.log"
    handler = logging.FileHandler(log_file, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(levelname)s | %(message)s"))
    _logger.addHandler(handler)
    _logger.setLevel(logging.DEBUG)
    _logged_keys.clear()
    install_unraisable_capture()
    assert getattr(sys, "planify_unraisable_capture", False)
    yield lambda: log_file.read_text(encoding="utf-8")
    _logger.removeHandler(handler)
    handler.close()
    # 不卸 sys.unraisablehook：进程级单飞标志保证幂等，卸了反而破坏其它测试


def _make_unraisable(exc_type, exc_value, tb=None, obj=None):
    return type(
        "U", (), {"exc_type": exc_type, "exc_value": exc_value,
                  "exc_traceback": tb, "object": obj}
    )()


class _Boom:
    def __del__(self):
        raise ValueError("del boom")


def test_unraisable_hook_writes_to_log(capture):
    """unraisable 异常（GC 触发 __del__ 抛错）必须写进 log 文件。"""
    from planify.core.logging_capture import _unraisable_hook

    try:
        raise ValueError("async generator already executing")
    except ValueError:
        tb = sys.exc_info()[2]
        _unraisable_hook(_make_unraisable(ValueError, sys.exc_info()[1], tb, "fake-agen"))
    text = capture()
    assert "unraisable" in text
    assert "Exception ignored in: 'fake-agen'" in text
    assert "async generator already executing" in text
    assert "ValueError" in text


def test_unraisable_hook_suppresses_duplicates(capture):
    """同一 (异常类型, 对象) 重复 unraisable 只记一次（GC 批量连发）。"""
    from planify.core.logging_capture import _unraisable_hook

    for _ in range(3):
        _unraisable_hook(_make_unraisable(RuntimeError, RuntimeError("dup"), None, "same-obj"))
    text = capture()
    assert text.count("unraisable") == 1


def test_hook_never_raises(capture, monkeypatch):
    """hook 依赖的 logger 不可用时自身绝不抛（再抛会静默丢原始异常）。"""
    from planify.core import logging_capture as lc

    monkeypatch.setattr(lc, "_logger", None)
    lc._unraisable_hook(_make_unraisable(ValueError, ValueError("x"), None, None))
    # 不抛即通过；stderr 分支自身失败也无害


def test_thread_excepthook_writes_to_log(capture):
    """线程内未捕获异常经 threading.excepthook 落文件。"""
    import threading

    def boom():
        raise RuntimeError("thread boom")

    t = threading.Thread(target=boom, name="t-cap")
    t.start()
    t.join(timeout=5)
    text = capture()
    assert "t-cap" in text
    assert "thread boom" in text


def test_real_gc_unraisable_lands_in_log(capture):
    """端到端：__del__ 抛错 → GC → unraisablehook → log 文件。"""
    _Boom()
    gc.collect()
    text = capture()
    assert "del boom" in text
