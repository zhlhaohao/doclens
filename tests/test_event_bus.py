"""EventBus 测试"""
import pytest
from cortex.event_bus import EventBus


def test_singleton():
    """测试 EventBus 是单例"""
    bus1 = EventBus.get_instance()
    bus2 = EventBus.get_instance()
    assert bus1 is bus2


def test_publish_subscribe():
    """测试发布/订阅基本功能"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    received = []

    def handler(payload):
        received.append(payload)

    unsubscribe = bus.subscribe("test_event", handler)
    bus.publish("test_event", {"data": "hello"})

    assert len(received) == 1
    assert received[0] == {"data": "hello"}


def test_unsubscribe():
    """测试取消订阅"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    received = []

    def handler(payload):
        received.append(payload)

    unsubscribe = bus.subscribe("test_event", handler)
    unsubscribe()  # 取消订阅
    bus.publish("test_event", {"data": "hello"})

    assert len(received) == 0


def test_multiple_subscribers():
    """测试多个订阅者"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    received1 = []
    received2 = []

    def handler1(payload):
        received1.append(payload)

    def handler2(payload):
        received2.append(payload)

    bus.subscribe("test_event", handler1)
    bus.subscribe("test_event", handler2)
    bus.publish("test_event", {"data": "hello"})

    assert len(received1) == 1
    assert len(received2) == 1


def test_no_subscribers_for_event():
    """测试发布到没有订阅者的事件"""
    bus = EventBus.get_instance()
    bus._subscribers = {}  # 清空订阅者

    # 不应抛出异常
    bus.publish("nonexistent_event", {"data": "hello"})
