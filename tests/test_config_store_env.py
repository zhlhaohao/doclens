# -*- coding: utf-8 -*-
"""`.env` 写入纪律（AP-34）：进程级锁 + 原子替换 + 值转义。

`.env` 有多个写方（设置页保存 / 预设激活 / 改密 / 从全局复制 / 恢复默认）。
此前各自 read-modify-write 且互不互斥：并发保存丢更新，半写让凭证解析失败
（叠加 auth fail-open），含空格/`#`/引号的值被 dotenv 截断或拆行。
"""
import os
import threading
from pathlib import Path

from dotenv import dotenv_values

from doclens.web_v2.config_store import (
    copy_env_file,
    read_env_values,
    write_env_values,
)


class TestAtomicity:
    def test_no_tmp_left_behind(self, tmp_path: Path):
        env = tmp_path / ".env"
        write_env_values(env, {"A": "1"})
        write_env_values(env, {"A": "2"})
        assert [p.name for p in tmp_path.iterdir()] == [".env"]

    def test_creates_missing_file_and_parents(self, tmp_path: Path):
        env = tmp_path / "deep" / "dir" / ".env"
        write_env_values(env, {"A": "1"})
        assert read_env_values(env, frozenset({"A"}))[0]["A"] == "1"

    def test_replace_not_truncate(self, tmp_path: Path, monkeypatch):
        """写入走 os.replace（同目录换名），不是就地截断重写。"""
        import doclens.web_v2.config_store as cs

        calls = []
        real = os.replace

        def spy(src, dst):
            calls.append((Path(src).name, Path(dst).name))
            return real(src, dst)

        monkeypatch.setattr(cs.os, "replace", spy)
        write_env_values(tmp_path / ".env", {"A": "1"})
        assert calls == [(".env.tmp", ".env")]


class TestConcurrentWrites:
    def test_parallel_writers_lose_nothing(self, tmp_path: Path):
        """16 个线程各写自己的键，全部必须落盘（旧实现在此丢更新）。"""
        env = tmp_path / ".env"
        write_env_values(env, {"BASE": "0"})
        barrier = threading.Barrier(16)

        def worker(i: int) -> None:
            barrier.wait()
            write_env_values(env, {f"K{i}": str(i)})

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(16)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        values, _ = read_env_values(env, frozenset({"BASE"} | {f"K{i}" for i in range(16)}))
        assert values["BASE"] == "0"
        missing = [k for k in values if k != "BASE" and values[k] == ""]
        assert missing == [], f"并发写丢键: {missing}"


class TestValueEscaping:
    def test_hash_is_not_truncated(self, tmp_path: Path):
        env = tmp_path / ".env"
        write_env_values(env, {"NOTE": "abc #def"})
        assert dotenv_values(str(env))["NOTE"] == "abc #def"

    def test_spaces_and_quotes_roundtrip(self, tmp_path: Path):
        env = tmp_path / ".env"
        value = 'say "hi" there'
        write_env_values(env, {"MSG": value})
        assert dotenv_values(str(env))["MSG"] == value

    def test_json_value_survives_repeated_writes(self, tmp_path: Path):
        """翻译预设的 envs JSON 含空格与引号——多次改写不得漂移。"""
        env = tmp_path / ".env"
        value = '{"api_key": "sk-1", "region": "cn north"}'
        for _ in range(3):
            write_env_values(env, {"CORTEX_TRANSLATE_ENVS": value})
        raw = dotenv_values(str(env))["CORTEX_TRANSLATE_ENVS"]
        assert raw == value
        import json

        assert json.loads(raw) == {"api_key": "sk-1", "region": "cn north"}

    def test_plain_values_stay_unquoted(self, tmp_path: Path):
        """裸值保持可读（既有 .env 文本断言与人工编辑习惯）。"""
        env = tmp_path / ".env"
        write_env_values(env, {"PLANIFY_MODEL_ID": "claude-opus-4-6", "PORT": "7860"})
        text = env.read_text(encoding="utf-8")
        assert "PLANIFY_MODEL_ID=claude-opus-4-6" in text
        assert 'PORT=7860' in text
        assert '"' not in text

    def test_newline_does_not_split_lines(self, tmp_path: Path):
        env = tmp_path / ".env"
        write_env_values(env, {"A": "1", "MULTI": "line1\nline2"})
        # 文件行数不因值内换行而增加（A + MULTI 两行）
        lines = [ln for ln in env.read_text(encoding="utf-8").splitlines() if ln.strip()]
        assert len(lines) == 2
        assert dotenv_values(str(env))["MULTI"] == "line1\nline2"


class TestCopyEnvFile:
    def test_copy_is_exact_and_atomic(self, tmp_path: Path):
        src = tmp_path / "g" / ".env"
        write_env_values(src, {"A": "x #y", "B": "2"})
        dst = tmp_path / "l" / ".env"
        copy_env_file(src, dst)
        assert dst.read_text(encoding="utf-8") == src.read_text(encoding="utf-8")
        assert dotenv_values(str(dst))["A"] == "x #y"
