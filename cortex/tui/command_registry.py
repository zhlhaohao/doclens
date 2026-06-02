"""命令注册表 - 统一管理所有斜杠命令（内置命令 + skill 命令）"""

from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass(frozen=True)
class Command:
    """斜杠命令定义"""

    name: str
    handler: Callable  # (app, arg: str) -> None
    description: str = ""
    aliases: tuple[str, ...] = ()
    is_skill: bool = False


class CommandRegistry:
    """统一管理所有斜杠命令（内置命令 + skill 命令）"""

    def __init__(self) -> None:
        self._commands: dict[str, Command] = {}  # canonical name -> Command
        self._alias_map: dict[str, str] = {}  # alias -> canonical name

    def register(self, cmd: Command) -> None:
        """注册一个命令"""
        self._commands[cmd.name] = cmd
        for alias in cmd.aliases:
            self._alias_map[alias] = cmd.name

    def resolve(self, raw: str) -> Optional[Command]:
        """通过名称或别名查找命令，未找到返回 None"""
        canonical = self._alias_map.get(raw) or (
            raw if raw in self._commands else None
        )
        if canonical is None:
            return None
        return self._commands.get(canonical)

    def match(self, prefix: str) -> list[Command]:
        """前缀匹配，返回所有名称或别名以 prefix 开头的命令（去重）"""
        prefix = prefix.lower()
        seen: set[str] = set()
        results: list[Command] = []

        for name, cmd in self._commands.items():
            if name.startswith(prefix):
                if name not in seen:
                    seen.add(name)
                    results.append(cmd)
            else:
                for alias in cmd.aliases:
                    if alias.startswith(prefix):
                        if name not in seen:
                            seen.add(name)
                            results.append(cmd)
                        break

        return results

    def all_commands(self) -> list[Command]:
        """返回全部命令，按名称排序"""
        return sorted(self._commands.values(), key=lambda c: c.name)
