"""AI 引文策展：以 AI 正文「## 参考资料」为主，工具检索结果做校验与兜底。

背景（真实问答数据验证）：旧实现无条件用工具全量 path 重写 AI 精选的参考
资料章节，导致 ① 引文膨胀（AI 精选 2-3 篇被替换成工具返回的 5-6 篇，混入
无关文档）；② 正文 [N] 标注与列表错位（标注按 AI 原列表编号，列表被换掉）。

策展策略：
- 路径 A（AI 章节合规）：保留 AI 精选列表，仅清洗——剔除不存在的路径、
  剔除正文从未用 [N] 标注的条目并同步重编号正文标注、剥掉悬空 [N]。
  正文无 [N] 标注时，AI 未声明引用映射，改用「内容佐证」校验：剔除佐证
  分低于阈值的条目（AI 引错文的实际案例：答案来自 grep 命中 A，引文却
  罗列无关命中 B/C/D），并补入佐证分高的未列路径（真实来源）。
- 路径 B（不合规）：分级兜底而非全量——read_document（AI 主动深读，强
  相关）优先，其次正文出现过的工具 path，最后 search/grep 命中补齐，总量
  封顶 MAX_FALLBACK_REFS；无法对齐的正文 [N] 标注剥掉。
任何改写后保证：正文每个 [N] 都有对应列表项，每个列表项都被 [N] 引用。
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from doclens.web_v2.references import (
    RETRIEVAL_TOOLS,
    extract_paths_by_tool,
    extract_snippets_by_path,
    normalize_paths,
)
from doclens.web_v2.refs_parser import parse_references_section, split_references_section

logger = logging.getLogger(__name__)

# 兜底引用数上限：防止 search 命中过多时兜底列表再次膨胀
MAX_FALLBACK_REFS = 5

# 内容佐证阈值（真实案例校准：真实来源 0.696，AI 错引 ≤0.13）
EVIDENCE_KEEP = 0.15  # AI 已列条目：低于此分剔除
EVIDENCE_ADD = 0.30   # 未列条目：高于此分补入（宁缺毋滥，补入门槛更高）

# 正文 [N] 引用标注
_MARK_RE = re.compile(r"\[(\d+)\]")
_WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class Curation:
    """策展结果。"""

    text: str  # 校正后的完整正文（含参考资料章节）
    paths: list[str]  # 最终引用 path（相对 workdir 正斜杠）
    fallback: bool  # True = AI 章节不可用，走了工具结果兜底（前端 toast 告警）
    actions: list[str] = field(default_factory=list)  # 清洗动作日志


def _used_marks(body: str) -> list[int]:
    """正文出现的 [N] 序号（升序去重）。"""
    return sorted({int(n) for n in _MARK_RE.findall(body)})


def _renumber(body: str, paths: list[str], keep_idx: list[int]) -> tuple[str, list[str]]:
    """只保留 keep_idx（1-based）对应的引用项；正文 [N] 同步重编号，悬空标注剥掉。

    Returns:
        (新正文, 保留的 path 列表)
    """
    mapping = {old: new for new, old in enumerate(keep_idx, 1)}
    kept = [paths[i - 1] for i in keep_idx]

    def _repl(m: re.Match[str]) -> str:
        n = int(m.group(1))
        return f"[{mapping[n]}]" if n in mapping else ""

    return _MARK_RE.sub(_repl, body), kept


def _build_text(body: str, paths: list[str]) -> str:
    """正文 + 标准「## 参考资料」章节（数字. 路径 格式）。"""
    section = "## 参考资料\n" + "".join(f"{i}. {p}\n" for i, p in enumerate(paths, 1))
    return body.rstrip() + "\n\n" + section


def _used_retrieval(tool_calls: list[dict[str, Any]]) -> bool:
    return any(
        tc.get("name") in RETRIEVAL_TOOLS and not tc.get("is_error") for tc in tool_calls
    )


def _bigrams(text: str) -> set[str]:
    """字符 bigram 集合（去空白）。中文无需分词，对 markdown 符号鲁棒。"""
    t = _WHITESPACE_RE.sub("", text)
    return {t[i : i + 2] for i in range(len(t) - 1)}


def _evidence_score(body_bg: set[str], pieces: list[str]) -> float:
    """正文与某 path 证据片段的内容重合度（0~1）。

    取两个方向的最大值：
    - 片段召回：max(|bg(片段)∩bg(正文)| / |bg(片段)|)——短片段（grep/search
      命中窗口）整体出现在正文中，适合「答案来自某条命中」的场景
    - 正文覆盖：|bg(正文)∩bg(全部证据)| / |bg(正文)|——read_document 整篇
      文档为证据时，正文的论据都能在该文档中找到
    """
    if not body_bg or not pieces:
        return 0.0
    union: set[str] = set()
    best_recall = 0.0
    for piece in pieces:
        pbg = _bigrams(piece)
        if not pbg:
            continue
        union |= pbg
        best_recall = max(best_recall, len(pbg & body_bg) / len(pbg))
    coverage = len(body_bg & union) / len(body_bg)
    return max(best_recall, coverage)


def _curate_by_evidence(
    body: str,
    existing: list[str],
    snippets: dict[str, list[str]],
    workdir: Path,
) -> Curation | None:
    """A3：正文无 [N] 标注时的内容佐证校验。

    AI 未声明引用映射，列表不可尽信（真实案例：答案来自 grep 命中 A，引文
    却是无关命中 B/C/D）。剔除佐证分不足的已列条目，补入佐证分高的未列
    路径，按佐证分降序。全部无佐证时返回 None（保底保留 AI 原列表）。
    """
    body_bg = _bigrams(body)
    actions: list[str] = []
    kept: list[tuple[str, float]] = []
    for p in existing:
        score = _evidence_score(body_bg, snippets.get(p, []))
        if score >= EVIDENCE_KEEP:
            kept.append((p, score))
        else:
            actions.append(f"佐证不足剔除({score:.2f}): {p}")
    for p, pieces in snippets.items():
        if p in existing or not (workdir / p).exists():
            continue
        score = _evidence_score(body_bg, pieces)
        if score >= EVIDENCE_ADD:
            kept.append((p, score))
            actions.append(f"佐证补入({score:.2f}): {p}")
    if not kept:
        return None
    kept.sort(key=lambda kv: -kv[1])
    paths = [p for p, _ in kept[:MAX_FALLBACK_REFS]]
    return Curation(
        text=_build_text(body, paths), paths=paths, fallback=False, actions=actions
    )


def _curate_compliant(
    raw_text: str,
    paths: list[str],
    workdir: Path,
    snippets: dict[str, list[str]],
) -> Curation | None:
    """路径 A：AI 章节合规时的清洗。无有效路径可留时返回 None（降级到兜底）。"""
    body, _ = split_references_section(raw_text)
    marks = _used_marks(body)
    actions: list[str] = []

    # A1：剔除 workdir 下不存在的路径（防幻觉）
    existing = [p for p in paths if (workdir / p).exists()]
    dropped_missing = [p for p in paths if p not in existing]
    if dropped_missing:
        actions.append(f"剔除不存在路径: {dropped_missing}")
    if not existing:
        return None

    if not marks:
        # 正文无 [N] 标注：无法建立序号映射，用内容佐证校验 AI 列表
        result = _curate_by_evidence(body, existing, snippets, workdir)
        if result is not None:
            return Curation(
                text=result.text,
                paths=result.paths,
                fallback=False,
                actions=actions + result.actions,
            )
        # 全部无佐证：保底保留 AI 原列表
        return Curation(
            text=_build_text(body, existing),
            paths=existing,
            fallback=False,
            actions=actions + ["正文无 [N] 且无佐证信号，保留 AI 原列表"],
        )

    # A2：剔除正文从未用 [N] 引用的条目 + 重编号；悬空 [N] 在重编号中剥掉
    keep_idx = [i for i in range(1, len(existing) + 1) if i in marks]
    uncited = [p for i, p in enumerate(existing, 1) if i not in marks]
    if uncited:
        actions.append(f"剔除未被正文引用的条目: {uncited}")
    dangling = [n for n in marks if n > len(existing)]
    if dangling:
        actions.append(f"剥掉悬空标注: {dangling}")
    if not keep_idx:
        return None  # 列表与标注完全对不上，降级兜底
    new_body, kept = _renumber(body, existing, keep_idx)
    return Curation(text=_build_text(new_body, kept), paths=kept, fallback=False, actions=actions)


def _fallback_paths(
    raw_text: str, tool_calls: list[dict[str, Any]], workdir: Path
) -> list[str]:
    """路径 B：分级兜底——read_document 优先，正文中出现过的其次，其余补齐封顶。"""
    by_tool = extract_paths_by_tool(tool_calls, workdir)
    ranked: list[str] = []

    def _add(p: str) -> None:
        if p not in ranked and len(ranked) < MAX_FALLBACK_REFS:
            ranked.append(p)

    # B1：read_document（AI 主动深读 = 强相关信号）
    for p in by_tool.get("read_document", []):
        _add(p)
    all_paths = normalize_paths([p for ps in by_tool.values() for p in ps], workdir)
    # B2：章节格式坏但正文里出现过的工具 path（多半是对的）
    for p in all_paths:
        if p in raw_text:
            _add(p)
    # B3：其余 search/grep 命中按首现顺序补齐
    for p in all_paths:
        _add(p)
    return [p for p in ranked if (workdir / p).exists()]


def curate_references(
    raw_text: str, tool_calls: list[dict[str, Any]], workdir: Path
) -> Curation:
    """策展 AI 正文的参考资料章节。

    Args:
        raw_text: AI 原始完整正文。
        tool_calls: 本轮工具调用（含 name/output/is_error）。
        workdir: 知识库根目录。

    Returns:
        Curation。未使用检索工具时原样返回（fallback=False）。
    """
    if not _used_retrieval(tool_calls):
        return Curation(text=raw_text, paths=[], fallback=False)

    parsed = parse_references_section(raw_text)
    if parsed.is_compliant():
        paths = normalize_paths(parsed.paths, workdir)
        snippets = extract_snippets_by_path(tool_calls, workdir)
        result = _curate_compliant(raw_text, paths, workdir, snippets)
        if result is not None:
            logger.info("refs curate(compliant): actions=%s refs=%d", result.actions, len(result.paths))
            return result
        logger.info("refs curate: 合规章节清洗后无有效条目，降级兜底")

    # 路径 B：不合规 → 分级兜底
    ranked = _fallback_paths(raw_text, tool_calls, workdir)
    if not ranked:
        return Curation(text=raw_text, paths=[], fallback=True, actions=["兜底无可用路径"])
    body, _ = split_references_section(raw_text)
    marks = _used_marks(body)
    actions = [f"正文不合规，工具结果分级兜底: {ranked}"]
    if marks:
        # 兜底列表序号与原标注无对应关系，剥掉避免错位
        body = _MARK_RE.sub("", body)
        actions.append(f"剥掉无法对齐的正文标注: {marks}")
    logger.info("refs curate(fallback): refs=%d actions=%s", len(ranked), actions)
    return Curation(text=_build_text(body, ranked), paths=ranked, fallback=True, actions=actions)
