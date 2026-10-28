"""终止进程类命令的自伤守卫（planify 中性组件，宿主无关）

动机（2026-10-28 事故复盘）：agent 在清理「疑似残留实例」时执行
``Stop-Process -Id <pid> -Force``，而该 PID 恰是承载本次对话的宿主
进程自己——工具代码就运行在那个进程里，命令成功 = 对话后端即刻消失，
日志戛然而止、无任何崩溃留证（区别于原生崩溃）。agent 无法从命令文本
判断目标是谁；守卫在进程内比对即可精确判定。

三层身份判定（杀掉即「自伤/连坐」的集合）：

1. 自身：``os.getpid()``——工具执行就在宿主进程内，天然权威。
2. 父链：杀掉会连坐宿主的进程（启动脚本 shell、终端、桌面），
   psutil 沿 parent 链上溯收集。
3. 同名：无 PID 的按名杀伤（``taskkill /IM python.exe``、
   ``Stop-Process -Name python``）——比对身份链可执行名
   （含去 .exe 变体；pkill -f 按命令行杀，无法静态核对，一律保守拒）。

拦截策略（fail-safe：宁可多拦一次让模型改写，不放行自伤）：

- 显式 PID → 与 {自身 ∪ 祖先} 求交，命中即拒；无交集放行
  （清理无关残留实例是正常操作，不受影响）。
- 显式名称 → 命中身份链名即拒；否则放行（taskkill /IM notepad.exe）。
- 动态投喂（``Get-Process x | Stop-Process``、``kill $(...)``、
  ``kill $PID``、``Stop-Process -InputObject``、含正则元的 pkill 模式）
  → 拒绝并要求改写为显式 PID/名称——等价于无差别杀伤。
- 非终止语义 → 放行（零开销路径）。裸词 kill 不算语义
  （防 ``git commit -m "kill bug"`` 类误伤），必须跟 PID/名称/动态形。

拦截以错误文案经工具错误通道返回（不抛异常），文案说明身份与改法。
"""

import logging
import os
import re
import sys
import threading
from typing import Optional

logger = logging.getLogger(__name__)

try:  # psutil 是 planify 依赖（pyproject 已声明），守卫不因它缺席而崩
    import psutil
except ImportError:  # pragma: no cover
    psutil = None


# ---- 语义识别：命令是否含「终止进程」动作 ----

_RE_STOP_PROCESS = re.compile(r"\bStop-Process\b", re.IGNORECASE)
_RE_TASKKILL = re.compile(r"\btaskkill\b", re.IGNORECASE)
_RE_GITBASH_TASK = re.compile(r"(?<![.\w-])task(?![.\w-])\s+//", re.IGNORECASE)
# kill [-flags] <digits>（Unix kill / PowerShell kill 别名；裸词不算语义）
_RE_KILL_PIDS = re.compile(
    r"(?<![.\w-])kill(?![.\w-])(?:\s+-{1,2}[\w-]+)*(?:\s+\d+)+",
    re.IGNORECASE,
)
# kill -Name x（PowerShell kill 别名的按名形）
_RE_KILL_NAME = re.compile(
    r"(?<![.\w-])kill(?![.\w-])\s+-Name\s+[\w.-]+", re.IGNORECASE
)
_RE_PKO = re.compile(r"\b(?:pkill|killall)\b", re.IGNORECASE)
# kill $(...) / kill `...`（命令替换投喂——裸词 + $ ` 即终止语义，先于
# 上面的「裸词不算语义」规则生效；防绕过：kill 词形 + 替换 = 必杀意图）
_RE_KILL_SUBST = re.compile(r"(?<![.\w-])kill(?![.\w-])\s+[`$]", re.IGNORECASE)

_SEMANTIC_PATTERNS = (
    _RE_STOP_PROCESS,
    _RE_TASKKILL,
    _RE_GITBASH_TASK,
    _RE_KILL_PIDS,
    _RE_KILL_NAME,
    _RE_PKO,
    _RE_KILL_SUBST,
)


def _has_kill_semantics(command: str) -> bool:
    """命令是否含终止进程动作（不含则守卫直接放行，零后续开销）。"""
    return any(p.search(command) for p in _SEMANTIC_PATTERNS)


# ---- 目标提取 ----

# Stop-Process -Id 123[,456]；taskkill /PID 123；Git Bash //PID 123
_RE_ID_FLAG = re.compile(r"(?:-Id\s+|/+PID\s+)(\d[\d,\s]*\d|\d)", re.IGNORECASE)
# Stop-Process -Name python；taskkill /IM python.exe；kill -Name python
_RE_NAME_FLAG = re.compile(r"(?:-Name\s+|/+IM\s+|kill\s+-Name\s+)([\w.-]+)", re.IGNORECASE)
# kill [-flags] pids（复用语义正则，取数字组）
_RE_KILL_PIDS_NUMS = re.compile(
    r"(?<![.\w-])kill(?![.\w-])(?:\s+-{1,2}[\w-]+)*((?:\s+\d+)+)",
    re.IGNORECASE,
)
# pkill/killall 的模式词（最后一个非 flag 词）
_RE_PKO_PATTERN = re.compile(
    r"\b(?:pkill|killall)\b(?:\s+-{1,2}[\w-]+)*\s+([^\s|;&]+)",
    re.IGNORECASE,
)
# 动态投喂：管道 Stop-Process / kill $( / kill ` / kill $VAR / -InputObject
_RE_DYNAMIC_TARGET = re.compile(
    r"\|\s*Stop-Process"
    r"|(?<![.\w-])kill(?![.\w-])\s+[`$]"
    r"|-InputObject\b"
    r"|\bpkill\s+-f\b",
    re.IGNORECASE,
)


def _extract_pids(command: str) -> set:
    """提取全部显式 PID 目标。"""
    pids = set()
    for m in _RE_ID_FLAG.finditer(command):
        for part in re.split(r"[,\s]+", m.group(1).strip()):
            if part.isdigit():
                pids.add(int(part))
    m = _RE_KILL_PIDS_NUMS.search(command)
    if m:
        for part in m.group(1).split():
            if part.isdigit():
                pids.add(int(part))
    return pids


def _extract_names(command: str) -> set:
    """提取全部显式名称目标（-Name / /IM / kill -Name，小写）。"""
    return {m.group(1).lower() for m in _RE_NAME_FLAG.finditer(command)}


def _extract_pko_patterns(command: str) -> set:
    """提取 pkill/killall 的模式词（去引号，小写）。"""
    pats = set()
    for m in _RE_PKO_PATTERN.finditer(command):
        tok = m.group(1).strip("'\"").lower()
        if tok:
            pats.add(tok)
    return pats


# ---- 身份链（自身 + 祖先），进程内缓存 ----
# 祖先链在进程生命周期内基本不变，psutil 上溯是系统调用，缓存一次。
# 代价：祖先退出后其 PID 留在缓存里，Windows PID 复用可能误拦个别
# 无关命令——fail-safe 方向（拦错给文案可改写，放行错 = 宿主消失）。

_lock = threading.Lock()
_pid_cache: Optional[set] = None
_name_cache: Optional[set] = None


def _ancestor_pids() -> set:
    """当前进程全部祖先 PID（psutil 缺席/异常时为空集，退化为只守自身）。"""
    pids = set()
    if psutil is None:
        return pids
    try:
        for parent in psutil.Process().parents():
            pids.add(parent.pid)
    except Exception:  # noqa: BLE001 - 身份获取失败不让守卫崩
        logger.debug("[process_guard] parents() 失败", exc_info=True)
    return pids


def _identity_pids() -> set:
    """{自身} ∪ 祖先 PID（杀掉即自伤/连坐的集合）。"""
    global _pid_cache
    with _lock:
        if _pid_cache is None:
            _pid_cache = {os.getpid()} | _ancestor_pids()
        return _pid_cache


def sys_executable() -> str:
    """当前解释器路径（独立函数便于宿主/测试替换身份）。"""
    return sys.executable


def _collect_identity_names() -> set:
    """身份链全部可执行名（小写，含去 .exe 变体）。"""
    names = set()

    def _add(exe: str) -> None:
        if not exe:
            return
        low = os.path.basename(str(exe)).lower()
        names.add(low)
        if low.endswith(".exe"):
            names.add(low[:-4])

    _add(sys_executable())
    if psutil is not None:
        try:
            procs = [psutil.Process(), *psutil.Process().parents()]
        except Exception:  # noqa: BLE001
            procs = []
        for proc in procs:
            try:
                _add(proc.exe())
            except Exception:  # noqa: BLE001
                pass
    return names


def _identity_names() -> set:
    global _name_cache
    with _lock:
        if _name_cache is None:
            _name_cache = _collect_identity_names()
        return _name_cache


# ---- 拒绝文案（说明身份 + 给出改道方向，模型可自行改写） ----

_MSG_SELF = (
    "Error: 拒绝执行——命令目标是当前进程自身（PID {pid}，"
    "即承载本次工具调用的进程，终止它会立即使对话后端消失）。"
    "如需重启服务请走标准重启协议；如要清理其他实例，先用端口属主/"
    "dev 标志/workdir 核对目标身份，确认非当前进程（PID {pid}）及其"
    "父链后再操作。"
)
_MSG_ANCESTOR = (
    "Error: 拒绝执行——命令目标 PID {pid} 是当前进程的祖先（父链成员），"
    "终止它会连坐当前进程（对话后端随之消失）。"
    "如确需终止，请确认当前对话不依赖它，或由用户手动操作。"
)
_MSG_NAME = (
    "Error: 拒绝执行——命令按名称终止进程「{name}」，命中当前进程"
    "（或其父链）的可执行名，会杀死承载本次工具调用的进程（PID {pid}）。"
    "请改写为显式 PID 形式，先核对目标身份（排除 PID {pid} 及其父链）。"
)
_MSG_DYNAMIC = (
    "Error: 拒绝执行——命令以管道/命令替换/变量方式向终止命令投喂目标"
    "（或按命令行模式杀），无法静态核对目标是否含当前进程（PID {pid}）"
    "或其父链，等价于无差别杀伤。请改写为显式 PID/名称形式并先核对身份。"
)


def check_kill_command(command: str) -> Optional[str]:
    """终止进程类命令的自伤守卫（bash/powershell/background_run 共用前置）。

    Returns:
        None  = 放行（无终止语义，或显式目标与身份链无交集）；
        str   = 拒绝文案（经工具错误通道返回给模型，不抛异常）。
    """
    if not command or not _has_kill_semantics(command):
        return None

    # 动态投喂优先判：无法提出可核对目标，保守拒绝
    if _RE_DYNAMIC_TARGET.search(command):
        logger.warning("[process_guard] 拦截动态目标终止命令: %s", command[:200])
        return _MSG_DYNAMIC.format(pid=os.getpid())

    pids = _extract_pids(command)
    if pids:
        me = os.getpid()
        if me in pids:
            logger.warning("[process_guard] 拦截自杀命令: %s", command[:200])
            return _MSG_SELF.format(pid=me)
        ancestors = pids & (_identity_pids() - {me})
        if ancestors:
            logger.warning(
                "[process_guard] 拦截杀父链命令 (PID %s): %s",
                sorted(ancestors), command[:200],
            )
            return _MSG_ANCESTOR.format(pid=sorted(ancestors)[0])
        return None  # 显式 PID 且无交集 → 正常清理操作，放行

    names = _extract_names(command)
    if names:
        hit = names & _identity_names()
        if hit:
            logger.warning("[process_guard] 拦截按名自杀命令: %s", command[:200])
            return _MSG_NAME.format(name=sorted(hit)[0], pid=os.getpid())
        return None  # 显式名称且不命中身份链（notepad 等）→ 放行

    # pkill/killall 模式词：无正则元且与身份名无交集才放行
    pats = _extract_pko_patterns(command)
    if pats:
        id_names = _identity_names()
        for pat in pats:
            if not re.fullmatch(r"[\w.-]+", pat):  # 含正则元/引号残片 → 无法核对
                logger.warning(
                    "[process_guard] 拦截模式终止命令: %s", command[:200]
                )
                return _MSG_DYNAMIC.format(pid=os.getpid())
        hit = pats & id_names
        if hit:
            logger.warning("[process_guard] 拦截按名自杀命令: %s", command[:200])
            return _MSG_NAME.format(name=sorted(hit)[0], pid=os.getpid())
        return None

    # 有语义但无任何可核对目标（如 Stop-Process 无参读管道的变体）→ 保守拒
    logger.warning("[process_guard] 拦截无目标终止命令: %s", command[:200])
    return _MSG_DYNAMIC.format(pid=os.getpid())
