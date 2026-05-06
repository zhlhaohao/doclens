"""命令路由 - 从用户输入解析为 (canonical_command, arg) 元组"""

from typing import Optional, Tuple

# 命令别名 -> 规范命令名
COMMAND_ALIASES: dict[str, str] = {
    # 搜索
    "s": "search",
    "search": "search",
    # 索引
    "i": "index",
    "index": "index",
    "reindex": "index",
    # 状态
    "stats": "status",
    "status": "status",
    "st": "status",
    "t": "status",
    # 退出
    "q": "quit",
    "quit": "quit",
    "exit": "quit",
    "e": "quit",
    # 帮助
    "h": "help",
    "help": "help",
    "?": "help",
    # 设置
    "n": "set",
    "set": "set",
    # 清屏
    "cls": "clear",
    "cl": "clear",
    "clear": "clear",
    # AI
    "ai": "ai",
    "llm": "ai",
    "agent": "ai",
    # 压缩
    "compact": "compact",
}

# 不走别名映射的命令（直接透传）
_PASS_THROUGH = {"tasks", "team", "inbox"}


def parse_input(line: str) -> Optional[Tuple[str, str]]:
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

        if raw_cmd in _PASS_THROUGH:
            return (raw_cmd, arg)

        canonical = COMMAND_ALIASES.get(raw_cmd)
        if canonical:
            return (canonical, arg)

        # 未知命令原样返回
        return (raw_cmd, arg)

    # 无斜杠前缀 -> Agent 对话
    return ("ai", line)
