"""Git 同步模块 - 知识库目录为 git 根时的定期 auto-commit → pull → merge → push 循环。

设计决议（CONTEXT.md / ADR-0006）：
- 仅 GUI 进程运行；纯固定间隔，无启动立即触发、无变更驱动。
- app 全自动 auto-commit：机器人身份 doclens-sync（逐命令 -c 指定，不污染用户 git 配置）。
- 合并冲突偏向本地（-X ours）：远端改动静默从工作区消失，git 历史仍可捞回。
- 同步范围仅内容文件：本地状态目录（.cortex / .doclens）由本组件自动写入 .gitignore。
- 降级行为：没配 remote → 整体停摆（不启动）；detached HEAD / MERGING 等异常状态
  及网络/认证/push 失败 → 本轮跳过 + 弱提醒（status().message）+ 下轮重试。
- 不自动修复：不 merge --abort、不 force-push、不创建/切换分支。
"""

import logging
import os
import subprocess
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

# 机器人提交身份（逐命令 -c 指定，不写入用户的 git config）
ROBOT_NAME = "doclens-sync"
ROBOT_EMAIL = "doclens-sync@local"

# 本地 git 操作（add/commit/status 类）与网络操作（pull/push）的超时
GIT_TIMEOUT_LOCAL = 30
GIT_TIMEOUT_NET = 120

# 未启动原因（status()["reason"]，供前端区分展示）
REASON_NOT_GIT_ROOT = "not_git_root"
REASON_NO_REMOTE = "no_remote"


class GitSync:
    """知识库 git 同步循环。

    内部维护可观测状态（status()），与 FileWatcher 同一模式：
    后台线程写、API 线程读，靠 _state_lock 保护。
    on_cycle_done 回调在每一轮结束（成功/失败/跳过）后触发，用于 SSE 广播。
    """

    def __init__(
        self,
        search_path: str,
        interval_seconds: float = 300.0,
        data_dir: str = ".cortex",
        on_cycle_done=None,
    ):
        self._path = os.path.abspath(search_path)
        self._interval = max(1.0, interval_seconds)
        self._data_dir = data_dir
        self._on_cycle_done = on_cycle_done
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        # 可观测状态（受 _state_lock 保护）
        self._state_lock = threading.Lock()
        self._running = False
        self._reason = ""  # 未启动原因："" | not_git_root | no_remote
        self._last_sync_at: Optional[float] = None
        self._last_success: Optional[bool] = None
        self._message = ""  # 弱提醒文案（"" = 无提醒）
        self._fail_count = 0

    # ------------------------------------------------------------------ git 原语

    def _git(self, *args: str, timeout: int = GIT_TIMEOUT_LOCAL) -> Optional[subprocess.CompletedProcess]:
        """在知识库目录执行 git 命令；异常（git 不存在/超时）返回 None，绝不抛出。"""
        try:
            return subprocess.run(
                ["git", "-C", self._path, *args],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except (OSError, subprocess.TimeoutExpired) as e:
            logger.warning("GitSync git %s 执行异常: %s", args[0] if args else "", e)
            return None

    def _is_git_root(self) -> bool:
        """工作目录本身是否为 git 仓库根（不是某个子目录）。"""
        r = self._git("rev-parse", "--show-toplevel")
        if r is None or r.returncode != 0:
            return False
        top = os.path.normcase(os.path.abspath(r.stdout.strip()))
        return top == os.path.normcase(self._path)

    def _has_remote(self) -> bool:
        r = self._git("remote")
        return r is not None and r.returncode == 0 and bool(r.stdout.strip())

    def _abnormal_state(self) -> str:
        """检测需要人工介入的仓库状态；返回弱提醒文案，正常返回 ""。"""
        r = self._git("rev-parse", "-q", "--verify", "MERGE_HEAD")
        if r is not None and r.returncode == 0:
            return "同步暂停：仓库处于合并中断状态，请手工处理"
        r = self._git("symbolic-ref", "-q", "HEAD")
        if r is None or r.returncode != 0:
            return "同步暂停：仓库处于 detached HEAD，请手工处理"
        return ""

    def _ensure_gitignore(self) -> None:
        """把本地状态目录（.cortex / .doclens）写入知识库 .gitignore（幂等）。"""
        gitignore = os.path.join(self._path, ".gitignore")
        entry = f"{self._data_dir}/"
        try:
            existing = ""
            if os.path.exists(gitignore):
                with open(gitignore, "r", encoding="utf-8", errors="replace") as f:
                    existing = f.read()
            covered = {
                line.strip()
                for line in existing.splitlines()
                if line.strip() and not line.strip().startswith("#")
            }
            if entry in covered or entry.rstrip("/") in covered or f"/{entry}" in covered:
                return
            with open(gitignore, "a", encoding="utf-8") as f:
                if existing and not existing.endswith("\n"):
                    f.write("\n")
                f.write(f"# doclens 本地状态（索引/会话/密钥），不随知识库同步\n{entry}\n")
            logger.info("GitSync 已将 %s 写入 %s", entry, gitignore)
        except OSError as e:
            logger.warning("GitSync 写入 .gitignore 失败: %s", e)

    def _ensure_gitattributes(self) -> None:
        """把日记目录的 union 合并例外写入知识库 .gitattributes（幂等，ADR-0008）。

        日记年度 md 是多设备高频追加文件，全局 ours-wins 会静默丢失他端片段；
        `日记/** merge=union` 让冲突时双方追加的行都保留。
        """
        gitattributes = os.path.join(self._path, ".gitattributes")
        entry = "日记/** merge=union"
        try:
            existing = ""
            if os.path.exists(gitattributes):
                with open(gitattributes, "r", encoding="utf-8", errors="replace") as f:
                    existing = f.read()
            covered = {
                line.strip()
                for line in existing.splitlines()
                if line.strip() and not line.strip().startswith("#")
            }
            if entry in covered:
                return
            with open(gitattributes, "a", encoding="utf-8") as f:
                if existing and not existing.endswith("\n"):
                    f.write("\n")
                f.write(f"# 日记目录：多设备追加冲突时双方保留（ADR-0008，ours-wins 的按路径例外）\n{entry}\n")
            logger.info("GitSync 已将 %s 写入 %s", entry, gitattributes)
        except OSError as e:
            logger.warning("GitSync 写入 .gitattributes 失败: %s", e)

    # ------------------------------------------------------------------ 生命周期

    def start(self) -> bool:
        """启动同步循环。前置条件不满足（非 git 根 / 无 remote）则不启动，返回 False。"""
        if not self._is_git_root():
            with self._state_lock:
                self._reason = REASON_NOT_GIT_ROOT
            logger.info("GitSync 未启动：%s 不是 git 仓库根目录", self._path)
            return False
        if not self._has_remote():
            with self._state_lock:
                self._reason = REASON_NO_REMOTE
            logger.info("GitSync 未启动：%s 没有配置 remote", self._path)
            return False

        self._ensure_gitignore()
        self._ensure_gitattributes()
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, name="doclens-git-sync", daemon=True)
        self._thread.start()
        with self._state_lock:
            self._running = True
        logger.info("GitSync 已启动：%s，间隔 %.0fs", self._path, self._interval)
        return True

    def stop(self) -> None:
        """停止同步循环（幂等）。"""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None
        with self._state_lock:
            self._running = False

    def status(self) -> dict:
        """返回同步状态快照（线程安全）。message 非空 = 弱提醒。"""
        with self._state_lock:
            return {
                "running": self._running,
                "reason": self._reason,
                "last_sync_at": self._last_sync_at,
                "last_success": self._last_success,
                "message": self._message,
                "fail_count": self._fail_count,
            }

    # ------------------------------------------------------------------ 同步循环

    def _loop(self) -> None:
        """纯固定间隔：先等一个间隔再跑第一轮，无启动立即触发。"""
        while not self._stop_event.wait(self._interval):
            self.run_once()

    def run_once(self) -> None:
        """执行一轮同步（auto-commit → pull → push）。拆出来供循环与测试共用。"""
        try:
            self._cycle()
        except Exception as e:  # noqa: BLE001 — 循环线程绝不因单轮异常退出
            logger.exception("GitSync 本轮同步异常: %s", e)
            self._finish(success=False, message="同步失败：内部错误，下轮重试")

    def _cycle(self) -> None:
        # 1. 异常状态（merge 中断 / detached HEAD）→ 本轮停摆，不自动修复
        abnormal = self._abnormal_state()
        if abnormal:
            self._finish(success=False, message=abnormal)
            return

        # 2. auto-commit 本地改动（机器人身份）
        r = self._git("add", "-A")
        if r is None or r.returncode != 0:
            self._finish(success=False, message="同步失败：git add 出错，下轮重试")
            return
        r = self._git("diff", "--cached", "--quiet")
        if r is not None and r.returncode == 1:
            # 有暂存改动 → 统计文件数并提交
            files = self._git("diff", "--cached", "--name-only")
            n = len([ln for ln in (files.stdout if files else "").splitlines() if ln.strip()])
            r = self._git(
                "-c", f"user.name={ROBOT_NAME}",
                "-c", f"user.email={ROBOT_EMAIL}",
                "commit", "-m", f"doclens: auto-sync ({n} files)",
            )
            if r is None or r.returncode != 0:
                self._finish(success=False, message="同步失败：auto-commit 出错，下轮重试")
                return

        # 3. fetch + merge（冲突偏向本地 -X ours；--no-edit 不弹编辑器）
        # 先显式 fetch：clone 空 remote 后本地还没有上游跟踪 ref，
        # 不 fetch 就判断 @{u} 会误判"无上游"而跳过合并直接 push（必被拒）。
        r = self._git("fetch", timeout=GIT_TIMEOUT_NET)
        if r is None or r.returncode != 0:
            detail = (r.stderr or r.stdout).strip() if r else ""
            logger.warning("GitSync fetch 失败: %s", detail)
            self._finish(success=False, message="同步失败：fetch 出错（网络/认证？），下轮重试")
            return
        # fetch 后仍无上游 ref = 空 remote 首次同步：无内容可合并，直接走 push
        up = self._git("rev-parse", "-q", "--verify", "@{u}")
        if up is not None and up.returncode == 0:
            # --allow-unrelated-histories：两台机器各自 clone 空 remote 并独立
            # auto-commit 后，两边 root commit 无共同祖先，属同步场景的正常首合并
            r = self._git("merge", "--no-edit", "-X", "ours", "--allow-unrelated-histories", "@{u}")
            if r is None or r.returncode != 0:
                detail = (r.stderr or r.stdout).strip() if r else ""
                logger.warning("GitSync merge 失败: %s", detail)
                self._finish(success=False, message="同步失败：merge 出错，下轮重试")
                return

        # 4. push（永不 force-push；被拒则下轮重试）
        r = self._git("push", timeout=GIT_TIMEOUT_NET)
        if r is not None and r.returncode != 0:
            # 分支未设上游（push 必败）→ 显式 push -u 建立跟踪后视为成功路径
            tracking = self._git("rev-parse", "--abbrev-ref", "@{u}")
            if tracking is not None and tracking.returncode != 0:
                remotes = self._git("remote")
                remote = (remotes.stdout.splitlines() or ["origin"])[0].strip() if remotes else "origin"
                logger.info("GitSync 分支无上游，改用 push -u %s HEAD", remote)
                r = self._git("push", "-u", remote, "HEAD", timeout=GIT_TIMEOUT_NET)
        if r is None or r.returncode != 0:
            detail = (r.stderr or r.stdout).strip() if r else ""
            logger.warning("GitSync push 失败: %s", detail)
            self._finish(success=False, message="同步失败：push 被拒，下轮重试")
            return

        self._finish(success=True, message="")

    def _finish(self, success: bool, message: str) -> None:
        with self._state_lock:
            self._last_sync_at = time.time()
            self._last_success = success
            self._message = message
            self._fail_count = 0 if success else self._fail_count + 1
        if self._on_cycle_done:
            try:
                self._on_cycle_done(self.status())
            except Exception as e:  # noqa: BLE001 — 回调异常不影响循环
                logger.warning("GitSync on_cycle_done 回调异常: %s", e)
