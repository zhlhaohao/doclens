"""SessionManager.invalidate_provider 测试。"""
from unittest.mock import MagicMock, patch

import pytest

from planify.core.session_manager import SessionManager


def test_invalidate_provider_resets_cached_provider():
    """invalidate_provider 后 _provider 应为 None。"""
    fake = MagicMock()
    SessionManager._provider = fake
    SessionManager.invalidate_provider()
    assert SessionManager._provider is None


def test_invalidate_provider_safe_when_already_none():
    """多次调用或初始为 None 时不报错。"""
    SessionManager._provider = None
    SessionManager.invalidate_provider()
    assert SessionManager._provider is None
