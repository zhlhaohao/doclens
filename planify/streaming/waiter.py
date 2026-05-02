#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户响应等待器

实现用户通过 Web 界面提交响应的等待机制。
使用 asyncio.Event 实现阻塞等待。
"""

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .types import UserResponseWaiter

logger = logging.getLogger(__name__)


@dataclass
class PendingRequest:
    """待处理的用户请求"""

    request_id: str
    event: asyncio.Event = field(default_factory=asyncio.Event)
    response: Optional[Dict[str, Any]] = None
    created_at: float = field(default_factory=time.time)


class GlobalResponseWaiter:
    """
    全局用户响应等待器

    单例模式，管理所有等待中的用户请求。
    支持 Web API 提交响应，代理循环等待响应。
    """

    _instance: Optional["GlobalResponseWaiter"] = None

    def __new__(cls) -> "GlobalResponseWaiter":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._pending: Dict[str, PendingRequest] = {}
            cls._instance._data_lock = asyncio.Lock()
        return cls._instance

    @classmethod
    def get_instance(cls) -> "GlobalResponseWaiter":
        """获取单例实例"""
        return cls()

    async def create_request(self, request_id: Optional[str] = None) -> str:
        """
        创建一个新的等待请求。

        Args:
            request_id: 可选的请求 ID，不提供则自动生成

        Returns:
            请求 ID
        """
        if request_id is None:
            request_id = f"req_{uuid.uuid4().hex[:8]}"

        async with self._data_lock:
            self._pending[request_id] = PendingRequest(request_id=request_id)

        logger.debug(f"[Waiter] 创建等待请求: {request_id}")
        return request_id

    async def wait_for_response(
        self,
        request_id: str,
        timeout: float = 300.0,
    ) -> Dict[str, Any]:
        """
        等待用户响应。

        Args:
            request_id: 请求 ID
            timeout: 超时时间（秒）

        Returns:
            用户响应数据

        Raises:
            TimeoutError: 等待超时
            KeyError: 请求不存在
        """
        async with self._data_lock:
            pending = self._pending.get(request_id)

        if pending is None:
            raise KeyError(f"请求不存在: {request_id}")

        logger.debug(f"[Waiter] 开始等待响应: {request_id}, 超时: {timeout}s")

        try:
            await asyncio.wait_for(pending.event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            # 清理超时的请求
            async with self._data_lock:
                self._pending.pop(request_id, None)
            logger.warning(f"[Waiter] 等待响应超时: {request_id}")
            raise TimeoutError(f"等待用户响应超时: {request_id}")

        # 获取响应并清理
        async with self._data_lock:
            pending = self._pending.pop(request_id, None)

        if pending is None:
            raise KeyError(f"请求已被清理: {request_id}")

        logger.info(f"[Waiter] 收到响应: {request_id}")
        return pending.response or {}

    def submit_response(self, request_id: str, response: Dict[str, Any]) -> bool:
        """
        提交用户响应（同步方法）。

        Note: 不使用 _data_lock，因为此方法需要被同步上下文（CLI）调用，
        且 dict.get + 属性赋值在 CPython GIL 下是原子的。

        Args:
            request_id: 请求 ID
            response: 响应数据

        Returns:
            是否成功提交
        """
        pending = self._pending.get(request_id)
        if pending is None:
            logger.warning(f"[Waiter] 提交响应失败，请求不存在: {request_id}")
            return False

        pending.response = response
        pending.event.set()
        logger.info(f"[Waiter] 响应已提交: {request_id}")
        return True

    async def cancel_request(self, request_id: str) -> bool:
        """
        取消等待请求。

        Args:
            request_id: 请求 ID

        Returns:
            是否成功取消
        """
        async with self._data_lock:
            pending = self._pending.pop(request_id, None)

        if pending is None:
            return False

        pending.event.set()
        logger.debug(f"[Waiter] 请求已取消: {request_id}")
        return True

    async def cleanup_expired(self, max_age: float = 600.0) -> int:
        """
        清理过期的等待请求。

        Args:
            max_age: 最大存活时间（秒）

        Returns:
            清理的请求数量
        """
        now = time.time()
        expired = []

        async with self._data_lock:
            for request_id, pending in list(self._pending.items()):
                if now - pending.created_at > max_age:
                    expired.append(request_id)
                    del self._pending[request_id]

        for request_id in expired:
            logger.debug(f"[Waiter] 清理过期请求: {request_id}")

        return len(expired)

    def has_pending_request(self, request_id: str) -> bool:
        """检查是否存在等待中的请求"""
        return request_id in self._pending

    def get_pending_count(self) -> int:
        """获取等待中的请求数量"""
        return len(self._pending)


class SessionWaiter:
    """
    会话级用户响应等待器

    每个会话独立的等待器，包装全局等待器提供会话隔离。
    """

    def __init__(
        self,
        global_waiter: Optional[GlobalResponseWaiter] = None,
        default_timeout: float = 300.0,
    ):
        """
        初始化会话等待器。

        Args:
            global_waiter: 全局等待器实例，默认使用单例
            default_timeout: 默认超时时间
        """
        self._global = global_waiter or GlobalResponseWaiter.get_instance()
        self._default_timeout = default_timeout

    async def create_and_wait(
        self,
        question: str,
        input_type: str = "text",
        options: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        创建请求并等待响应的便捷方法。

        Args:
            question: 问题内容
            input_type: 输入类型
            options: 选项配置
            timeout: 超时时间

        Returns:
            用户响应数据
        """
        request_id = await self._global.create_request()

        # 这里只负责等待，发射 ask_user 事件由调用者处理
        return await self._global.wait_for_response(
            request_id,
            timeout=timeout or self._default_timeout,
        )

    async def wait_for_response(
        self,
        request_id: str,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        等待用户响应。

        Args:
            request_id: 请求 ID
            timeout: 超时时间

        Returns:
            用户响应数据
        """
        return await self._global.wait_for_response(
            request_id,
            timeout=timeout or self._default_timeout,
        )

    def submit_response(self, request_id: str, response: Dict[str, Any]) -> bool:
        """
        提交用户响应。

        Args:
            request_id: 请求 ID
            response: 响应数据

        Returns:
            是否成功提交
        """
        return self._global.submit_response(request_id, response)


# 全局单例获取函数
def get_global_waiter() -> GlobalResponseWaiter:
    """获取全局响应等待器单例"""
    return GlobalResponseWaiter.get_instance()
