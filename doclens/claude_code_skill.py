"""Claude Code skill 同步：启动时把 kb-ask skill 装到 ~/.claude/skills/。

源 skill 随 doclens 包分发（doclens/claude_code_skills/kb-ask/skill.md）。
TUI / GUI 启动时调用 ensure_claude_code_skill()：
  - 目标不存在 → 提示安装
  - 目标内容不一致 → 提示覆盖
  - 一致 → 静默
交互提示仅在 tty 下进行（非交互终端跳过，不卡死）。
"""
from __future__ import annotations

import logging
import shutil
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

SKILL_NAME = "kb-ask"
SKILL_FILENAME = "skill.md"


def _source_skill_file() -> Path:
    """包内源 skill：doclens/claude_code_skills/kb-ask/skill.md。"""
    return Path(__file__).parent / "claude_code_skills" / SKILL_NAME / SKILL_FILENAME


def _target_skill_file() -> Path:
    """Claude Code 用户技能目录：~/.claude/skills/kb-ask/skill.md。"""
    return Path.home() / ".claude" / "skills" / SKILL_NAME / SKILL_FILENAME


def skill_status(src_file: Path, tgt_file: Path) -> str:
    """比较源/目标 skill 文件，返回 'missing' | 'outdated' | 'ok'。"""
    if not tgt_file.exists():
        return "missing"
    if src_file.read_text(encoding="utf-8") == tgt_file.read_text(encoding="utf-8"):
        return "ok"
    return "outdated"


def install_skill(src_file: Path, tgt_file: Path) -> None:
    """把源 skill 拷到目标（自动创建父目录）。"""
    tgt_file.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_file, tgt_file)


def ensure_claude_code_skill(interactive: bool = True) -> bool:
    """启动检查：必要时提示并安装/覆盖 kb-ask 到 ~/.claude/skills/。

    Returns:
        True 表示执行了安装/覆盖；False 表示一致、跳过或源缺失。
    """
    src_file = _source_skill_file()
    if not src_file.exists():
        logger.debug("源 skill 不存在，跳过同步: %s", src_file)
        return False

    tgt_file = _target_skill_file()
    status = skill_status(src_file, tgt_file)
    if status == "ok":
        return False

    verb = "安装" if status == "missing" else "覆盖（更新）"

    if interactive and not sys.stdin.isatty():
        logger.info(
            "检测到 Claude Code skill '%s' 需要%s，但当前非交互终端，已跳过。"
            "可手动: cp %s %s",
            SKILL_NAME, verb, src_file, tgt_file,
        )
        return False

    if interactive:
        try:
            ans = input(
                f"\n检测到 Claude Code skill '{SKILL_NAME}' 需要{verb}到\n  {tgt_file}\n是否{verb}? [Y/n] "
            ).strip().lower()
        except (EOFError, KeyboardInterrupt):
            return False
        if ans not in ("", "y", "yes"):
            print(f"已跳过 '{SKILL_NAME}' skill 的{verb}。")
            return False

    install_skill(src_file, tgt_file)
    print(f"已{verb} Claude Code skill '{SKILL_NAME}' -> {tgt_file}")
    return True
