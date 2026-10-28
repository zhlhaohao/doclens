"""PPT 中间格式解析器：md → 页树（Slide/Directive/Block）。

规范见 ../SCHEMA.md。设计原则：警告 + 降级，永不因小错中断。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

# yaml 可选依赖（发行版环境有 PyYAML）；缺失时退化为手写的窄解析
try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None


class Warnings:
    """降级警告收集器——转换全程唯一警告通道。"""

    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, msg: str) -> None:
        self.items.append(msg)

    def __str__(self) -> str:  # pragma: no cover
        return "\n".join(f"  - {m}" for m in self.items)


# ---------------------------------------------------------------------------
# 指令解析：<!-- slide: k=v k=v --> / <!-- block: k=v -->
# ---------------------------------------------------------------------------

_SLIDE_RE = re.compile(r"^\s*<!--\s*slide\s*:\s*(?P<kv>.*?)\s*-->\s*$")
_BLOCK_RE = re.compile(r"^\s*<!--\s*block\s*:\s*(?P<kv>.*?)\s*-->\s*$")
_NOTES_RE = re.compile(r"^\s*<!--\s*notes\s*:\s*(?P<txt>.*?)\s*-->\s*$")

_KV_RE = re.compile(
    r"""(?P<key>[A-Za-z_][\w-]*)\s*=\s*(?P<val>"[^"]*"|'[^']*'|[^\s"']+)"""
)


def parse_kv(text: str, warn: Warnings, ctx: str) -> dict[str, str]:
    """解析空格分隔的 k=v 对；值剥引号。未知内容静默保留（校验在消费方）。"""
    out: dict[str, str] = {}
    for m in _KV_RE.finditer(text):
        key = m.group("key").lower()
        val = m.group("val")
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key] = val
    return out


# ---------------------------------------------------------------------------
# frontmatter（窄实现：行键: 值，一层嵌套 font.family）——有 PyYAML 则走 YAML
# ---------------------------------------------------------------------------

def parse_frontmatter(text: str, warn: Warnings) -> tuple[dict[str, Any], str]:
    """剥离并解析 frontmatter，返回 (meta, 正文)。坏 frontmatter → 整段忽略+警告。"""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        warn.add("frontmatter 有开头无结尾，整段忽略")
        return {}, text
    raw = text[4:end].strip("\n")
    rest = text[end + 4:].lstrip("\n")
    meta: dict[str, Any] = {}
    if yaml is not None:
        try:
            loaded = yaml.safe_load(raw)
            if isinstance(loaded, dict):
                meta = loaded
            elif loaded is not None:
                warn.add(f"frontmatter 不是映射（{type(loaded).__name__}），忽略")
        except yaml.YAMLError as e:
            warn.add(f"frontmatter YAML 解析失败，忽略：{e}")
    else:
        # 窄解析：只支持 两级 key: value
        parent: Optional[str] = None
        for line in raw.splitlines():
            if not line.strip():
                continue
            indent = len(line) - len(line.lstrip())
            m = re.match(r"^([\w-]+)\s*:\s*(.*)$", line.strip())
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            if indent == 0:
                if v == "":
                    parent = k
                    meta[k] = {}
                else:
                    parent = None
                    meta[k] = _coerce_scalar(v)
            elif parent:
                meta[parent][k] = _coerce_scalar(v)
    return meta, rest


def _coerce_scalar(v: str) -> Any:
    if v.startswith(("'", '"')) and v.endswith(("'", '"')) and len(v) >= 2:
        return v[1:-1]
    if v.lower() in ("true", "false"):
        return v.lower() == "true"
    try:
        return int(v)
    except ValueError:
        return v


# ---------------------------------------------------------------------------
# 行内白名单：MD 原生 + <mark>/<span>/<br> → Run 序列
# ---------------------------------------------------------------------------

_INLINE_HTML_RE = re.compile(
    r"(<mark>.*?</mark>|<span\s+class=\"([\w-]+)\">.*?</span>|<br\s*/?>)"
)
_MD_EMPH_RE = re.compile(
    r"(\*\*.+?\*\*|__.+?__|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_|`[^`]+`|~~.+?~~|\[[^\]]+\]\([^)]+\))"
)


@dataclass
class Run:
    text: str
    bold: bool = False
    italic: bool = False
    code: bool = False
    strike: bool = False
    mark: bool = False          # <mark> 高亮
    color_role: str = ""        # <span class="角色"> 的主题角色名
    color_hex: str = ""         # 块级 color= 覆盖（对无 markup 文本生效由 renderer 处理）
    link: str = ""              # 渲染为蓝色下划线纯文本


def parse_inline(text: str) -> list[Run]:
    """把一行内联文本解析为 Run 序列。非白名单 HTML 按字面处理。"""
    runs: list[Run] = []
    pos = 0
    tokens: list[tuple[int, int, str, str]] = []  # (start, end, kind, payload)
    for m in _INLINE_HTML_RE.finditer(text):
        tokens.append((m.start(), m.end(), "html", m.group(0)))
    for m in _MD_EMPH_RE.finditer(text):
        # 跳过与 HTML token 重叠的
        if any(s <= m.start() < e for s, e, _, _ in tokens):
            continue
        tokens.append((m.start(), m.end(), "md", m.group(0)))
    tokens.sort()

    def emit_plain(seg: str) -> None:
        if seg:
            runs.append(Run(text=seg))

    for start, end, kind, payload in tokens:
        if start < pos:  # 重叠保护
            continue
        emit_plain(text[pos:start])
        if kind == "html":
            if payload.startswith("<mark>"):
                inner = payload[6:-7]
                runs.append(Run(text=inner, mark=True))
            elif payload.startswith("<span"):
                cls = re.search(r'class="([\w-]+)"', payload)
                inner = re.sub(r"<[^>]+>", "", payload)
                runs.append(Run(text=inner, color_role=cls.group(1) if cls else ""))
            else:  # <br>
                runs.append(Run(text="\n"))
        else:
            _emit_md(runs, payload)
        pos = end
    emit_plain(text[pos:])
    return runs


def _emit_md(runs: list[Run], tok: str) -> None:
    if tok.startswith("**") or tok.startswith("__"):
        runs.append(Run(text=tok[2:-2], bold=True))
    elif tok.startswith("~~"):
        runs.append(Run(text=tok[2:-2], strike=True))
    elif tok.startswith("`"):
        runs.append(Run(text=tok[1:-1], code=True))
    elif tok.startswith("["):
        m = re.match(r"\[([^\]]+)\]\(([^)]+)\)", tok)
        if m:
            runs.append(Run(text=m.group(1), link=m.group(2)))
        else:  # pragma: no cover
            runs.append(Run(text=tok))
    else:
        runs.append(Run(text=tok[1:-1], italic=True))


# ---------------------------------------------------------------------------
# 块级解析：页 → 内容块序列
# ---------------------------------------------------------------------------

@dataclass
class Block:
    """一个 MD 顶层元素 + 可选块指令。"""
    kind: str                    # heading / para / list / quote / table / code / image / hr
    directive: dict[str, str] = field(default_factory=dict)
    level: int = 0               # heading 级别
    lines: list[str] = field(default_factory=list)      # 原始行（表格/代码/段落等）
    runs: list[Run] = field(default_factory=list)       # para/heading 行内解析结果
    list_items: list[tuple[int, list[Run], bool]] = field(default_factory=list)  # (缩进层级, runs, ordered)
    alt: str = ""                # image
    image_path: str = ""         # image（原始路径，未解析）
    lang: str = ""               # code 语言（mermaid 特判）

    @property
    def anim(self) -> str:
        return self.directive.get("anim", "")


@dataclass
class Slide:
    directive: dict[str, str] = field(default_factory=dict)
    blocks: list[Block] = field(default_factory=list)
    notes: str = ""


_FENCE_RE = re.compile(r"^```([\w-]*)\s*$")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_IMAGE_RE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$")
_LIST_RE = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")
_TABLE_SEP = re.compile(r"^\s*\|?[\s:|-]+\|[\s:|-]*$")


def parse_blocks(slide_text: str) -> list[Block]:
    """把单页文本解析为块序列（不含页指令行——调用方已剥离）。"""
    blocks: list[Block] = []
    lines = slide_text.splitlines()
    i = 0
    pending_directive: dict[str, str] = {}

    def take_directive() -> dict[str, str]:
        nonlocal pending_directive
        d = pending_directive
        pending_directive = {}
        return d

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue  # 空行不清指令：<!-- block: --> 后隔空行再接内容仍生效

        m = _BLOCK_RE.match(line)
        if m:
            pending_directive = parse_kv(m.group("kv"), None, "block")  # type: ignore
            i += 1
            continue

        hm = _HEADING_RE.match(stripped)
        if hm:
            blocks.append(Block(
                kind="heading", level=len(hm.group(1)), directive=take_directive(),
                runs=parse_inline(hm.group(2)),
            ))
            i += 1
            continue

        if stripped.startswith("```"):
            lang = _FENCE_RE.match(stripped).group(1) if _FENCE_RE.match(stripped) else ""
            body: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1  # 跳过收尾 ```
            blocks.append(Block(kind="code", lang=lang.lower(), lines=body,
                                directive=take_directive()))
            continue

        im = _IMAGE_RE.match(stripped)
        if im:
            blocks.append(Block(kind="image", alt=im.group(1), image_path=im.group(2),
                                directive=take_directive()))
            i += 1
            continue

        if stripped in ("---", "***", "___"):
            blocks.append(Block(kind="hr", directive=take_directive()))
            i += 1
            continue

        # 表格：当前行含 | 且下一行是分隔行
        if "|" in stripped and i + 1 < len(lines) and _TABLE_SEP.match(lines[i + 1]):
            tbl: list[str] = [stripped]
            i += 2
            while i < len(lines) and "|" in lines[i] and lines[i].strip():
                tbl.append(lines[i].strip())
                i += 1
            blocks.append(Block(kind="table", lines=tbl, directive=take_directive()))
            continue

        # 引用块
        if stripped.startswith(">"):
            q: list[str] = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                q.append(lines[i].strip().lstrip(">").strip())
                i += 1
            blocks.append(Block(kind="quote", lines=[x for x in q if x],
                                directive=take_directive()))
            continue

        # 列表（连续；嵌套按缩进）
        lm = _LIST_RE.match(line)
        if lm:
            items: list[tuple[int, list[Run], bool]] = []
            while i < len(lines):
                lm2 = _LIST_RE.match(lines[i])
                if not lm2:
                    if lines[i].strip() == "" and i + 1 < len(lines) and _LIST_RE.match(lines[i + 1]):
                        i += 1  # 列表内空行
                        continue
                    break
                indent = len(lm2.group(1)) // 2  # 2 空格一级
                ordered = lm2.group(2)[0].isdigit()
                items.append((min(indent, 3), parse_inline(lm2.group(3)), ordered))
                i += 1
            blocks.append(Block(kind="list", list_items=items, directive=take_directive()))
            continue

        # 段落：到空行/新块起点为止的连续行
        para: list[str] = []
        while i < len(lines):
            s = lines[i].strip()
            if (not s or s.startswith("```") or _HEADING_RE.match(s)
                    or _LIST_RE.match(lines[i]) or _IMAGE_RE.match(s)
                    or _BLOCK_RE.match(lines[i]) or s.startswith(">")
                    or s in ("---", "***", "___")):
                break
            para.append(s)
            i += 1
        merged = " ".join(para)
        blocks.append(Block(kind="para", runs=parse_inline(merged),
                            directive=take_directive()))

    if pending_directive:
        pass  # 悬空指令（页尾）丢弃；renderer 无从挂靠
    return blocks


# ---------------------------------------------------------------------------
# 顶层入口
# ---------------------------------------------------------------------------

@dataclass
class Deck:
    meta: dict[str, Any]
    slides: list[Slide]


def parse_markdown(text: str, warn: Warnings) -> Deck:
    meta, body = parse_frontmatter(text, warn)
    pages: list[tuple[dict[str, str], str, str]] = []  # (directive, notes, raw_body)
    cur_dir: dict[str, str] = {}
    cur_notes = ""
    cur_lines: list[str] = []

    def flush() -> None:
        if cur_dir or cur_lines:
            pages.append((cur_dir, cur_notes, "\n".join(cur_lines)))

    for line in body.splitlines():
        sm = _SLIDE_RE.match(line)
        if sm:
            flush()
            cur_dir = parse_kv(sm.group("kv"), warn, "slide")
            cur_notes = cur_dir.get("notes", "")
            cur_lines = []
            continue
        nm = _NOTES_RE.match(line)
        if nm and not cur_notes:
            cur_notes = nm.group("txt")
            continue
        cur_lines.append(line)
    flush()

    slides = [Slide(directive=d, notes=n, blocks=parse_blocks(raw))
              for d, n, raw in pages]
    slides = [s for s in slides if s.blocks or s.directive]
    if not slides and body.strip():
        warn.add("文档没有可解析的页内容")
    return Deck(meta=meta, slides=slides)
