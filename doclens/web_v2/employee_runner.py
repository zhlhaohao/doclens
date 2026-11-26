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

from doclens.web_v2.chat_interrupt import register_interrupt, request_stop, unregister_interrupt
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
    "spawn_teammate", "list_teammates", "send_message", "read_inbox", "broadcast",
    "shutdown_request", "plan_approval", "idle",
    "compress",
    "TodoWrite",
})

#: 有写入能力的内置 shell 工具（授权界面提示「写入不受产物目录硬保证」）
SHELL_TOOLS: frozenset[str] = frozenset({"bash", "powershell"})

#: doclens 注入的知识库工具（工具目录分组用；定义见 kb_tools.py / grep_tools.py）
KB_TOOL_NAMES: frozenset[str] = frozenset({"search_kb", "read_document", "file_info", "kb_grep"})

#: 产物目录内的临时文件子目录
SCRATCH_SUBDIR = "tmp"



_SLUG_MAX = 40

# ---------------------------------------------------------------------------
# 结局与评审结果
# ---------------------------------------------------------------------------

OUTCOME_PASSED = "passed"
OUTCOME_EXHAUSTED = "exhausted"
OUTCOME_REVIEW_FAILED = "review_failed"
OUTCOME_STOPPED = "stopped"
OUTCOME_INTERRUPTED = "interrupted"
OUTCOME_BUDGET = "budget_exhausted"
OUTCOMES = (OUTCOME_PASSED, OUTCOME_EXHAUSTED, OUTCOME_REVIEW_FAILED,
            OUTCOME_STOPPED, OUTCOME_INTERRUPTED, OUTCOME_BUDGET)


@dataclass
class ReviewResult:
    """一次评审的结果。``score=None`` 表示未评审（无产物预检 / 评审失败）。"""

    score: Optional[int]
    passed: bool
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    summary: str = ""
    checks: list[dict] = field(default_factory=list)
    kind: str = "review"   # review | failed
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
            "checks": list(self.checks),
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


def build_system_extra(prompt: str, workdir: Path, artifact_dir: Path,
                       work_skills: list[str]) -> str:
    """专属提示词 + 员工工作规则（追加在精简基础提示词之后；技能按需加载不预载）。"""
    parts: list[str] = ["# Your role\n\n" + prompt.strip()]
    rules = [
        "# 数字员工工作规则\n\n",
        f"- 工作目录：`{workdir.as_posix()}`；本次任务的产物目录：`{artifact_dir.as_posix()}`。",
        "- 你的全部工作成果**必须落盘到产物目录**（或任务指定的位置）。只写在对话里的内容不算交付。",
        "- 你**只能写入产物目录**（含其子目录）；写别处会被工具拒绝。",
        f"- 临时脚本与中间文件放产物目录下的 `{SCRATCH_SUBDIR}/`。",
        "- 完成后用一两句话说明产出了哪些文件（路径）。",
    ]
    if work_skills:
        rules.append(
            "- 工作技能（任务开始前先 load_skill 加载）：" + ", ".join(f"`{s}`" for s in work_skills)
            + "。白名单外的技能不可用。"
        )
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
# 纯函数层：评审回合（ADR-0065）
# ---------------------------------------------------------------------------

REVIEW_ORDER_TAG = "review-order"

#: 评审回合的结束契约：模型调用它提交结果；未调用即评审失败
REVIEW_TOOL_SCHEMA = {
    "name": "submit_review",
    "description": (
        "提交评审结果并结束评审。这是评审回合唯一被接受的结束方式：分析完成后必须调用它，"
        "不要以文字总结结束。score 为 0-100 整数；issues 是员工返工的依据，每条要指向具体位置并说明期望。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {"type": "integer", "minimum": 0, "maximum": 100,
                      "description": "0-100 的单个总分"},
            "passed": {"type": "boolean", "description": "是否达到通过阈值（仅作参考，达标判定以分数为准）"},
            "issues": {"type": "array", "items": {"type": "string"},
                       "description": "必须修正的问题（给返工用，具体可执行）"},
            "suggestions": {"type": "array", "items": {"type": "string"},
                            "description": "可选的改进建议"},
            "summary": {"type": "string", "description": "一两句话的总体评价"},
            "checks": {"type": "array",
                       "description": "逐项检查明细（可选）：评审技能跑脚本/核对得到的逐项结果",
                       "items": {"type": "object",
                                 "properties": {"name": {"type": "string"},
                                                "value": {"type": "string"},
                                                "pass": {"type": "boolean"}}}},
        },
        "required": ["score", "issues"],
    },
}


def build_review_order(skill: str, artifact_dir: Path, task: str, criteria: str,
                       threshold: int, tool_rounds: int = 0) -> str:
    """评审指令：以用户消息形态落库（带标签），驱动评审回合。

    ``tool_rounds`` > 0 时在指令里明示本回合的工具调用上限——让模型据此规划
    （把调用留给核实、尽早提交），并在评审 agent 上以 force_answer_rounds 强制执行。
    真机教训（2026-11-26）：评审模型把「抽查」做成「审计」，29 次 bash 仍未提交，
    上限不明示时模型不会自己收敛。
    """
    cap = (
        f"工具调用上限：本评审回合最多 {tool_rounds} 次工具调用（达到即强制结束，"
        "届时未调用 submit_review 视为评审失败）——请把调用留给核实，**尽早调用 submit_review 提交结果**。\n"
        if tool_rounds else ""
    )
    return (
        f"<{REVIEW_ORDER_TAG} skill=\"{skill}\" threshold=\"{threshold}\">\n"
        "请使用评审技能评审本次产物：\n"
        f"- 评审技能：`{skill}`（先 load_skill 加载，按其方法评审）\n"
        f"- 产物目录：{artifact_dir.as_posix()}\n"
        f"- 原始任务：{task.strip()}\n"
        f"- 评审标准：{criteria.strip()}\n"
        f"- 通过阈值：{threshold} 分\n"
        "要求：用工具核实，不凭印象；每条意见指向具体位置。不要修改被评审的交付物。"
        "**这是抽查不是审计**：核实 2–4 处即可，不要逐条核对每个数字。\n"
        "分析完成后**调用 submit_review 提交结果**——这是评审回合唯一被接受的结束方式。\n"
        f"{cap}"
        f"</{REVIEW_ORDER_TAG}>"
    )


def build_budget_warning(used: int, budget: int) -> str:
    """预算预警（作为返工指令前缀）。"""
    pct = int(used * 100 / budget) if budget else 0
    return f"⚠️ 预算已用 {pct}%（{used:,} / {budget:,} token），请尽快收尾。\n"


def sum_usage(usages: list[dict]) -> int:
    """一次回合的 token 消耗（四字段全算不加权，与 usage 归一契约同口径）。"""
    total = 0
    for u in usages or []:
        if not isinstance(u, dict):
            continue
        for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens"):
            v = u.get(k)
            if isinstance(v, (int, float)):
                total += int(v)
    return total


def build_skill_allowlist_handler(original_handler, allow: set[str]):
    """包装 load_skill：只允许白名单内的技能名，其余明确拒绝。"""

    def _h(name: str = "", **kw):
        n = (name or kw.get("name") or "").strip()
        if n not in allow:
            return (
                f"Error: 技能 `{n}` 不在你的白名单内，无法加载。"
                f"可用技能：{', '.join(sorted(allow)) or '（无）'}。请如实说明并停止，不要绕过。"
            )
        return original_handler(name=n, **kw) if original_handler else f"Error: 技能 `{n}` 不存在"

    return _h


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


def internal_skill_loader():
    """内部技能库的独立加载器（与公开技能的全局单例互不可见）。目录不存在 → None。"""
    from planify.skills.skill_loader import SkillLoader
    from doclens.web_v2.employees_store import internal_skills_dir

    root = internal_skills_dir()
    if not root.exists():
        return None
    return SkillLoader(root, auto_refresh=False)


def _check_internal_skills(cfg: dict, loader) -> None:
    """派活前校验：引用的内部技能必须存在，否则派活失败（不静默降级）。"""
    from doclens.web_v2.employees_store import internal_skills_dir

    names = set(loader.skills.keys()) if loader is not None else set()
    missing = [n for n in (cfg.get("skills_allow") or []) if n not in names]
    rs = cfg.get("review_skill")
    if rs and rs not in names:
        missing.append(rs)
    if missing:
        raise DispatchError(
            f"内部技能不存在：{', '.join(missing)}（内部技能库：{internal_skills_dir()}）",
            "SKILL_MISSING", 400,
        )


# ---- 回合执行 ----


async def _run_turn(store, session_id: str, message: str, *, runtime, workdir: Path, provider,
                    model: str, tools: list, handlers: dict, skills_loader, system_extra: str,
                    interrupt, tracer, max_tool_rounds: int,
                    keep_tools_on_force: tuple = ()) -> Any:
    """跑一个回合（工作或评审通用）并落库。返回 (RoundOutcome, emitter)。"""
    from planify.streaming.runner import StreamingAgent
    from planify.streaming.types import StreamingConfig
    from planify.streaming.waiter import get_global_waiter
    from doclens.web_v2.api._chat_emitter import ChatEventEmitter

    # 调用方已 ensure_message_user（首轮由 dispatch 落库；此处不再 ensure——
    # ensure 的幂等只看「末条是否同内容 user」，此刻末条是流程事件条目会重复落）
    history = store.get_chat_history(session_id)
    if history and history[-1].get("role") == "user":
        tail = history[-1].get("content")
        if isinstance(tail, str) and tail == message:
            history.pop()
    round_start = len(history)
    emitter = ChatEventEmitter(queue=None, context_window=runtime.config.planify_context_window)
    kw = {}
    if max_tool_rounds:
        kw["force_answer_rounds"] = max_tool_rounds
        if keep_tools_on_force:
            kw["force_answer_keep_tools"] = tuple(keep_tools_on_force)
    sa = StreamingAgent(
        client=provider, model=model, tools=tools, tool_handlers=handlers, emitter=emitter,
        config=StreamingConfig(
            compact_threshold=int(round(runtime.config.planify_context_window * 0.8)),
            context_window=runtime.config.planify_context_window,
            max_tokens=runtime.config.planify_max_tokens, **kw,
        ),
        waiter=get_global_waiter(), skills_loader=skills_loader, logger_instance=runtime.logger,
        runtime=runtime, interrupt_event=interrupt, system_prompt_extra=system_extra,
        tracer=tracer, base_prompt="minimal",
    )
    await sa.run_stream(history, message, session_id)
    outcome = persist_round(
        store, session_id, history=history, message=message, agent=sa, emitter=emitter,
        round_start=round_start, loaded_skill_marker=_loaded_skill_marker(),
        interrupt_event=interrupt,
    )
    return outcome, emitter


def _loaded_skill_marker() -> str:
    from doclens.web_v2.api._chat_markers import LOADED_SKILL_MARKER

    return LOADED_SKILL_MARKER


class _SubmitReviewCatcher:
    """评审回合的 submit_review handler：收到入参即记录；重复调用以首次为准。"""

    def __init__(self):
        self.result: Optional[dict] = None

    def __call__(self, **kw):
        if self.result is None:
            self.result = dict(kw)
            return "评审结果已提交。评审结束。"
        return "评审结果已提交过，无需重复。"


def _review_result_from_input(inp: dict, threshold: int) -> ReviewResult:
    try:
        score = int(round(float(inp.get("score"))))
    except (TypeError, ValueError):
        raise ValueError("评审结果缺少合法分数")
    score = max(0, min(100, score))
    issues = [str(x).strip() for x in (inp.get("issues") or []) if str(x).strip()]
    suggestions = [str(x).strip() for x in (inp.get("suggestions") or []) if str(x).strip()]
    checks = []
    for c in inp.get("checks") or []:
        if isinstance(c, dict):
            checks.append({"name": str(c.get("name", "")), "value": str(c.get("value", "")),
                           "pass": bool(c.get("pass"))})
    return ReviewResult(score=score, passed=score >= threshold, issues=issues,
                        suggestions=suggestions, summary=str(inp.get("summary") or ""),
                        checks=checks)


async def _loop(state: AssignmentState, cfg: dict, task: str, first_message: str,
                system_extra: str) -> None:
    """派活主循环（后台 task）：工作回合 → 评审回合 → 返工指令，直至结局。"""
    from doclens.web_v2.deps import get_agent, get_sessions_store
    from planify.core.llm.trace import LLMTracer
    store = get_sessions_store()
    agent = get_agent()
    runtime = agent.runtime
    workdir = Path(agent.workdir)
    session_id = state.session_id

    work_preset = _preset_or_none(cfg["model_preset_id"])
    if work_preset is None:
        raise DispatchError("工作模型预设不存在", "MODEL_MISSING", 400)
    depth = cfg.get("thinking_depth") or "auto"
    provider = _make_provider(work_preset, depth)
    model = work_preset.get("model_id") or ""

    threshold = int(cfg.get("score_threshold") or 90)
    max_iter = int(cfg.get("max_iterations") or 5)
    budget = int(cfg.get("token_budget") or 0)
    max_rounds = int(cfg.get("max_tool_rounds") or 0)
    review_rounds = int(cfg.get("review_tool_rounds") or 0)
    criteria = cfg.get("review_criteria") or ""
    review_skill = cfg.get("review_skill") or ""
    artifact_dir = state.artifact_dir

    allowed = set(resolve_tools(runtime.tools, cfg.get("tools_allow") or [], cfg.get("tools_deny") or []))
    # 员工需要 load_skill 才能按需加载内部技能；强制加入（白名单由 handler 校验）
    skill_names = set(cfg.get("skills_allow") or [])
    if review_skill:
        skill_names.add(review_skill)
    base_handlers = {k: v for k, v in runtime.tool_handlers.items() if k in allowed}
    base_handlers = bind_write_boundary(base_handlers, artifact_dir, workdir)
    loader = internal_skill_loader()
    if loader is None:
        raise DispatchError("内部技能库不存在", "SKILL_MISSING", 400)
    base_handlers["load_skill"] = build_skill_allowlist_handler(
        _internal_load_skill_handler(loader, runtime), skill_names,
    )
    base_tools = [t for t in runtime.tools if t.get("name") in allowed]
    if "load_skill" not in allowed:
        base_tools = [t for t in runtime.tools if t.get("name") == "load_skill"] + base_tools
    # 清单只列白名单内的内部技能：用 loader 的 disabled 机制（只影响 descriptions）
    loader.set_disabled(set(loader.skills.keys()) - skill_names)

    interrupt = state.interrupt
    tracer = LLMTracer.create(label="employee", session_key=session_id, workdir=agent.workdir)

    store.append_event(session_id, KIND_START, {
        "employee_id": state.employee_id, "employee_name": state.employee_name,
        "artifact_dir": artifact_dir.as_posix(), "threshold": threshold,
        "max_iterations": max_iter, "token_budget": budget, "task": task,
    })
    outcome: str = OUTCOME_INTERRUPTED
    final_score: Optional[int] = None
    last_review: Optional[ReviewResult] = None
    spent = 0
    try:
        for i in range(1, max_iter + 1):
            if interrupt.is_set():
                outcome = OUTCOME_STOPPED
                break
            state.iteration = i
            # ---- 工作回合 ----
            if i == 1:
                message = first_message
            else:
                assert last_review is not None
                message = build_rework_order(last_review, threshold, artifact_dir)
                if budget and spent * 5 >= budget * 4:
                    message = build_budget_warning(spent, budget) + message
                store.ensure_message_user(session_id, message)
            round_outcome, emitter = await _run_turn(
                store, session_id, message, runtime=runtime, workdir=workdir, provider=provider,
                model=model, tools=base_tools, handlers=base_handlers, skills_loader=loader,
                system_extra=system_extra, interrupt=interrupt, tracer=tracer,
                max_tool_rounds=max_rounds,
            )
            spent += sum_usage(emitter.usages)
            if interrupt.is_set():
                outcome = OUTCOME_STOPPED
                break
            if round_outcome.error:
                last_review = ReviewResult(score=None, passed=False, kind="failed",
                                           error=f"工作回合失败：{round_outcome.error}")
                store.append_event(session_id, KIND_REVIEW, last_review.to_payload(i, threshold))
                outcome = OUTCOME_REVIEW_FAILED
                break
            if budget and spent >= budget:
                outcome = OUTCOME_BUDGET
                break
            # ---- 评审回合 ----
            catcher = _SubmitReviewCatcher()
            review_handlers = dict(base_handlers)
            review_handlers["submit_review"] = catcher
            review_tools = base_tools + [{"name": "submit_review",
                                          "description": REVIEW_TOOL_SCHEMA["description"],
                                          "input_schema": REVIEW_TOOL_SCHEMA["input_schema"]}]
            review_provider, review_model = provider, model
            for pid in cfg.get("review_model_presets") or []:
                p = _preset_or_none(pid)
                if p is not None:
                    try:
                        review_provider = _make_provider(p, depth)
                        review_model = p.get("model_id") or ""
                        break
                    except Exception as e:  # noqa: BLE001
                        logger.warning("review preset %s unusable: %s", pid, e)
            order = build_review_order(review_skill, artifact_dir, task, criteria, threshold,
                                       review_rounds)
            store.ensure_message_user(session_id, order)
            review_outcome, review_emitter = await _run_turn(
                store, session_id, order, runtime=runtime, workdir=workdir,
                provider=review_provider, model=review_model, tools=review_tools,
                handlers=review_handlers, skills_loader=loader, system_extra=system_extra,
                interrupt=interrupt, tracer=tracer, max_tool_rounds=review_rounds,
                keep_tools_on_force=("submit_review",),
            )
            spent += sum_usage(review_emitter.usages)
            if interrupt.is_set():
                outcome = OUTCOME_STOPPED
                break
            if catcher.result is None:
                last_review = ReviewResult(
                    score=None, passed=False, kind="failed",
                    error=(f"评审回合未调用 submit_review 就结束。{('错误：' + review_outcome.error) if review_outcome.error else '员工最后说：' + (review_emitter.get_full_text() or '（无）')[:300]}"),
                )
                store.append_event(session_id, KIND_REVIEW, last_review.to_payload(i, threshold))
                outcome = OUTCOME_REVIEW_FAILED
                break
            try:
                last_review = _review_result_from_input(catcher.result, threshold)
            except ValueError as e:
                last_review = ReviewResult(score=None, passed=False, kind="failed", error=str(e))
                store.append_event(session_id, KIND_REVIEW, last_review.to_payload(i, threshold))
                outcome = OUTCOME_REVIEW_FAILED
                break
            store.append_event(session_id, KIND_REVIEW, last_review.to_payload(i, threshold))
            if last_review.score is not None and last_review.score >= threshold:
                outcome, final_score = OUTCOME_PASSED, last_review.score
                break
            if budget and spent >= budget:
                outcome = OUTCOME_BUDGET
                break
        else:
            outcome = OUTCOME_EXHAUSTED
            final_score = last_review.score if last_review is not None else None
        if (state.stop_requested or interrupt.is_set()) and outcome != OUTCOME_PASSED:
            outcome = OUTCOME_STOPPED
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
            "employee_id": state.employee_id, "tokens_spent": spent, "token_budget": budget,
        })
        with _lock:
            _active.pop(session_id, None)
        try:
            unregister_interrupt(session_id, interrupt)
        except Exception:  # noqa: BLE001
            pass
        logger.info("[employee:%s] assignment %s ended: %s score=%s tokens=%s/%s",
                    state.employee_name, session_id, outcome, final_score, spent, budget)


def _internal_load_skill_handler(loader, runtime):
    """内部技能的 load_skill 底层 handler（与框架的公开 load_skill 同契约：
    返回 XML 包装的技能正文；成功时按会话标记已加载）。"""
    from planify.skills.access_state import get_current_session_id, mark_loaded_if_known

    state = getattr(runtime, "skill_access_state", None)

    def _handle(name: str) -> str:
        body = loader.load(name)
        mark_loaded_if_known(state, get_current_session_id(), name, body)
        return body

    return _handle


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
    内部技能缺失（400）/ 模板缺失（400）。
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
    if not employee.get("review_skill"):
        raise DispatchError("未配置评审技能", "SKILL_MISSING", 400)
    loader = internal_skill_loader()
    if loader is None:
        raise DispatchError("内部技能库不存在", "SKILL_MISSING", 400)
    _check_internal_skills(employee, loader)

    agent = get_agent()
    workdir = Path(agent.workdir)

    artifact_dir = assignment_dir(workdir, employee["artifact_root"], task)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    (artifact_dir / SCRATCH_SUBDIR).mkdir(exist_ok=True)
    try:
        has_template, _template_names = _copy_template(employee.get("template_path"), artifact_dir, workdir)
    except DispatchError:
        shutil.rmtree(artifact_dir, ignore_errors=True)
        raise

    session_id = _new_session(employee, task)

    system_extra = build_system_extra(
        employee.get("prompt") or "", workdir, artifact_dir, employee.get("skills_allow") or [],
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

    # 配置快照：整个派活按此刻的员工配置运行
    cfg = {k: (list(v) if isinstance(v, list) else v) for k, v in employee.items()}
    task_obj = loop.create_task(_loop(state, cfg, task, brief, system_extra))

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
