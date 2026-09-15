"""统一的 ripgrep 降级搜索逻辑"""

import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Iterable

logger = logging.getLogger(__name__)

# 大语料 like_search(REGEXP) 旁路阈值：nodes 行数超过此值时跳过 SQLite
# 正则预筛，全权交给 ripgrep。REGEXP 是逐行 Python UDF（每行跨语言回调
# 一次 re.search），十万行级全表扫即秒级起步、百万行级分钟~十分钟级
# （实测 51 万文档语料单次 grep 卡死对话流）；rg 子进程原生扫盘同规模
# 仅数十秒。10 万取「Phase 1 单次扫描开始可感（>1s）」的保守下界。
REGEXP_SKIP_NODES_THRESHOLD = 100_000
# nodes 计数缓存（db_path -> (count, 抓取时间戳)）：COUNT(*) 在大表上
# 也要全 B-tree 扫描（秒级），TTL 内复用
_NODES_COUNT_TTL_S = 600
_nodes_count_cache: dict[str, tuple[int, float]] = {}


def _nodes_count_bypass(idx, threshold: int = REGEXP_SKIP_NODES_THRESHOLD) -> bool:
    """判定是否旁路 like_search 正则路径（大语料直通 rg）。

    nodes 行数超阈值即旁路；计数结果按 db_path 缓存（TTL 10min）。
    COUNT 失败（表缺失/锁）按小语料处理（保守，维持旧行为）。
    threshold 参数仅供测试缩小规模，生产恒用 REGEXP_SKIP_NODES_THRESHOLD。
    """
    db_path = str(getattr(idx, "index_path", ""))
    now = time.monotonic()
    cached = _nodes_count_cache.get(db_path)
    if cached and now - cached[1] < _NODES_COUNT_TTL_S:
        count = cached[0]
        if count > threshold:
            logger.debug("[grep] nodes=%d 超阈值（缓存），直通 rg", count)
            return True
        return False
    try:
        import sqlite3

        with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
            count = conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0]
    except Exception as e:  # noqa: BLE001
        logger.warning("[grep] nodes 计数失败（按小语料处理）: %s", e)
        return False
    _nodes_count_cache[db_path] = (count, now)
    if count > threshold:
        logger.info(
            "[grep] nodes=%d 超阈值 %d，跳过 SQLite REGEXP 预筛直通 rg",
            count, threshold,
        )
        return True
    return False


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
    pre_hits: dict[str, list[int]] | None = None,
) -> list[tuple[str, dict, int, int, float]]:
    """执行 ripgrep 降级搜索。

    doc_nodes_map 为空时：创建合成节点（原 _ripgrep_fallback 逻辑）。
    doc_nodes_map 非空时：匹配已有节点（原 format_results 内联逻辑）。

    pre_hits 给定时跳过内部逐文件扫描（大语料目录模式由调用方预取，
    见 _rg_search_root_hits——逐文件分批在数十万文件下要数千次进程
    启动，不可行），key 为绝对文件路径。

    Returns:
        [(doc_id, node_dict, matched_count, proximity, fts_score)]
    """
    from treesearch.ripgrep import rg_available, rg_search

    if not rg_available():
        return []

    shadow_to_original: dict[str, str] = {}
    if pre_hits is not None:
        hits = pre_hits
    else:
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

    # 反向映射: source_path -> [doc_ids]（normpath 统一形态，目录模式的
    # rg 输出路径与 path_map 的分隔符/相对形态可能不同）
    reverse_map: dict[str, list[str]] = {}
    for key, path in path_map.items():
        reverse_map.setdefault(os.path.normpath(path), []).append(key)

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
            doc_ids = reverse_map.get(os.path.normpath(display_path), [])
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
                "source_path": display_path,
            }
            results.append((doc_id, synthetic_node, len(query_words), 0, 0.0))

    return results


def _rg_search_root_hits(
    pattern: str,
    root: str,
    *,
    use_regex: bool,
    timeout: float = 120.0,
) -> dict[str, list[int]]:
    """rg 单进程递归扫描根目录（大语料目录模式）。

    与逐文件 rg_search（treesearch）的分批模式相对：数十万文件分批要
    数千次进程启动（每次 ≤10s 超时预算），而 rg 递归扫目录一次进程原生
    并行完成（51 万文件实测 10-30s）。代价：不经 path_map 逐文件过滤，
    会扫到未索引文件（与 grep 工具「搜索所有文件」的承诺一致）；二进制
    文档的 shadow md 在数据目录内、被排除 glob 跳过（FTS 检索仍覆盖）。

    Returns:
        {绝对文件路径: [1-based 行号]}
    """
    import json as _json
    import subprocess

    from treesearch.ripgrep import rg_available

    if not rg_available():
        return {}
    from treesearch.ripgrep import rg_path as _ts_rg_path

    exe = _ts_rg_path()
    if not exe:
        return {}

    # 排除数据/版本目录（索引、会话、shadow md 都不该进 grep 结果）
    exclude_globs = [
        "!.cortex/**", "!.doclens/**", "!.treesearch/**", "!.git/**",
    ]
    cmd = [exe, "--json", "--ignore-case", "--max-count", "100"]
    if not use_regex:
        cmd.append("--fixed-strings")
    for g in exclude_globs:
        cmd.extend(["-g", g])
    cmd.extend(["--", pattern, os.path.abspath(root)])
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        logger.warning("[grep] rg 目录扫描超时 %.0fs（root=%s）", timeout, root)
        return {}
    except OSError as e:  # noqa: BLE001
        logger.warning("[grep] rg 目录扫描失败: %s", e)
        return {}

    hits: dict[str, list[int]] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        try:
            obj = _json.loads(line)
        except ValueError:
            continue
        if obj.get("type") != "match":
            continue
        data = obj.get("data", {})
        fp = data.get("path", {}).get("text", "")
        ln = data.get("line_number")
        if fp and ln:
            hits.setdefault(fp, []).append(ln)
    return hits


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


# ---------------------------------------------------------------------------
# 统一 grep 搜索入口
# ---------------------------------------------------------------------------

@dataclass
class GrepResult:
    """grep 搜索结果。

    Attributes:
        content_results: 内容匹配 [(doc_id, node_dict, matched, proximity, fts_score)]
                         已按 matched（命中词项数）降序排序
        path_results: 路径匹配，格式同上
        query_words: 提取的词项列表（从正则 | 分割）
    """
    content_results: list[tuple[str, dict, int, int, float]]
    path_results: list[tuple[str, dict, int, int, float]]
    query_words: list[str]


def _extract_terms(pattern: str) -> list[str]:
    """从正则中提取独立词项（按 | 分割顶层 alternation）。"""
    terms = []
    depth = 0
    start = 0
    for i, ch in enumerate(pattern):
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        elif ch == "|" and depth == 0:
            term = pattern[start:i].strip()
            if term:
                terms.append(term)
            start = i + 1
    tail = pattern[start:].strip()
    if tail:
        terms.append(tail)
    return terms


def _count_term_hits(text: str, terms: list[str]) -> int:
    """统计 text 中命中了多少个词项。"""
    count = 0
    for term in terms:
        try:
            if re.search(term, text, re.IGNORECASE):
                count += 1
        except re.error:
            if term.lower() in text.lower():
                count += 1
    return count


def _discover_disk_files(search_path: str, allowed_exts: set[str], max_files: int = 0) -> list[str]:
    """递归发现搜索根目录下的可解析文件（含未索引的）。

    复用 treesearch.pathutil.resolve_paths —— 与索引链路同一套忽略规则
    （DEFAULT_IGNORE_DIRS + .gitignore + 扩展名白名单 + 跳过影子 MD），
    保证 rg 兜底覆盖的磁盘范围与索引器眼中的"应索引范围"一致。
    max_files 默认 0（不设限）——rg 兜底是尽力而为的降级路径，
    索引已建起来的大库不应在搜索时被同一上限二次卡断。
    """
    from treesearch.pathutil import resolve_paths

    try:
        return resolve_paths([search_path], allowed_extensions=allowed_exts, max_files=max_files)
    except (OSError, ValueError) as e:
        logger.warning("disk file discovery failed for %s: %s", search_path, e)
        return []


def _rg_fallback_path_map(idx, path_map: dict[str, str]) -> dict[str, str]:
    """构建 rg 兜底用的 path_map：索引内文档 + 磁盘上未索引的文件。

    未索引文件以文件名（去扩展名）为伪 doc_id 入表，rg 命中后由
    rg_fallback_search 的合成节点逻辑产出结果（此时 reverse_map 查不到
    该路径的已索引 doc_id，自然落到 os.path.splitext 分支）。
    """
    from doclens.index_manager import SUPPORTED_FORMATS

    supported_exts = set(SUPPORTED_FORMATS.keys())
    if getattr(idx, "allowed_source_types", None):
        from treesearch.pathutil import get_allowed_extensions_for_source_types
        type_exts = get_allowed_extensions_for_source_types(idx.allowed_source_types)
        if type_exts is not None:
            supported_exts = supported_exts & type_exts

    indexed = {os.path.abspath(p) for p in path_map.values()}
    merged = dict(path_map)
    for fp in _discover_disk_files(idx.search_path, supported_exts):
        if os.path.abspath(fp) in indexed:
            continue
        pseudo_id = os.path.splitext(os.path.basename(fp))[0]
        merged.setdefault(pseudo_id, fp)
    return merged


def _fulltext_for_node(idx, like_item: dict) -> str:
    """like_search 命中节点回填全文（structure_json 反序列化）。

    nodes.summary 是索引期截断的窗口（长节点仅头尾摘要），锚点前文可能
    已在截断时丢失。按 node_id 从 structure_json 找回完整 text；失败时
    退回 summary（旧行为）。
    """
    summary = like_item.get("summary", "") or ""
    node_id = like_item.get("node_id", "")
    doc_id = like_item.get("doc_id", "")
    if not node_id or not doc_id:
        return summary
    try:
        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=idx.index_path)
        try:
            doc = fts.load_document(doc_id)
        finally:
            fts.close()
        if doc is None:
            return summary
        node = doc.get_node_by_id(node_id)
        return (node or {}).get("text", "") or summary
    except Exception as e:  # noqa: BLE001
        logger.warning("fulltext backfill failed for %s/%s: %s", doc_id, node_id, e)
        return summary


def execute_grep_search(
    idx,
    query: str,
    max_results: int = 50,
    allowed: set[str] | None = None,
) -> GrepResult:
    """执行统一的 grep 搜索流程。

    搜索流程:
    1. like_search(use_regex=True) — SQLite REGEXP 搜索
    2. 若无结果: rg_fallback_search — ripgrep 降级搜索（覆盖磁盘上
       未索引文件，与 grep 工具"搜索所有文件（包括未索引的）"的承诺一致）
    3. search_paths_by_regex — 路径正则匹配
    4. 对内容结果评分排序（按词项命中数降序）

    Args:
        idx: IndexManager 实例
        query: 正则表达式
        max_results: 最大结果数
        allowed: 可选，搜索目标命中的 path_map 键集合
            （resolve_search_targets 的结果）；传入则三条路径只保留目标内文档

    Returns:
        GrepResult 包含内容结果、路径结果和查询词
    """
    terms = _extract_terms(query)
    query_words = terms if terms else [query]

    # 目标过滤：path_map 收敛到 allowed（rg 降级 / 路径匹配共用）
    path_map = idx.path_map
    if allowed is not None:
        path_map = {k: v for k, v in path_map.items() if k in allowed}

    # 步骤 1: like_search（有目标过滤时放大候选量，避免截断在前过滤在后丢结果）
    # 大语料旁路：REGEXP 逐行 Python 扫描在百万节点级是分钟级（见
    # _nodes_count_bypass 注释），直接走 rg 目录扫描（原生速度同规模数十秒）
    like_limit = max(200, max_results * 4) if allowed is not None else max_results
    corpus_bypass = _nodes_count_bypass(idx)
    if corpus_bypass:
        like_results = []
    else:
        like_results = idx.like_search(query, max_results=like_limit, use_regex=True)

    if like_results:
        if allowed is not None:
            like_results = [r for r in like_results if r.get("doc_id", "") in allowed]
        # like_search 返回 dict 列表，转为 tuple 格式；summary 可能是索引期
        # 截断的 300 字符窗口（锚点前文丢失），回填 structure_json 中的节点全文
        content_results = [
            (item["doc_id"], {"title": item.get("title", ""), "text": _fulltext_for_node(idx, item)}, 1, 0, item.get("fts_score", 0.0))
            for item in like_results
        ]
    else:
        # 步骤 2: ripgrep 降级（无目标过滤时合并磁盘未索引文件；
        # 大语料旁路也落此处——like_results 被置空，且用目录扫描模式
        # 取代逐文件分批：数十万文件的分批 = 数千次进程启动，不可行）
        if corpus_bypass and allowed is None:
            pre_hits = _rg_search_root_hits(query, str(idx.search_path), use_regex=True)
            content_results = rg_fallback_search(
                query,
                path_map,
                {},
                query_words,
                context_before=idx.rg_context_before,
                context_after=idx.rg_context_after,
                use_regex=True,
                pre_hits=pre_hits,
            )
        else:
            rg_path_map = _rg_fallback_path_map(idx, path_map) if allowed is None else path_map
            content_results = rg_fallback_search(
                query,
                rg_path_map,
                {},
                query_words,
                context_before=idx.rg_context_before,
                context_after=idx.rg_context_after,
                use_regex=True,
            )

    # 步骤 3: 路径搜索
    path_results = search_paths_by_regex(
        query,
        path_map,
        max_results=max_results,
    )

    # 步骤 4: 评分排序 — 更新 matched 为实际命中词项数，按命中数降序
    total_terms = len(query_words)
    if terms:
        scored: list[tuple[int, tuple]] = []
        for item in content_results:
            doc_id, node, _matched, prox, fts = item
            text = node.get("text", "") or ""
            hits = _count_term_hits(text, terms)
            scored.append((hits, (doc_id, node, hits, prox, fts)))
        scored.sort(key=lambda x: -x[0])
        content_results = [item for _, item in scored]

    # 步骤 5: 评分阈值过滤（同时过滤内容和路径结果）
    score_threshold = getattr(idx, "grep_score_threshold", 0.0)
    if score_threshold > 0 and total_terms > 0:
        content_results = [
            item for item in content_results
            if item[2] / total_terms >= score_threshold
        ]
        path_results = [
            item for item in path_results
            if item[2] / total_terms >= score_threshold
        ]

    # 步骤 6: 限制最大结果数
    grep_max = getattr(idx, "grep_max_results", max_results)
    if len(content_results) > grep_max:
        content_results = content_results[:grep_max]

    return GrepResult(
        content_results=content_results,
        path_results=path_results,
        query_words=query_words,
    )
