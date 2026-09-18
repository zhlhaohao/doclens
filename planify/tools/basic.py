"""基础工具函数 (s02)

提供文件操作和命令执行基础工具。

所有路径操作都通过安全检查，确保工作目录不被逃逸。
命令执行具有以下安全措施：
- 危险命令过滤（rm -rf /, sudo, shutdown, 等）
- 超时保护（``PLANIFY_SHELL_TIMEOUT`` 可调，默认 120 秒；bash/powershell 统一）
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

# shell 工具超时默认值（秒）。经 env ``PLANIFY_SHELL_TIMEOUT`` 调整（调用期
# 现读，改 .env 重启即生效）；非法/非正值回落默认。长命令的正道是改用
# background_run 后台启动 + check_background 轮询，而非调大本值硬等。
_DEFAULT_SHELL_TIMEOUT = 120


def _shell_timeout() -> int:
    """读 PLANIFY_SHELL_TIMEOUT（非法/非正回落默认 120）。"""
    try:
        t = int(os.getenv("PLANIFY_SHELL_TIMEOUT", "").strip())
    except ValueError:
        return _DEFAULT_SHELL_TIMEOUT
    return t if t > 0 else _DEFAULT_SHELL_TIMEOUT


def _timeout_message() -> str:
    """超时返回文案：带实际秒数 + 引导模型改用后台工具（而非反复重试）。"""
    return (
        f"Error: Timeout ({_shell_timeout()}s). For long-running commands, "
        "use background_run to start the task in the background, "
        "then check_background to poll its output."
    )


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


def _resolve_tool_path(
    path: str,
    workdir: Path,
    resolve,
    write: bool,
) -> tuple:
    """结构化工具的路径解析（含门禁注入通路）。

    Args:
        path: 工具入参路径
        workdir: 工作目录
        resolve: 门禁解析函数（guard.resolve_guarded_path）；None = 旧
            safe_path 硬拒绝行为（默认，非门禁链路保持不变）
        write: 是否写语义（门禁查写账本）

    Returns:
        (Path, None) 放行；(None, error_msg) 拒绝
    """
    if resolve is not None:
        return resolve(path, workdir, write)
    try:
        return safe_path(path, workdir), None
    except Exception as e:
        return None, f"Error: {e}".encode("utf-8", errors="replace").decode("utf-8")


def run_bash(command: str, workdir: Path) -> str:
    """
    执行 shell 命令

    在沙盒环境中执行命令，包含以下安全措施：
    - 危险命令过滤（rm -rf /, sudo, shutdown, reboot 等）
    - 超时保护（PLANIFY_SHELL_TIMEOUT，默认 120 秒，Windows/Unix 统一）
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
                timeout=_shell_timeout(),
            )
        else:
            # Unix 环境直接使用 shell
            logger.debug("[bash] Executing: %s in %s", command, workdir)
            r = subprocess.run(
                command, shell=True, cwd=str(workdir), capture_output=True, timeout=_shell_timeout()
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
        return _timeout_message()
    except Exception as e:
        return f"Error: {str(e).encode('utf-8', errors='replace').decode('utf-8')}"


def run_powershell(command: str, workdir: Path) -> str:
    """
    执行 Windows 原生 shell 命令

    按优先级选择 shell：PowerShell 7 (pwsh) → Windows PowerShell → cmd。
    安全措施与 run_bash 一致：
    - 危险命令过滤
    - 超时保护（PLANIFY_SHELL_TIMEOUT，默认 120 秒）
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
            timeout=_shell_timeout(),
        )

        # 确保输出使用 UTF-8 解码，失败时替换不可编码字符
        out = (
            r.stdout.decode("utf-8", errors="replace")
            + r.stderr.decode("utf-8", errors="replace")
        ).strip()[:50000]
        return out if out else "(no output)"
    except subprocess.TimeoutExpired:
        return _timeout_message()
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

    注意：planify 的 read_file 已改用 offset/limit 按行分块（2026-09-17，
    ADR-0024），本函数仅供 doclens 的 read_document 词序号体系使用
    （doclens/kb_tools.py 导入，属有意的单一真相源），planify 内部勿新增消费方。
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
    offset: int = None,
    limit: int = None,
    resolve=None,
) -> str:
    """
    读取文件内容（纯文本），输出带行号前缀（``行号<TAB>内容``，1-based）。

    offset/limit 按行分块（offset 为起始行号，1-based；limit 为行数），
    均不传时从头读。输出超字符预算时按行截断并给续读提示。

    Args:
        path: 相对文件路径
        workdir: 工作目录，用于路径解析
        offset: 起始行号（可选，1-based，默认 1）
        limit: 读取行数（可选，默认读到预算上限）
        resolve: 门禁路径解析函数（可选；None = safe_path 硬拒绝逃逸）

    Returns:
        带行号的文件内容（可能被截断，截断时附续读提示）
    """
    try:
        file_path, err = _resolve_tool_path(path, workdir, resolve, write=False)
        if err:
            return err
        content = file_path.read_text(encoding="utf-8", errors="replace")
        if content == "":
            return "（文件为空。）"
        lines = content.splitlines()
        total = len(lines)

        start = max(offset or 1, 1)
        if start > total:
            return f"（起始行号超出文件范围。文件共 {total} 行，offset 应 ≤ {total}。）"
        limit = max(limit, 1) if limit is not None else None
        end = total if limit is None else min(start + limit - 1, total)

        # 字符预算：逐行累计（含行号+Tab 前缀开销），超预算按行截断。
        # 仅在「未显式给 limit 而被预算截断」时附续读提示——显式 limit 是
        # 调用方自己开的窗，不打扰（对齐 Claude Code）。
        shown: list[str] = []
        acc = 0
        budget_truncated = False
        for i, line in enumerate(lines[start - 1 : end]):
            acc += len(str(start + i)) + 1 + len(line)
            if acc > READ_FILE_MAX_CHARS:
                budget_truncated = True
                break
            shown.append(line)

        out = "\n".join(f"{start + i}\t{line}" for i, line in enumerate(shown))
        if budget_truncated:
            next_offset = start + len(shown)
            out += (
                f"\n\n（内容已截断：已显示第 {start}-{next_offset - 1} 行 / 共 {total} 行。"
                f"使用 offset={next_offset} 续读后续内容。）"
            )
        return out
    except Exception as e:
        error_msg = f"Error: {e}".encode("utf-8", errors="replace").decode("utf-8")
        return error_msg


def run_write(path: str, content: str, workdir: Path, resolve=None) -> str:
    """
    写入文件内容

    自动创建父目录（如果不存在）。

    Args:
        path: 相对文件路径
        content: 要写入的内容
        workdir: 工作目录，用于路径解析
        resolve: 门禁路径解析函数（可选；None = safe_path 硬拒绝逃逸）

    Returns:
        操作结果信息
    """
    try:
        fp, err = _resolve_tool_path(path, workdir, resolve, write=True)
        if err:
            return err
        fp.parent.mkdir(parents=True, exist_ok=True)
        # 确保内容是字符串，使用 UTF-8 编码
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="replace")
        fp.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} bytes to {path}"
    except Exception as e:
        error_msg = f"Error: {e}".encode("utf-8", errors="replace").decode("utf-8")
        return error_msg


def run_edit(
    path: str,
    old_text: str,
    new_text: str,
    workdir: Path,
    resolve=None,
    replace_all: bool = False,
) -> str:
    """
    编辑文件（精确字符串替换）

    默认要求 old_text 在文件中**唯一**——出现多次时报错，提示补充上下文
    或改用 replace_all 全部替换。old_text/new_text 不得包含 read_file
    输出的行号前缀（``行号<TAB>``）。

    Args:
        path: 相对文件路径
        old_text: 要替换的文本
        new_text: 新文本
        workdir: 工作目录，用于路径解析
        resolve: 门禁路径解析函数（可选；None = safe_path 硬拒绝逃逸）
        replace_all: 替换全部出现位置（默认 False，仅允许唯一匹配）

    Returns:
        操作结果信息
    """
    try:
        fp, err = _resolve_tool_path(path, workdir, resolve, write=True)
        if err:
            return err
        # 显式指定 UTF-8 编码读取
        c = fp.read_text(encoding="utf-8", errors="replace")
        count = c.count(old_text)
        if count == 0:
            return f"Error: Text not found in {path}"
        if not replace_all and count > 1:
            return (
                f"Error: old_text 在 {path} 中出现 {count} 次，不唯一。"
                "请补充更多上下文使其唯一，或传 replace_all=True 全部替换。"
            )
        # 显式指定 UTF-8 编码写入
        fp.write_text(c.replace(old_text, new_text), encoding="utf-8")
        if replace_all and count > 1:
            return f"Edited {path}（替换 {count} 处）"
        return f"Edited {path}"
    except Exception as e:
        error_msg = f"Error: {e}".encode("utf-8", errors="replace").decode("utf-8")
        return error_msg


def make_basic_tools(workdir: Path, guard_enabled: bool = False) -> dict:
    """
    创建基础工具处理器字典

    Args:
        workdir: 工作目录，用于操作
        guard_enabled: 是否启用外部访问门禁（ADR-0021）——True 时结构化
            工具的路径逃逸从「safe_path 硬拒绝」改为「门禁三态处置」
            （宿主 GUI 链路传入；False 保持旧行为，TUI/CLI 不变）

    Returns:
        工具名称到处理器函数的字典
    """
    resolve = None
    if guard_enabled:
        from .guard import resolve_guarded_path

        resolve = resolve_guarded_path

    return {
        "bash": lambda **kw: run_bash(kw["command"], workdir),
        "powershell": lambda **kw: run_powershell(kw["command"], workdir),
        "read_file": lambda **kw: run_read(
            kw["path"], workdir, kw.get("offset"), kw.get("limit"), resolve
        ),
        "write_file": lambda **kw: run_write(kw["path"], kw["content"], workdir, resolve),
        "edit_file": lambda **kw: run_edit(
            kw["path"],
            kw["old_text"],
            kw["new_text"],
            workdir,
            resolve,
            kw.get("replace_all", False),
        ),
    }
