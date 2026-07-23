"""CortexConfig 的 MCP server 配置字段。"""
from doclens.config import CortexConfig


def test_mcp_defaults():
    """未设置环境变量时，MCP 字段使用安全默认值。"""
    c = CortexConfig(_env_file=None)
    assert c.mcp_enabled is True
    assert c.mcp_port == 7880
    assert c.mcp_host == "127.0.0.1"
    assert c.mcp_token is None


def test_mcp_env_override(monkeypatch):
    """CORTEX_MCP_* 环境变量覆盖默认值。"""
    monkeypatch.setenv("CORTEX_MCP_ENABLED", "false")
    monkeypatch.setenv("CORTEX_MCP_PORT", "9001")
    monkeypatch.setenv("CORTEX_MCP_HOST", "0.0.0.0")
    monkeypatch.setenv("CORTEX_MCP_TOKEN", "secret")
    c = CortexConfig(_env_file=None)
    assert c.mcp_enabled is False
    assert c.mcp_port == 9001
    assert c.mcp_host == "0.0.0.0"
    assert c.mcp_token == "secret"
