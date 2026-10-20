"""预览域共享工具（P1-3 拆分的公共层）。

preview / preview_assets / preview_mutations 三路由共用的路径解析、
越权校验与可写性判定。独立成模块避免跨文件私有 import（红线 6：
api/ 内各路由之间只走公共接口）。

- safe_resolve 的单源在 path_safety.py（本模块 re-export 便捷消费方）
- resolve_path / lookup_rel_via_path_map 依赖 IndexManager（path_map
  反查），属预览域语义，不进 path_safety
"""
import os
from pathlib import Path

from doclens.config import data_dirname
from doclens.index_manager import IndexManager
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.path_safety import safe_resolve  # noqa: F401（re-export）

# 二进制合成预览的后缀白名单（消费方：preview.py 分派 + writable 判定）。
# 放这里而非 preview.py：_compute_writable 与分派同文件时会循环 import。
from treesearch.parsers.image_parser import IMAGE_EXTENSIONS

BINARY_PREVIEW_EXTS = frozenset({
    ".pdf", ".docx", ".doc", ".docm", ".pptx", ".ppt", ".pps", ".pot",
    ".xlsx", ".xlsm", ".xltx", ".xltm", ".xls",
    ".rtf", ".epub", ".csv", ".mhtml", ".mht",
}) | IMAGE_EXTENSIONS


def resolve_path(base: Path, requested: str, idx: IndexManager) -> tuple[Path, str]:
    """解析文档路径：先直接拼（相对 workdir），失败则用 path_map 按文件名/endswith 反查。

    AI 偶发只给文件名（如 ``深海生物新物种发现.md``，无目录前缀），直接拼 workdir 找不到；
    path_map 的 mapped_path 是绝对路径，endswith(filename) 可反查出完整相对路径。

    Returns:
        (full_path, resolved_rel_path) —— full_path 是绝对路径，resolved_rel_path 是
        相对 workdir 的路径（用于二进制合成等下游）；若直接拼就命中，resolved_rel_path=requested。
    """
    candidate = safe_resolve(base, requested)
    if candidate.exists() and candidate.is_file():
        return candidate, requested
    rel = lookup_rel_via_path_map(base, requested, idx)
    if rel is not None:
        full = safe_resolve(base, rel)
        if full.exists() and full.is_file():
            return full, rel
    raise CortexAPIError(404, "FILE_NOT_FOUND", f"文件不存在: {requested}")


def lookup_rel_via_path_map(base: Path, requested: str, idx: IndexManager) -> str | None:
    """用 path_map 按文件名/endswith 反查相对 workdir 的路径（不检查文件存在）。

    用于：纯文件名（无目录）→ 反查完整相对路径；binary 文件可能不在磁盘但已在 DB 索引，
    不能用存在性判断，所以本函数只反查路径。
    """
    for mapped in idx.path_map.values():
        if mapped == requested or mapped.endswith("/" + requested) \
                or mapped.endswith("\\" + requested) or mapped.endswith(requested):
            try:
                return str(Path(mapped).resolve().relative_to(base.resolve())).replace("\\", "/")
            except ValueError:
                return requested
    return None


def compute_writable(full: Path, search_path: Path) -> bool:
    """判断文件是否可在 PUT /api/preview 中写入。

    用于 GET（响应 writable 字段）和 PUT（写前检查），保持两端判断一致。
    """
    if not full.exists() or not full.is_file():
        return False
    if full.suffix.lower() in BINARY_PREVIEW_EXTS:
        return False
    # PST 物理文件：预览是合成的邮件目录页，写回会毁掉 GB 级二进制
    if full.suffix.lower() == ".pst":
        return False
    # 数据目录内部不让用户改索引（开发 .cortex / 发行版 .doclens）
    try:
        full.relative_to(search_path / data_dirname())
        return False
    except ValueError:
        pass
    return os.access(full, os.W_OK)
