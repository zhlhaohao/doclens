"""AI 会话临时文件工作区：`<workdir>/<.cortex>/tmp/<session_id>/`。

背景：AI 对话中 agent 用 write_file + bash/powershell 生成并运行临时代码时，
文件默认落在知识库根目录（workdir），污染知识库并触发索引/文件监控。
本模块提供按会话隔离的临时目录（位于已被索引器/watcher 排除的数据目录下），
以及启动时 / 会话删除时的清理入口。

注意：写文件行为的引导由 system prompt 完成（planify/streaming/runner.py
run_stream 注入 Temporary Files 段），工具层不做硬重定向。
"""
from __future__ import annotations

import logging
import re
import shutil
from pathlib import Path

from doclens.config import data_dirname

logger = logging.getLogger(__name__)

# 会话 id 只允许安全字符（web 会话 id 为 ULID），防路径穿越
SESSION_ID_RE = re.compile(r"^[\w.-]+$")


def _is_safe_session_id(session_id: str) -> bool:
    """session_id 合法性：安全字符 + 不能是纯点号（"." / ".." / "..." 等）。"""
    return bool(session_id) and bool(SESSION_ID_RE.match(session_id)) and bool(session_id.strip("."))


def _tmp_root(workdir: Path) -> Path:
    """临时目录根：`<workdir>/<data_dirname>/tmp/`（不主动创建）。"""
    return workdir / data_dirname() / "tmp"


def session_tmp_dir(workdir: Path, session_id: str) -> Path:
    """返回并创建会话临时目录 `.cortex/tmp/<session_id>/`。

    Raises:
        ValueError: session_id 含非法字符（路径穿越风险）。
    """
    if not _is_safe_session_id(session_id):
        raise ValueError(f"非法 session_id（路径穿越风险）: {session_id!r}")
    d = _tmp_root(workdir) / session_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def cleanup_session_tmp(workdir: Path, session_id: str) -> bool:
    """删除单会话临时目录。返回是否有目录被删除；出错记 log 不抛出。"""
    if not _is_safe_session_id(session_id):
        logger.warning("跳过非法 session_id 的临时目录清理: %r", session_id)
        return False
    d = _tmp_root(workdir) / session_id
    if not d.is_dir():
        return False
    try:
        shutil.rmtree(d)
        logger.info("已清理会话临时目录: %s", d)
        return True
    except OSError as e:
        logger.warning("清理会话临时目录失败 %s: %s", d, e)
        return False


def cleanup_all_tmp(workdir: Path) -> int:
    """清空临时目录根下全部会话目录（根目录本身重建为空）。返回删除的目录数。"""
    root = _tmp_root(workdir)
    if not root.is_dir():
        return 0
    removed = 0
    try:
        for child in root.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
            else:
                child.unlink(missing_ok=True)
        if removed:
            logger.info("已清空临时工作区 %s（%d 个会话目录）", root, removed)
    except OSError as e:
        logger.warning("清空临时工作区失败 %s: %s", root, e)
    return removed
