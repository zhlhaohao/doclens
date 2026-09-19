"""外部访问门禁（ADR-0021）

对「工作目录以外路径的读写」做统一处置：结构化工具（read/write/edit）
精确判定路径，shell 工具（bash/powershell/background_run）扫描命令文本
中的绝对路径。三态配置：

- ``ask``（默认）：弹用户确认，确认后会话内按目录授权（读/写分账）
- ``allow``：不问直接放行（关闭确认）
- ``block``：不问直接拦截

安全立场：**纵深防御，不是沙箱**——shell 命令的静态扫描存在已知漏检
（变量拼接 ``$VAR``、``cd`` 后相对操作等），目的是把「无意识的外部访问」
变成「用户可见的决策」，不是阻止决心绕过的执行者。

无交互渠道（子代理 / teammate 线程）或确认超时一律 fail-closed（按 block
处置）——否则子代理会成为绕过门禁的后门。

配置命名空间：``PLANIFY_OUTSIDE_WORKDIR``（引擎只认自身命名空间，宿主
经环境或自身配置通路注入）。术语保持中性，不出现宿主应用名。
"""

from __future__ import annotations

import logging
import os
import re
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from ..skills.access_state import get_current_session_id

logger = logging.getLogger(__name__)

__all__ = [
    "GUARD_ENV",
    "GUARD_MODES",
    "GuardVerdict",
    "ACTION_ALLOW",
    "ACTION_DENY",
    "ACTION_CONFIRM",
    "GRANT_LABEL",
    "DENY_LABEL",
    "get_guard_mode",
    "classify_tool_call",
    "record_grant",
    "grant_session_clear",
    "grant_clear_all",
    "make_guard_question",
    "parse_grant_response",
    "resolve_guarded_path",
    "wrap_shell_handler_fail_closed",
    "denied_message",
    "extract_external_paths",
    "is_write_command",
]

# ---- 配置 ----

GUARD_ENV = "PLANIFY_OUTSIDE_WORKDIR"
GUARD_MODES = ("ask", "allow", "block")
# 门禁确认超时（秒）：超时即 fail-closed 拒绝、对话继续
# （比模型提问的 300s 短：安全确认是「当下决策」，不宜长时间挂起对话）
GUARD_TIMEOUT_SECONDS = 120.0


def get_guard_mode() -> str:
    """读取门禁三态配置（非法值回落 ask 并告警）。"""
    raw = os.getenv(GUARD_ENV, "ask").strip().lower()
    if raw not in GUARD_MODES:
        logger.warning(
            "[guard] %s=%r 非法（合法值 %s），回落 ask", GUARD_ENV, raw, GUARD_MODES
        )
        return "ask"
    return raw


# ---- 受管工具与读写语义 ----

# 结构化工具：path 参数语义干净，精确判定。值为读写语义。
STRUCTURED_TOOLS: Dict[str, str] = {
    "read_file": "read",
    "write_file": "write",
    "edit_file": "write",
}
# shell 工具：命令文本启发式扫描。
SHELL_TOOLS = ("bash", "powershell", "background_run")
GUARDED_TOOLS = frozenset(STRUCTURED_TOOLS) | frozenset(SHELL_TOOLS)

# ---- 判定结果 ----

ACTION_ALLOW = "allow"
ACTION_DENY = "deny"
ACTION_CONFIRM = "confirm"


@dataclass(frozen=True)
class GuardVerdict:
    """门禁判定结果（不可变）。

    action=allow/deny 时 targets/mode 仅供错误消息参考；
    action=confirm 时 targets 为待授权目录、mode 为读写语义。
    """

    action: str
    tool: str = ""
    mode: str = "read"  # "read" | "write"
    targets: Tuple[Path, ...] = ()
    reason: str = ""

    @property
    def allowed(self) -> bool:
        return self.action == ACTION_ALLOW


_ALLOWED_VERDICT = GuardVerdict(action=ACTION_ALLOW)


# ---- 路径归一化与内外判定 ----


def _norm_key(p: Path) -> str:
    """路径归一键：resolve（不要求存在）+ 大小写折叠（Windows 不敏感）。"""
    try:
        return str(p.resolve(strict=False)).casefold()
    except OSError:  # 解析失败（非法盘符等）退化为字面值
        return str(p).casefold()


def _outside(path: Path, workdir_key: str) -> bool:
    """路径是否在 workdir 之外（含子树语义）。"""
    key = _norm_key(path)
    return not (key == workdir_key or key.startswith(workdir_key + os.sep))


# PowerShell 环境变量语法：$env:NAME（os.path.expandvars 只认 %VAR%，不认这个）
_PS_ENV = re.compile(r"\$env:([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)


def _expand(raw: str) -> Path:
    """展开 ~ / %VAR% / $env:NAME 后构造 Path（Windows 下另做 MSYS 盘符归一）。"""
    tok = _PS_ENV.sub(
        lambda m: os.environ.get(m.group(1), m.group(0)), os.path.expandvars(raw)
    )
    if sys.platform == "win32":
        # Git Bash 工具用 /c/... 挂载风格表达盘符路径——归一为 C:\...，
        # 否则按 Unix 绝对路径 resolve 成「C:\c\...」：确认文案显示怪路径，
        # 且授权账本键与 Windows 写法不互通（同一目录两种写法重复弹确认）
        m = _MSYS_DRIVE.match(tok)
        if m:
            rest = tok[3:]
            tok = m.group(1).upper() + ":\\" + rest.replace("/", "\\")
    p = Path(tok)
    if str(p).startswith("~"):
        p = p.expanduser()
    return p


def _grant_dir(path: Path) -> Path:
    """授权记账的目录锚点。

    目标本身是已存在的目录 → 授权该目录（ls ~/、ls D:\\报告 的意图就是它，
    取 parent 会把 C:\\Users、D:\\ 这类超大范围一并授权）；目标是文件或
    不存在（write_file 新文件）→ 取父目录（父目录即意图范围）。
    """
    try:
        if path.is_dir():
            return path
    except OSError:
        pass
    return path.parent


# ---- 会话目录授权账本（读/写分账，写蕴含读；内存态，会话结束不持久） ----


class _GrantLedger:
    """线程安全的会话级授权账本（模块级单例）。

    结构：session_id -> {"read": {目录键…}, "write": {目录键…}}。
    授权为目录子树语义：目标路径落在任一授权目录之下即视为已授权。
    """

    def __init__(self) -> None:
        self._grants: Dict[str, Dict[str, Set[str]]] = {}
        self._lock = threading.Lock()

    def grant(self, session_id: str, dir_path: Path, mode: str) -> None:
        """授予目录访问权；写授权同时蕴含读授权。"""
        if not session_id:
            return
        key = _norm_key(dir_path)
        with self._lock:
            s = self._grants.setdefault(session_id, {"read": set(), "write": set()})
            s[mode].add(key)
            if mode == "write":
                s["read"].add(key)

    def is_granted(self, session_id: str, path: Path, mode: str) -> bool:
        """路径是否已被会话授权（mode=read 时查读∪写账本）。"""
        if not session_id:
            return False
        key = _norm_key(path)
        with self._lock:
            s = self._grants.get(session_id)
            if not s:
                return False
            pools = s["write"] if mode == "write" else (s["read"] | s["write"])
            return any(
                key == d or key.startswith(d + os.sep) for d in pools
            )

    def clear(self, session_id: str) -> None:
        with self._lock:
            self._grants.pop(session_id, None)

    def clear_all(self) -> None:
        with self._lock:
            self._grants.clear()


_ledger = _GrantLedger()


def record_grant(session_id: str, dirs: List[Path], mode: str) -> None:
    """确认通过后记账（批量目录，同一读写语义）。"""
    for d in dirs:
        _ledger.grant(session_id, d, mode)


def grant_session_clear(session_id: str) -> None:
    """会话结束/清除时清账本（宿主删除会话时调用）。"""
    _ledger.clear(session_id)


def grant_clear_all() -> None:
    """清空全部会话授权账本（宿主批量删除会话时调用）。"""
    _ledger.clear_all()


# ---- shell 命令文本分析 ----

# token 是否为绝对路径形态：盘符 / UNC / Unix 根 / 家目录 / Windows 环境变量
_ABS_FORMS = (
    re.compile(r"^[A-Za-z]:[\\/]"),       # C:\ 或 C:/
    re.compile(r"^\\\\"),                 # \\server\share
    re.compile(r"^/"),                    # /unix/path
    re.compile(r"^~(?:[\\/]|$)"),         # ~/... 或裸 ~（bash 展开为家目录）
    re.compile(r"^%[^%]+%[\\/]"),         # %USERPROFILE%\...
)
_SEP_CHARS = ("/", "\\")
# Git Bash（MSYS）盘符挂载风格：/c、/c/... （单字母盘符）
_MSYS_DRIVE = re.compile(r"^/([a-zA-Z])(/|$)")


def _is_pathlike(tok: str) -> bool:
    """token 是否按路径处理：绝对形态，或含分隔符，或是 `..` 出界形态。"""
    if any(rx.match(tok) for rx in _ABS_FORMS):
        return True
    if any(c in tok for c in _SEP_CHARS):
        return True
    return tok == ".." or tok.startswith(".." + os.sep) or tok.startswith("../")


def _strip_quotes(tok: str) -> str:
    return tok.strip("\"'`").rstrip(",;")

# 写信号词表（POSIX 命令 + cmd 内建 + PowerShell cmdlet 全名；大小写不敏感）。
# 别名两字母短词（sc/sp/ri/ci/ni 等）不收——误伤普通 token，得不偿失。
_WRITE_WORDS = frozenset({
    # POSIX / coreutils
    "rm", "rmdir", "mv", "cp", "mkdir", "touch", "tee", "truncate", "shred",
    "dd", "chmod", "chown", "chgrp", "ln", "install", "strip", "patch",
    # sed -i 原地写；无 -i 是纯读——整词判写是保守方向的已接受代价
    "sed",
    # cmd 内建
    "del", "erase", "rd", "ren", "md",
    # PowerShell cmdlet（含与 POSIX 重名的默认别名 rm/cp/mv/del/rd，上表已覆盖）
    "remove-item", "copy-item", "move-item", "new-item", "set-content",
    "add-content", "out-file", "clear-content", "export-csv",
    "export-clixml", "set-item", "move", "copy",
})
# 命令段切分：管道 / 顺序 / 条件 / 换行
_SEGMENT_SPLIT = re.compile(r"[|;&\n]+")
# 丢弃型/复制型重定向：不落盘（stderr 丢弃 2>/dev/null、2>NUL；fd 复制 2>&1）。
# 从命令剥除后再检查剩余 ">"，避免「查环境把 stderr 静音」这类纯读命令误判写。
_NULL_REDIRECT = re.compile(r"\d*>>?\s*(&\d+|/dev/null|nul\b)", re.IGNORECASE)
# 空设备 token 白名单（Unix /dev/null 与 Windows NUL）：设备不落盘，不算外部路径
_NULL_DEVICE_TOKENS = {"/dev/null", "nul"}


def is_write_command(command: str) -> bool:
    """shell 命令的读写作判定（写信号词表）。

    任一命令段的首 token 命中写词表，或命令在剥除丢弃型/复制型重定向
    （``2>/dev/null``、``2>NUL``、``2>&1`` 等）后仍含 ``>`` / ``>>``
    重定向符，即整条按写处理；不确定偏向写（保守端）。
    """
    if ">" in _NULL_REDIRECT.sub(" ", command):
        return True
    for seg in _SEGMENT_SPLIT.split(command):
        tokens = _tokenize(seg)
        if not tokens:
            continue
        head = _strip_quotes(tokens[0]).casefold()
        if head in _WRITE_WORDS:
            return True
    return False


def _tokenize(command: str) -> List[str]:
    """引号感知分词：引号内的空白不分词（带空格路径不腰斩）。

    ``ls "C:/Program Files/x.exe"`` 必须产出整路径 token——朴素空白切分
    会把路径腰斩成两截，前者 resolve 成 ``C:\\Program``，授权锚点塌缩到
    盘根 ``C:\\``（确认一次即授权整个 C 盘，严重过度授权）。引号本身剥除。
    """
    tokens: List[str] = []
    buf: List[str] = []
    quote: Optional[str] = None
    for ch in command:
        if quote:
            if ch == quote:
                quote = None
            else:
                buf.append(ch)
        elif ch in "\"'":
            quote = ch
        elif ch.isspace():
            if buf:
                tokens.append("".join(buf))
                buf = []
        else:
            buf.append(ch)
    if buf:
        tokens.append("".join(buf))
    return tokens


def extract_external_paths(command: str, workdir: Path) -> List[Path]:
    """扫描命令文本，提取落在 workdir 之外的路径形态 token（去重保序）。

    引号内空白不切分（带空格路径保持整 token）；空设备（/dev/null、NUL）
    不算外部路径；URL（含 ``://``）不触发：作为相对路径拼接后不会出 workdir。
    """
    workdir_key = _norm_key(workdir)
    found: List[Path] = []
    seen: Set[str] = set()
    for raw in _tokenize(command):
        tok = _strip_quotes(raw)
        if not tok or not _is_pathlike(tok):
            continue
        if tok.casefold() in _NULL_DEVICE_TOKENS:
            continue
        p = _expand(tok)
        full = p if p.is_absolute() else workdir / p
        if _outside(full, workdir_key):
            key = _norm_key(full)
            if key not in seen:
                seen.add(key)
                found.append(full)
    return found


def extract_write_targets(command: str, workdir: Path) -> List[Path]:
    """扫描命令文本，提取**可能被写**的目标路径候选（去重保序，纯文本扫描）。

    与 ``extract_external_paths`` 的两点差异，均为宿主「写前备份」场景服务：
    - 只统计**写段**（段首 token 命中写词表，或剥除丢弃型重定向后仍含
      ``>`` / ``>>``）——纯读段的名字参数不进候选；
    - 不限路径形态也不限 workdir 内外——``sed -i note.md`` 这类无分隔符
      相对名是最常见的写目标；token 统统按相对路径拼到 workdir 解析，
      是否真为现存文件由调用方 stat 决定（本函数不做存在性过滤，
      也不区分读写位置参数——写段的全部非首 token 皆候选，宁可多备）。

    空设备 token（/dev/null、NUL）排除；URL（含 ``://``）拼接后不指现实
    文件，由调用方存在性过滤自然淘汰。
    """
    found: List[Path] = []
    seen: Set[str] = set()
    for seg in _SEGMENT_SPLIT.split(command):
        tokens = _tokenize(seg)
        if not tokens:
            continue
        head = _strip_quotes(tokens[0]).casefold()
        seg_write = head in _WRITE_WORDS or ">" in _NULL_REDIRECT.sub(" ", seg)
        if not seg_write:
            continue
        for raw in tokens[1:]:  # 首 token 是命令词，不是目标
            tok = _strip_quotes(raw)
            if not tok or tok.casefold() in _NULL_DEVICE_TOKENS:
                continue
            if tok.startswith("-"):
                continue  # flag/选项参数（-i / --force / -Recurse）不是文件名
            if set(tok) <= set("><&0123456789"):
                continue  # 重定向运算符（> / >> / 2> / &1）不是文件名
            p = _expand(tok)
            full = p if p.is_absolute() else workdir / p
            key = _norm_key(full)
            if key not in seen:
                seen.add(key)
                found.append(full)
    return found


# ---- 判定入口 ----


def _structured_verdict(
    tool: str, raw_path: str, workdir: Path, session_id: str, mode_cfg: str
) -> GuardVerdict:
    rw = STRUCTURED_TOOLS[tool]
    p = _expand(str(raw_path))
    full = p if p.is_absolute() else workdir / p
    if not _outside(full, _norm_key(workdir)):
        return _ALLOWED_VERDICT
    if mode_cfg == "allow":
        return _ALLOWED_VERDICT
    # block 优先于会话授权：严格模式绝对拦截（用户切 block 的意图是全拦，
    # 已授权目录静默放行会违背直觉）；授权只在 ask 模式下免弹
    if mode_cfg == "block":
        return GuardVerdict(
            ACTION_DENY, tool=tool, mode=rw, targets=(_grant_dir(full),),
            reason=f"配置 {GUARD_ENV}=block",
        )
    if _ledger.is_granted(session_id, full, rw):
        return _ALLOWED_VERDICT
    return GuardVerdict(
        ACTION_CONFIRM, tool=tool, mode=rw, targets=(_grant_dir(full),)
    )


def _shell_verdict(
    tool: str, command: str, workdir: Path, session_id: str, mode_cfg: str
) -> GuardVerdict:
    externals = extract_external_paths(command, workdir)
    if not externals:
        return _ALLOWED_VERDICT
    if mode_cfg == "allow":
        return _ALLOWED_VERDICT
    rw = "write" if is_write_command(command) else "read"
    # block 优先于会话授权（同 _structured_verdict：严格模式绝对拦截）
    if mode_cfg == "block":
        return GuardVerdict(
            ACTION_DENY, tool=tool, mode=rw,
            targets=tuple(_grant_dir(p) for p in externals),
            reason=f"配置 {GUARD_ENV}=block",
        )
    seen: Set[str] = set()
    targets: List[Path] = []
    for p in externals:
        if _ledger.is_granted(session_id, p, rw):
            continue
        d = _grant_dir(p)
        key = _norm_key(d)
        if key in seen:
            continue
        seen.add(key)
        targets.append(d)
    if not targets:
        return _ALLOWED_VERDICT
    return GuardVerdict(ACTION_CONFIRM, tool=tool, mode=rw, targets=tuple(targets))


def classify_tool_call(
    tool_name: str,
    input_data: dict,
    workdir: Path,
    session_id: Optional[str] = None,
) -> GuardVerdict:
    """门禁判定（同步、无副作用）。

    Args:
        tool_name: 工具名
        input_data: 模型给出的工具入参
        workdir: 工作目录（越界判定的基准）
        session_id: 会话 ID（缺省取 contextvar——子代理线程自动继承）

    Returns:
        GuardVerdict：allow=放行 / deny=拦截 / confirm=需用户确认
    """
    if tool_name not in GUARDED_TOOLS:
        return _ALLOWED_VERDICT
    mode_cfg = get_guard_mode()
    if mode_cfg == "allow":
        return _ALLOWED_VERDICT
    sid = session_id if session_id is not None else get_current_session_id()
    if tool_name in STRUCTURED_TOOLS:
        raw = input_data.get("path")
        if not isinstance(raw, str) or not raw:
            return _ALLOWED_VERDICT
        return _structured_verdict(tool_name, raw, workdir, sid, mode_cfg)
    raw_cmd = input_data.get("command")
    if not isinstance(raw_cmd, str) or not raw_cmd:
        return _ALLOWED_VERDICT
    return _shell_verdict(tool_name, raw_cmd, workdir, sid, mode_cfg)


# ---- 确认交互（载荷构造与答案解析） ----

GRANT_LABEL = "允许（本会话）"
DENY_LABEL = "拒绝"


def make_guard_question(verdict: GuardVerdict) -> dict:
    """构造门禁确认的 questions 载荷（单问题）。

    ``guard: True`` 是防仿冒标志：模型自调 ask_user_question 的入参经
    validate_ask_questions 白名单清洗，永远带不上此字段——只有门禁代码
    直接构造的载荷才有。前端据此做视觉区分。
    """
    verb = "写入" if verdict.mode == "write" else "读取"
    scope = "写入（含读取）" if verdict.mode == "write" else "读取"
    dirs = "\n".join(str(t) for t in verdict.targets)
    return {
        "question": (
            f"安全确认：工具 {verdict.tool} 请求{verb}工作目录以外的路径：\n"
            f"{dirs}\n是否允许？"
        ),
        "header": "外部访问",
        "multiSelect": False,
        "options": [
            {
                "label": GRANT_LABEL,
                "description": f"本会话内允许{scope}上述目录及其子目录，会话结束自动失效",
            },
            {
                "label": DENY_LABEL,
                "description": "拦截本次访问，AI 将收到拒绝说明",
            },
        ],
        "guard": True,
    }


def parse_grant_response(response: dict) -> bool:
    """解析用户对门禁确认的应答。

    仅当首个答案的 selected 精确包含允许 label 才算授权——
    Other 自由文本一律不算（防歧义授权），未答/异常按拒绝。
    """
    answers = response.get("answers") if isinstance(response, dict) else None
    if not isinstance(answers, list) or not answers:
        return False
    first = answers[0]
    selected = first.get("selected") if isinstance(first, dict) else None
    return isinstance(selected, list) and GRANT_LABEL in selected


def denied_message(verdict: GuardVerdict, *, no_channel: bool = False) -> str:
    """拦截/拒绝时回填给模型的错误消息（Error: 前缀 → is_error=True）。"""
    verb = "写入" if verdict.mode == "write" else "读取"
    paths = "、".join(str(t) for t in verdict.targets) or "(unknown)"
    if verdict.reason:
        head = f"Error: 外部访问门禁（{verdict.reason}）："
    else:
        head = "Error: 外部访问门禁："
    if no_channel:
        return (
            f"{head}{verb}工作目录外的 {paths} 未获用户授权。"
            "当前执行上下文无用户交互渠道（子代理/后台），外部访问默认拦截；"
            "请把需要外部访问的步骤交回主代理在交互中征得用户确认，"
            "或改用工作目录内路径。"
        )
    return (
        f"{head}{verb}工作目录外的 {paths} 未获用户授权（用户已拒绝或确认超时）。"
        "请征得用户同意后重试，或改用工作目录内路径。"
    )


# ---- 结构化工具路径解析（basic.py 门禁模式注入用） ----


def resolve_guarded_path(
    raw: str, workdir: Path, write: bool
) -> Tuple[Optional[Path], Optional[str]]:
    """门禁启用时结构化工具的路径解析。

    Returns:
        (path, None) 放行（路径可能在工作目录外）；
        (None, error) 拦截（fail-closed 消息）。
    """
    p = _expand(raw)
    full = p if p.is_absolute() else workdir / p
    if not _outside(full, _norm_key(workdir)):
        return full, None
    mode_cfg = get_guard_mode()
    if mode_cfg == "allow":
        return full, None
    sid = get_current_session_id()
    rw = "write" if write else "read"
    tool = "write_file" if write else "read_file"
    # block 优先于会话授权（严格模式绝对拦截，与 classify_tool_call 一致）
    if mode_cfg == "block":
        return None, denied_message(
            GuardVerdict(
                ACTION_DENY, tool=tool, mode=rw, targets=(_grant_dir(full),),
                reason=f"配置 {GUARD_ENV}=block",
            ),
            no_channel=True,
        )
    if _ledger.is_granted(sid, full, rw):
        return full, None
    # 到达 handler 层即无交互渠道（管道层确认发生在调用 handler 之前），
    # confirm 与 deny 同途归拒绝——fail-closed
    return None, denied_message(
        GuardVerdict(
            ACTION_CONFIRM, tool=tool, mode=rw, targets=(_grant_dir(full),)
        ),
        no_channel=True,
    )


# ---- shell handler 的 fail-closed 包装（子代理/后台上下文覆盖用） ----


def wrap_shell_handler_fail_closed(handler, workdir: Path, tool_name: str = "bash"):
    """包装 shell 工具 handler：执行前门禁判定，未授权直接拒绝。

    主代理路径上，StreamingAgent 管道层已在调用前完成确认与记账，
    此处二次判定必然放行（幂等）；子代理/teammate 无管道确认，
    未授权即 fail-closed——防「派子代理绕过门禁」。
    """

    def _guarded(**kwargs):
        cmd = kwargs.get("command")
        if isinstance(cmd, str) and cmd:
            verdict = classify_tool_call(tool_name, {"command": cmd}, workdir)
            if not verdict.allowed:
                return denied_message(verdict, no_channel=True)
        return handler(**kwargs)

    return _guarded
