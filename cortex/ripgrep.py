"""统一的 ripgrep 降级搜索逻辑"""

import os
import re
from typing import Iterable


def build_rg_paths(
    path_map: dict[str, str],
    doc_ids: Iterable[str],
) -> tuple[list[str], dict[str, str]]:
    """构建搜索路径列表，二进制文件映射到 shadow MD。

    Args:
        path_map: doc_id/doc_name -> source_path 映射
        doc_ids: 需要包含的文档 ID 集合

    Returns:
        (rg_paths, shadow_to_original 映射)
    """
    from treesearch.parsers.registry import is_binary_extension
    from treesearch.pathutil import shadow_md_path

    rg_paths = []
    shadow_to_original: dict[str, str] = {}

    # 收集所有唯一源文件路径
    if doc_ids is None:
        raw_paths = set(path_map.values())
    else:
        raw_paths = {path_map.get(did, "") for did in doc_ids}

    for p in raw_paths:
        if not p or not os.path.exists(p):
            continue
        ext = os.path.splitext(p)[1].lower()
        if is_binary_extension(ext):
            md = shadow_md_path(p)
            if os.path.exists(md):
                rg_paths.append(md)
                shadow_to_original[md] = p
            # 无 shadow md 则跳过（rg 搜不了二进制）
        else:
            rg_paths.append(p)

    return rg_paths, shadow_to_original


def rg_fallback_search(
    query: str,
    path_map: dict[str, str],
    doc_nodes_map: dict[str, list[dict]],
    query_words: list[str],
    context_before: int = 6,
    context_after: int = 5,
    use_regex: bool = False,
) -> list[tuple[str, dict, int, int, float]]:
    """执行 ripgrep 降级搜索。

    doc_nodes_map 为空时：创建合成节点（原 _ripgrep_fallback 逻辑）。
    doc_nodes_map 非空时：匹配已有节点（原 format_results 内联逻辑）。

    Returns:
        [(doc_id, node_dict, matched_count, proximity, fts_score)]
    """
    from treesearch.ripgrep import rg_available, rg_search

    if not rg_available():
        return []

    # 根据是否有 doc_nodes_map 决定路径构建方式
    if doc_nodes_map:
        doc_ids = doc_nodes_map.keys()
    else:
        doc_ids = path_map.keys()

    rg_paths, shadow_to_original = build_rg_paths(path_map, doc_ids)
    if not rg_paths:
        return []

    hits = rg_search(query, rg_paths, case_sensitive=False, use_regex=use_regex)
    if not hits:
        return []

    # 反向映射: source_path -> [doc_ids]
    reverse_map: dict[str, list[str]] = {}
    for key, path in path_map.items():
        reverse_map.setdefault(path, []).append(key)

    results: list[tuple[str, dict, int, int, float]] = []

    if doc_nodes_map:
        # 模式 1：匹配已有节点（format_results 内联逻辑）
        for hit_path, line_nums in hits.items():
            original_path = shadow_to_original.get(hit_path, hit_path)
            source_doc_id = None
            for did in doc_nodes_map:
                if path_map.get(did, "") == original_path:
                    source_doc_id = did
                    break
            if not source_doc_id:
                continue

            all_nodes = doc_nodes_map.get(source_doc_id, [])
            matched_node = None
            for n in all_nodes:
                n_line = n.get("line_start")
                if n_line and n_line in line_nums:
                    matched_node = n
                    break

            if not matched_node:
                for n in all_nodes:
                    n_text = n.get("text", "") or ""
                    if query.lower() in n_text.lower():
                        matched_node = n
                        break

            if matched_node:
                results.append((source_doc_id, matched_node, len(query_words), 0, 0.0))
    else:
        # 模式 2：创建合成节点（原 _ripgrep_fallback 逻辑）
        for file_path, line_nums in hits.items():
            display_path = shadow_to_original.get(file_path, file_path)
            doc_ids = reverse_map.get(display_path, [])
            doc_id = doc_ids[0] if doc_ids else os.path.splitext(os.path.basename(display_path))[0]

            matched_line = line_nums[0]  # 1-based
            try:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    all_lines = f.readlines()
            except OSError:
                continue

            matched_idx = matched_line - 1  # convert to 0-based
            context_start = max(0, matched_idx - context_before)
            context_end = min(len(all_lines), matched_idx + context_after + 1)
            text = ''.join(all_lines[context_start:context_end]).rstrip()

            title = os.path.splitext(os.path.basename(display_path))[0]
            for did in doc_ids:
                if did in path_map and did != path_map[did]:
                    title = did
                    doc_id = did
                    break

            synthetic_node = {
                "title": title,
                "text": text,
                "line_start": matched_line,
            }
            results.append((doc_id, synthetic_node, len(query_words), 0, 0.0))

    return results


def search_paths_by_regex(
    regex: str,
    path_map: dict[str, str],
    max_results: int = 100,
) -> list[tuple[str, dict, int, int, float]]:
    """在文件路径上执行正则匹配。

    Args:
        regex: 正则表达式
        path_map: doc_id -> 文件路径的映射
        max_results: 最大返回结果数

    Returns:
        [(doc_id, node_dict, matched_count, proximity, fts_score)]
        node_dict 包含 'title'（路径）和 'text'（路径）字段
    """
    results = []
    try:
        pattern = re.compile(regex, re.IGNORECASE)
    except re.error:
        return results

    for doc_id, file_path in path_map.items():
        if pattern.search(file_path):
            # 构造与 rg_fallback_search 模式 2 一致的 node dict
            node = {
                "title": f"[路径匹配] {file_path}",
                "text": f"路径包含正则匹配: {regex}",
            }
            results.append((doc_id, node, 1, 0, 0.0))

    return results[:max_results]
