"""Tests for CortexAgent apply_config() hot-reload."""
from unittest.mock import MagicMock, patch
from pathlib import Path


def test_apply_config_updates_session_client_and_model():
    from doclens.agent_integration import CortexAgent

    agent = CortexAgent(Path("/tmp/fake"))
    # Simulate an initialized session
    agent.session = MagicMock()
    agent.session.client = "old_client"
    agent.session.model = "old-model-id"

    config = MagicMock()
    config.planify_base_url = "https://new.api.url"
    config.planify_api_key = "sk-new-key"
    config.planify_model_id = "claude-sonnet-4-6"

    with patch("doclens.agent_integration.init_anthropic_client", return_value="new_client") as mock_init:
        agent.apply_config(config)

    mock_init.assert_called_once_with("https://new.api.url", "sk-new-key")
    assert agent.session.client == "new_client"
    assert agent.session.model == "claude-sonnet-4-6"


def test_apply_config_does_not_crash_when_session_is_none():
    from doclens.agent_integration import CortexAgent

    agent = CortexAgent(Path("/tmp/fake"))
    agent.session = None  # Not yet initialized

    config = MagicMock()
    config.planify_base_url = None
    config.planify_api_key = None
    config.planify_model_id = "claude-opus-4-6"

    # Should be a no-op, not raise
    agent.apply_config(config)
    assert agent.session is None
