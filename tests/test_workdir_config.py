"""CORTEX_WORKDIR 工作目录覆盖（次优先级）测试。

优先级链：显式 -C > CORTEX_WORKDIR (env > local .env > global .env) > 启动目录。
跳转发生在 setup_logging / CortexConfig.load 之前（cortex_cli.main 接线，
仅未传 -C 时应用配置项），本测试直测解析/跳转函数，并子进程实测端到端。
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from doclens.config import (
    WORKDIR_ENV_KEY,
    data_dirname,
    resolve_workdir_override,
)


@pytest.fixture(autouse=True)
def _no_env_override(monkeypatch, tmp_path):
    """隔离：清掉环境变量与 global .env 的干扰，global 指到临时目录。"""
    monkeypatch.delenv(WORKDIR_ENV_KEY, raising=False)
    monkeypatch.setattr(
        "doclens.config.get_global_cortex_dir", lambda: tmp_path / "ghome"
    )


# ---- resolve_workdir_override：三级优先与缺省 ----


def test_override_none_when_unconfigured(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert resolve_workdir_override() is None


def test_override_from_process_env_highest(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    # local 与 global 都配了，env 优先
    (tmp_path / data_dirname()).mkdir()
    (tmp_path / data_dirname() / ".env").write_text(
        f"{WORKDIR_ENV_KEY}=C:\\from-local-env\n", encoding="utf-8"
    )
    monkeypatch.setenv(WORKDIR_ENV_KEY, str(tmp_path / "from-env"))
    assert resolve_workdir_override() == str(tmp_path / "from-env")


def test_override_from_local_env_beats_global(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    ghome = tmp_path / "ghome"
    ghome.mkdir()
    (ghome / ".env").write_text(
        f"{WORKDIR_ENV_KEY}=C:\\from-global\n", encoding="utf-8"
    )
    (tmp_path / data_dirname()).mkdir()
    (tmp_path / data_dirname() / ".env").write_text(
        f"{WORKDIR_ENV_KEY}=C:\\from-local-env\n", encoding="utf-8"
    )
    assert resolve_workdir_override() == "C:\\from-local-env"


def test_override_from_global_env(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    ghome = tmp_path / "ghome"
    ghome.mkdir()
    (ghome / ".env").write_text(f"{WORKDIR_ENV_KEY}= D:/kb \n", encoding="utf-8")
    assert resolve_workdir_override() == "D:/kb"  # strip 生效


# ---- _apply_workdir_override：跳转 / 跳过 / 报错 ----


def _apply():
    from doclens.cortex_cli import _apply_workdir_override
    _apply_workdir_override()


def test_apply_chdir_to_target(tmp_path, monkeypatch, capsys):
    source, target = tmp_path / "src", tmp_path / "kb"
    source.mkdir(); target.mkdir()
    monkeypatch.chdir(source)
    monkeypatch.setenv(WORKDIR_ENV_KEY, str(target))
    _apply()
    assert os.getcwd() == str(target)
    assert WORKDIR_ENV_KEY in capsys.readouterr().err


def test_apply_same_dir_noop(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv(WORKDIR_ENV_KEY, str(tmp_path))
    _apply()  # 相同目录静默跳过，不退出
    assert os.getcwd() == str(tmp_path)


def test_apply_missing_dir_exits(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv(WORKDIR_ENV_KEY, str(tmp_path / "nope"))
    with pytest.raises(SystemExit):
        _apply()
    assert "目录不存在" in capsys.readouterr().err


# ---- 设置链路校验 ----


def test_validator_rejects_missing_dir():
    from doclens.web_v2.config_validator import validate_values

    errors = validate_values({"CORTEX_WORKDIR": "Z:/definitely/not/exist"})
    field_errors = [e for e in errors.fields if e.field == "CORTEX_WORKDIR"]
    assert len(field_errors) == 1
    assert "目录不存在" in field_errors[0].error


def test_validator_accepts_existing_dir(tmp_path):
    from doclens.web_v2.config_validator import validate_values

    errors = validate_values({"CORTEX_WORKDIR": str(tmp_path)})
    assert [e for e in errors.fields if e.field == "CORTEX_WORKDIR"] == []


def test_workdir_key_in_known_keys_and_restart_fields():
    from doclens.web_v2.config_store import KNOWN_KEYS
    from doclens.web_v2.models.config import RESTART_FIELDS

    assert "CORTEX_WORKDIR" in KNOWN_KEYS
    assert "CORTEX_WORKDIR" in RESTART_FIELDS


# ---- CLI 端到端：子进程实测优先级 ----


def _run_status(tmp_path, env, extra_args):
    """status 子命令：读配置后退出——main() 的 chdir 链在它之前执行。
    stderr 丢弃（venv 审计钩子会灌海量 AUDIT 流）；UTF-8 解码防 GBK 崩。"""
    return subprocess.run(
        [sys.executable, "-m", "doclens", "status", *extra_args],
        env=env, timeout=180,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        encoding="utf-8", errors="replace",
        cwd=str(tmp_path),
    )


def test_cli_explicit_dash_c_beats_config(tmp_path):
    """显式 -C A + env 配 B → 落在 A（-C 最高优先级）。"""
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir(); b.mkdir()
    env = {**os.environ, WORKDIR_ENV_KEY: str(b),
           "PYTHONPATH": os.getcwd()}
    r = _run_status(tmp_path, env, ["-C", str(a)])
    assert str(a) in (r.stdout or "")
    assert r.returncode == 0


def test_cli_config_used_when_no_dash_c(tmp_path):
    """无 -C + env 配 B → 落在 B（配置项次优先级，覆盖启动目录）。"""
    launch_dir, b = tmp_path / "launch", tmp_path / "b"
    launch_dir.mkdir(); b.mkdir()
    env = {**os.environ, WORKDIR_ENV_KEY: str(b),
           "PYTHONPATH": os.getcwd()}
    r = _run_status(launch_dir, env, [])
    assert str(b) in (r.stdout or "")
    assert r.returncode == 0
