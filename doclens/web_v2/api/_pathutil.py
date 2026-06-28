"""web_v2 API 共享：把 doc_id/doc_name 解析为相对 search_path 的可预览路径。"""
from pathlib import Path


def resolve_preview_path(doc_key: str, path_map: dict, search_path: str) -> str:
    """把 doc_id 或 doc_name 解析为相对 search_path 的可预览路径。

    IndexManager.path_map 同时以 doc_id（可能带 _hash 后缀）和 doc_name 作 key，
    所以两种 key 都可直接查。
    """
    source_abs = path_map.get(doc_key) if path_map else None
    if not source_abs:
        return doc_key
    try:
        rel = Path(source_abs).resolve().relative_to(Path(search_path).resolve())
        return rel.as_posix()
    except (ValueError, OSError):
        return doc_key
