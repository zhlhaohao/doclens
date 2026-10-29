"""图位清单：扫 md 里所有 `![P{n}-图{k} alt](路径)`，供重绘/替换图片时精确定位。

为什么需要命令：图位散落在 md 各页，编号在 alt 里、路径在括号里，
还要判断「这是即梦生成的还是用户自备的」——LLM 每次手工解析既慢又易漏。

判定来源：
- 路径含 `图片/AI/` 或文件名像即梦产物（含日期戳） → jimeng（可重绘）
- 文件存在且路径相对 md → local（用户自备，重绘前应征询）
- 文件不存在 → missing（应修复）
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

from .parser import parse_markdown

_IMG_RE = re.compile(r"^!\[(?P<alt>[^\]]*)\]\((?P<path>[^)]+)\)\s*$")
_GEN_RE = re.compile(r"\d{8}-\d{6}")          # 即梦文件名的时间戳形态
NO_LABEL = "未编号"


@dataclass
class ImageSlot:
    page: int
    label: str          # P3-图1；无编号时 "未编号"
    alt: str
    path: str           # md 里写的原始路径
    resolved: str       # 解析后的绝对路径（存在时）或空
    exists: bool
    source: str         # jimeng | local | missing
    size_kb: float = 0.0

    def row(self) -> str:
        src = {"jimeng": "即梦生成", "local": "本地自备", "missing": "缺失!"}[self.source]
        size = f"{self.size_kb:.0f}KB" if self.size_kb else "-"
        flag = "" if self.label != NO_LABEL else "  ⚠ 缺编号"
        return (f"P{self.page:<3} {self.label:<10} {src:<8} {size:>7}  "
                f"{self.alt[:24]:<24} {self.path}{flag}")


class _Sink:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, msg: str) -> None:
        self.items.append(msg)


def collect(md_path: Path) -> tuple[list[ImageSlot], list[str]]:
    text = md_path.read_text(encoding="utf-8")
    sink = _Sink()
    deck = parse_markdown(text, sink)
    md_dir = md_path.parent
    slots: list[ImageSlot] = []

    for i, slide in enumerate(deck.slides, 1):
        for b in slide.blocks:
            if b.kind != "image":
                continue
            alt = (b.alt or "").strip()
            raw = (b.image_path or "").strip()
            m = re.match(r"^(P\d+-图\d+)\s*(.*)$", alt)
            label = m.group(1) if m else NO_LABEL

            p = Path(raw)
            full = p if p.is_absolute() else (md_dir / p)
            try:
                full = full.resolve()
            except OSError:
                pass
            exists = full.exists()
            size = round(full.stat().st_size / 1024, 1) if exists else 0.0

            if not exists:
                source = "missing"
            elif "图片/AI" in raw.replace("\\", "/") or _GEN_RE.search(full.name) \
                    or "/AI/" in raw.replace("\\", "/"):
                source = "jimeng"
            else:
                source = "local"

            slots.append(ImageSlot(
                page=i, label=label, alt=alt, path=raw,
                resolved=str(full) if exists else "",
                exists=exists, source=source, size_kb=size,
            ))
    return slots, sink.items


def render(slots: list[ImageSlot], md_path: Path) -> str:
    if not slots:
        return (f"{md_path.name} 里没有图片位。\n"
                f"（如果这页本来该有配图，用 ![P{{页}}-图{{序号}} 用途说明](路径) 补上）")
    lines = [f"# 图位清单 — {md_path.name}", ""]
    lines.append(f"{'页':<5}{'图位':<11}{'来源':<9}{'大小':>8}  {'用途(alt)':<24} 路径")
    lines.append("-" * 104)
    for s in slots:
        lines.append(s.row())
    lines.append("")
    by = {"jimeng": 0, "local": 0, "missing": 0}
    for s in slots:
        by[s.source] += 1
    lines.append(f"合计 {len(slots)} 处：即梦生成 {by['jimeng']} · 本地自备 {by['local']} · "
                 f"缺失 {by['missing']}")
    no_label = [s for s in slots if s.label == NO_LABEL]
    if no_label:
        lines.append("")
        lines.append(f"⚠ {len(no_label)} 处缺图位编号——重绘时无法精确指代。"
                     f"补法：把 alt 改成 `P{{页}}-图{{序号}} 用途`")
    missing = [s for s in slots if s.source == "missing"]
    if missing:
        lines.append("")
        lines.append("⚠ 缺失的图会在渲染时变成占位框：" +
                     ", ".join(f"P{s.page}" for s in missing))
    return "\n".join(lines)


def save_json(slots: list[ImageSlot], md_path: Path) -> Path:
    out = Path(str(md_path.with_suffix("")) + "-images.json")
    out.write_text(json.dumps([asdict(s) for s in slots], ensure_ascii=False, indent=2),
                   encoding="utf-8")
    return out
