"""基础工具函数 (s02)

提供文件操作和命令执行基础工具。

所有路径操作都通过安全检查，确保工作目录不被逃逸。
命令执行具有以下安全措施：
- 危险命令过滤（rm -rf /, sudo, shutdown, 等）
- 超时保护（120 秒）
- 输出截断（50000 字符）

"""

import logging
import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)


def _find_bash_path() -> str:
    """查找 bash 可执行文件路径

    Windows 环境下依次尝试：
    1. shutil.which() 查找 PATH 中的 bash
    2. 常见 Git Bash 安装路径
    """
    # 1. 优先使用 shutil.which 查找
    bash_path = shutil.which("bash") or shutil.which("bash.exe")
    if bash_path:
        return bash_path

    # 3. Windows 下常见 Git Bash 安装路径
    possible_paths = [
        r"C:\Program Files\Git\usr\bin\bash.exe",
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Git\bin\bash.exe"),
    ]
    for path in possible_paths:
        if os.path.isfile(path):
            return path

    return None


def safe_path(p: str, workdir: Path) -> Path:
    """
    安全路径解析

    将相对路径解析为绝对路径，并检查是否在工作目录内。
    防止路径遍历攻击（如 ../../../etc/passwd）。

    Args:
        p: 相对路径字符串
        workdir: 工作目录，用于限制路径

    Returns:
        解析后的绝对路径

    Raises:
        ValueError: 如果路径逃逸工作空间
    """
    path = (workdir / p).resolve()
    if not path.is_relative_to(workdir):
        raise ValueError(f"Path escapes workspace: {p}")
    return path


def run_bash(command: str, workdir: Path) -> str:
    """
    执行 shell 命令

    在沙盒环境中执行命令，包含以下安全措施：
    - 危险命令过滤（rm -rf /, sudo, shutdown, reboot 等）
    - 超时保护（20 秒）
    - 输出截断（50000 字符）

    Args:
        command: 要执行的 shell 命令
        workdir: 命令执行的工作目录

    Returns:
        命令的 stdout 和 stderr，或错误信息
    """
    dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/", "mkfs", "dd"]
    if any(d in command for d in dangerous):
        return "Error: Dangerous command blocked"

    try:
        workdir = Path(workdir)
        if not workdir.exists():
            workdir.mkdir(parents=True, exist_ok=True)

        # 检测 Windows 环境并使用 bash 包装命令
        if platform.system() == "Windows":
            bash_path = _find_bash_path()
            if not bash_path:
                return "Error: bash not found on Windows"
            # 使用 bash -c 包装命令
            logger.debug("[bash] Executing: %s -c '%s' in %s", bash_path, command, workdir)
            r = subprocess.run(
                [bash_path, "-c", command],
                shell=False,
                cwd=str(workdir),
                capture_output=True,
                timeout=20,
            )
        else:
            # Unix 环境直接使用 shell
            logger.debug("[bash] Executing: %s in %s", command, workdir)
            r = subprocess.run(
                command, shell=True, cwd=str(workdir), capture_output=True, timeout=120
            )

        # 确保输出使用 UTF-8 解码，失败时替换不可编码字符
        try:
            out = (
                r.stdout.decode("utf-8", errors="replace")
                + r.stderr.decode("utf-8", errors="replace")
            ).strip()[:50000]
        except UnicodeDecodeError:
            # 如果解码失败，尝试使用系统默认编码
            out = (
                r.stdout.decode("utf-8", errors="replace")
                + r.stderr.decode("utf-8", errors="replace")
            ).strip()[:50000]
        return out if out else "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: Timeout (20s)"
    except Exception as e:
        return f"Error: {str(e).encode('utf-8', errors='replace').decode('utf-8')}"


def run_read(path: str, workdir: Path, limit: int = None) -> str:
    """
    读取文件内容

    Args:
        path: 相对文件路径
        workdir: 工作目录，用于路径解析
        limit: 可选的行数限制

    Returns:
        文件内容（可能被截断）
    """
    try:
        # 显式指定 UTF-8 编码，遇到错误时替换
        file_path = safe_path(path, workdir)
        content = file_path.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()
        if limit and limit < len(lines):
            lines = lines[:limit] + [f"... ({len(lines) - limit} more)"]
        return "\n".join(lines)[:50000]
    except Exception as e:
        error_msg = f"Error: {e}".encode("utf-8", errors="replace").decode("utf-8")
        return error_msg


def run_write(path: str, content: str, workdir: Path) -> str:
    """
    写入文件内容

    自动创建父目录（如果不存在）。

    Args:
        path: 相对文件路径
        content: 要写入的内容
        workdir: 工作目录，用于路径解析

    Returns:
        操作结果信息
    """
    try:
        fp = safe_path(path, workdir)
        fp.parent.mkdir(parents=True, exist_ok=True)
        # 确保内容是字符串，使用 UTF-8 编码
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="replace")
        fp.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} bytes to {path}"
    except Exception as e:
        error_msg = f"Error: {e}".encode("utf-8", errors="replace").decode("utf-8")
        return error_msg


def run_edit(path: str, old_text: str, new_text: str, workdir: Path) -> str:
    """
    编辑文件

    完全匹配并替换文本的第一个出现位置。

    Args:
        path: 相对文件路径
        old_text: 要替换的文本
        new_text: 新文本
        workdir: 工作目录，用于路径解析

    Returns:
        操作结果信息
    """
    try:
        fp = safe_path(path, workdir)
        # 显式指定 UTF-8 编码读取
        c = fp.read_text(encoding="utf-8", errors="replace")
        if old_text not in c:
            return f"Error: Text not found in {path}"
        # 显式指定 UTF-8 编码写入
        fp.write_text(c.replace(old_text, new_text, 1), encoding="utf-8")
        return f"Edited {path}"
    except Exception as e:
        error_msg = f"Error: {e}".encode("utf-8", errors="replace").decode("utf-8")
        return error_msg


def make_basic_tools(workdir: Path) -> dict:
    """
    创建基础工具处理器字典

    Args:
        workdir: 工作目录，用于操作

    Returns:
        工具名称到处理器函数的字典
    """
    return {
        "bash": lambda **kw: run_bash(kw["command"], workdir),
        "read_file": lambda **kw: run_read(kw["path"], workdir, kw.get("limit")),
        "write_file": lambda **kw: run_write(kw["path"], kw["content"], workdir),
        "edit_file": lambda **kw: run_edit(
            kw["path"], kw["old_text"], kw["new_text"], workdir
        ),
    }
