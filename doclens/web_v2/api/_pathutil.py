"""web_v2 API 共享：把 doc_id/doc_name 解析为相对 search_path 的可预览路径。"""
import os
from pathlib import Path


def resolve_preview_path(doc_key: str, path_map: dict, search_path: str) -> str:
    """把 doc_id、doc_name 或绝对路径解析为相对 search_path 的可预览路径。

    IndexManager.path_map 同时以 doc_id（可能带 _hash 后缀）和 doc_name 作 key，
    所以两种 key 都可直接查。

    绝对路径兜底（BUG-G1 修复）：ripgrep 合成节点的 source_path 是磁盘绝对
    路径（未索引文件不在 path_map 里）——path_map 查不到时，若 doc_key 是
    search_path 内的绝对路径，相对化后返回，保证 grep/search 降级结果与
    FTS 主链路的路径形态一致（前端预览按相对路径寻址）。
    """
    source_abs = path_map.get(doc_key) if path_map else None
    if not source_abs:
        if _is_abs_inside(doc_key, search_path):
            return _rel_posix(doc_key, search_path)
        return doc_key
    try:
        return _rel_posix(source_abs, search_path)
    except (ValueError, OSError):
        return doc_key


def _is_abs_inside(p: str, search_path: str) -> bool:
    if not p or not os.path.isabs(p):
        return False
    try:
        Path(p).resolve().relative_to(Path(search_path).resolve())
        return True
    except (ValueError, OSError):
        return False


def _rel_posix(p: str, search_path: str) -> str:
    rel = Path(p).resolve().relative_to(Path(search_path).resolve())
    return rel.as_posix()
