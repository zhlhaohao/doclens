"""命令路由 - 解析用户输入并利用 CommandRegistry 进行分发"""

from typing import Optional, Tuple

from cortex.tui.command_registry import Command, CommandRegistry


def build_builtin_registry() -> CommandRegistry:
    """构建内置命令注册表（不含 skill 命令）"""
    registry = CommandRegistry()

    # -- 搜索 --
    registry.register(Command(
        name="search",
        handler="_cmd_search",
        description="搜索文档",
        aliases=("s", "search"),
    ))
    registry.register(Command(
        name="grep",
        handler="_cmd_grep",
        description="正则搜索(索引)",
        aliases=("grep", "g"),
    ))
    registry.register(Command(
        name="ripgrep",
        handler="_cmd_ripgrep",
        description="正则搜索(磁盘)",
        aliases=("ripgrep", "rg"),
    ))

    # -- 索引 --
    registry.register(Command(
        name="index",
        handler="_cmd_index",
        description="重建索引",
        aliases=("i", "index", "reindex"),
    ))

    # -- 状态 --
    registry.register(Command(
        name="status",
        handler="_cmd_status",
        description="显示状态",
        aliases=("stats", "status", "st", "t"),
    ))

    # -- 导航 --
    registry.register(Command(
        name="quit",
        handler="_cmd_quit",
        description="退出",
        aliases=("q", "quit", "exit", "e"),
    ))
    registry.register(Command(
        name="help",
        handler="_cmd_help",
        description="帮助",
        aliases=("h", "help", "?"),
    ))
    registry.register(Command(
        name="clear",
        handler="_cmd_clear",
        description="清屏",
        aliases=("cls", "cl", "clear"),
    ))

    # -- AI --
    registry.register(Command(
        name="ai",
        handler="_cmd_ai",
        description="Agent 对话",
        aliases=("ai", "llm", "agent"),
    ))
    registry.register(Command(
        name="compact",
        handler="_cmd_compact",
        description="压缩对话历史",
        aliases=("compact",),
    ))

    # -- 网络 --
    registry.register(Command(
        name="web",
        handler="_cmd_web",
        description="网络搜索",
        aliases=("web", "w"),
    ))
    registry.register(Command(
        name="webfetch",
        handler="_cmd_webfetch",
        description="网页抓取",
        aliases=("webfetch", "wf"),
    ))

    # -- 工具 --
    registry.register(Command(
        name="copy",
        handler="_cmd_copy",
        description="复制上次输出",
        aliases=("copy", "cp"),
    ))
    registry.register(Command(
        name="set",
        handler="_cmd_set",
        description="设置参数",
        aliases=("n", "set"),
    ))

    # -- Agent 管理 --
    registry.register(Command(
        name="tasks",
        handler="_cmd_agent_slash",
        description="查看任务",
        aliases=("tasks",),
    ))
    registry.register(Command(
        name="team",
        handler="_cmd_agent_slash",
        description="查看团队",
        aliases=("team",),
    ))
    registry.register(Command(
        name="inbox",
        handler="_cmd_agent_slash",
        description="查看收件箱",
        aliases=("inbox",),
    ))
    registry.register(Command(
        name="failed",
        handler="_cmd_agent_slash",
        description="查看解析失败文件",
        aliases=("failed",),
    ))
    registry.register(Command(
        name="clearfailed",
        handler="_cmd_agent_slash",
        description="清空失败记录",
        aliases=("clearfailed",),
    ))

    return registry


def parse_input(line: str, registry: CommandRegistry) -> Optional[Tuple[str, str]]:
    """解析用户输入。

    Returns:
        None 表示空输入或命令不完整
        ("ai", text) 表示无前缀的自然语言输入
        (canonical_cmd, arg) 表示斜杠命令
    """
    line = line.strip()
    if not line:
        return None

    # 中文顿号转斜杠
    if line.startswith("\u3001"):
        line = "/" + line[1:]

    if line.startswith("/"):
        parts = line[1:].split(maxsplit=1)
        if not parts or not parts[0]:
            return None
        raw_cmd = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""

        # 通过 registry 解析
        cmd = registry.resolve(raw_cmd)
        if cmd:
            return (cmd.name, arg)

        # 未注册的命令原样返回（会在 dispatch 中报"未知命令"）
        return (raw_cmd, arg)

    # 无斜杠前缀 -> Agent 对话
    return ("ai", line)
