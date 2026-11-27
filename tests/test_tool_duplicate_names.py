"""工具表同名重复回归（DeepSeek 400 "Tool names must be unique"，2026-11-26）。

回归背景：``register_external_tools`` 的模块级全局表只 ``extend`` 不去重。
宿主切换工作目录 / 配置重载会重装配 agent（``reset_singletons`` 只置
``_agent = None``，全局外部工具表不清），同一进程内第 N 次装配把 KB/grep
工具追加成 N 份同名定义 → DeepSeek anthropic 兼容端点直接 400，而该会话
用其他模型时可能不报错，表现为「换个模型就坏」。

两道防线：
1. ``register_external_tools`` 按名去重（后注册覆盖）——治本。
2. ``build_tool_registry`` 末尾兜底去重——防其他来源的重名。
"""
from planify.tools import registry
from planify.tools.registry import build_tool_registry, register_external_tools


def _reset_external(monkeypatch):
    monkeypatch.setattr(registry, "_external_tools", [])
    monkeypatch.setattr(registry, "_external_handlers", {})
    monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)
    monkeypatch.delenv("PLANIFY_DISABLED_TOOLS", raising=False)


def _fake_kb_tool(marker: str):
    return {
        "name": "search_kb",
        "description": f"kb tool {marker}",
        "input_schema": {"type": "object", "properties": {}},
    }


def test_register_external_tools_repeated_registration_no_dupes(tmp_path, monkeypatch):
    """多次注册同名外部工具只保留一份（后注册覆盖）。"""
    _reset_external(monkeypatch)
    for i in range(5):
        register_external_tools([_fake_kb_tool(str(i))], {"search_kb": lambda: str(i)})

    ext_tools, ext_handlers = registry.get_external_tools()
    assert [t["name"] for t in ext_tools] == ["search_kb"]
    assert ext_tools[0]["description"] == "kb tool 4"  # 后注册覆盖
    assert "search_kb" in ext_handlers

    tools, _ = build_tool_registry(workdir=tmp_path)
    names = [t["name"] for t in tools]
    assert names.count("search_kb") == 1


def test_build_tool_registry_dedupes_any_source(tmp_path, monkeypatch):
    """兜底：即便工具表出现同名（如白名单过滤前的其他来源），也不重复发给模型。"""
    _reset_external(monkeypatch)
    # 模拟历史残留：外部表里已被塞入两份同名
    monkeypatch.setattr(
        registry,
        "_external_tools",
        [_fake_kb_tool("a"), _fake_kb_tool("b")],
    )
    monkeypatch.setattr(registry, "_external_handlers", {"search_kb": lambda: "x"})

    tools, handlers = build_tool_registry(workdir=tmp_path)
    names = [t["name"] for t in tools]
    assert names.count("search_kb") == 1
    assert len(names) == len(set(names))  # 全表唯一
    assert "search_kb" in handlers
    assert "bash" in names and "read_file" in names  # 内置工具未受影响
