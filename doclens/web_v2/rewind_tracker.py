"""改前备份 / 快照 / 恢复（ADR-0027：回退即事实）。

两阶段模型（对齐 Claude Code fileHistory 的机制，存储形态换成本仓惯例）：

- **轮首快照**（``begin_turn``，chat.py 每轮请求入口调用）：对全部已追踪
  文件 stat/size/mtime 快路径 → 内容比对慢路径，变则新版本备份；快照挂
  锚点（最新 message_user 的 seq）落 sessions.db（rewind_snapshots 表，
  环形 100/会话）。
- **写前备份**（``track_structured`` / ``track_shell``，工具 handler 执行前
  包装调用）：备份改前内容**回填最新快照**——锚点时点状态由此可恢复。
  备份必须发生在写入之前，事后不可补录。

备份文件：``{数据目录}/rewind/{session_id}/{sha256(绝对路径)[:16]}@v{N}``
（整文件拷贝，copy2 保留 mtime 供变更检测快路径）。快照元数据在 DB，
文件内容在盘，删会话时 ``purge`` 级联清目录（store 侧 FK 只管 DB 行）。

best-effort 边界（UI 明示，不静默）：

- 命令文本扫描（planify guard 的 ``extract_write_targets``）漏掉的写
  （脚本内部生成文件）不备份不恢复；
- shell 扫描候选**不做**「不存在 → null 标记」——token 集合过宽，误记
  null 会在恢复时误删用户文件；null 仅来自结构化工具的显式写目标；
- 单文件超 ``max_bytes``（默认 50MB）跳过备份；
- 只盯文件，目录跳过（``rm -rf 目录`` 的内容不在恢复面内）。
"""
from __future__ import annotations

import hashlib
import logging
import shutil
import threading
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 单文件备份大小上限（50MB）：知识库有 GB 级 PST，整拷贝会吃穿磁盘。
# 超限文件不备份，恢复面里标「未备份，无法恢复」。
DEFAULT_MAX_BACKUP_BYTES = 50 * 1024 * 1024

# 变更检测内容比对的分块大小（8KB 足够，两文件 size 相同才走到这步）
_COMPARE_CHUNK = 8192


def _backup_name(path: Path, version: int) -> str:
    """备份文件名：路径哈希前 16 位 + 版本号（确定性，容纳 workdir 外路径）。"""
    digest = hashlib.sha256(str(path).encode("utf-8")).hexdigest()[:16]
    return f"{digest}@v{version}"


class RewindTracker:
    """按会话的改前备份与恢复（线程安全；GUI/web 链路专用）。"""

    def __init__(
        self,
        store,
        base_dir: Path,
        max_bytes: int = DEFAULT_MAX_BACKUP_BYTES,
    ):
        self._store = store
        self._base_dir = Path(base_dir)
        self._max_bytes = max_bytes
        self._lock = threading.RLock()

    # ---- 轮次生命周期 ----

    def begin_turn(self, session_id: str) -> None:
        """轮次开始：对已追踪文件快照并落库（anchor = 最新 message_user seq）。

        任何异常只记日志——备份失败不得阻断对话主流程。
        """
        try:
            anchor = self._store.last_message_user_seq(session_id)
            if anchor is None:
                return  # 无消息（防御；正常链路前端先落 message_user 再发请求）
            snapshots = self._store.list_rewind_snapshots(session_id)
            per_path = self._latest_entries(snapshots)
            new_backups: dict = {}
            for path, entry in per_path.items():
                fp = Path(path)
                try:
                    st = fp.stat()
                except FileNotFoundError:
                    # 仍不存在：null 标记随快照结转（锚点时不存在 → 恢复时删除）
                    new_backups[path] = {
                        "backup_file_name": None,
                        "version": entry["version"] + 1,
                    }
                    continue
                except OSError:
                    new_backups[path] = entry  # 无法 stat：沿用旧条目
                    continue
                if not fp.is_file():
                    continue  # 目录/非常规文件：脱离追踪（不备份不误删）
                if entry["backup_file_name"] is None or entry.get("skipped_reason"):
                    # 上轮不存在 / 上轮超限跳过，现在存在：尝试备份当前态
                    nb = self._create_backup(session_id, fp, entry["version"] + 1)
                    if nb is not None:
                        new_backups[path] = nb
                    else:
                        # 仍超限：结转 skip 条目（恢复面可见「未备份」，
                        # 绝不退化为 null——null 会在恢复时误删现存文件）
                        reason = entry.get("skipped_reason") or (
                            f"超过备份大小上限（{self._max_bytes} 字节），未备份"
                        )
                        new_backups[path] = {
                            "backup_file_name": None,
                            "version": entry["version"] + 1,
                            "skipped_reason": reason,
                        }
                elif self._origin_changed(
                    session_id, fp, entry["backup_file_name"], st
                ):
                    nb = self._create_backup(session_id, fp, entry["version"] + 1)
                    # 超限跳过：沿用旧条目（保持可恢复到上一版本）
                    new_backups[path] = nb if nb is not None else entry
                else:
                    new_backups[path] = entry  # 未变：版本指针结转
            evicted = self._store.append_rewind_snapshot(
                session_id, anchor, new_backups
            )
            self._cleanup_evicted(session_id, evicted)
        except Exception as e:  # noqa: BLE001
            logger.warning("rewind begin_turn failed for %s: %s", session_id, e)

    # ---- 写前备份（工具 handler 执行前调用）----

    def track_structured(self, session_id: str, raw_path: str, workdir: Path) -> None:
        """结构化写工具（write_file/edit_file）的改前备份。

        目标文件不存在时记 null 标记（恢复到锚点 = 删除该文件）——结构化
        工具的 path 参数是确定的写目标，null 语义可信。
        """
        try:
            fp = self._resolve(raw_path, workdir)
            self._track(session_id, fp, record_missing=True)
        except Exception as e:  # noqa: BLE001
            logger.warning("rewind track_structured failed (%s): %s", raw_path, e)

    def track_shell(self, session_id: str, command: str, workdir: Path) -> None:
        """shell 工具（bash/powershell/background_run）执行前的命令文本扫描备份。

        候选 = planify guard 的 ``extract_write_targets``（写段全部非首
        token，workdir 内外皆可）；只对**现存文件**备份，不记 null——
        token 集合过宽，null 会误删（见模块 docstring）。
        """
        try:
            from planify.tools.guard import extract_write_targets

            for cand in extract_write_targets(command, Path(workdir)):
                try:
                    if cand.is_file():
                        self._track(session_id, cand, record_missing=False)
                except OSError:
                    continue  # stat 失败的候选静默跳过（best-effort）
        except Exception as e:  # noqa: BLE001
            logger.warning("rewind track_shell failed: %s", e)

    def _track(self, session_id: str, fp: Path, *, record_missing: bool) -> None:
        """写前备份一条路径：幂等（最新快照已含则跳过），回填最新快照。"""
        with self._lock:
            snapshots = self._store.list_rewind_snapshots(session_id)
            if not snapshots:
                # 首轮前就有写（防御）：先补一个锚点快照再回填
                anchor = self._store.last_message_user_seq(session_id)
                if anchor is None:
                    return
                self._store.append_rewind_snapshot(session_id, anchor, {})
                snapshots = self._store.list_rewind_snapshots(session_id)
            key = str(fp)
            if key in snapshots[-1]["tracked_file_backups"]:
                return  # 最新快照已追踪（Claude Code trackEdit 同款幂等）
            per_path = self._latest_entries(snapshots)
            entry = per_path.get(key)
            version = (entry["version"] if entry else 0) + 1
            try:
                st = fp.stat()
            except FileNotFoundError:
                if record_missing:
                    self._store.backfill_rewind_snapshot(session_id, key, {
                        "backup_file_name": None, "version": version,
                    })
                return
            except OSError:
                return
            if not fp.is_file():
                return
            nb = self._create_backup(session_id, fp, version)
            if nb is not None:
                self._store.backfill_rewind_snapshot(session_id, key, nb)
            else:
                # 超限跳过：记 skip 条目（恢复面明示「未备份」，ADR-0027
                # 确认框契约）——backup_file_name 为 None 但带 skipped_reason，
                # 恢复时按跳过处置而非删除
                self._store.backfill_rewind_snapshot(session_id, key, {
                    "backup_file_name": None,
                    "version": version,
                    "skipped_reason": (
                        f"超过备份大小上限（{self._max_bytes} 字节），未备份"
                    ),
                })

    # ---- 恢复（预览 / 执行共用同一规划）----

    def preview(self, session_id: str, point_seq: int) -> dict:
        """回退预览（不写盘）：按锚点快照规划每个追踪文件的三态处置。"""
        return self._restore(session_id, point_seq, apply=False)

    def restore(self, session_id: str, point_seq: int) -> dict:
        """执行恢复：逐文件三态处置，逐文件容错（单文件失败不阻断整批）。

        Returns:
            {"restored": [...], "deleted": [...],
             "skipped": [{"path", "reason"}...], "failed": [{"path", "error"}...]}
        """
        return self._restore(session_id, point_seq, apply=True)

    def _restore(self, session_id: str, point_seq: int, *, apply: bool) -> dict:
        snapshots = self._store.list_rewind_snapshots(session_id)
        # 目标快照 = 该锚点的最后一条（同锚点多轮只认最新——与回放投影
        # 「最后一个边界生效」组合语义一致）
        target = None
        for snap in snapshots:
            if snap["anchor_seq"] == point_seq:
                target = snap
        per_path = self._latest_entries(snapshots)
        first_version = self._first_versions(snapshots)

        result = {"restored": [], "deleted": [], "skipped": [], "failed": []}
        for path in per_path:
            try:
                self._restore_one(
                    session_id, path, target, first_version, result, apply
                )
            except Exception as e:  # noqa: BLE001
                result["failed"].append({"path": path, "error": str(e)})
        return result

    def _restore_one(
        self, session_id: str, path: str, target, first_version: dict,
        result: dict, apply: bool,
    ) -> None:
        fp = Path(path)
        # 目标态：锚点快照条目；锚点后才首触的文件退回首版本（首触前内容）
        entry = None
        if target is not None:
            entry = target["tracked_file_backups"].get(path)
        if entry is None:
            entry = first_version.get(path)
        if entry is None:
            result["skipped"].append({"path": path, "reason": "无备份（未追踪或扫描漏检）"})
            return
        if entry.get("skipped_reason"):
            # 超限未备份：明示跳过（null + skipped_reason ≠ 「不存在」）
            result["skipped"].append({
                "path": path, "reason": entry["skipped_reason"],
            })
            return
        backup_name = entry["backup_file_name"]
        if backup_name is None:
            # 锚点时不存在 → 现存则删除
            if fp.exists():
                if apply:
                    if fp.is_dir():
                        shutil.rmtree(fp)
                    else:
                        fp.unlink()
                result["deleted"].append(path)
            return
        backup_path = self._session_dir(session_id) / backup_name
        if not backup_path.exists():
            result["skipped"].append({"path": path, "reason": "备份文件缺失（环形淘汰）"})
            return
        try:
            st = fp.stat()
        except FileNotFoundError:
            pass  # 现文件缺失 → 直接恢复
        except OSError:
            st = None
        changed = st is None or not fp.is_file() or self._origin_changed(
            session_id, fp, backup_name, st
        )
        if changed:
            if apply:
                fp.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup_path, fp)
            result["restored"].append(path)

    # ---- 生命周期 ----

    def purge(self, session_id: str) -> None:
        """删会话时级联清备份目录（DB 行由 FK ON DELETE CASCADE 自理）。"""
        try:
            shutil.rmtree(self._session_dir(session_id), ignore_errors=True)
        except Exception as e:  # noqa: BLE001
            logger.warning("rewind purge failed for %s: %s", session_id, e)

    # ---- 内部 ----

    def _session_dir(self, session_id: str) -> Path:
        return self._base_dir / session_id

    @staticmethod
    def _resolve(raw_path: str, workdir: Path) -> Path:
        p = Path(raw_path)
        return p if p.is_absolute() else (Path(workdir) / p)

    @staticmethod
    def _latest_entries(snapshots: list) -> dict:
        """跨快照归并每个路径的最新条目（版本链指针，快照按 id 升序）。"""
        per_path: dict = {}
        for snap in snapshots:
            for path, entry in snap["tracked_file_backups"].items():
                per_path[path] = entry
        return per_path

    @staticmethod
    def _first_versions(snapshots: list) -> dict:
        """每个路径的首版本条目（v1 = 首次改前内容；跨快照找 version==1）。"""
        first: dict = {}
        for snap in snapshots:
            for path, entry in snap["tracked_file_backups"].items():
                if entry.get("version") == 1 and path not in first:
                    first[path] = entry
        return first

    def _create_backup(self, session_id: str, fp: Path, version: int) -> Optional[dict]:
        """整文件备份（copy2 保留 mtime）。超限跳过返回 None。"""
        st = fp.stat()
        if st.st_size > self._max_bytes:
            logger.info(
                "rewind backup skipped (size %d > %d): %s",
                st.st_size, self._max_bytes, fp,
            )
            return None
        # 版本号防撞：环形淘汰可能丢掉版本计数，以磁盘现存最大版本兜底
        version = max(version, self._disk_max_version(session_id, fp) + 1)
        name = _backup_name(fp, version)
        dst = self._session_dir(session_id) / name
        if not dst.exists():  # 同名已存在（同版本同内容）直接复用
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(fp, dst)
        return {"backup_file_name": name, "version": version}

    def _disk_max_version(self, session_id: str, fp: Path) -> int:
        """备份目录里该路径现存的最大版本号（0 = 无备份）。"""
        prefix = hashlib.sha256(str(fp).encode("utf-8")).hexdigest()[:16] + "@v"
        best = 0
        try:
            for name in self._session_dir(session_id).iterdir():
                if name.name.startswith(prefix):
                    try:
                        best = max(best, int(name.name[len(prefix):]))
                    except ValueError:
                        continue
        except OSError:
            return 0
        return best

    def _origin_changed(
        self, session_id: str, fp: Path, backup_name: str, st=None
    ) -> bool:
        """现文件 vs 备份是否不同：size 快路径 → mtime 快路径 → 内容比对。"""
        backup_path = self._session_dir(session_id) / backup_name
        try:
            bst = backup_path.stat()
        except OSError:
            return True  # 备份找不到：视为已变（触发新备份，无害）
        if st is None:
            try:
                st = fp.stat()
            except OSError:
                return True
        if st.st_size != bst.st_size:
            return True
        if st.st_mtime < bst.st_mtime:
            return False  # 现文件早于备份：未动过（copy2 保留源 mtime）
        with open(fp, "rb") as a, open(backup_path, "rb") as b:
            while True:
                ca = a.read(_COMPARE_CHUNK)
                cb = b.read(_COMPARE_CHUNK)
                if ca != cb:
                    return True
                if not ca:
                    return False

    def _cleanup_evicted(self, session_id: str, evicted: list) -> None:
        """环形淘汰后清理孤儿备份文件（不再被任何幸存快照引用的文件）。"""
        if not evicted:
            return
        session_dir = self._session_dir(session_id)
        survivors = self._store.list_rewind_snapshots(session_id)
        referenced = set()
        for snap in survivors:
            for entry in snap["tracked_file_backups"].values():
                name = entry.get("backup_file_name")
                if name:
                    referenced.add(name)
        for snap in evicted:
            for entry in snap.get("tracked_file_backups", {}).values():
                name = entry.get("backup_file_name")
                if name and name not in referenced:
                    try:
                        (session_dir / name).unlink(missing_ok=True)
                    except OSError:
                        pass  # 清理失败留待下次（无功能影响）


def bind_rewind_hooks(tool_handlers: dict, tracker, session_id: str, workdir: Path) -> None:
    """按请求包装写类工具 handler（改前备份，ADR-0027）。

    在 chat.py 的浅拷贝 tool_handlers 上**原位替换**（不污染共享 runtime
    单例，与 bind_user_interaction_handlers 同律）。备份失败只记日志，
    绝不阻断工具调用本身。tracker 为 None（未启用）时 no-op。
    """
    if tracker is None or not session_id:
        return

    def _wrap(name: str, pre):
        orig = tool_handlers.get(name)
        if not orig:
            return

        def handler(**kw):
            pre(kw)
            return orig(**kw)

        tool_handlers[name] = handler

    def _pre_file(kw):
        tracker.track_structured(session_id, kw.get("path", ""), workdir)

    def _pre_shell(kw):
        tracker.track_shell(session_id, kw.get("command", ""), workdir)

    for name in ("write_file", "edit_file"):
        _wrap(name, _pre_file)
    for name in ("bash", "powershell", "background_run"):
        _wrap(name, _pre_shell)
