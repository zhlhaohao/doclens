"""索引库只读探测（AP-9 拆分）。

从 IndexManager 抽出的**无状态** DB 探测函数群：每个函数只收
``index_path``，自带连接生命周期（open → query → close），不依赖
IndexManager 实例——files/status/CLI 侧的目录页探测可脱离宿主类单测。

⚠️ 每次调用开关一个 DB 连接（含 PRAGMA 重放）——已知成本口径：
目录页批量判定用 indexed_children_of（单查合并，81 条目 27s → 0.3s，
50 万文档库实测）；连接复用归 AP-8/AP-10 管，不属本模块语义。

异常语义分两类（AP-45）：

- **展示类探测**（目录页徽标 / 计数 / 状态面板）：DB 故障按「探测失败」
  处理（返回空值/False + debug 日志），不向调用方抛——目录页不能因索引库
  瞬时锁而 500。
- **判定类探测**（`has_documents_checked`）：DB 故障**必须**抛
  `IndexProbeError`。这类探测的返回值被用来决定「有没有内容可搜」，
  返回 False 会被上游读成「空库」，于是锁冲突/库损坏在界面上等同
  「这个知识库里没有这段内容」——比报错危险得多。
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


class IndexProbeError(RuntimeError):
    """索引库不可读（锁冲突 / 文件损坏 / 权限）——不等于「空库」。

    调用方**不得**把它当成「没有命中」：正确处置是向用户/AI 报告
    「索引暂时不可用」，而不是给出一份看似正常的空结果（AP-45）。
    """


def _open(index_path: str):
    from treesearch.fts import FTS5Index
    return FTS5Index(db_path=index_path)


def indexed_doc_count(index_path: str) -> int:
    """索引文档总数（DB COUNT，不物化 documents——ADR-0018）。"""
    try:
        fts = _open(index_path)
        try:
            return int(fts.get_stats().get("document_count", 0))
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("indexed_doc_count failed: %s", e)
        return 0


def has_documents_checked(index_path: str) -> bool:
    """索引库是否有文档；**DB 不可读时抛 ``IndexProbeError``**。

    与 :func:`indexed_doc_count` 的区别就是这个异常：那个返回 0，0 与
    「库为空」不可区分；这里把「探测失败」作为独立结局交给调用方
    （检索链路必须区分二者，见 AP-45）。
    """
    from treesearch.fts import FTS5Index

    try:
        fts = FTS5Index(db_path=index_path)
    except Exception as e:  # noqa: BLE001
        raise IndexProbeError(f"索引库无法打开: {e}") from e
    try:
        return fts.has_documents()
    except Exception as e:  # noqa: BLE001
        raise IndexProbeError(f"索引库探测失败: {e}") from e
    finally:
        try:
            fts.close()
        except Exception:  # noqa: BLE001
            pass


def indexed_source_paths(index_path: str) -> list[str]:
    """已索引文档的 source_path 列表（DB 轻量查询，不物化树结构）。

    ⚠️ 全表返回（O(库内文档数)）——50 万级语料上单次调用秒级、每次
    请求调用会拖垮 API。目录页/单文件场景请用 indexed_paths_under()。
    仅保留给 /files/documents（自身就是全量语义）与低频管理场景。
    """
    try:
        fts = _open(index_path)
        try:
            return sorted(set(fts.load_doc_id_source_paths().values()))
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("indexed_source_paths failed: %s", e)
        return []


def indexed_paths_under(index_path: str, dir_abs_path: str) -> set[str]:
    """某目录（含子目录）下已索引文档的绝对路径集合（索引化前缀查询）。

    LIKE 'dir%' 走 idx_documents_source_path 索引：50 万文档库上
    DB 查询 ~0.4s，但返回集合仍达全子树规模——目录页请改用
    is_path_indexed()（逐条目常数时间探测，不在 Python 侧物化集合）。
    """
    try:
        fts = _open(index_path)
        try:
            return fts.search_source_paths_under(dir_abs_path)
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("indexed_paths_under failed: %s", e)
        return set()


def is_path_indexed(index_path: str, abs_path: str, is_dir: bool = False) -> bool:
    """单个路径是否已索引（索引化探测）。

    目录：前缀 EXISTS（子树里有任一文档即 True）；文件：精确匹配。
    ⚠️ 每次调用开关一个 DB 连接 + 一次索引范围扫（9.4GB 库上目录前缀
    ~0.1s）——目录页批量判定请用 indexed_children_of（单查合并）。
    """
    try:
        fts = _open(index_path)
        try:
            return fts.has_docs_under(abs_path) if is_dir else fts.has_doc_at(abs_path)
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("is_path_indexed(%s) failed: %s", abs_path, e)
        return False


def indexed_children_of(index_path: str, dir_abs_path: str) -> set[str]:
    """目录的直接子项中含已索引文档的子项名集合（单次前缀查询）。

    目录页一次调用替代逐条目探测：81 条目 27s → 0.3s（50 万文档库）。
    子项名不含路径；文件 = 直接子文件已索引，子目录 = 其子树含文档。
    """
    try:
        fts = _open(index_path)
        try:
            return fts.indexed_children_of(dir_abs_path)
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("indexed_children_of(%s) failed: %s", e)
        return set()


def ghost_children_of(index_path: str, dir_abs_path: str) -> set[str]:
    """目录的直接子项中「仅登记」（ghost 行，ADR-0034）的子项名集合。

    与 indexed_children_of 同构的单次前缀查询；三态徽标的数据源之一。
    """
    try:
        fts = _open(index_path)
        try:
            return fts.ghost_children_of(dir_abs_path)
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("ghost_children_of(%s) failed: %s", e)
        return set()


def is_path_registered(index_path: str, abs_path: str) -> bool:
    """单个文件路径是否为「仅登记」ghost 行（未索引但已收录元数据）。"""
    try:
        fts = _open(index_path)
        try:
            return fts.is_ghost_at(abs_path)
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("is_path_registered(%s) failed: %s", e)
        return False


def registered_doc_count(index_path: str) -> int:
    """「仅登记」ghost 行总数（与已索引文档分开报，ADR-0034）。"""
    try:
        fts = _open(index_path)
        try:
            return int(fts.get_stats().get("ghost_count", 0))
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("registered_doc_count failed: %s", e)
        return 0


def load_document_source_path(index_path: str, doc_id: str) -> str | None:
    """按 doc_id 查源文件路径（documents 表单行点查；无则 None）。

    resolve_doc_path 的 DB 兜底（AP-10：请求级连接，替代 get_fts_index
    全局单例——那个入口 db_path 变化时会 close 旧单例，持有者凭空断连）。
    只取 source_path 列，不反序列化 structure_json。
    """
    fts = _open(index_path)
    try:
        doc = fts.load_document(doc_id)
        if doc is None:
            return None
        return (doc.metadata or {}).get("source_path", "") or None
    finally:
        fts.close()


def file_stats(index_path: str, cache: tuple | None = None) -> tuple[tuple[int, dict[str, int]], tuple | None]:
    """(总字节数, 扩展名分布)——供 /api/status。

    ⚠️ 本函数**不做**缓存（cache 参数是拆分前实例缓存的占位锚点，
    调用方 IndexManager.file_stats 仍持有实例级缓存，键 = DB 文档计数：
    50 万语料全量 stat 90s+，COUNT 毫秒级；同数替换下显示值可能略滞后，
    status 展示可接受）。直接调用本函数 = 无缓存全量统计。
    """
    total = 0
    ext_counts: dict[str, int] = {}
    for src in indexed_source_paths(index_path):
        if not src:
            continue
        try:
            total += os.path.getsize(src)
        except OSError:
            pass
        ext = os.path.splitext(src)[1].lower()
        if ext:
            ext_counts[ext] = ext_counts.get(ext, 0) + 1
    return (total, ext_counts), None
