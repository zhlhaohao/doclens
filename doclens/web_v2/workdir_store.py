"""最近工作目录存储层（ADR-0043）。

全局单层 JSON 文件 ``~/.cortex/recent_workdirs.json``（发行版 ``~/.doclens/``）。
机器级本地资产（类比模型预设）：位于数据目录（已被 Git 同步 gitignore 排除）、
不参与知识库 Git 同步、各机器各自维护。

行为口径（ADR-0043）：
- 按最近使用时间倒序、按 normcase 路径去重，上限 ``_MAX_ITEMS`` 条；
- 读取时**静默过滤**已不存在的目录（列表永远干净）；
- 写入时机：进程启动落定 workdir 时 + 每次热切换成功时。

线程安全：文件读写经进程内锁串行化；写采用临时文件 + ``os.replace`` 原子替换。
"""
import json
import os
import threading
from datetime import datetime, timezone
from typing import Optional

from doclens.config import get_global_cortex_dir

_LOCK = threading.Lock()
_FILENAME = "recent_workdirs.json"
_SCHEMA_VERSION = 1
_MAX_ITEMS = 20


def normalize_workdir(path: str) -> str:
    """规范化工作目录路径（与 cortex_cli._apply_workdir_override 同口径）。

    expanduser + abspath + 去尾斜杠；比较请用 ``same_workdir``（normcase）。
    """
    return os.path.abspath(os.path.expanduser(path.strip())).rstrip("\\/")


def same_workdir(a: str, b: str) -> bool:
    """两个路径是否指向同一目录（Windows normcase 大小写折叠）。"""
    return os.path.normcase(normalize_workdir(a)) == os.path.normcase(normalize_workdir(b))


def _store_path():
    return get_global_cortex_dir() / _FILENAME


def _empty_data() -> dict:
    return {"version": _SCHEMA_VERSION, "items": []}


def _load_raw() -> dict:
    """读取原始 JSON。文件缺失或损坏时返回空结构（不抛错）。"""
    path = _store_path()
    if not path.exists():
        return _empty_data()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty_data()
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        return _empty_data()
    return data


def _save_raw(data: dict) -> None:
    """原子写：临时文件 + os.replace。"""
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(tmp, path)


def record_workdir(path: str) -> None:
    """记录一个工作目录（去重后置顶，截断到上限）。"""
    norm = normalize_workdir(path)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with _LOCK:
        data = _load_raw()
        items = [
            it for it in data["items"]
            if isinstance(it, dict) and not same_workdir(str(it.get("path", "")), norm)
        ]
        items.insert(0, {"path": norm, "last_used": now})
        data["items"] = items[:_MAX_ITEMS]
        _save_raw(data)


def list_recent() -> list[dict]:
    """最近工作目录列表（倒序；静默过滤已不存在的目录）。

    Returns:
        [{"path": ..., "last_used": ...}, ...]
    """
    with _LOCK:
        data = _load_raw()
    out = []
    for it in data["items"]:
        if not isinstance(it, dict):
            continue
        p = str(it.get("path", "")).strip()
        if p and os.path.isdir(p):
            out.append({"path": p, "last_used": it.get("last_used")})
    return out


def remove_workdir(path: str) -> bool:
    """从列表移除指定目录（供未来管理入口；不存在返回 False）。"""
    norm = normalize_workdir(path)
    with _LOCK:
        data = _load_raw()
        before = len(data["items"])
        data["items"] = [
            it for it in data["items"]
            if not (isinstance(it, dict) and same_workdir(str(it.get("path", "")), norm))
        ]
        if len(data["items"]) == before:
            return False
        _save_raw(data)
        return True
