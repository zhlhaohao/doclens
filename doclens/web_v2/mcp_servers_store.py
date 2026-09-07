"""MCP 服务器配置存储层（ADR-0014）。

机器级单层 JSON 文件 ``~/.cortex/mcp_servers.json``（发行版 ``~/.doclens/``）。
含明文密钥（stdio env 值 / http headers 值）—— 与 ``.env`` 同等保护：
位于全局数据目录、GET 接口脱敏、不参与知识库 Git 同步、各机器各自维护。

线程安全：文件读写经进程内锁串行化；写采用临时文件 + ``os.replace`` 原子替换。
不可变风格：更新走「重建列表再整体落盘」，不就地 mutation。
"""
import json
import os
import threading
import uuid
from typing import Optional

from doclens.config import get_global_cortex_dir
from doclens.web_v2.models.mcp_server import MCP_SECRET_MASK

_LOCK = threading.Lock()
_FILENAME = "mcp_servers.json"
_SCHEMA_VERSION = 1

# 持久化字段白名单（与 McpServer 模型对齐，不含 id）
_FIELDS = (
    "name", "enabled", "transport",
    "command", "args", "env", "cwd",
    "url", "headers",
    "timeout", "notes",
)


class McpServerError(Exception):
    """配置操作错误（名称冲突、字段缺失等），由 API 层映射为 4xx。"""


def _servers_path() -> "object":
    return get_global_cortex_dir() / _FILENAME


def _empty_data() -> dict:
    return {"version": _SCHEMA_VERSION, "servers": []}


def _load_raw() -> dict:
    """读取原始 JSON（含明文密钥）。文件缺失或损坏时返回空结构（不抛错）。"""
    path = _servers_path()
    if not path.exists():
        return _empty_data()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty_data()
    if not isinstance(data, dict) or not isinstance(data.get("servers"), list):
        return _empty_data()
    return data


def _save_raw(data: dict) -> None:
    """原子写：临时文件 + os.replace。"""
    path = _servers_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(tmp, path)


def _mask(server: dict) -> dict:
    """返回脱敏副本（env / headers 的非空值 → ***）。"""
    out = {**server}
    for key in ("env", "headers"):
        val = out.get(key)
        if isinstance(val, dict):
            out[key] = {k: (MCP_SECRET_MASK if v else v) for k, v in val.items()}
    return out


def _project(server: dict) -> dict:
    """只保留白名单字段，丢弃 id 之外的杂项。"""
    return {k: server.get(k) for k in _FIELDS if k in server} | {"id": server.get("id")}


def _find_by_name(servers: list[dict], name: str, exclude_id: Optional[str] = None) -> Optional[dict]:
    target = str(name).strip().lower()
    for s in servers:
        if s.get("id") != exclude_id:
            if str(s.get("name", "")).strip().lower() == target:
                return s
    return None


def _validate(server: dict) -> None:
    """按 transport 校验必填连接字段。"""
    transport = server.get("transport")
    if transport == "stdio":
        if not str(server.get("command", "")).strip():
            raise McpServerError("stdio 服务器必须提供启动命令 command")
    elif transport in ("http", "sse"):
        if not str(server.get("url", "")).strip():
            raise McpServerError(f"{transport} 服务器必须提供 url")
    else:
        raise McpServerError(f"未知传输类型: {transport}")


def list_servers() -> list[dict]:
    """脱敏服务器列表。"""
    with _LOCK:
        data = _load_raw()
    return [_mask(_project(s)) for s in data["servers"]]


def get_server(server_id: str) -> Optional[dict]:
    """单条脱敏配置；不存在返回 None。"""
    with _LOCK:
        data = _load_raw()
    for s in data["servers"]:
        if s.get("id") == server_id:
            return _mask(_project(s))
    return None


def get_server_raw(server_id: str) -> Optional[dict]:
    """单条**未脱敏**配置（供 mcp_client 建连使用，勿直接返回前端）。"""
    with _LOCK:
        data = _load_raw()
    for s in data["servers"]:
        if s.get("id") == server_id:
            return {**s}
    return None


def get_all_raw() -> list[dict]:
    """全部**未脱敏**配置快照（供 reconcile diff 使用）。"""
    with _LOCK:
        data = _load_raw()
    return [{**s} for s in data["servers"]]


def create_server(fields: dict) -> dict:
    """创建服务器配置。name 全局唯一（大小写不敏感）。返回脱敏后的配置。"""
    name = str(fields.get("name", "")).strip()
    if not name:
        raise McpServerError("服务器名称不能为空")
    with _LOCK:
        data = _load_raw()
        if _find_by_name(data["servers"], name):
            raise McpServerError(f"同名服务器已存在: {name}")
        server = {"id": uuid.uuid4().hex, "name": name}
        for f in _FIELDS:
            if f == "name":
                continue
            if f in fields and fields[f] is not None:
                server[f] = fields[f]
        _validate(server)
        new_data = {**data, "servers": [*data["servers"], server]}
        _save_raw(new_data)
    return _mask(_project(server))


def update_server(server_id: str, updates: dict) -> dict:
    """更新配置。env/headers 值 = ***（占位）或字段 = None 表示跳过。返回脱敏后的配置。

    env/headers 为浅合并：更新请求里的 key 覆盖原值（*** = 保留原值），
    原 dict 中未被请求提及的 key 保留。传空 dict 无效果（清空需逐 key 传空串）。
    """
    with _LOCK:
        data = _load_raw()
        target = next(
            (s for s in data["servers"] if s.get("id") == server_id), None
        )
        if target is None:
            raise McpServerError(f"服务器不存在: {server_id}")

        effective: dict = {}
        for k, v in updates.items():
            if v is None:
                continue
            if k == "name":
                v = str(v).strip()
                if _find_by_name(data["servers"], v, exclude_id=server_id):
                    raise McpServerError(f"同名服务器已存在: {v}")
                effective[k] = v
            elif k in ("env", "headers"):
                original = target.get(k) or {}
                merged = {
                    **{ek: ev for ek, ev in original.items() if ek not in v},
                    **{ek: (original.get(ek, "") if ev == MCP_SECRET_MASK else ev)
                       for ek, ev in v.items()},
                }
                effective[k] = merged
            else:
                effective[k] = v

        new_servers = []
        result: Optional[dict] = None
        for s in data["servers"]:
            if s.get("id") == server_id:
                merged = {**s, **effective}
                _validate(merged)
                new_servers.append(merged)
                result = _mask(_project(merged))
            else:
                new_servers.append({**s})
        _save_raw({**data, "servers": new_servers})
    assert result is not None  # target 已确认存在
    return result


def set_enabled(server_id: str, enabled: bool) -> dict:
    """切换启用位（不触发连接参数变更语义）。返回脱敏后的配置。"""
    return update_server(server_id, {"enabled": enabled})


def delete_server(server_id: str) -> bool:
    """删除配置。返回是否删除成功（不存在返回 False）。"""
    with _LOCK:
        data = _load_raw()
        if not any(s.get("id") == server_id for s in data["servers"]):
            return False
        new_data = {
            **data,
            "servers": [s for s in data["servers"] if s.get("id") != server_id],
        }
        _save_raw(new_data)
    return True
