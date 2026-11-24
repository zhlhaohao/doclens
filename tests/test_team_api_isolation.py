"""team API 隔离校验（ADR-0060 §3）：leased_by 决定读/写/停/删的可见性。"""

import json

import pytest

from doclens.web_v2.api.team import require_bot
from doclens.web_v2.api.errors import CortexAPIError


class _Registry:
    def __init__(self, bots):
        self._bots = bots

    def get(self, name):
        return self._bots.get(name)


class _Hub:
    def __init__(self, bots):
        self.registry = _Registry(bots)


@pytest.fixture
def hub(monkeypatch):
    h = _Hub({
        "alice": {"name": "alice", "leased_by": "S1", "role": "researcher"},
        "bob": {"name": "bob", "leased_by": None, "role": "researcher"},
    })
    monkeypatch.setattr("doclens.web_v2.api.team._hub", lambda: h)
    return h


def test_holder_can_access(hub):
    _, bot = require_bot("S1", "alice")
    assert bot["name"] == "alice"


def test_other_session_rejected(hub):
    with pytest.raises(CortexAPIError) as e:
        require_bot("S2", "alice")
    assert e.value.status == 409


def test_unleased_bot_rejected(hub):
    """无主 Bot（原父会话已删）任何会话都不能直接读写——留痕保留但不可读。"""
    with pytest.raises(CortexAPIError) as e:
        require_bot("S1", "bob")
    assert e.value.status == 409


def test_missing_bot_404(hub):
    with pytest.raises(CortexAPIError) as e:
        require_bot("S1", "ghost")
    assert e.value.status == 404
