"""会话库（sessions.db）整库备份与恢复（ADR-0047）。

背景：2026-10-21 sessions.db 损坏事故，多年对话丢失。本模块提供：

- **备份**：SQLite backup API 一致性快照（WAL 下无需拷 -wal/-shm），整库
  不筛表，落 ``{数据目录}/backups/sessions/``，环形保留 10 份（全量，
  不做增量/差异链——十几 MB 量级不值得）。
- **恢复**：损坏库改名 ``sessions.db.corrupt-<时间戳>`` 留原地（留尸供
  事后抢救，不自动删）→ 最新备份整拷回 → 验证可打开。
- **触发时机**：启动时（无近 1 小时内新备份才做）+ 长驻每 24 小时；
  退出时**不**备份（库损坏多伴随崩溃/断电，退出路径在该场景不执行）。

损坏检测两面（本模块只提供原语，接线在 deps / errors）：
1. 启动/热切换构建 SessionsStore 失败（``sqlite3.DatabaseError``）；
2. 运行中 API 捕获 DatabaseError（malformed / disk I/O error）。

人工恢复入口：控制面板「会话备份」（GET /api/sessions/backups 清单 +
POST /api/sessions/backups/{file}/restore）。恢复完成后经 watch SSE 广播
``sessions_restored`` 事件，前端 toast + 刷新会话列表。
"""
from __future__ import annotations

import logging
import shutil
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

#: 环形保留份数（每次备份后删最旧）
BACKUP_KEEP = 10

#: 启动备份的最小间隔：近 1 小时内已有新备份则跳过（防频繁重启刷备份）
STARTUP_BACKUP_MIN_INTERVAL_SEC = 3600.0

#: 长驻定时备份间隔（24h）
PERIODIC_BACKUP_INTERVAL_SEC = 24 * 3600.0

#: 备份文件名模式（UTC 时间戳，字典序 = 时间序）
_BACKUP_NAME = "sessions-{ts}.db"
_BACKUP_TS_FMT = "%Y%m%dT%H%M%SZ"

#: 损坏库改名模式
_CORRUPT_SUFFIX_FMT = "%Y%m%dT%H%M%SZ"

# 备份/恢复互斥锁：备份读库、恢复换库文件，两者并发会拿到撕裂状态。
# 模块级单锁（进程内）；跨进程实例本就各持各的数据目录，无共享。
_lock = threading.Lock()


def backup_dir(db_path: Path) -> Path:
    """备份目录：与 sessions.db 同数据目录的 ``backups/sessions/``。

    与 rewind/ 同惯例——天然被索引器排除、被 GitSync 自动 gitignore。
    """
    return db_path.parent / "backups" / "sessions"


def _ts_name(ts: float) -> str:
    return _BACKUP_NAME.format(
        ts=datetime.fromtimestamp(ts, tz=timezone.utc).strftime(_BACKUP_TS_FMT)
    )


def list_backups(db_path: Path) -> list[dict]:
    """备份清单（新→旧）：[{file, size_bytes, created_at_iso}]。

    只认本模块命名模式的文件；损坏库残留（.corrupt-*）不在其列
    （``list_corrupt_files`` 单独供 UI 展示）。
    """
    d = backup_dir(db_path)
    if not d.is_dir():
        return []
    out = []
    for p in d.iterdir():
        if not p.is_file() or not p.name.startswith("sessions-") or not p.name.endswith(".db"):
            continue
        if ".corrupt-" in p.name:
            continue
        try:
            mtime = p.stat().st_mtime
        except OSError:
            continue
        out.append({
            "file": p.name,
            "size_bytes": p.stat().st_size,
            "created_at": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(timespec="seconds"),
        })
    out.sort(key=lambda x: x["file"], reverse=True)
    return out


def list_corrupt_files(db_path: Path) -> list[dict]:
    """损坏库改名残留清单（新→旧）：[{file, size_bytes, created_at_iso}]。"""
    parent = db_path.parent
    out = []
    if not parent.is_dir():
        return out
    prefix = db_path.name + ".corrupt-"
    for p in parent.iterdir():
        if not p.is_file() or not p.name.startswith(prefix):
            continue
        try:
            st = p.stat()
        except OSError:
            continue
        out.append({
            "file": p.name,
            "size_bytes": st.st_size,
            "created_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(timespec="seconds"),
        })
    out.sort(key=lambda x: x["file"], reverse=True)
    return out


def latest_backup_age_sec(db_path: Path) -> Optional[float]:
    """最新一份备份的年龄（秒）；无备份返回 None。"""
    d = backup_dir(db_path)
    if not d.is_dir():
        return None
    stamps = [
        p.name[len("sessions-"):-len(".db")]
        for p in d.iterdir()
        if p.is_file() and p.name.startswith("sessions-") and p.name.endswith(".db")
        and ".corrupt-" not in p.name
    ]
    if not stamps:
        return None
    newest = max(stamps)
    try:
        t = datetime.strptime(newest, _BACKUP_TS_FMT).replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return time.time() - t.timestamp()


def create_backup(db_path: Path, *, reason: str = "") -> Optional[dict]:
    """做一次一致性整库备份（SQLite backup API）。

    WAL 模式下 backup API 在源库上取读快照，无需停写、无需拷 -wal/-shm。
    失败只告警返回 None（备份是韧性机制，失败不能打断主流程）；
    成功后执行环形淘汰。

    Args:
        db_path: sessions.db 路径。
        reason: 触发原因（startup / periodic / manual），仅入日志。
    """
    if not Path(db_path).exists():
        return None
    with _lock:
        bdir = backup_dir(db_path)
        bdir.mkdir(parents=True, exist_ok=True)
        dest_path = bdir / _ts_name(time.time())
        src = sqlite3.connect(str(db_path))
        try:
            dest = sqlite3.connect(str(dest_path))
            try:
                src.backup(dest)
            finally:
                dest.close()
        finally:
            src.close()
        _evict_overkeep(bdir)
        logger.info(
            "sessions.db backup created (%s): %s (%d bytes)",
            reason or "unspecified", dest_path.name, dest_path.stat().st_size,
        )
        return {
            "file": dest_path.name,
            "size_bytes": dest_path.stat().st_size,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }


def _evict_overkeep(bdir: Path) -> None:
    """环形淘汰：超出 BACKUP_KEEP 份删最旧（按文件名字典序）。"""
    files = sorted(
        p for p in bdir.iterdir()
        if p.is_file() and p.name.startswith("sessions-") and p.name.endswith(".db")
        and ".corrupt-" not in p.name
    )
    for p in files[:-BACKUP_KEEP] if len(files) > BACKUP_KEEP else []:
        try:
            p.unlink()
            logger.info("backup evicted (ring): %s", p.name)
        except OSError as e:
            logger.warning("backup evict failed: %s: %s", p.name, e)


def _verify_openable(db_path: Path) -> bool:
    """库文件能否正常打开并读 schema（恢复后自检）。"""
    try:
        conn = sqlite3.connect(str(db_path))
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1").fetchone()
        finally:
            conn.close()
        return True
    except sqlite3.DatabaseError:
        return False


def restore_backup(db_path: Path, backup_file: str) -> dict:
    """用指定备份恢复 sessions.db。

    流程（持锁）：目标库改名 ``.corrupt-<ts>`` 留原地 → 备份整拷到目标
    路径（先写临时文件再原子 rename，防半拷状态）→ 验证可打开；验证
    失败回滚（删半拷、改回原名）并抛错。

    Returns:
        {"restored_from": 备份文件名, "corrupt_renamed": 改名后的损坏库文件名或 None,
         "backup_created_at": 备份时间点 ISO}
    Raises:
        FileNotFoundError: 备份不存在（或不在备份目录内——防路径穿越）。
        RuntimeError: 恢复后验证失败（已回滚）。
    """
    db_path = Path(db_path)
    bdir = backup_dir(db_path)
    src = (bdir / backup_file).resolve()
    if bdir.resolve() not in src.parents or not src.is_file():
        raise FileNotFoundError(f"备份不存在: {backup_file}")

    with _lock:
        corrupt_name = None
        tmp_path = db_path.with_name(db_path.name + ".restore-tmp")
        if db_path.exists():
            corrupt_name = (
                db_path.name + ".corrupt-"
                + datetime.now(timezone.utc).strftime(_CORRUPT_SUFFIX_FMT)
            )
            db_path.rename(db_path.parent / corrupt_name)
            logger.warning("sessions.db corrupted/displaced: renamed to %s", corrupt_name)
        try:
            shutil.copyfile(src, tmp_path)
            if not _verify_openable(tmp_path):
                raise RuntimeError("备份文件校验失败（无法作为 SQLite 库打开）")
            tmp_path.replace(db_path)
        except BaseException:
            # 回滚：删半拷残留，把改名库放回去
            tmp_path.unlink(missing_ok=True)
            if corrupt_name and not db_path.exists():
                (db_path.parent / corrupt_name).rename(db_path)
            raise
        # 附带清 WAL/SHM 残留（旧库的 wal 属于改名库，不复用）
        for suffix in ("-wal", "-shm"):
            sidecar = db_path.with_name(db_path.name + suffix)
            try:
                sidecar.unlink(missing_ok=True)
            except OSError:
                pass
        logger.info("sessions.db restored from backup %s", backup_file)
        return {
            "restored_from": backup_file,
            "corrupt_renamed": corrupt_name,
            "backup_created_at": datetime.fromtimestamp(
                src.stat().st_mtime, tz=timezone.utc
            ).isoformat(timespec="seconds"),
        }


def restore_latest(db_path: Path) -> Optional[dict]:
    """从最新备份恢复（自动恢复路径用）；无备份返回 None。"""
    backups = list_backups(db_path)
    if not backups:
        return None
    return restore_backup(db_path, backups[0]["file"])


# ---------------------------------------------------------------------------
# 触发时机：启动备份（节流）+ 24h 定时器
# ---------------------------------------------------------------------------

_timer: Optional[threading.Timer] = None
_timer_lock = threading.Lock()


def backup_if_due(db_path: Path, *, reason: str = "startup") -> Optional[dict]:
    """启动/热切换时的备份入口：近 1 小时内已有新备份则跳过。

    备份失败静默告警（韧性机制不打断主流程）。
    """
    try:
        age = latest_backup_age_sec(db_path)
        if age is not None and age < STARTUP_BACKUP_MIN_INTERVAL_SEC:
            return None
        return create_backup(db_path, reason=reason)
    except Exception as e:  # noqa: BLE001
        logger.warning("startup session backup failed: %s", e)
        return None


def start_periodic_backup(db_path: Path) -> None:
    """启动 24h 周期备份定时器（daemon 线程级，进程退出即消亡）。

    幂等：已有定时器在跑时先取消旧的。每次到期备份后重新装弹
    （周期 = 备份完成时刻 + 24h，非固定整点）。
    """
    global _timer
    stop_periodic_backup()
    with _timer_lock:
        _timer = threading.Timer(
            PERIODIC_BACKUP_INTERVAL_SEC,
            _periodic_tick,
            args=(db_path,),
        )
        _timer.daemon = True
        _timer.start()


def _periodic_tick(db_path: Path) -> None:
    try:
        create_backup(db_path, reason="periodic")
    except Exception as e:  # noqa: BLE001
        logger.warning("periodic session backup failed: %s", e)
    # 重新装弹（db_path 不变；工作目录热切换时由 start_ 重启）
    start_periodic_backup(db_path)


def stop_periodic_backup() -> None:
    """停掉周期备份定时器（工作目录切换 / 进程退出前调用）。"""
    global _timer
    with _timer_lock:
        t = _timer
        _timer = None
    if t is not None:
        t.cancel()
