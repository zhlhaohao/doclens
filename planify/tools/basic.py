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


# 危险命令：含空格的按子串匹配，单词按整词匹配（避免 "dd" 误伤 "yyyy-MM-dd"）
_DANGEROUS_SUBSTRINGS = ["rm -rf /", "> /dev/"]
_DANGEROUS_WORDS = {"sudo", "shutdown", "reboot", "mkfs", "dd"}


def _is_dangerous(command: str) -> bool:
    """检查命令是否命中危险命令过滤"""
    if any(s in command for s in _DANGEROUS_SUBSTRINGS):
        return True
    tokens = set(command.replace(";", " ").replace("&", " ").replace("|", " ").split())
    return bool(tokens & _DANGEROUS_WORDS)


def _find_bash_path() -> str:
    """查找 bash 可执行文件路径

    Windows 环境下依次尝试：
    1. 常见 Git Bash 安装路径
    2. shutil.which() 查找 PATH 中的 bash（兜底，可能命中 WSL 的 bash）
    """
    # 1. 优先匹配常见 Git Bash 安装路径（避免误用 WSL 的 bash.exe）
    possible_paths = [
        r"C:\Program Files\Git\usr\bin\bash.exe",
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Git\bin\bash.exe"),
    ]
    for path in possible_paths:
        if os.path.isfile(path):
            return path

    # 2. 兜底：PATH 查找，排除 WSL 的 bash（System32 下的 bash.exe 是 WSL 启动器）
    bash_path = shutil.which("bash") or shutil.which("bash.exe")
    if bash_path and "system32" not in bash_path.lower():
        return bash_path

    return None


def _find_windows_shell() -> tuple:
    """查找 Windows 原生 shell 可执行文件

    按优先级依次尝试：
    1. PowerShell 7 (pwsh.exe)
    2. Windows PowerShell 5.1 (powershell.exe)
    3. cmd.exe（必然存在）

    Returns:
        (exe_path, kind) 元组，kind ∈ {"pwsh", "powershell", "cmd"}；
        非 Windows 平台返回 None
    """
    if platform.system() != "Windows":
        return None

    # 1. PowerShell 7
    pwsh_path = shutil.which("pwsh") or shutil.which("pwsh.exe")
    if not pwsh_path:
        candidate = r"C:\Program Files\PowerShell\7\pwsh.exe"
        if os.path.isfile(candidate):
            pwsh_path = candidate
    if pwsh_path:
        return (pwsh_path, "pwsh")

    # 2. Windows PowerShell 5.1（固定在 SystemRoot 下，PATH 不一定包含）
    powershell_path = shutil.which("powershell") or shutil.which("powershell.exe")
    if not powershell_path:
        candidate = os.path.join(
            os.environ.get("SystemRoot", r"C:\Windows"),
            r"System32\WindowsPowerShell\v1.0\powershell.exe",
        )
        if os.path.isfile(candidate):
            powershell_path = candidate
    if powershell_path:
        return (powershell_path, "powershell")

    # 3. cmd 兜底
    return (os.environ.get("COMSPEC", "cmd.exe"), "cmd")


def _build_shell_argv(exe_path: str, kind: str, command: str) -> list:
    """按 shell 类型构建命令行参数

    统一强制 UTF-8 输出，避免中文系统 GBK 代码页导致解码乱码；
    PowerShell 7 同时关闭 ANSI 颜色渲染，保证输出为纯文本。
    """
    if kind in ("pwsh", "powershell"):
        wrapped = (
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
            "if ($PSStyle) { $PSStyle.OutputRendering = 'PlainText' }; "
            f"{command}"
        )
        return [exe_path, "-NoProfile", "-NonInteractive", "-Command", wrapped]
    # cmd：先切 UTF-8 代码页再执行
    return [exe_path, "/c", f"chcp 65001>nul & {command}"]


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
    if _is_dangerous(command):
        return "Error: Dangerous command blocked"

    try:
        workdir = Path(workdir)
        if not workdir.exists():
            workdir.mkdir(parents=True, exist_ok=True)

        # 检测 Windows 环境并使用 bash 包装命令
        if platform.system() == "Windows":
            bash_path = _find_bash_path()
            if not bash_path:
                # 没有 Git Bash，回退到 Windows 原生 shell（pwsh → powershell → cmd）
                return run_powershell(command, workdir)
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


def run_powershell(command: str, workdir: Path) -> str:
    """
    执行 Windows 原生 shell 命令

    按优先级选择 shell：PowerShell 7 (pwsh) → Windows PowerShell → cmd。
    安全措施与 run_bash 一致：
    - 危险命令过滤
    - 超时保护（20 秒）
    - 输出截断（50000 字符）

    Args:
        command: 要执行的命令（PowerShell 或 cmd 语法，取决于解析到的 shell）
        workdir: 命令执行的工作目录

    Returns:
        命令的 stdout 和 stderr，或错误信息
    """
    if platform.system() != "Windows":
        return "Error: powershell tool is only available on Windows"

    if _is_dangerous(command):
        return "Error: Dangerous command blocked"

    shell = _find_windows_shell()
    if not shell:
        return "Error: no Windows shell found"
    exe_path, kind = shell

    try:
        workdir = Path(workdir)
        if not workdir.exists():
            workdir.mkdir(parents=True, exist_ok=True)

        argv = _build_shell_argv(exe_path, kind, command)
        logger.debug("[powershell] Executing: %s (%s) in %s", argv, kind, workdir)
        r = subprocess.run(
            argv,
            shell=False,
            cwd=str(workdir),
            capture_output=True,
            timeout=20,
        )

        # 确保输出使用 UTF-8 解码，失败时替换不可编码字符
        out = (
            r.stdout.decode("utf-8", errors="replace")
            + r.stderr.decode("utf-8", errors="replace")
        ).strip()[:50000]
        return out if out else "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: Timeout (20s)"
    except Exception as e:
        return f"Error: {str(e).encode('utf-8', errors='replace').decode('utf-8')}"


# CJK 统一表意文字 + 扩展A + 兼容表意 + 日文假名 + 谚文（中文一字一词的判定范围）
_CJK_RANGES = (
    (0x4E00, 0x9FFF),    # CJK 统一表意文字
    (0x3400, 0x4DBF),    # 扩展 A
    (0xF900, 0xFAFF),    # 兼容表意
    (0x3040, 0x30FF),    # 日文假名
    (0xAC00, 0xD7AF),    # 谚文音节
)


def _is_cjk(ch: str) -> bool:
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in _CJK_RANGES)


def split_words_with_seps(text: str) -> list[tuple[str, str]]:
    """切词（保留分隔符）：CJK 每字一词；非 CJK 连续段按空白切分。

    返回 (word, sep) 列表，sep 为该词后随的原始空白串（含换行/缩进）——
    切片后 join 可无损还原原文格式。序号对同一文本确定（无词典依赖）。
    doclens 的 read_document 与本模块共用此定义，两工具词序号语义一致。
    """
    words: list[tuple[str, str]] = []
    n = len(text)
    i = 0
    while i < n:
        if text[i].isspace():
            i += 1
            continue
        start = i
        if _is_cjk(text[i]):
            i += 1
        else:
            while i < n and not text[i].isspace() and not _is_cjk(text[i]):
                i += 1
        j = i
        while j < n and text[j].isspace():
            j += 1
        words.append((text[start:i], text[i:j]))
        i = j
    return words


def join_word_slice(pairs: list[tuple[str, str]]) -> str:
    """把 (word, sep) 切片拼回文本：词间保留原始分隔符，无损还原格式。"""
    return "".join(w + s for w, s in pairs).rstrip()


# read_file 输出字符预算（防超长文件撑爆上下文）
READ_FILE_MAX_CHARS = 50000


def run_read(
    path: str,
    workdir: Path,
    start_word: int = None,
    end_word: int = None,
) -> str:
    """
    读取文件内容（纯文本），支持按词序号切片。

    词的定义：中日韩文字每字算一词，其余按空白切分（英文单词/数字各一词）。
    序号 1-based 闭区间。不传词参数时读全文（超预算按词边界截断并给续读提示）。

    Args:
        path: 相对文件路径
        workdir: 工作目录，用于路径解析
        start_word: 起始词序号（可选）
        end_word: 结束词序号（可选，含该词）

    Returns:
        文件内容（可能被截断，截断时附续读提示）
    """
    try:
        # 显式指定 UTF-8 编码，遇到错误时替换
        file_path = safe_path(path, workdir)
        content = file_path.read_text(encoding="utf-8", errors="replace")
        pairs = split_words_with_seps(content)
        total = len(pairs)

        if start_word is None and end_word is None:
            if len(content) <= READ_FILE_MAX_CHARS:
                return content
            # 按词边界截到预算内（保留原文格式），并给续读提示
            acc_len = 0
            keep = 0
            for idx, (w, s) in enumerate(pairs):
                if acc_len + len(w) + len(s) > READ_FILE_MAX_CHARS:
                    break
                acc_len += len(w) + len(s)
                keep = idx + 1
            out = join_word_slice(pairs[:keep])
            return (
                out
                + f"\n\n（内容已截断。使用 start_word={keep + 1} 续读后续内容。全文共 {total} 词。）"
            )

        start_idx = max((start_word or 1) - 1, 0)
        end_idx = min(end_word if end_word is not None else total, total)
        if start_idx >= total or end_idx <= start_idx:
            return f"（指定范围内无内容。全文共 {total} 词，start_word 应 ≤ {total}。）"

        sliced = pairs[start_idx:end_idx]
        joined = join_word_slice(sliced)
        extra = ""
        shown = len(sliced)
        if len(joined) > READ_FILE_MAX_CHARS:
            acc: list[tuple[str, str]] = []
            size = 0
            for w, s in sliced:
                if size + len(w) + len(s) > READ_FILE_MAX_CHARS:
                    break
                acc.append((w, s))
                size += len(w) + len(s)
            joined = join_word_slice(acc)
            shown = len(acc)
            extra = (
                f"\n\n（内容已截断。使用 start_word={start_idx + len(acc) + 1} 续读后续内容。）"
            )

        return (
            f"[第 {start_idx + 1}-{start_idx + shown} 词 / 共 {total} 词]\n"
            + joined
            + extra
        )
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
        "powershell": lambda **kw: run_powershell(kw["command"], workdir),
        "read_file": lambda **kw: run_read(
            kw["path"], workdir, kw.get("start_word"), kw.get("end_word")
        ),
        "write_file": lambda **kw: run_write(kw["path"], kw["content"], workdir),
        "edit_file": lambda **kw: run_edit(
            kw["path"], kw["old_text"], kw["new_text"], workdir
        ),
    }
