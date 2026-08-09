"""模型预设存储层（ADR-0009）。

全局单层 JSON 文件 ``~/.cortex/model_presets.json``（发行版 ``~/.doclens/``）。
含明文 API Key —— 与 ``.env`` 同等保护：位于数据目录（已被 Git 同步 gitignore
排除）、GET 接口脱敏、不参与知识库 Git 同步、各机器各自维护。

线程安全：文件读写经进程内锁串行化；写采用临时文件 + ``os.replace`` 原子替换。
"""
import json
import os
import threading
import uuid
from typing import Optional

from doclens.config import get_global_cortex_dir
from doclens.web_v2.models.preset import PRESET_SECRET_MASK

_LOCK = threading.Lock()
_FILENAME = "model_presets.json"
_SCHEMA_VERSION = 1

# 预设持久化字段白名单（与 Preset 模型对齐；模型字段=llm|vision，搜索字段=search）
_FIELDS = (
    "name", "kind",
    # 模型连接（llm|vision）
    "protocol", "base_url", "model_id", "api_key", "context_window",
    # 搜索调优（search）
    "max_results", "min_score_threshold", "max_span",
    "weight_keyword_match", "weight_file_name_match", "weight_fts_score",
    "weight_title_match", "weight_proximity_match",
)


class PresetError(Exception):
    """预设操作错误（名称冲突、未找到等），由 API 层映射为 4xx。"""


def _presets_path() -> "object":
    return get_global_cortex_dir() / _FILENAME


def _empty_data() -> dict:
    return {"version": _SCHEMA_VERSION, "presets": []}


def _load_raw() -> dict:
    """读取原始 JSON（含明文 key）。文件缺失或损坏时返回空结构（不抛错）。"""
    path = _presets_path()
    if not path.exists():
        return _empty_data()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty_data()
    if not isinstance(data, dict) or not isinstance(data.get("presets"), list):
        return _empty_data()
    return data


def _save_raw(data: dict) -> None:
    """原子写：临时文件 + os.replace。"""
    path = _presets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(tmp, path)


def _mask(preset: dict) -> dict:
    """返回脱敏副本（api_key 非空 → ***）。"""
    out = {**preset}
    if out.get("api_key"):
        out["api_key"] = PRESET_SECRET_MASK
    return out


def _project(preset: dict) -> dict:
    """只保留白名单字段，丢弃 id 之外的杂项。"""
    return {k: preset.get(k) for k in _FIELDS if k in preset} | {"id": preset.get("id")}


def _find_by_name(
    presets: list[dict], name: str, kind: str, exclude_id: Optional[str] = None
) -> Optional[dict]:
    target = name.strip().lower()
    for p in presets:
        if p.get("kind") == kind and p.get("id") != exclude_id:
            if str(p.get("name", "")).strip().lower() == target:
                return p
    return None


def list_presets(kind: Optional[str] = None) -> list[dict]:
    """脱敏预设列表（可选按 kind 过滤）。"""
    with _LOCK:
        data = _load_raw()
    presets = data["presets"]
    if kind:
        presets = [p for p in presets if p.get("kind") == kind]
    return [_mask(_project(p)) for p in presets]


def get_preset(preset_id: str) -> Optional[dict]:
    """单条脱敏预设；不存在返回 None。"""
    with _LOCK:
        data = _load_raw()
    for p in data["presets"]:
        if p.get("id") == preset_id:
            return _mask(_project(p))
    return None


def get_preset_raw(preset_id: str) -> Optional[dict]:
    """单条**未脱敏**预设（供物化使用，勿直接返回前端）。"""
    with _LOCK:
        data = _load_raw()
    for p in data["presets"]:
        if p.get("id") == preset_id:
            return {**p}
    return None


def create_preset(fields: dict) -> dict:
    """创建预设。name 同 kind 内唯一（大小写不敏感）。返回脱敏后的预设。"""
    name = str(fields.get("name", "")).strip()
    kind = fields.get("kind")
    if not name:
        raise PresetError("预设名称不能为空")
    with _LOCK:
        data = _load_raw()
        if _find_by_name(data["presets"], name, kind):
            raise PresetError(f"同名预设已存在: {name}")
        preset = {"id": uuid.uuid4().hex, "name": name, "kind": kind}
        for f in _FIELDS:
            if f in ("name", "kind"):
                continue
            if f in fields and fields[f] is not None:
                preset[f] = fields[f]
        new_data = {**data, "presets": [*data["presets"], preset]}
        _save_raw(new_data)
    return _mask(_project(preset))


def update_preset(preset_id: str, updates: dict) -> dict:
    """更新预设。api_key=***（占位）或字段=None 表示跳过。返回脱敏后的预设。

    不可变重建 presets 列表（coding-style：不就地 mutation 原结构）。
    """
    with _LOCK:
        data = _load_raw()
        target = next(
            (p for p in data["presets"] if p.get("id") == preset_id), None
        )
        if target is None:
            raise PresetError(f"预设不存在: {preset_id}")

        effective: dict = {}
        for k, v in updates.items():
            if v is None:
                continue
            if k == "api_key" and v == PRESET_SECRET_MASK:
                continue  # 占位 = 未改动
            if k == "name":
                v = str(v).strip()
                if _find_by_name(data["presets"], v, target.get("kind"), exclude_id=preset_id):
                    raise PresetError(f"同名预设已存在: {v}")
            effective[k] = v

        new_presets = []
        result: Optional[dict] = None
        for p in data["presets"]:
            if p.get("id") == preset_id:
                merged = {**p, **effective}
                new_presets.append(merged)
                result = _mask(_project(merged))
            else:
                new_presets.append({**p})
        _save_raw({**data, "presets": new_presets})
    assert result is not None  # target 已确认存在
    return result


def delete_preset(preset_id: str) -> bool:
    """删除预设。返回是否删除成功（不存在返回 False）。"""
    with _LOCK:
        data = _load_raw()
        if not any(p.get("id") == preset_id for p in data["presets"]):
            return False
        new_data = {
            **data,
            "presets": [p for p in data["presets"] if p.get("id") != preset_id],
        }
        _save_raw(new_data)
    return True
