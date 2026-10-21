"""git 子进程的统一执行原语（AP-42）。

两处曾各自 ``subprocess.run(text=True)`` 且部分调用漏了编码：Windows 上
Python 按 locale（cp936）解码 git 输出的 UTF-8 路径，``--show-toplevel``
变成乱码 → ``normcase`` 比较失败 → 中文路径知识库被判「不是 git 根」，
GitSync 整体停摆、``/api/git/*`` 一律 400。

so 统一收口：**所有** git 调用经本模块，固定 ``encoding="utf-8",
errors="replace"``（git 在 Windows 上也输出 UTF-8 路径，与 locale 无关）。
"""
from __future__ import annotations

import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

#: 本地 git 操作（add/commit/status/rev-parse 类）超时
GIT_TIMEOUT_LOCAL = 30
#: 网络操作（pull/push/fetch）超时
GIT_TIMEOUT_NET = 120

#: git 输出的解码口径——不可省略，见模块 docstring。
_GIT_TEXT_KW = {"text": True, "encoding": "utf-8", "errors": "replace"}


def run_git(
    root: str | Path,
    *args: str,
    timeout: int = GIT_TIMEOUT_LOCAL,
) -> Optional[subprocess.CompletedProcess]:
    """在 ``root`` 下执行 git 命令。

    Returns:
        ``CompletedProcess``；git 不存在 / 超时 / 其他 OSError 时返回 None
        （不抛——调用方各自决定是「静默降级」还是「映射为 API 错误」）。
    """
    try:
        return subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            timeout=timeout,
            **_GIT_TEXT_KW,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        logger.warning("git %s 执行异常: %s", args[0] if args else "", e)
        return None


def is_git_root(root: str | Path) -> bool:
    """``root`` 本身是否为 git 仓库根（而非某个子目录）。

    单一口径：``doclens/git_sync.py`` 与 ``web_v2/api/git.py`` 共用本函数
    ——曾各写一份，任一侧改口径（加子仓库判定/编码修复）另一侧不同步。
    """
    r = run_git(root, "rev-parse", "--show-toplevel")
    if r is None or r.returncode != 0:
        return False
    top = os.path.normcase(os.path.abspath(r.stdout.strip()))
    return top == os.path.normcase(os.path.abspath(str(root)))
