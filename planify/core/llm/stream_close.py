# -*- coding: utf-8 -*-
"""流式 SDK 的确定性收尾工具。

Why：``AsyncStream.close()`` / ``AsyncMessageStream.close()`` 只关闭持有的
httpx Response，SDK 内部的 ``__stream__`` async generator（属性名
``_iterator``）仍挂起在 yield 上，它持有
``_iter_events → aiter_bytes/aiter_raw → BoundAsyncStream.__aiter__`` 整条
生成器链。只靠 GC 终结器收尾时，若终结恰好发生在另一协程仍在驱动该链的
时刻，解释器就抛 unraisable：

    Exception ignored in: <async_generator object Response.aiter_raw>
    ValueError: async generator already executing

2026-11-06 日志审计：该噪音约 40 次/天，全部指向 httpx 的
``aiter_raw`` / ``BoundAsyncStream.__aiter__``，且都出现在「上一轮流结束、
下一轮请求开始」的间隙——即上一轮的流未确定性关闭。

做法：退出流消费时先 ``await _iterator.aclose()``，httpx ``aiter_raw`` 的
``finally`` 才能在事件循环内正常走完 ``await stream.aclose()``，再把
Response 交给 SDK 的上下文管理器关闭。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def close_sdk_stream_iterator(stream: Any) -> None:
    """确定性地关闭流式 SDK 的内部事件迭代器。

    私有属性按 ``getattr`` 防御访问——SDK 换实现时静默跳过，不制造新崩溃点。
    幂等：已读完/已关闭的生成器再 aclose 无副作用。
    """
    iterator = getattr(stream, "_iterator", None)
    aclose = getattr(iterator, "aclose", None)
    if aclose is None:
        return
    try:
        await aclose()
    except (RuntimeError, ValueError) as e:
        # 已被消费/关闭，或恰好正在执行——都属幂等收尾，不需要噪音
        logger.debug("关闭 SDK 流迭代器失败（忽略）: %s", e)
    except BaseException:  # noqa: BLE001 —— 含取消途中的 CancelledError
        # 取消态下 await 会被立即打断：转后台补一次，别把未关的流丢给 GC
        try:
            asyncio.ensure_future(aclose())
        except Exception:  # noqa: BLE001
            pass
