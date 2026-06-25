"""共享路径安全模块。

preview.py 和 files.py 共用：路径解析、点文件保护、根目录保护。
"""
import os
import re
from pathlib import Path

from doclens.web_v2.api.errors import CortexAPIError

MAX_PATH_LEN = 255

ILLEGAL_NAME_CHARS = frozenset('\\/:*?"<>|')
_ILLEGAL_NAME_PATTERNS = [
    re.compile(r"^\s"),
    re.compile(r"[\x00-\x1f]"),
]
RESERVED_WIN_NAMES = frozenset({
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
})


def safe_resolve(base: Path, requested: str) -> Path:
    """解析并校验请求路径必须落在 base 内（防 .. 越权）。"""
    base_abs = base.resolve()
    candidate = (base_abs / requested).resolve()
    try:
        candidate.relative_to(base_abs)
    except ValueError:
        raise CortexAPIError(404, "FILE_NOT_FOUND", "路径越权")
    if len(str(candidate)) > MAX_PATH_LEN:
        raise CortexAPIError(400, "INVALID_PATH", f"路径超过 {MAX_PATH_LEN} 字符")
    return candidate


def is_protected(full: Path, base: Path) -> bool:
    """任何路径组件以 '.' 开头都视为受保护。"""
    try:
        rel = full.relative_to(base.resolve())
    except ValueError:
        return True
    return any(part.startswith(".") for part in rel.parts)


def is_root(full: Path, base: Path) -> bool:
    return full.resolve() == base.resolve()


def assert_not_protected(full: Path, base: Path) -> None:
    if is_protected(full, base):
        raise CortexAPIError(403, "PROTECTED", f"受保护路径: {full}")


def assert_not_root(full: Path, base: Path) -> None:
    if is_root(full, base):
        raise CortexAPIError(400, "INVALID_TARGET", "不能操作根目录")


def validate_name(name: str) -> None:
    """mkdir / rename / upload 文件名共用校验。"""
    if not name or name in (".", ".."):
        raise CortexAPIError(400, "INVALID_NAME", "名称为空或为保留字")
    if name.startswith("."):
        raise CortexAPIError(400, "INVALID_NAME", "名称不能以点开头")
    bad = set(name) & ILLEGAL_NAME_CHARS
    if bad:
        raise CortexAPIError(400, "INVALID_NAME", f"含非法字符: {bad}")
    if any(p.search(name) for p in _ILLEGAL_NAME_PATTERNS):
        raise CortexAPIError(400, "INVALID_NAME", "含控制字符或以空白开头")
    if name.upper() in RESERVED_WIN_NAMES:
        raise CortexAPIError(400, "RESERVED_NAME", f"Windows 保留名: {name}")


def validate_move_target(from_path: Path, dest_dir: Path) -> None:
    """from 不能是 dest_dir 本身或其祖先（防自循环）。"""
    if from_path.resolve() == dest_dir.resolve():
        raise CortexAPIError(400, "INVALID_TARGET", "不能移动到自身")
    try:
        dest_dir.resolve().relative_to(from_path.resolve())
        raise CortexAPIError(400, "INVALID_TARGET", "不能移动到自己的子目录")
    except ValueError:
        pass  # 安全


def compute_writable(full: Path, base: Path) -> bool:
    """统一可写性判断（保护 / 存在性 / 文件 W_OK / 目录 W_OK+X_OK）。"""
    if is_protected(full, base):
        return False
    if not full.exists():
        return False
    if full.is_file():
        return os.access(full, os.W_OK)
    if full.is_dir():
        return os.access(full, os.W_OK) and os.access(full, os.X_OK)
    return False
