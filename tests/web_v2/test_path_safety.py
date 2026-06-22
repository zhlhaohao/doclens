"""path_safety 共享模块测试。"""
import os
from pathlib import Path

import pytest

from cortex.web_v2.api.errors import CortexAPIError
from cortex.web_v2.path_safety import (
    safe_resolve,
    is_protected,
    is_root,
    assert_not_protected,
    assert_not_root,
    validate_name,
    validate_move_target,
    compute_writable,
)


@pytest.fixture
def base(tmp_path: Path) -> Path:
    """创建 base 目录，含 docs/ 和 .cortex/。"""
    (tmp_path / "docs" / "sub").mkdir(parents=True)
    (tmp_path / "docs" / "report.md").write_text("hi", encoding="utf-8")
    (tmp_path / ".cortex").mkdir()
    (tmp_path / ".cortex" / "index.db").write_bytes(b"")
    (tmp_path / ".env").write_text("KEY=x", encoding="utf-8")
    (tmp_path / "memo.draft.md").write_text("ok", encoding="utf-8")
    return tmp_path


# --- safe_resolve ---

def test_safe_resolve_normal_path(base: Path):
    full = safe_resolve(base, "docs/report.md")
    assert full == (base / "docs" / "report.md").resolve()


def test_safe_resolve_rejects_dotdot(base: Path):
    with pytest.raises(CortexAPIError) as exc:
        safe_resolve(base, "../outside")
    assert exc.value.status == 404
    assert exc.value.code == "FILE_NOT_FOUND"


def test_safe_resolve_rejects_absolute_outside(base: Path):
    with pytest.raises(CortexAPIError):
        safe_resolve(base, "/etc/passwd")


# --- is_protected ---

def test_is_protected_cortex_dir(base: Path):
    assert is_protected(base / ".cortex" / "index.db", base) is True


def test_is_protected_env_file(base: Path):
    assert is_protected(base / ".env", base) is True


def test_is_protected_dotfile_inside_subdir(base: Path):
    (base / "docs" / ".hidden").write_text("x", encoding="utf-8")
    assert is_protected(base / "docs" / ".hidden", base) is True


def test_is_protected_dotdir_inside_subdir(base: Path):
    (base / "docs" / ".git").mkdir()
    assert is_protected(base / "docs" / ".git" / "config", base) is True


def test_is_protected_normal_file_is_false(base: Path):
    assert is_protected(base / "docs" / "report.md", base) is False


def test_is_protected_memo_with_dot_in_middle_is_false(base: Path):
    assert is_protected(base / "memo.draft.md", base) is False


def test_is_protected_outside_base_is_true(base: Path):
    assert is_protected(Path("/etc/passwd").resolve(), base) is True


# --- is_root ---

def test_is_root_matches_base(base: Path):
    assert is_root(base, base) is True


def test_is_root_rejects_subdir(base: Path):
    assert is_root(base / "docs", base) is False


# --- assert_not_protected / assert_not_root ---

def test_assert_not_protected_raises_for_dotfile(base: Path):
    with pytest.raises(CortexAPIError) as exc:
        assert_not_protected(base / ".env", base)
    assert exc.value.code == "PROTECTED"


def test_assert_not_protected_passes_for_normal(base: Path):
    assert_not_protected(base / "docs" / "report.md", base)


def test_assert_not_root_raises_for_base(base: Path):
    with pytest.raises(CortexAPIError) as exc:
        assert_not_root(base, base)
    assert exc.value.code == "INVALID_TARGET"


def test_assert_not_root_passes_for_subdir(base: Path):
    assert_not_root(base / "docs", base)


# --- validate_name ---

def test_validate_name_normal():
    validate_name("report.md")
    validate_name("新建目录")
    validate_name("file (1).txt")


def test_validate_name_rejects_empty():
    with pytest.raises(CortexAPIError) as exc:
        validate_name("")
    assert exc.value.code == "INVALID_NAME"


def test_validate_name_rejects_dot():
    with pytest.raises(CortexAPIError):
        validate_name(".")
    with pytest.raises(CortexAPIError):
        validate_name("..")


def test_validate_name_rejects_leading_dot():
    with pytest.raises(CortexAPIError) as exc:
        validate_name(".hidden")
    assert "点" in exc.value.detail


def test_validate_name_rejects_illegal_chars():
    for bad in ["a/b", "a\\b", "a:b", "a*b", 'a"b', "a<b", "a>b", "a|b", "a?b"]:
        with pytest.raises(CortexAPIError) as exc:
            validate_name(bad)
        assert exc.value.code == "INVALID_NAME"


def test_validate_name_rejects_control_chars():
    with pytest.raises(CortexAPIError):
        validate_name("a\x01b")


def test_validate_name_rejects_leading_whitespace():
    with pytest.raises(CortexAPIError):
        validate_name(" leading")


def test_validate_name_rejects_windows_reserved():
    for reserved in ["CON", "PRN", "AUX", "NUL", "COM1", "LPT9", "con", "com1", "lpt1"]:
        with pytest.raises(CortexAPIError) as exc:
            validate_name(reserved)
        assert exc.value.code == "RESERVED_NAME"


# --- validate_move_target ---

def test_validate_move_target_rejects_self(base: Path):
    src = base / "docs"
    with pytest.raises(CortexAPIError) as exc:
        validate_move_target(src, src)
    assert exc.value.code == "INVALID_TARGET"


def test_validate_move_target_rejects_own_child(base: Path):
    src = base / "docs"
    dest_dir = base / "docs" / "sub"
    with pytest.raises(CortexAPIError) as exc:
        validate_move_target(src, dest_dir)
    assert exc.value.code == "INVALID_TARGET"


def test_validate_move_target_allows_independent_paths(base: Path):
    src = base / "docs"
    dest_dir = base / "archive"
    dest_dir.mkdir()
    validate_move_target(src, dest_dir)


# --- compute_writable ---

def test_compute_writable_protected_is_false(base: Path):
    assert compute_writable(base / ".env", base) is False
    assert compute_writable(base / ".cortex" / "index.db", base) is False


def test_compute_writable_nonexistent_is_false(base: Path):
    assert compute_writable(base / "nope.md", base) is False


def test_compute_writable_normal_file_is_true(base: Path):
    assert compute_writable(base / "docs" / "report.md", base) is True


def test_compute_writable_normal_dir_is_true(base: Path):
    assert compute_writable(base / "docs", base) is True


def test_compute_writable_readonly_file_is_false(base: Path):
    f = base / "docs" / "readonly.md"
    f.write_text("x", encoding="utf-8")
    os.chmod(f, 0o444)
    try:
        assert compute_writable(f, base) is False
    finally:
        os.chmod(f, 0o644)
