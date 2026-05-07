"""全局事件总线 - 提供事件发布/订阅能力"""
import logging
from typing import Callable


class EventBus:
    """单例事件总线"""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._subscribers = {}
        return cls._instance

    @classmethod
    def get_instance(cls) -> "EventBus":
        """获取 EventBus 单例实例"""
        if cls._instance is None:
            cls()
        return cls._instance

    def publish(self, event_type: str, payload: dict) -> None:
        """发布事件到所有订阅者"""
        if event_type not in self._subscribers:
            return
        # Copy list to avoid RuntimeError if subscriber modifies during iteration
        subscribers = list(self._subscribers[event_type])
        for callback in subscribers:
            try:
                callback(payload)
            except Exception as e:
                # Log but don't interrupt other subscribers
                logging.getLogger(__name__).warning(f"Event subscriber raised: {e}")

    def subscribe(self, event_type: str, callback: Callable[[dict], None]) -> Callable:
        """订阅事件，返回取消订阅函数"""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

        def unsubscribe():
            self._subscribers[event_type].remove(callback)

        return unsubscribe
