"""jimeng stdio server 真实子进程 e2e（无 API Key 也能验证的部分）。

复用 test_mcp_client_e2e 的形态：真实 spawn `python -m doclens.jimeng`
子进程 → 握手 → list_tools → 跨线程调用（无 key → 可读错误文本）。
真实生成链路（Ark HTTP + 下载）需要 key，不在自动化测试范围——
由 test_jimeng.py 的 mock 层覆盖逻辑。
"""
import sys
import time
from pathlib import Path

import pytest

from doclens.config import CortexConfig
from doclens.web_v2 import mcp_servers_store


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    monkeypatch.setattr(mcp_servers_store, "get_global_cortex_dir", lambda: Path(tmp_path))
    # 隔离配置加载：无 key（默认）状态
    monkeypatch.setattr(CortexConfig, "load", classmethod(lambda cls: cls()))
    yield


class _FakeRuntime:
    def __init__(self):
        self.tools = []
        self.tool_handlers = {}


def _wait_builtin_ok(mgr, timeout=40.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        for s in mgr.status_snapshot():
            if s.get("builtin") and s["status"] == "ok":
                return s
        time.sleep(0.3)
    return None


def test_stdio_server_handshake_and_no_key_error(monkeypatch, tmp_path):
    """真实子进程：握手 + 工具注册名 + 无 key 报错文本（agent 可读）。"""
    from doclens import mcp_client
    from doclens.mcp_client import McpClientManager

    # 直接把 jimeng server 当 stdio 条目测（等价于内置注册 spawn 的形态）；
    # 不走 builtin_server_configs 的 key 门槛——子进程内 CortexConfig.load
    # 被 monkeypatch 到无 key 状态，验证的是 server 侧报错路径。
    #
    # PYTHONPATH 指向本仓库根：worktree 开发形态下 venv 的 editable finder
    # MAPPING 写死指向主仓（../cortex），子进程 import doclens 会解析到主仓
    # 副本（没有 jimeng 模块）——前置本仓路径保证测的是本仓代码。
    repo_root = str(Path(__file__).resolve().parent.parent)
    monkeypatch.setattr(mcp_client, "RECONCILE_INTERVAL", 0.2)
    monkeypatch.chdir(tmp_path)

    created = mcp_servers_store.create_server({
        "name": "jimeng",
        "transport": "stdio",
        "command": sys.executable,
        "args": ["-m", "doclens.jimeng"],
        # JIMENG_API_KEY="" 显式清空：子进程不受本进程 monkeypatch 影响，
        # 会读真实全局 .env（开发机已配 key）——不覆盖就会真实调 Ark 花钱。
        # CortexConfig 读取链 env > .env，空 env 变量覆盖 .env 值。
        "env": {"PYTHONPATH": repo_root, "JIMENG_API_KEY": ""},
        "timeout": 15,
    })
    sid = created["id"]

    rt = _FakeRuntime()
    mgr = McpClientManager()
    try:
        assert mgr.start(runtime=rt)
        snap = None
        deadline = time.time() + 40.0
        while time.time() < deadline:
            for s in mgr.status_snapshot():
                if s["server_id"] == sid and s["status"] == "ok":
                    snap = s
                    break
            if snap:
                break
            time.sleep(0.3)
        assert snap is not None, mgr.status_snapshot()
        assert snap["tool_count"] == 1

        names = [t["name"] for t in rt.tools]
        assert "mcp__jimeng__generate" in names
        tool_def = next(t for t in rt.tools if t["name"] == "mcp__jimeng__generate")
        assert "prompt" in tool_def["input_schema"].get("properties", {})
        assert tool_def["input_schema"].get("required") == ["prompt"]

        # 无 key：跨线程真实调用 → 可读错误（不是堆栈、不是静默）
        handler = rt.tool_handlers["mcp__jimeng__generate"]
        result = handler(prompt="一只猫")
        assert result.startswith("Error:")
        assert "JIMENG_API_KEY" in result
    finally:
        mgr.stop()


def test_builtin_registration_in_reconcile(monkeypatch, tmp_path):
    """内置注册：配 key 才出现在 reconcile 快照并真实连上。"""
    from doclens import mcp_client
    from doclens.mcp_client import McpClientManager

    cfg = CortexConfig(jimeng_api_key="test-key-not-real")
    monkeypatch.setattr(CortexConfig, "load", classmethod(lambda cls: cfg))
    monkeypatch.setattr(mcp_client, "RECONCILE_INTERVAL", 0.2)
    monkeypatch.chdir(tmp_path)
    # 同上：worktree 形态下让子进程解析本仓 doclens（jimeng 模块）
    repo_root = str(Path(__file__).resolve().parent.parent)
    monkeypatch.setattr(
        mcp_client,
        "builtin_server_configs",
        lambda: [{
            "id": mcp_client.BUILTIN_ID_PREFIX + "jimeng",
            "name": "jimeng",
            "transport": "stdio",
            "command": sys.executable,
            "args": ["-m", "doclens.jimeng"],
            "env": {"PYTHONPATH": repo_root},
            "cwd": None,
            "timeout": 15,
            "enabled": True,
        }],
    )

    rt = _FakeRuntime()
    mgr = McpClientManager()
    try:
        assert mgr.start(runtime=rt)
        snap = _wait_builtin_ok(mgr)
        assert snap is not None, mgr.status_snapshot()
        assert snap["builtin"] is True
        names = [t["name"] for t in rt.tools]
        assert "mcp__jimeng__generate" in names

        # key 移除（内置条目从快照消失）→ 同一 manager 下轮 reconcile
        # 收割连接 → 工具表同步下架
        monkeypatch.setattr(
            mcp_client,
            "builtin_server_configs",
            lambda: [],
        )
        deadline = time.time() + 30.0
        gone = False
        while time.time() < deadline:
            if "mcp__jimeng__generate" not in [t["name"] for t in rt.tools]:
                gone = True
                break
            time.sleep(0.3)
        assert gone, "key 移除后内置工具应下架"
        assert not [s for s in mgr.status_snapshot() if s.get("builtin")]
    finally:
        mgr.stop()
