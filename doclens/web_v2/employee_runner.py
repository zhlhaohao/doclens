"""数字员工派活循环（ADR-0062/0063）。

一个派活 = 一个独立会话里的「工作回合 → 无产物预检 → 评审 → 返工指令」
循环，直至达标 / 轮数耗尽 / 评审失败 / 用户停止 / 已中断。

模块分两层：

- **纯函数层**（可单测，无 I/O 副作用）：``resolve_tools``、``build_system_extra``、
  ``build_brief``、``build_rework_order``、``list_artifacts``、``has_deliverable``、
  ``collect_review_material``、``build_review_messages``、``parse_review``、
  ``bind_write_boundary``、``tool_catalog``。
- **运行时层**：``dispatch``（启动后台 task）、``stop``、``running_for``、
  ``mark_interrupted_on_startup``。

状态留档：派活开始 / 每次评审 / 派活结束各落一条自定义 kind 条目
（``assignment_start`` / ``review`` / ``assignment_end``），回放层忽略、
展示层渲染；进程重启后「有开始无结束」的派活补记中断结局。

停止复用既有 ``POST /chat/stop``：派活 task 经 ``chat_runner.try_register``
登记、中断事件经 ``register_interrupt`` 登记——信号 + 杀 shell + cancel 三层
语义零改动可用；``POST /chat`` 的 409 预检天然实现「派活中禁发消息」。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from doclens.web_v2.chat_interrupt import register_interrupt, request_stop
from doclens.web_v2.chat_runner import get_task, try_register
from doclens.web_v2.round_finalizer import persist_round

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

SESSION_MODE = "employee"          # sessions.mode 标记
KIND_START = "assignment_start"
KIND_REVIEW = "review"
KIND_END = "assignment_end"
REWORK_TAG = "rework-order"

#: 对全部数字员工无条件不可用的工具（ADR-0063）：向人提问、子代理、后台任务、
#: 技能加载（走预加载）、团队协作、手动压缩、任务管理。
FORBIDDEN_TOOLS: frozenset[str] = frozenset({
    "ask_user_question", "ask_user", "user_confirm",
    "task",
    "background_run", "check_background",
    "load_skill",
    "spawn_teammate", "list_teammates", "send_message", "read_inbox", "broadcast",
    "shutdown_request", "plan_approval", "idle",
    "compress",
    "TodoWrite",
})

#: 有写入能力的内置 shell 工具（授权界面提示「写入不受产物目录硬保证」）
SHELL_TOOLS: frozenset[str] = frozenset({"bash", "powershell"})

#: doclens 注入的知识库工具（工具目录分组用；定义见 kb_tools.py / grep_tools.py）
KB_TOOL_NAMES: frozenset[str] = frozenset({"search_kb", "read_document", "file_info", "kb_grep"})

#: 产物目录中被评审忽略的子目录 / 文件
SCRATCH_SUBDIR = "tmp"
_IGNORED_NAMES: frozenset[str] = frozenset({SCRATCH_SUBDIR, ".versions", ".DS_Store", "Thumbs.db"})

#: 评审输出上限（结构化 JSON：分数 + 意见清单）
REVIEW_MAX_TOKENS = 4000
#: 评审材料预算占评审模型上下文窗口的比例
REVIEW_BUDGET_RATIO = 0.5
#: 主产物保护：最大文档类文件至少占预算的比例
PRIMARY_ARTIFACT_SHARE = 0.6
#: 单文件最少分到的字符数；低于此则不纳入评审（只列路径）
_MIN_SHARE_CHARS = 500

_TEXT_EXTS = {".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".toml", ".xml", ".html",
              ".htm", ".log", ".py", ".js", ".ts", ".sql", ".ini", ".cfg", ".rst"}
_DOC_EXTS = {".md", ".txt", ".docx", ".pptx", ".xlsx", ".html", ".htm"}
_OFFICE_EXTS = {".docx", ".pptx", ".xlsx"}
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

_SLUG_MAX = 40

# ---------------------------------------------------------------------------
# 结局与评审结果
# ---------------------------------------------------------------------------

OUTCOME_PASSED = "passed"
OUTCOME_EXHAUSTED = "exhausted"
OUTCOME_REVIEW_FAILED = "review_failed"
OUTCOME_STOPPED = "stopped"
OUTCOME_INTERRUPTED = "interrupted"
OUTCOMES = (OUTCOME_PASSED, OUTCOME_EXHAUSTED, OUTCOME_REVIEW_FAILED,
            OUTCOME_STOPPED, OUTCOME_INTERRUPTED)


@dataclass
class ReviewResult:
    """一次评审的结果。``score=None`` 表示未评审（无产物预检 / 评审失败）。"""

    score: Optional[int]
    passed: bool
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    summary: str = ""
    kind: str = "review"   # review | no_artifact | failed
    error: str = ""

    def to_payload(self, iteration: int, threshold: int) -> dict:
        return {
            "iteration": iteration,
            "kind": self.kind,
            "score": self.score,
            "threshold": threshold,
            "passed": self.passed,
            "issues": list(self.issues),
            "suggestions": list(self.suggestions),
            "summary": self.summary,
            "error": self.error,
        }


class DispatchError(Exception):
    def __init__(self, msg: str, code: str = "DISPATCH_ERROR", status: int = 400):
        super().__init__(msg)
        self.code, self.status = code, status


# ---------------------------------------------------------------------------
# 纯函数层：授权与提示词
# ---------------------------------------------------------------------------


def resolve_tools(all_tools: list[dict], allow: list[str], deny: list[str]) -> list[str]:
    """有效工具名 = (白名单 or 全部) − 黑名单 − 禁用工具（黑名单优先）。"""
    names = [t.get("name") for t in all_tools if t.get("name")]
    base = [n for n in names if n in set(allow)] if allow else list(names)
    deny_set = set(deny)
    return [n for n in base if n not in deny_set and n not in FORBIDDEN_TOOLS]


def is_writing_tool(name: str) -> bool:
    """有写入能力：文件写工具、shell、以及全部 MCP 工具（无法判定，保守计）。"""
    return name in SHELL_TOOLS or name in {"write_file", "edit_file"} or name.startswith("mcp__")


def slugify(text: str, max_len: int = _SLUG_MAX) -> str:
    """任务文本 → 目录安全 slug（保留 CJK；去路径非法字符；空则 fallback）。"""
    s = re.sub(r"[\\/:*?\"<>|\r\n\t]+", " ", text).strip()
    s = re.sub(r"\s+", "-", s)
    s = s[:max_len].strip("-_ ")
    return s or "task"


def assignment_dir(workdir: Path, artifact_root: str, task: str,
                   now: Optional[datetime] = None) -> Path:
    """产物目录 = <产物路径>/<YYYYMMDD>-<slug>（绝对路径）；重名时追加 -2/-3。"""
    root = Path(artifact_root)
    root = root if root.is_absolute() else workdir / root
    stamp = (now or datetime.now()).strftime("%Y%m%d")
    base = root / f"{stamp}-{slugify(task)}"
    candidate, n = base, 2
    while candidate.exists():
        candidate = base.with_name(f"{base.name}-{n}")
        n += 1
    return candidate


def build_system_extra(prompt: str, skills_bodies: list[tuple[str, str]], workdir: Path,
                       artifact_dir: Path, missing_skills: list[str]) -> str:
    """专属提示词 + 预加载技能正文 + 员工工作规则（追加在精简基础提示词之后）。"""
    parts: list[str] = []
    parts.append("# Your role\n\n" + prompt.strip())
    if skills_bodies:
        parts.append(
            "# Preloaded skills\n\n以下技能已为你预加载（正文完整在下），直接按其指引工作，"
            "无需也不可再调用任何技能加载工具。\n\n"
            + "\n\n".join(body for _, body in skills_bodies)
        )
    if missing_skills:
        parts.append(
            "# 技能提示\n\n以下技能在本机不存在，无法使用，请勿尝试："
            + ", ".join(missing_skills)
        )
    rules = [
        "# 数字员工工作规则\n\n",
        f"- 工作目录：`{workdir.as_posix()}`；本次任务的产物目录：`{artifact_dir.as_posix()}`。",
        "- 你的全部工作成果**必须落盘到产物目录**。只写在对话里的内容不算交付，评审只看产物目录。",
        "- 你**只能写入产物目录**（含其子目录）；写别处会被工具拒绝。",
        f"- 临时脚本与中间文件放产物目录下的 `{SCRATCH_SUBDIR}/`（不参与评审）。",
        "- 完成后用一两句话说明产出了哪些文件（路径）。",
    ]
    parts.append("\n".join(rules))
    return "\n\n".join(parts)


def build_brief(task: str, artifact_dir: Path, has_template: bool, threshold: int,
                criteria: str, max_iterations: int) -> str:
    """首条用户消息：派活说明（系统段）+ 用户原话。"""
    tpl = (
        "产物目录内已放置模板拷贝，请在其基础上填写/改写，不要另起文件名。"
        if has_template else "本次无模板。"
    )
    return (
        "<assignment>\n"
        f"产物目录：{artifact_dir.as_posix()}\n"
        f"模板：{tpl}\n"
        f"临时文件：产物目录下的 {SCRATCH_SUBDIR}/（不参与评审）\n"
        f"评审：你的产物将由评审按以下标准打分，达到 {threshold} 分才算完成；"
        f"最多 {max_iterations} 轮，未达标会收到返工意见。\n"
        f"<criteria>\n{criteria.strip()}\n</criteria>\n"
        "</assignment>\n\n"
        f"{task.strip()}"
    )


def build_rework_order(review: ReviewResult, threshold: int, artifact_dir: Path) -> str:
    """返工指令：以用户消息形态落库（带标签），包裹评审意见。"""
    score_attr = "" if review.score is None else str(review.score)
    lines = [f'<{REWORK_TAG} score="{score_attr}" threshold="{threshold}">']
    if review.kind == "no_artifact":
        lines.append("评审未执行：产物目录为空（模板拷贝与 tmp/ 不计）。")
        lines.append(f"你的工作成果必须写入产物目录 `{artifact_dir.as_posix()}`，请把成果落盘。")
    else:
        lines.append(f"评审意见（本次 {review.score} 分，需 {threshold} 分）：")
        for i, issue in enumerate(review.issues, 1):
            lines.append(f"{i}. {issue}")
        if review.suggestions:
            lines.append("修改建议：")
            for s in review.suggestions:
                lines.append(f"- {s}")
        if review.summary:
            lines.append(f"评审总结：{review.summary}")
        if not review.issues and not review.suggestions and not review.summary:
            lines.append("评审未给出具体意见。请自查产物是否满足评审标准后完善。")
        lines.append("请根据以上意见修改产物目录中的文件。")
    lines.append(f"</{REWORK_TAG}>")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 纯函数层：产物清单与评审材料
# ---------------------------------------------------------------------------


@dataclass
class ArtifactFile:
    path: str          # 相对产物目录（posix）
    abs_path: Path
    ext: str
    size: int
    is_template: bool = False


def list_artifacts(artifact_dir: Path, template_names: set[str]) -> list[ArtifactFile]:
    """产物目录清单（忽略 tmp/ 与系统垃圾文件；标记模板拷贝）。"""
    out: list[ArtifactFile] = []
    if not artifact_dir.exists():
        return out
    for p in sorted(artifact_dir.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(artifact_dir)
        if any(part in _IGNORED_NAMES for part in rel.parts):
            continue
        rel_posix = rel.as_posix()
        out.append(ArtifactFile(
            path=rel_posix, abs_path=p, ext=p.suffix.lower(), size=p.stat().st_size,
            is_template=(rel_posix in template_names) or (len(rel.parts) == 1 and rel.name in template_names),
        ))
    return out


def has_deliverable(artifact_dir: Path, template_names: set[str]) -> bool:
    """无产物预检：产物目录里是否有「非模板」的文件。"""
    return any(not a.is_template for a in list_artifacts(artifact_dir, template_names))


def classify_artifact(ext: str) -> str:
    """text | office | image | binary"""
    if ext in _OFFICE_EXTS:
        return "office"
    if ext in _IMAGE_EXTS:
        return "image"
    if ext in _TEXT_EXTS or ext == "":
        return "text"
    return "binary"


def _is_primary_candidate(a: ArtifactFile) -> bool:
    return (not a.is_template) and a.ext in _DOC_EXTS


def extract_text(path: Path, limit: int) -> tuple[str, bool]:
    """读文本类文件（只保开头）。返回 (文本, 是否截断)。"""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return f"[读取失败：{e}]", False
    if len(text) > limit:
        return text[:limit], True
    return text, False


def extract_office_text(path: Path, limit: int) -> tuple[str, bool]:
    """Office 文档抽文本——复用索引同一套解析器（树节点带文本）→ 渲染为 markdown。

    不走索引库（产物是刚写的新文件，尚未索引）。不生成节点摘要（不调模型）。
    """
    try:
        from treesearch.parsers.registry import get_parser
        from doclens.web_v2.preview_synthesizer import render_tree_to_md

        parser = get_parser(path.suffix.lower())
        if parser is None:
            return "[该文档类型无可用解析器]", False
        doc = asyncio.run(parser(str(path), if_add_node_text=True, if_add_node_summary=False))
        md, _ = render_tree_to_md(doc.get("structure"), doc.get("source_type") or path.suffix.lower().lstrip("."))
    except RuntimeError:
        # 已在事件循环内（评审在 to_thread 之外被同步调用时）——退线程池跑
        try:
            doc = asyncio.run_coroutine_threadsafe(
                _parse_office(path), _bg_loop()
            ).result(timeout=60)
            from doclens.web_v2.preview_synthesizer import render_tree_to_md

            md, _ = render_tree_to_md(doc.get("structure"), doc.get("source_type") or path.suffix.lower().lstrip("."))
        except Exception as e:  # noqa: BLE001
            return f"[文档解析失败：{e}]", False
    except Exception as e:  # noqa: BLE001
        return f"[文档解析失败：{e}]", False
    if len(md) > limit:
        return md[:limit], True
    return md, False


async def _parse_office(path: Path) -> dict:
    from treesearch.parsers.registry import get_parser

    parser = get_parser(path.suffix.lower())
    if parser is None:
        return {"structure": [], "source_type": None}
    return await parser(str(path), if_add_node_text=True, if_add_node_summary=False)


_bg_loop_singleton: dict = {}


def _bg_loop():
    """专供同步上下文里跑异步解析器的事件循环（懒建，守护线程）。"""
    loop = _bg_loop_singleton.get("loop")
    if loop is None or loop.is_closed():
        import threading as _th

        ev = _th.Event()
        new_loop: asyncio.AbstractEventLoop = asyncio.new_event_loop()

        def _run():
            asyncio.set_event_loop(new_loop)
            ev.set()
            new_loop.run_forever()

        _th.Thread(target=_run, name="employee-office-parser", daemon=True).start()
        ev.wait(5)
        _bg_loop_singleton["loop"] = new_loop
        loop = new_loop
    return loop


def _char_budget(context_window: Optional[int]) -> int:
    """评审材料的字符预算：窗口 × 比例 × 1.5 字符/token（CJK/英文折中）。"""
    cw = context_window or 128_000
    return max(20_000, int(cw * REVIEW_BUDGET_RATIO * 1.5))


def collect_review_material(artifact_dir: Path, template_names: set[str],
                            context_window: Optional[int]) -> dict:
    """评审材料：产物目录的文本化清单（预算：主产物保护 + 只保开头）。

    Returns:
        {"files": [{"path","kind","text","truncated","included"}], "images": [Path],
         "omitted": [path], "budget_chars": int}
    """
    files = list_artifacts(artifact_dir, template_names)
    budget = _char_budget(context_window)
    images: list[Path] = []
    out: list[dict] = []

    def _meta(a: ArtifactFile, included: bool, kind: Optional[str] = None) -> None:
        out.append({"path": a.path, "kind": kind or classify_artifact(a.ext), "text": "",
                    "truncated": False, "included": included})

    # 模板拷贝：只列路径，不纳入正文
    for a in files:
        if a.is_template:
            _meta(a, False, "template")

    content = [a for a in files if not a.is_template]
    for a in content:
        if classify_artifact(a.ext) == "image":
            images.append(a.abs_path)
            _meta(a, True, "image")
        elif classify_artifact(a.ext) == "binary":
            _meta(a, False, "binary")

    textual = [a for a in content if classify_artifact(a.ext) in ("text", "office")]
    textual.sort(key=lambda a: a.size, reverse=True)
    primary = next((a for a in textual if _is_primary_candidate(a)), None)
    remaining = [a for a in textual if a is not primary]

    def _emit(a: ArtifactFile, limit: int) -> None:
        if classify_artifact(a.ext) == "office":
            text, truncated = extract_office_text(a.abs_path, limit)
        else:
            text, truncated = extract_text(a.abs_path, limit)
        out.append({"path": a.path, "kind": classify_artifact(a.ext), "text": text,
                    "truncated": truncated, "included": True})

    primary_budget = int(budget * PRIMARY_ARTIFACT_SHARE) if primary else 0
    if primary is not None:
        _emit(primary, max(primary_budget, 4_000))
    rest_budget = budget - primary_budget
    share = rest_budget // max(len(remaining), 1)
    omitted: list[str] = []
    for a in remaining:
        if share < _MIN_SHARE_CHARS:
            omitted.append(a.path)
            _meta(a, False)
        else:
            _emit(a, share)
    # 按目录顺序稳定输出
    order = {a.path: i for i, a in enumerate(files)}
    out.sort(key=lambda f: order.get(f["path"], 10**9))
    return {"files": out, "images": images, "omitted": omitted, "budget_chars": budget}


def build_review_messages(material: dict, task: str, criteria: str, threshold: int,
                          review_images: bool) -> tuple[str, list[dict]]:
    """评审提示骨架（系统）+ 用户消息。评审标准由员工配置提供，骨架固定。"""
    system = (
        "You are an artifact reviewer. You judge whether the produced artifacts satisfy the task "
        "and the review criteria. You do NOT have any tools; judge only from the material given.\n"
        "Be strict but fair. Do not inflate scores. Respond ONLY by calling the `submit_review` tool."
    )
    parts: list[str] = [
        f"# Task\n{task.strip()}\n",
        "# Review criteria\n" + criteria.strip() + "\n",
        f"# Passing threshold\n{threshold} / 100\n",
        "# Artifacts",
    ]
    for f in material["files"]:
        if f["kind"] == "template":
            parts.append(f"## {f['path']} (template copy — NOT part of the review)\n")
        elif not f["included"]:
            parts.append(f"## {f['path']} (not included in review: unsupported or over budget)\n")
        elif f["kind"] == "image":
            note = "" if review_images else " (image — you cannot view images; noted only)"
            parts.append(f"## {f['path']}{note}\n")
        else:
            tr = " [TRUNCATED — only the beginning is shown]" if f["truncated"] else ""
            parts.append(f"## {f['path']}{tr}\n```\n{f['text']}\n```\n")
    return system, [{"role": "user", "content": "\n".join(parts)}]


REVIEW_TOOL_SCHEMA = {
    "name": "submit_review",
    "description": "提交评审结果：0-100 总分、是否达标、问题清单与修改建议。",
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {"type": "integer", "minimum": 0, "maximum": 100,
                      "description": "0-100 的单个总分"},
            "passed": {"type": "boolean", "description": "是否达到通过阈值"},
            "issues": {"type": "array", "items": {"type": "string"},
                       "description": "必须修正的问题（给返工用，具体可执行）"},
            "suggestions": {"type": "array", "items": {"type": "string"},
                            "description": "可选的改进建议"},
            "summary": {"type": "string", "description": "一两句话的总体评价"},
        },
        "required": ["score", "passed", "issues"],
    },
}


def _block_dict(block: Any) -> dict:
    if isinstance(block, dict):
        return block
    return {"type": getattr(block, "type", None), "name": getattr(block, "name", None),
            "input": getattr(block, "input", None)}


def parse_review(content: Any, fallback_threshold: int) -> ReviewResult:
    """从 provider 响应的 content blocks 解析 ``submit_review`` 的入参。"""
    for block in content or []:
        b = _block_dict(block)
        if b.get("type") == "tool_use" and b.get("name") == "submit_review":
            inp = b.get("input") or {}
            try:
                score = int(round(float(inp.get("score"))))
            except (TypeError, ValueError):
                raise ValueError("评审结果缺少合法分数")
            score = max(0, min(100, score))
            issues = [str(x).strip() for x in (inp.get("issues") or []) if str(x).strip()]
            suggestions = [str(x).strip() for x in (inp.get("suggestions") or []) if str(x).strip()]
            passed = bool(inp.get("passed")) or score >= fallback_threshold
            return ReviewResult(score=score, passed=passed, issues=issues,
                                suggestions=suggestions, summary=str(inp.get("summary") or ""))
    raise ValueError("评审结果中没有 submit_review 调用")


# ---------------------------------------------------------------------------
# 纯函数层：写入边界与工具目录
# ---------------------------------------------------------------------------


def _inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (ValueError, OSError):
        return False


def _extract_paths(arg: Any) -> list[Path]:
    """从工具入参里取路径（file tools：path/file_path；递归 dict/list）。"""
    out: list[Path] = []
    if isinstance(arg, dict):
        for k, v in arg.items():
            if k in ("path", "file_path", "target", "dest", "destination", "to") and isinstance(v, str):
                out.append(Path(v))
            else:
                out.extend(_extract_paths(v))
    elif isinstance(arg, list):
        for v in arg:
            out.extend(_extract_paths(v))
    return out


_PATH_IN_CMD = re.compile(
    r"""(?x)
    (?P<abs>[A-Za-z]:[\\/][^\s"'`|;&]+ | /(?!\S*/dev/)[^\s"'`|;&]+)   # 绝对路径
  | (?P<rel>(?<![\w\-./\\])[^\s"'`|;&()\[\]{}<>$*?=]+(?:[\\/][^\s"'`|;&()\[\]{}<>$*?=]+)*)  # 裸相对路径（可含子目录）
    """
)
_WRITE_SIGNAL = re.compile(
    r"""(?x)(>>|(?<![>&<])>(?![&<])|\btee\b|\bmv\b|\bcp\b|\brm\b|\bdel\b|\bmove\b|\bcopy\b|
        \bremove-item\b|\bset-content\b|\badd-content\b|\bmkdir\b|\bmd\b|\btouch\b|\bri\b|
        \bwrite\b|\bsave\b|\bexport\b|\bconvertto\b|\bout-file\b|\bnew-item\b)"""
)


def shell_write_targets(cmd: str) -> list[str]:
    """从 shell 命令里粗提取「写信号之后」的路径 token（纵深防御，非沙箱）。

    只看重定向 ``>``/``>>`` 紧随的那个 token，以及写命令词（mv/cp/tee/mkdir…）
    后面的参数；不解析 shell 语法（管道/变量/子 shell 均不覆盖）。
    """
    targets: list[str] = []
    # 重定向目标
    for m in re.finditer(r">>?\s*([^\s|;&\"'`]+)", cmd):
        targets.append(m.group(1))
    # 写命令词后的参数（跳过选项）
    for m in re.finditer(r"\b(mv|cp|copy|move|tee|mkdir|md|touch|rm|del|ri|remove-item|"
                         r"set-content|add-content|out-file|new-item|save|export|write)\b\s+(.*)", cmd, re.I):
        for tok in m.group(2).split():
            if tok.startswith("-") or tok in ("=",):
                continue
            targets.append(tok)
            break
    return [t for t in targets if t]


def bind_write_boundary(tool_handlers: dict[str, Any], root: Path, workdir: Path) -> dict[str, Any]:
    """返回浅拷贝的 handlers：写类工具与 shell 写入产物目录外一律拒绝。

    结构化工具（write_file / edit_file）：**硬检查**入参路径在 root 内。
    shell（bash / powershell）：**纵深防御**——命令里出现写信号且引用了工作目录内
    的路径而该路径不在 root 内时拒绝；不确定放行（与外部访问门禁同一局限：
    脚本内部拼接的写入会漏检，已在授权界面明示）。
    MCP 工具在独立进程写文件，**不经此处**——完全不受边界约束。
    """
    root_abs = root.resolve()
    wd_abs = workdir.resolve()

    def _outside(path_str: str) -> bool:
        p = Path(path_str)
        abs_p = p if p.is_absolute() else (wd_abs / p)
        return not _inside(abs_p, root_abs)

    def _reject(path_str: str) -> str:
        return (
            f"Error: 写入被拒绝——数字员工只能写入本次产物目录 `{root_abs}`；"
            f"`{path_str}` 在其之外。请把成果写进产物目录。"
        )

    def _wrap_file(fn):
        def _paths(*a, **kw):
            # 关键字入参：按名字挑路径字段；位置入参：只有第一个是路径
            # （write_file/edit_file 的 path 居首），内容/旧新文本不当路径。
            for p in _extract_paths(kw):
                yield str(p)
            if a and isinstance(a[0], (str, Path)):
                yield str(a[0])

        def _h(*a, **kw):
            for ps in _paths(*a, **kw):
                if _outside(ps):
                    return _reject(ps)
            return fn(*a, **kw)
        return _h

    def _wrap_shell(fn):
        def _h(*a, **kw):
            cmd = ""
            if a and isinstance(a[0], str):
                cmd = a[0]
            cmd = cmd or str(kw.get("command") or kw.get("cmd") or "")
            if cmd:
                for raw in shell_write_targets(cmd):
                    p = Path(raw)
                    abs_p = p if p.is_absolute() else (wd_abs / p)
                    # 只拦「工作目录内、产物目录外」的明确路径；家目录/临时目录等不拦
                    if _inside(abs_p, wd_abs) and not _inside(abs_p, root_abs):
                        return (
                            f"Error: 命令被拒绝——它似乎要写入产物目录 `{root_abs}` 之外的位置"
                            f"（{raw}）。数字员工只能写入本次产物目录。"
                        )
            return fn(*a, **kw)
        return _h

    out = dict(tool_handlers)
    for name in ("write_file", "edit_file"):
        if name in out:
            out[name] = _wrap_file(out[name])
    for name in SHELL_TOOLS:
        if name in out:
            out[name] = _wrap_shell(out[name])
    return out


def tool_catalog(all_tools: list[dict]) -> list[dict]:
    """设置页表单的工具目录：分组、是否可写、是否禁用。"""
    out = []
    for t in all_tools:
        name = t.get("name") or ""
        if not name:
            continue
        if name.startswith("mcp__"):
            rest = name[5:]
            group, server = "mcp", (rest.split("__", 1)[0] if "__" in rest else "")
        elif name in KB_TOOL_NAMES:
            group, server = "kb", None
        else:
            group, server = "builtin", None
        out.append({
            "name": name,
            "group": group,
            "server": server,
            "writable": is_writing_tool(name),
            "forbidden": name in FORBIDDEN_TOOLS,
        })
    return out


# ---------------------------------------------------------------------------
# 运行时层
# ---------------------------------------------------------------------------


@dataclass
class AssignmentState:
    """进程内进行中的派活（注册表条目）。"""

    session_id: str
    employee_id: str
    employee_name: str
    artifact_dir: Path
    started_at: str
    iteration: int = 0
    interrupt: threading.Event = field(default_factory=threading.Event)
    stop_requested: bool = False


_active: dict[str, AssignmentState] = {}       # session_id -> state
_lock = threading.Lock()


def running_for(employee_id: str) -> Optional[AssignmentState]:
    with _lock:
        for st in _active.values():
            if st.employee_id == employee_id:
                return st
    return None


def is_assignment(session_id: str) -> bool:
    with _lock:
        return session_id in _active


def stop(session_id: str) -> bool:
    """停止派活：复用 /chat/stop 的三层语义（信号 + 杀 shell + cancel）。"""
    with _lock:
        st = _active.get(session_id)
        if st is not None:
            st.stop_requested = True
    hit = st is not None
    request_stop(session_id)
    task = get_task(session_id)
    if task is not None and not task.done():
        task.cancel()
    return hit


def _kill_shells_hook(session_id: str):
    def _hook():
        try:
            from planify.tools.basic import kill_session_shell_procs

            kill_session_shell_procs(session_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("kill session shell procs failed for %s: %s", session_id, e)
    return _hook


def _make_provider(preset: dict, thinking_depth: str):
    from planify.core.llm import create_provider

    return create_provider({
        "protocol": preset.get("protocol") or "",
        "base_url": preset.get("base_url") or "",
        "model_id": preset.get("model_id") or "",
        "api_key": preset.get("api_key") or "",
        "thinking_depth": thinking_depth or "auto",
    })


def _preset_or_none(preset_id: Optional[str]) -> Optional[dict]:
    if not preset_id:
        return None
    from doclens.web_v2 import presets_store

    try:
        return presets_store.get_preset_raw(preset_id) or None
    except Exception:  # noqa: BLE001
        return None


# ---- 派活预处理 ----


def _copy_template(template_path: Optional[str], artifact_dir: Path, workdir: Path) -> tuple[bool, set[str]]:
    """把模板整体拷入产物目录。返回 (是否有模板, 模板文件名集合)。"""
    if not template_path:
        return False, set()
    src = Path(template_path)
    src = src if src.is_absolute() else workdir / src
    if not src.exists():
        raise DispatchError(f"产物模板不存在：{template_path}", "TEMPLATE_MISSING", 400)
    names: set[str] = set()
    if src.is_dir():
        shutil.copytree(src, artifact_dir, dirs_exist_ok=True)
        names = {p.relative_to(src).as_posix() for p in src.rglob("*") if p.is_file()}
    else:
        shutil.copy2(src, artifact_dir / src.name)
        names = {src.name}
    return True, names


def _preload_skills(runtime, allow: list[str]) -> tuple[list[tuple[str, str]], list[str]]:
    bodies: list[tuple[str, str]] = []
    missing: list[str] = []
    loader = getattr(runtime, "skills", None)
    for name in allow or []:
        body = loader.load(name) if loader is not None else f"Error: Unknown skill '{name}'."
        if not body or body.startswith("Error:"):
            missing.append(name)
        else:
            bodies.append((name, body))
    return bodies, missing


async def _loop(state: AssignmentState, cfg: dict, task: str, first_message: str,
                template_names: set[str], skills_extra: str, review_images: bool) -> None:
    """派活主循环（后台 task）。``first_message`` = 派活说明（dispatch 已落库为首条 user）。"""
    from doclens.web_v2.deps import get_agent, get_sessions_store
    from doclens.web_v2.api._chat_emitter import ChatEventEmitter
    from planify.core.llm.trace import LLMTracer
    from planify.streaming.runner import StreamingAgent
    from planify.streaming.types import StreamingConfig

    store = get_sessions_store()
    agent = get_agent()
    runtime = agent.runtime
    workdir = Path(agent.workdir)
    session_id = state.session_id

    work_preset = _preset_or_none(cfg["model_preset_id"])
    if work_preset is None:
        raise DispatchError("工作模型预设不存在", "MODEL_MISSING", 400)
    review_preset = _preset_or_none(cfg.get("review_model_preset_id")) or work_preset
    depth = cfg.get("thinking_depth") or "auto"
    provider = _make_provider(work_preset, depth)
    review_provider = _make_provider(review_preset, depth)
    model = work_preset.get("model_id") or ""

    threshold = int(cfg.get("score_threshold") or 90)
    max_iter = int(cfg.get("max_iterations") or 5)
    criteria = cfg.get("review_criteria") or ""
    cw = review_preset.get("context_window")

    allowed = set(resolve_tools(runtime.tools, cfg.get("tools_allow") or [], cfg.get("tools_deny") or []))
    tools = [t for t in runtime.tools if t.get("name") in allowed]
    handlers = bind_write_boundary(
        {k: v for k, v in runtime.tool_handlers.items() if k in allowed}, state.artifact_dir, workdir,
    )
    from planify.streaming.waiter import get_global_waiter

    waiter = get_global_waiter()
    interrupt = state.interrupt
    tracer = LLMTracer.create(label="employee", session_key=session_id, workdir=agent.workdir)

    store.append_event(session_id, KIND_START, {
        "employee_id": state.employee_id, "employee_name": state.employee_name,
        "artifact_dir": state.artifact_dir.as_posix(), "threshold": threshold,
        "max_iterations": max_iter, "task": task,
    })
    outcome: str = OUTCOME_INTERRUPTED
    final_score: Optional[int] = None
    last_review: Optional[ReviewResult] = None
    try:
        for i in range(1, max_iter + 1):
            if interrupt.is_set():
                outcome = OUTCOME_STOPPED
                break
            state.iteration = i
            if i == 1:
                # 首条 = 派活说明，dispatch 已落库（ensure 的幂等只看「末条是否同内容
                # 的 user」，而此刻末条是 assignment_start 事件，再 ensure 会重复落一条）
                message = first_message
            else:
                message = build_rework_order(last_review, threshold, state.artifact_dir)
                store.ensure_message_user(session_id, message)
            history = store.get_chat_history(session_id)
            if history and history[-1].get("role") == "user":
                tail = history[-1].get("content")
                if isinstance(tail, str) and tail == message:
                    history.pop()
            round_start = len(history)
            emitter = ChatEventEmitter(queue=None, context_window=runtime.config.planify_context_window)
            sa = StreamingAgent(
                client=provider, model=model, tools=tools, tool_handlers=handlers,
                emitter=emitter,
                config=StreamingConfig(
                    compact_threshold=int(round(runtime.config.planify_context_window * 0.8)),
                    context_window=runtime.config.planify_context_window,
                    max_tokens=runtime.config.planify_max_tokens,
                ),
                waiter=waiter, skills_loader=None, logger_instance=runtime.logger,
                runtime=runtime, interrupt_event=interrupt, system_prompt_extra=skills_extra,
                tracer=tracer, base_prompt="minimal",
                scratch_dir=f"{state.artifact_dir.as_posix()}/{SCRATCH_SUBDIR}",
            )
            await sa.run_stream(history, message, session_id)
            if interrupt.is_set():
                persist_round(store, session_id, history=history, message=message, agent=sa,
                              emitter=emitter, round_start=round_start,
                              loaded_skill_marker=_loaded_skill_marker(), interrupt_event=interrupt)
                outcome = OUTCOME_STOPPED
                break
            outcome_round = persist_round(store, session_id, history=history, message=message,
                                          agent=sa, emitter=emitter, round_start=round_start,
                                          loaded_skill_marker=_loaded_skill_marker(), interrupt_event=interrupt)
            if outcome_round.error:
                last_review = ReviewResult(score=None, passed=False, kind="failed",
                                           error=f"工作回合失败：{outcome_round.error}")
                store.append_event(session_id, KIND_REVIEW, last_review.to_payload(i, threshold))
                outcome = OUTCOME_REVIEW_FAILED
                break
            if not has_deliverable(state.artifact_dir, template_names):
                last_review = ReviewResult(score=None, passed=False, kind="no_artifact")
                store.append_event(session_id, KIND_REVIEW, last_review.to_payload(i, threshold))
                continue
            material = collect_review_material(state.artifact_dir, template_names, cw)
            system, msgs = build_review_messages(material, task, criteria, threshold, review_images)
            last_review = await _do_review(review_provider, msgs, system, cw, review_images, tracer)
            store.append_event(session_id, KIND_REVIEW, last_review.to_payload(i, threshold))
            if last_review.kind == "failed":
                outcome = OUTCOME_REVIEW_FAILED
                break
            if last_review.score is not None and last_review.score >= threshold:
                outcome, final_score = OUTCOME_PASSED, last_review.score
                break
        else:
            outcome = OUTCOME_EXHAUSTED
            final_score = last_review.score if last_review is not None else None
        if state.stop_requested or interrupt.is_set():
            outcome = OUTCOME_STOPPED if outcome != OUTCOME_PASSED else outcome
    except asyncio.CancelledError:
        outcome = OUTCOME_STOPPED if (state.stop_requested or interrupt.is_set()) else OUTCOME_INTERRUPTED
        raise
    except DispatchError:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("[employee:%s] assignment crashed: %s", state.employee_name, e)
        outcome = OUTCOME_REVIEW_FAILED
        last_review = ReviewResult(score=None, passed=False, kind="failed", error=str(e))
        store.append_event(session_id, KIND_REVIEW, last_review.to_payload(state.iteration, threshold))
    finally:
        store.append_event(session_id, KIND_END, {
            "outcome": outcome, "score": final_score, "iterations": state.iteration,
            "employee_id": state.employee_id,
        })
        with _lock:
            _active.pop(session_id, None)
        try:
            unregister_interrupt(session_id, interrupt)
        except Exception:  # noqa: BLE001
            pass
        logger.info("[employee:%s] assignment %s ended: %s score=%s",
                    state.employee_name, session_id, outcome, final_score)


def _loaded_skill_marker() -> str:
    from doclens.web_v2.api._chat_markers import LOADED_SKILL_MARKER

    return LOADED_SKILL_MARKER


async def _do_review(provider, messages: list[dict], system: str, context_window: Optional[int],
                     review_images: bool, tracer=None) -> ReviewResult:
    """评审调用（重试一次）。失败返回 ReviewResult(kind='failed')。

    评审**不走兜底切换**：换评审模型即换分数口径（ADR-0062）。
    """
    last_err = ""
    from planify.core.llm.types import Tool

    review_tool = Tool(
        name=REVIEW_TOOL_SCHEMA["name"],
        description=REVIEW_TOOL_SCHEMA["description"],
        input_schema=REVIEW_TOOL_SCHEMA["input_schema"],
    )
    for attempt in range(2):
        try:
            resp = await asyncio.to_thread(
                provider.chat, messages, system, [review_tool], REVIEW_MAX_TOKENS, tracer,
            )
            return parse_review(getattr(resp, "content", None), 0)
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
            logger.warning("review attempt %d failed: %s", attempt + 1, last_err)
            if attempt == 0:
                await asyncio.sleep(1.0)
    return ReviewResult(score=None, passed=False, kind="failed", error=last_err)


def _new_session(employee: dict, task: str) -> str:
    """建派活会话（type=chat，mode=employee，标题 = 员工名 · 任务前 20 字）。"""
    from doclens.web_v2.deps import get_sessions_store
    from doclens.web_v2.sessions_store import SessionSummary, SessionType

    store = get_sessions_store()
    now = datetime.now(timezone.utc)
    more = "…" if len(task) > 20 else ""
    session_id = store.new_session_id()
    store.create(SessionSummary(
        id=session_id, type=SessionType.CHAT,
        title=f"{employee['name']} · {task[:20]}{more}", preview=task[:120], mode=SESSION_MODE,
        created_at=now, updated_at=now,
    ))
    return session_id


def dispatch(employee: dict, task: str) -> dict:
    """派活入口（同步预处理 + 后台 task）。返回 {session_id, artifact_dir}。

    错误以 DispatchError 抛出：同员工有进行中派活（409）/ 模型预设缺失（400）/
    模板缺失（400）。
    """
    from doclens.web_v2.chat_interrupt import register_interrupt_hook
    from doclens.web_v2.deps import get_agent, get_sessions_store

    task = (task or "").strip()
    if not task:
        raise DispatchError("任务不能为空", "EMPTY_TASK", 400)
    if running_for(employee["id"]) is not None:
        raise DispatchError(f"员工「{employee['name']}」有进行中的派活", "EMPLOYEE_BUSY", 409)
    if _preset_or_none(employee.get("model_preset_id")) is None:
        raise DispatchError("工作模型预设不存在，请先在员工设置里改配", "MODEL_MISSING", 400)
    if employee.get("review_model_preset_id") and _preset_or_none(employee["review_model_preset_id"]) is None:
        raise DispatchError("评审模型预设不存在，请先在员工设置里改配", "MODEL_MISSING", 400)

    agent = get_agent()
    runtime = agent.runtime
    workdir = Path(agent.workdir)

    artifact_dir = assignment_dir(workdir, employee["artifact_root"], task)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    (artifact_dir / SCRATCH_SUBDIR).mkdir(exist_ok=True)
    try:
        has_template, template_names = _copy_template(employee.get("template_path"), artifact_dir, workdir)
    except DispatchError:
        shutil.rmtree(artifact_dir, ignore_errors=True)
        raise

    session_id = _new_session(employee, task)

    skills_bodies, missing = _preload_skills(runtime, employee.get("skills_allow") or [])
    skills_extra = build_system_extra(
        employee.get("prompt") or "", skills_bodies, workdir, artifact_dir, missing,
    )
    brief = build_brief(
        task, artifact_dir, has_template,
        int(employee.get("score_threshold") or 90), employee.get("review_criteria") or "",
        int(employee.get("max_iterations") or 5),
    )
    get_sessions_store().ensure_message_user(session_id, brief)

    interrupt = register_interrupt(session_id)
    state = AssignmentState(
        session_id=session_id, employee_id=employee["id"], employee_name=employee["name"],
        artifact_dir=artifact_dir, started_at=datetime.now(timezone.utc).isoformat(),
        interrupt=interrupt,
    )
    register_interrupt_hook(session_id, _kill_shells_hook(session_id))
    with _lock:
        _active[session_id] = state

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError as e:
        with _lock:
            _active.pop(session_id, None)
        raise DispatchError("派活需要在事件循环上启动", "NO_LOOP", 500) from e

    # 配置快照：整个派活按此刻的员工配置运行（期间改配置不影响进行中的派活）
    cfg = {k: (list(v) if isinstance(v, list) else v) for k, v in employee.items()}
    review_preset = _preset_or_none(employee.get("review_model_preset_id")) or _preset_or_none(employee["model_preset_id"])
    review_images = bool((review_preset or {}).get("vision"))
    task_obj = loop.create_task(_loop(state, cfg, task, brief, template_names, skills_extra, review_images))

    if not try_register(session_id, task_obj):
        task_obj.cancel()
        with _lock:
            _active.pop(session_id, None)
        raise DispatchError("会话登记失败，请重试", "REGISTER_FAILED", 409)
    return {"session_id": session_id, "artifact_dir": artifact_dir.as_posix()}


def mark_interrupted_on_startup() -> int:
    """启动时补记：库里有 start 无 end 的派活 → 追加 interrupted 结局。返回补记条数。"""
    from doclens.web_v2.deps import get_sessions_store

    store = get_sessions_store()
    n = 0
    try:
        for sid in store.sessions_with_open_event(KIND_START, KIND_END):
            start = store.get_events(sid, KIND_START)
            emp_id = None
            if start:
                try:
                    emp_id = json.loads(start[0].payload).get("employee_id")
                except (json.JSONDecodeError, TypeError):
                    pass
            store.append_event(sid, KIND_END, {"outcome": OUTCOME_INTERRUPTED, "score": None,
                                               "iterations": 0, "employee_id": emp_id})
            n += 1
    except Exception as e:  # noqa: BLE001
        logger.warning("mark interrupted assignments failed: %s", e)
    return n
