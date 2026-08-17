"""搜索目标（``paths`` 参数）解析：把相对目录/相对文件路径映射为命中的文档集合。

供 search_kb（kb_tools）与 grep（grep_tools/ripgrep）共用。匹配语义：
文档的 source_path **等于**目标（文件形式）或 **以 `目标 + 分隔符` 开头**
（目录形式）即命中。目标未命中任何文档时不报错，由调用方在结果头部提示，
引导 AI 自查路径拼写。
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Mapping, Sequence

# search_kb / grep 工具 schema 共用的 paths 属性定义
SEARCH_PATHS_PROPERTY = {
    "type": "array",
    "items": {"type": "string"},
    "description": (
        "可选。搜索目标列表，用于缩小搜索范围：元素为相对知识库根目录的目录"
        "（如 '科技'）或具体文件路径（如 '科技/量子计算.md'）；不传则全库搜索"
    ),
}


def normalize_target(workdir: Path, target: str) -> Path:
    """相对目标路径 → workdir 内绝对路径。

    Raises:
        ValueError: 绝对路径或 ``..`` 穿越出 workdir。
    """
    t = target.strip().replace("\\", "/")
    if not t:
        raise ValueError("空目标路径")
    p = Path(t)
    if p.is_absolute():
        raise ValueError(f"目标必须是相对路径: {target!r}")
    base = workdir.resolve()
    resolved = (base / t).resolve()
    if not resolved.is_relative_to(base):
        raise ValueError(f"目标越出知识库目录: {target!r}")
    return resolved


def resolve_search_targets(
    workdir: Path,
    targets: Sequence[str],
    path_map: Mapping[str, str],
) -> tuple[set[str], list[str]]:
    """解析搜索目标，返回 (命中的 path_map 键集合, 未命中/非法的原始目标列表)。

    Args:
        workdir: 知识库根目录
        targets: 用户传入的目标列表（相对目录 或 '相对目录/文件名'）
        path_map: IndexManager.path_map（doc_id/doc_name → 绝对 source_path）
    """
    # 预归一化全部 source_path（normcase 兼容 Windows 大小写不敏感）
    entries = [
        (key, os.path.normcase(os.path.normpath(source_path)))
        for key, source_path in path_map.items()
        if source_path
    ]
    allowed: set[str] = set()
    missed: list[str] = []
    for raw in targets:
        try:
            t_abs = os.path.normcase(os.path.normpath(str(normalize_target(workdir, raw))))
        except ValueError:
            missed.append(raw)
            continue
        prefix = t_abs + os.sep
        hits = {key for key, sp in entries if sp == t_abs or sp.startswith(prefix)}
        if hits:
            allowed.update(hits)
        else:
            missed.append(raw)
    return allowed, missed


def format_missed_note(missed: Sequence[str]) -> str:
    """未命中目标的结果头部提示（引导 AI 核对路径拼写）。"""
    if not missed:
        return ""
    return (
        "⚠️ 以下搜索目标未命中任何已索引文档（请核对路径拼写，"
        "目标应为相对知识库根目录的目录或文件路径）："
        + "、".join(f"`{m}`" for m in missed)
        + "\n\n"
    )
