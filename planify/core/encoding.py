#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
编码设置模块

提供跨平台 UTF-8 编码支持，修复 Windows GBK 显示问题。
必须在其他任何导入之前被导入和调用。
"""

import io
import os
import sys


# ============================================================
# 重要：在模块导入时立即设置 UTF-8 编码
# ============================================================
# 在 Windows 上启用 UTF-8 模式（Python 3.7+）
if sys.version_info >= (3, 7) and sys.platform == 'win32':
    os.environ['PYTHONUTF8'] = '1'

# 不再自动包装 stdout/stderr，避免与 debugpy 冲突
# 改为在 setup_encoding() 中使用 reconfigure


def setup_encoding():
    """
    设置 UTF-8 编码以实现跨平台兼容性。

    在 Windows 上，将控制台代码页设置为 UTF-8（代码页 65001）。
    在类 Unix 系统上，确保设置了 UTF-8 环境变量。
    """
    # 设置 UTF-8 环境变量
    os.environ['PYTHONIOENCODING'] = 'utf-8'

    # 在 Windows 上，将控制台代码页设置为 UTF-8
    if sys.platform == 'win32':
        try:
            import ctypes
            # 将控制台代码页设置为 UTF-8（代码页 65001）
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
            kernel32.SetConsoleCP(65001)
            kernel32.SetConsoleOutputCP(65001)
        except Exception:
            # 如果 ctypes 失败，回退到 chcp
            try:
                os.system('chcp 65001 > nul 2>&1')
            except Exception:
                pass

    # 重新配置 stdout/stderr 以使用 UTF-8（Python 3.7+）
    if sys.version_info >= (3, 7):
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        if hasattr(sys.stdin, 'reconfigure'):
            sys.stdin.reconfigure(encoding='utf-8', errors='replace')


# =============================================================================
# 安全的打印和输入函数
# =============================================================================
_builtin_print = print  # 保存内置 print
_builtin_input = input  # 保存内置 input


def safe_print(*args, **kwargs):
    """
    安全处理 UTF-8 编码的打印函数。

    此函数尝试使用 UTF-8 编码打印，
    必要时回退到安全字符替换。
    """
    try:
        # 检查 stdout 是否已关闭
        if hasattr(sys.stdout, 'buffer') and sys.stdout.buffer.closed:
            return
        _builtin_print(*args, **kwargs)
    except UnicodeEncodeError:
        # 回退：使用 errors='replace' 编码并解码回来
        safe_args = []
        for arg in args:
            if isinstance(arg, str):
                safe_args.append(arg.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8'))
            else:
                safe_args.append(arg)
        try:
            _builtin_print(*safe_args, **kwargs)
        except:
            pass  # 完全失败时静默忽略
    except (ValueError, IOError):
        # 处理 "I/O operation on closed file" 错误
        pass


def safe_input(prompt=""):
    """
    安全处理 UTF-8 编码的输入函数。

    此函数尝试使用 UTF-8 编码读取输入。
    在使用 GBK 终端的 Windows 上，将输入转换为 UTF-8。
    """
    try:
        # 检查 stdin 是否已关闭
        if hasattr(sys.stdin, 'buffer') and sys.stdin.buffer.closed:
            return ''
        result = _builtin_input(prompt)
        # 在使用 GBK 终端的 Windows 上，将 GBK 转换为 UTF-8
        if sys.platform == 'win32' and sys.stdin.encoding and sys.stdin.encoding.lower().startswith(('gbk', 'gb2312')):
            try:
                result = result.encode(sys.stdin.encoding, errors='replace').decode('utf-8', errors='replace')
            except Exception:
                pass  # 如果转换失败，保留原始值
        return result
    except (ValueError, IOError, EOFError):
        # 处理 "I/O operation on closed file" 错误或 EOF
        return ''
    except UnicodeDecodeError:
        # 回退：处理编码问题
        try:
            if not (hasattr(sys.stderr, 'buffer') and sys.stderr.buffer.closed):
                _builtin_print(prompt, end='', file=sys.stderr, flush=True)
            result = sys.stdin.read().rstrip('\n')
            return result
        except:
            return ''


def apply_safe_stdio():
    """
    用安全版本覆盖 print 和 input 函数。

    此函数在模块级别覆盖 print 和 input，确保所有后续的 print 和 input
    调用都使用 UTF-8 安全的版本。
    """
    global print, input
    print = safe_print
    input = safe_input
