"""tests 全局隔离层：跨测试泄漏的统一防御。

防两类顺序性污染（2026-09-14 排查：全量跑时 test_search_preset_params ×3
与 test_tool_whitelist ×1 失败，单独跑全过；stash 对照证明与功能改动无关）：

1. **进程 env 污染**：部分链路（web_v2 deps.reload / agent_integration）调
   ``load_dotenv(override=True)`` 会把真实 ``~/.cortex/.env`` 的用户配置
   （CORTEX_* / PLANIFY_*，如激活过搜索预设物化的 CORTEX_MAX_SPAN）灌进
   ``os.environ`` 且不清理。pydantic-settings 中 env vars 优先于默认值与
   ``_env_file``，此后所有 CortexConfig 构造都被污染（默认值断言、
   假 .env 读回断言双双失真）。
2. **工具注册表全局泄漏**：``planify.tools.registry`` 的模块级
   ``_external_tools`` 经 ``register_external_tools()`` 累积追加从不重置——
   触发过宿主装配的测试会把 KB 外部工具泄漏给后续所有
   ``build_tool_registry`` 调用。

每个测试开始时统一清理；monkeypatch 在 teardown 自动恢复原值（shell 预置
的 env、装配后的注册表在各自测试内仍可用）。
"""
import os

import pytest

import planify.tools.registry as _tool_registry

_ENV_PREFIXES = ("CORTEX_", "PLANIFY_", "TREESEARCH_")


@pytest.fixture(autouse=True)
def _isolate_runtime_globals(monkeypatch: pytest.MonkeyPatch):
    """清进程 env 三命名空间 + 重置外部工具注册表（每测试一份干净基线）。"""
    for key in list(os.environ):
        if key.startswith(_ENV_PREFIXES):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(_tool_registry, "_external_tools", [])
    monkeypatch.setattr(_tool_registry, "_external_handlers", {})
