"""GET /api/git/* —— 未提交改动视图（CONTEXT.md 2026-10-01 决议）。

只读观察面板：列出 staged + unstaged + untracked 的未提交改动集合，
点击文件返回工作区 vs HEAD 的单文件 Unified Diff（staged+unstaged 叠加
总净效果，不分层）。不含任何写操作（不做丢弃/stage/unstage——doclens
是知识库工具不是 git 客户端，提交全权归 Git Sync 机器人）。

前提 = 知识库为 git 根（与有无 remote 无关——没 remote 的纯本地 git
知识库恰是改动堆积最久的场景）；非 git 根 400 not_git_root（前端据
capability 探测隐藏入口）。
"""
import asyncio
import logging
import os
import subprocess
from pathlib import Path

from fastapi import APIRouter, Depends, Query

from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.deps import get_index_manager
from doclens.web_v2.models.git import (
    GitChange,
    GitChangesResponse,
    GitDiffResponse,
    Staging,
)

logger = logging.getLogger(__name__)
router = APIRouter()

GIT_TIMEOUT = 30  # 与 GitSync.GIT_TIMEOUT_LOCAL 同档（本地操作）


def _run_git(
    root: str, *args: str, timeout: int = GIT_TIMEOUT, ok_codes: tuple[int, ...] = (0,),
) -> subprocess.CompletedProcess:
    """在知识库目录执行 git 命令；失败抛 CortexAPIError（git 缺失/超时）。

    ok_codes：额外放行的退出码（diff --no-index 有差异时按惯例返回 1）。
    """
    try:
        r = subprocess.run(
            ["git", "-C", root, *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        logger.warning("git %s 执行异常: %s", args[0] if args else "", e)
        raise CortexAPIError(500, "GIT_ERROR", f"git 命令执行失败: {e}") from e
    if r.returncode not in ok_codes:
        raise CortexAPIError(500, "GIT_ERROR", f"git {' '.join(args[:2])} 失败: {r.stderr.strip()[:200]}")
    return r


def _is_git_root(root: Path) -> bool:
    """工作目录本身是否为 git 仓库根（与 GitSync._is_git_root 同口径：不含子仓库）。"""
    try:
        r = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=GIT_TIMEOUT,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    if r.returncode != 0:
        return False
    top = os.path.normcase(os.path.abspath(r.stdout.strip()))
    return top == os.path.normcase(str(root))


def _require_git_root(idx: IndexManager) -> str:
    root = str(idx.search_path)
    if not _is_git_root(Path(root)):
        raise CortexAPIError(400, "not_git_root", "当前知识库不是 git 仓库")
    return root


def _head_size(root: str, path: str) -> int | None:
    """HEAD 版本文件大小（bytes）；不在 HEAD（新增）或读取失败返回 None。"""
    try:
        r = subprocess.run(
            ["git", "-C", root, "cat-file", "-s", f"HEAD:{path}"],
            capture_output=True, text=True, timeout=GIT_TIMEOUT,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if r.returncode != 0:
        return None
    try:
        return int(r.stdout.strip())
    except ValueError:
        return None


def _worktree_size(root: str, path: str) -> int:
    try:
        return os.path.getsize(os.path.join(root, path))
    except OSError:
        return 0


def _parse_porcelain(root: str) -> list[GitChange]:
    """解析 `git status --porcelain`，归并为 GitChange 列表。

    porcelain XY 两列：X = 暂存层（HEAD→index），Y = 工作区层（index→worktree）。
    映射：?? → added/untracked；X∈{A,R,C} 或 Y∈{A,R,C} → added/modified 类；
    X=D → deleted(staged)；Y=D → deleted(unstaged)；其余 M → modified。
    staged/unstaged 分层徽章由 (X≠' ', Y≠' ') 双层判定。
    """
    r = _run_git(root, "status", "--porcelain", "--untracked-files=all", "-z")
    out: dict[str, GitChange] = {}

    for record in r.stdout.split("\0"):
        if not record:
            continue
        x, y = record[0], record[1]
        # -z 模式：重命名/复制为 "XY old -> new"，取新路径为准（Q12 决议）
        path = record[3:]
        if " -> " in path and x in ("R", "C"):
            path = path.rsplit(" -> ", 1)[1]

        if x == "?" and y == "?":
            kind, staging = "added", "untracked"
        elif "D" in (x, y):
            kind = "deleted"
            staging = "both" if (x != " " and y != " ") else ("staged" if x != " " else "unstaged")
        elif x in ("A", "R", "C"):
            kind, staging = "added", "staged" if y in (" ", "?") else "both"
        elif y in ("A", "R", "C"):
            kind, staging = "added", "unstaged"
        else:
            kind = "modified"
            staging = "both" if (x != " " and y != " ") else ("staged" if x != " " else "unstaged")

        if kind == "deleted":
            size, old_size = 0, _head_size(root, path)
        elif kind == "added":
            size, old_size = _worktree_size(root, path), None
        else:
            size, old_size = _worktree_size(root, path), _head_size(root, path)

        out[path] = GitChange(
            path=path, kind=kind, staging=staging,  # type: ignore[arg-type]
            size=size, old_size=old_size,
        )
    return list(out.values())


def _diff_binary_flag(root: str, path: str, kind: str) -> bool:
    """git 是否把该文件的 diff 判定为二进制（无行级 diff 可展示）。

    tracked 文件：`git diff --numstat [HEAD] -- path` 首列 "-" 即二进制
    （无 HEAD 变更输出空 → 再试无 HEAD 的 index/worktree 两层）。
    added（untracked）：--no-index 对比 devnull，同判据。
    """
    if kind == "added":
        r = subprocess.run(
            ["git", "-C", root, "diff", "--no-index", "--numstat", "--", os.devnull, path],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=GIT_TIMEOUT,
        )
    else:
        r = subprocess.run(
            ["git", "-C", root, "diff", "--numstat", "HEAD", "--", path],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=GIT_TIMEOUT,
        )
        if r.returncode == 0 and not r.stdout.strip():
            r = subprocess.run(
                ["git", "-C", root, "diff", "--numstat", "--", path],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=GIT_TIMEOUT,
            )
    if not r.stdout.strip():
        return False
    first = r.stdout.strip().splitlines()[0]
    # numstat 二进制行格式："-\t-\tpath"（注意 rc=1 是 --no-index 有差异的
    # 正常退出码，不在此拦——先看输出再下结论）
    return first.split("\t")[0] == "-"


@router.get("/git/changes", response_model=GitChangesResponse)
async def git_changes(idx: IndexManager = Depends(get_index_manager)):
    """未提交改动列表（staged + unstaged + untracked）。"""
    root = _require_git_root(idx)
    changes = await asyncio.to_thread(_parse_porcelain, root)
    return GitChangesResponse(changes=changes, total=len(changes))


@router.get("/git/diff", response_model=GitDiffResponse)
async def git_diff(
    path: str = Query(..., description="相对知识库根的 POSIX 路径"),
    idx: IndexManager = Depends(get_index_manager),
):
    """单文件 Unified Diff：工作区 vs HEAD 总净效果（-U3 hunk 稀疏）。"""
    root = _require_git_root(idx)
    full = Path(root) / path
    # 路径越权防护：拼出的绝对路径必须仍落在知识库根内（防 ../ 逃逸）
    try:
        full.resolve().relative_to(Path(root).resolve())
    except (ValueError, OSError):
        raise CortexAPIError(400, "invalid_path", "非法路径")

    # 该文件必须确实在改动集合中（查询不在集合的文件无 diff 语义）
    changes = await asyncio.to_thread(_parse_porcelain, root)
    change = next((c for c in changes if c.path == path), None)
    if change is None:
        raise CortexAPIError(404, "not_changed", "该文件不在未提交改动集合中")

    is_binary = await asyncio.to_thread(_diff_binary_flag, root, path, change.kind)

    if is_binary:
        # 二进制占位卡片（Q8 决议）：无内容对比，只给大小/哈希简写元数据
        def _sha(p: str | None) -> str | None:
            if p is None:
                return None
            try:
                r = subprocess.run(
                    ["git", "-C", root, "rev-parse", p],
                    capture_output=True, text=True, timeout=GIT_TIMEOUT,
                )
                return r.stdout.strip()[:12] if r.returncode == 0 else None
            except (OSError, subprocess.TimeoutExpired):
                return None

        blob = subprocess.run(
            ["git", "-C", root, "hash-object", str(full)],
            capture_output=True, text=True, timeout=GIT_TIMEOUT,
        )
        worktree_sha = blob.stdout.strip()[:12] if blob.returncode == 0 else None
        return GitDiffResponse(
            path=path, kind=change.kind, is_binary=True, diff="",
            binary_info={
                "old_size": change.old_size,
                "new_size": change.size if change.kind != "deleted" else 0,
                "old_sha": await asyncio.to_thread(_sha, f"HEAD:{path}"),
                "new_sha": worktree_sha,
            },
        )

    if change.kind == "added":
        # untracked / staged 新增：diff = 整文件全绿（对比空文件）。
        # 用相对路径 + prefix 归一，避免绝对路径泄漏进 diff 头；
        # --no-index 有差异时退出码为 1，属正常。
        r = await asyncio.to_thread(
            _run_git, root,
            "diff", "--no-index", "--no-color", "-U3",
            "--src-prefix=a/", "--dst-prefix=b/",
            "--", os.devnull, path,
            ok_codes=(0, 1),
        )
        diff = r.stdout
    else:
        r = await asyncio.to_thread(
            _run_git, root,
            "diff", "--no-color", "-U3", "HEAD", "--", path,
        )
        diff = r.stdout

    # 无 HEAD（空仓库首提交前）时 HEAD 不存在 → 退回对比空树的 diff
    if change.kind != "added" and not diff:
        try:
            r2 = await asyncio.to_thread(
                _run_git, root,
                "diff", "--no-color", "-U3", "--", path,
            )
            diff = r2.stdout
        except CortexAPIError:
            diff = ""

    return GitDiffResponse(path=path, kind=change.kind, is_binary=False, diff=diff)
