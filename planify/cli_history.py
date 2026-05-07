#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CLI 命令历史系统 - 自实现，持久化到磁盘

提供上下箭头历史导航功能，不依赖 readline/pyreadline3。
历史记录以 JSON 文件形式持久化，程序重启后仍然可用。
"""

import json
import sys
from pathlib import Path


class CommandHistory:
    """命令历史管理器，支持持久化到 JSON 文件"""

    def __init__(self, file_path: Path, max_entries: int = 1000):
        self._file_path = file_path
        self._max_entries = max_entries
        self._entries: list[str] = []
        self._history_index: int = 0
        self._load()

    def add(self, cmd: str) -> None:
        """添加命令到历史列表"""
        cmd = cmd.strip()
        if not cmd:
            return
        # 与上一条相同时跳过
        if self._entries and self._entries[-1] == cmd:
            self.reset_index()
            return
        self._entries.append(cmd)
        if len(self._entries) > self._max_entries:
            self._entries = self._entries[-self._max_entries:]
        self._history_index = len(self._entries)
        self._save()

    def up(self) -> str | None:
        """向上导航（更早的命令），返回命令文本或 None"""
        if not self._entries or self._history_index <= 0:
            return None
        self._history_index -= 1
        return self._entries[self._history_index]

    def down(self) -> str | None:
        """向下导航（更新的命令），返回命令文本或 None"""
        if self._history_index >= len(self._entries) - 1:
            self._history_index = len(self._entries)
            return None
        self._history_index += 1
        return self._entries[self._history_index]

    def reset_index(self) -> None:
        """重置导航索引到末尾"""
        self._history_index = len(self._entries)

    def _save(self) -> None:
        """保存历史到 JSON 文件"""
        try:
            self._file_path.parent.mkdir(parents=True, exist_ok=True)
            self._file_path.write_text(
                json.dumps(self._entries, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass  # 静默失败，历史丢失可接受

    def _load(self) -> None:
        """从 JSON 文件加载历史"""
        try:
            if self._file_path.exists():
                data = json.loads(
                    self._file_path.read_text(encoding="utf-8")
                )
                if isinstance(data, list):
                    self._entries = [str(e) for e in data]
                    # 超限时截断
                    if len(self._entries) > self._max_entries:
                        self._entries = self._entries[-self._max_entries:]
        except (OSError, json.JSONDecodeError, ValueError):
            self._entries = []
        self._history_index = len(self._entries)


# ============================================================================
# 跨平台单字符输入
# ============================================================================

def _read_char_win32() -> str:
    """Windows: 使用 msvcrt 读取单个字符（支持 Unicode）"""
    import msvcrt
    ch = msvcrt.getwch()
    return ch


def _read_char_unix() -> str:
    """Unix: 使用 termios raw 模式读取单个字符"""
    import termios
    import tty
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
    return ch


def _get_clipboard_text() -> str:
    """获取 Windows 剪贴板文本内容"""
    import ctypes
    from ctypes import wintypes

    CF_UNICODETEXT = 13

    class HGLOBAL(ctypes.Structure):
        pass

    HGLOBAL._fields_ = []

    OpenClipboard = ctypes.windll.user32.OpenClipboard
    OpenClipboard.argtypes = [wintypes.HWND]
    OpenClipboard.restype = wintypes.BOOL

    CloseClipboard = ctypes.windll.user32.CloseClipboard
    CloseClipboard.restype = wintypes.BOOL

    GetClipboardData = ctypes.windll.user32.GetClipboardData
    GetClipboardData.argtypes = [wintypes.UINT]
    GetClipboardData.restype = wintypes.HANDLE

    GlobalLock = ctypes.windll.kernel32.GlobalLock
    GlobalLock.argtypes = [wintypes.HGLOBAL]
    GlobalLock.restype = wintypes.LPVOID

    GlobalUnlock = ctypes.windll.kernel32.GlobalUnlock
    GlobalUnlock.argtypes = [wintypes.HGLOBAL]
    GlobalUnlock.restype = wintypes.BOOL

    text = ""
    if OpenClipboard(None):
        try:
            hwnd = GetClipboardData(CF_UNICODETEXT)
            if hwnd:
                data = GlobalLock(hwnd)
                if data:
                    text = ctypes.c_wchar_p(data).value
                    GlobalUnlock(hwnd)
        finally:
            CloseClipboard()
    return text


def _read_key() -> tuple[str, str]:
    """
    读取一个逻辑按键。

    Returns:
        (kind, value) 其中 kind 为:
        - 'char': 普通字符，value 为该字符
        - 'enter': 回车
        - 'backspace': 退格
        - 'up': 上箭头
        - 'down': 下箭头
        - 'paste': 右键粘贴，value 为剪贴板文本
        - 'ctrl_c': Ctrl+C
        - 'ctrl_d': Ctrl+D
        - 'other': 其他控制键
    """
    if sys.platform == "win32":
        return _read_key_win32()
    return _read_key_unix()


def _read_key_win32() -> tuple[str, str]:
    """Windows 平台按键识别（兼容原生控制台和 ANSI 终端）

    策略：用 getch() 检测特殊键（方向键/ESC），其余字符直接用 getch() 的值。
    对于非 ASCII 字节（>127），尝试读取完整 UTF-8 序列。
    """
    import os

    # 检测是否在 Git Bash/mintty 环境下
    is_mintty = os.environ.get("TERM", "").lower().find("mintty") >= 0
    if is_mintty:
        return _read_key_unix()

    import msvcrt

    # 用 getch() 读取第一个字节
    first_raw = msvcrt.getch()
    if isinstance(first_raw, int):
        first_ord = first_raw
    elif isinstance(first_raw, bytes):
        first_ord = first_raw[0]
    else:
        first_ord = ord(first_raw)

    # Windows 虚拟键前缀（cmd.exe / PowerShell 原生终端的箭头键）
    if first_ord in (0, 0xe0):
        second_raw = msvcrt.getch()
        if isinstance(second_raw, int):
            second_ord = second_raw
        elif isinstance(second_raw, bytes):
            second_ord = second_raw[0]
        else:
            second_ord = ord(second_raw)
        # Windows 虚拟键码：VK_UP=0x26, VK_DOWN=0x28, VK_LEFT=0x25, VK_RIGHT=0x27
        # 但 getch() 在某些配置下返回扫描码，需要同时处理
        # 扫描码：上=72(0x48), 下=80(0x50), 左=75(0x4B), 右=77(0x4D)
        # 虚拟键码：上=38(0x26), 下=40(0x28), 左=37(0x25), 右=39(0x27)
        if second_ord in (72, 38):  # Up arrow
            return ("up", "")
        if second_ord in (80, 40):  # Down arrow
            return ("down", "")
        if second_ord in (77, 39):  # Right arrow
            return ("right", "")
        if second_ord in (75, 37):  # Left arrow
            return ("left", "")
        return ("other", "")

    # ANSI ESC 序列（VS Code 集成终端 / Windows Terminal / MSYS2 的箭头键）
    if first_ord == 0x1b:
        second_raw = msvcrt.getch()
        if isinstance(second_raw, int):
            second_ord = second_raw
        elif isinstance(second_raw, bytes):
            second_ord = second_raw[0]
        else:
            second_ord = ord(second_raw)

        # 两种 ANSI 序列格式：
        # 1. ESC [ A/B/C/D (xterm 风格，第二个字节是 '[' = 91)
        # 2. ESC O A/B/C/D (部分终端风格，第二个字节是 'O' = 79)
        if second_ord in (91, 79):  # '[' 或 'O'
            third_raw = msvcrt.getch()
            if isinstance(third_raw, int):
                third_ord = third_raw
            elif isinstance(third_raw, bytes):
                third_ord = third_raw[0]
            else:
                third_ord = ord(third_raw)
            # 'A' = 65 (上), 'B' = 66 (下), 'C' = 67 (右), 'D' = 68 (左)
            if third_ord == 65:
                return ("up", "")
            if third_ord == 66:
                return ("down", "")
            if third_ord == 67:
                return ("right", "")
            if third_ord == 68:
                return ("left", "")
            # 其他情况不消费，直接返回
            return ("other", "")
        # ESC 键：清除当前输入
        return ("esc_clear", "")

    # 控制键
    if first_ord == 3:
        return ("ctrl_c", "")
    if first_ord == 4:
        return ("ctrl_d", "")
    if first_ord in (13, 10):
        return ("enter", "")
    if first_ord == 8:
        return ("backspace", "")  # 退格键
    if first_ord == 127:
        return ("backspace", "")  # Delete 键

    # 右键点击（粘贴）- Windows 控制台 VK_APPS (0x5D) 或 0x2E
    # 右键在很多终端模拟器中发送 0x00 或 0xE0 前缀 + 0x2E (VK_CANCEL) 或 0x5D
    # 检测 0x5D (93) - VK_APPS 通常是右键
    if first_ord == 93:
        clipboard_text = _get_clipboard_text()
        return ("paste", clipboard_text)

    # ASCII 可打印字符（32-126）
    if first_ord <= 127:
        return ("char", chr(first_ord))

    # 非 ASCII 字节（128-255）：可能是 UTF-8 多字节序列的首字节
    # 尝试读取完整的 UTF-8 字符
    char_bytes = bytes([first_ord])

    # 判断 UTF-8 首字节，确定需要读取的续字节数
    if 0xC0 <= first_ord <= 0xDF:
        numContinuation = 1
    elif 0xE0 <= first_ord <= 0xEF:
        numContinuation = 2
    elif 0xF0 <= first_ord <= 0xF7:
        numContinuation = 3
    else:
        # 不是有效的 UTF-8 首字节，作为 Latin-1 字符处理
        return ("char", chr(first_ord))

    # 读取后续字节
    for _ in range(numContinuation):
        cont_raw = msvcrt.getch()
        if isinstance(cont_raw, bytes):
            char_bytes += cont_raw
        elif isinstance(cont_raw, int):
            char_bytes += bytes([cont_raw])
        else:
            char_bytes += cont_raw.encode('latin-1') if isinstance(cont_raw, str) else cont_raw

    # UTF-8 解码
    try:
        return ("char", char_bytes.decode('utf-8'))
    except UnicodeDecodeError:
        # 解码失败，作为 Latin-1 字符处理
        return ("char", chr(first_ord))


def _read_key_unix_ansi() -> tuple[str, str]:
    """Unix ANSI 风格读取（用于 Git Bash/mintty）"""
    import sys
    import termios
    import tty

    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
        if ch == "\x1b":
            # ESC 序列
            ch2 = sys.stdin.read(1)
            if ch2 == "[":
                ch3 = sys.stdin.read(1)
                if ch3 == "A":
                    return ("up", "")
                if ch3 == "B":
                    return ("down", "")
                if ch3 == "C":
                    return ("right", "")
                if ch3 == "D":
                    return ("left", "")
            return ("other", "")
        # 普通字符
        return ("char", ch)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def _read_key_unix() -> tuple[str, str]:
    """Unix 平台按键识别"""
    ch = _read_char_unix()

    # Ctrl+C
    if ch == "\x03":
        return ("ctrl_c", "")
    # Ctrl+D
    if ch == "\x04":
        return ("ctrl_d", "")
    # Enter
    if ch in ("\r", "\n"):
        return ("enter", "")
    # Backspace / Ctrl+H / Delete
    if ch in ("\x7f", "\x08"):
        return ("backspace", "")
    # ESC 序列（箭头键）
    if ch == "\x1b":
        ch2 = _read_char_unix()
        if ch2 == "[":
            ch3 = _read_char_unix()
            if ch3 == "A":
                return ("up", "")
            if ch3 == "B":
                return ("down", "")
        return ("other", "")
    # 普通字符
    return ("char", ch)


# ============================================================================
# 带历史导航的输入函数
# ============================================================================

def _clear_line(prompt_len: int, buf_len: int) -> None:
    """清除当前行内容并重置光标到 prompt 之后"""
    # \r 回到行首 → 输出 prompt_len 个空格覆盖 → 再回到行首
    sys.stdout.write("\r" + " " * (prompt_len + buf_len) + "\r")
    sys.stdout.write("\r")  # 光标到行首
    sys.stdout.flush()


def _redraw_line(prompt: str, buf: str, cursor_pos: int) -> None:
    """重绘当前行：prompt + buf，光标定位到 cursor_pos"""
    # 回到行首
    sys.stdout.write("\r")
    # 清除从光标到行尾
    sys.stdout.write("\033[K")
    # 写入 prompt + buf
    sys.stdout.write(prompt + buf)
    # 将光标移到正确位置（从行首算起 prompt_len + cursor_pos）
    total_len = len(prompt) + len(buf)
    target = len(prompt) + cursor_pos
    if target < total_len:
        # 向左移动 (total_len - target) 个字符位置
        sys.stdout.write(f"\033[{total_len - target}D")
    sys.stdout.flush()


def input_with_history(prompt: str, history: CommandHistory) -> str:
    """
    带历史导航的输入函数。

    当 stdin 不是终端（如管道输入）时，自动回退到标准 input()。

    Args:
        prompt: 提示符字符串
        history: CommandHistory 实例

    Returns:
        用户输入的文本

    Raises:
        KeyboardInterrupt: Ctrl+C
        EOFError: Ctrl+D
    """
    # 非 TTY 模式（管道/重定向）回退到标准 input()
    if not sys.stdin.isatty():
        result = input(prompt)
        history.add(result)
        return result

    buf = ""
    cursor_pos = 0  # 光标在 buf 中的位置

    # 显示提示符
    sys.stdout.write(prompt)
    sys.stdout.flush()

    while True:
        kind, value = _read_key()

        if kind == "enter":
            sys.stdout.write("\n")
            sys.stdout.flush()
            result = buf
            history.add(result)
            return result

        elif kind == "char":
            # 在 cursor_pos 处插入字符
            buf = buf[:cursor_pos] + value + buf[cursor_pos:]
            cursor_pos += len(value)
            _redraw_line(prompt, buf, cursor_pos)

        elif kind == "backspace":
            if cursor_pos > 0:
                buf = buf[: cursor_pos - 1] + buf[cursor_pos:]
                cursor_pos -= 1
                _redraw_line(prompt, buf, cursor_pos)

        elif kind == "esc_clear":
            # ESC 键：清除当前输入
            buf = ""
            cursor_pos = 0
            _redraw_line(prompt, buf, cursor_pos)

        elif kind == "up":
            entry = history.up()
            if entry is not None:
                buf = entry
                cursor_pos = len(buf)
                _redraw_line(prompt, buf, cursor_pos)

        elif kind == "down":
            entry = history.down()
            if entry is not None:
                buf = entry
            else:
                buf = ""
            cursor_pos = len(buf)
            _redraw_line(prompt, buf, cursor_pos)

        elif kind == "paste":
            # 右键粘贴：在光标位置插入剪贴板内容
            clipboard_text = value
            if clipboard_text:
                buf = buf[:cursor_pos] + clipboard_text + buf[cursor_pos:]
                cursor_pos += len(clipboard_text)
                _redraw_line(prompt, buf, cursor_pos)

        elif kind == "ctrl_c":
            sys.stdout.write("\n")
            sys.stdout.flush()
            history.reset_index()
            raise KeyboardInterrupt

        elif kind == "ctrl_d":
            if not buf:
                sys.stdout.write("\n")
                sys.stdout.flush()
                raise EOFError
