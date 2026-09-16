# -*- coding: utf-8 -*-
"""grep 工具：基于 ripgrep 的结构化文件内容搜索。

业务逻辑对齐 Claude Code GrepTool（ADR-0022）：

- 三种输出模式：content（匹配行）/ files_with_matches（文件清单，默认）
  / count（每文件计数）
- head_limit（默认 250，0 = 无上限逃生舱）+ offset 分页；截断状态显式回传
  （仅真发生截断时）——模型据此判断「可能还有更多结果」并用 offset 自主翻页
- files_with_matches 按文件 mtime 倒序（最近修改优先，隐性相关性启发式）；
  stat 失败按 mtime=0 排末尾，单个文件被删不拖垮整批
- 先截断后加工（content/count 模式）：路径化简等 per-line 成本不为被丢弃的
  行支付（宽 pattern 可能命中万级行而 limit 只留数百）
- 结果路径一律化简为搜索目标的相对形式（默认目标 = 工作目录），节省 token
- 50000 字符硬上限：本框架层不统一截断工具输出（streaming 层明确不截断），
  与 bash/powershell 工具的输出截断对齐
- rg exit code 语义：0/1 均成功（1 = 无匹配）；超时零结果 → 明确报错——
  区分「无匹配」与「没搜完」，防模型基于错误的空结果继续推理；
  超时但有部分输出 → 返回部分结果并丢弃最后一行（可能是半行）

安全（本项目特有，Claude Code 无对应物）：path 与 read_file 同一通路
（ADR-0021）——非门禁链路 safe_path 硬拒绝 workdir 外路径；gui_mode 由
注册处注入 resolve_guarded_path 走门禁三态处置，不引入逃逸通道。

注意：rg 定位逻辑在本模块内独立实现（shutil.which + 缓存），不 import
treesearch.ripgrep——模块红线：planify 与 treesearch 互不依赖。
"""

import logging
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .basic import safe_path

logger = logging.getLogger(__name__)

# rg 子进程超时（秒）。对齐 Claude Code 的 20s（其 WSL 60s 特例不移植）
RG_TIMEOUT_S = 20
# head_limit 未指定时的默认上限：250 对探索性搜索足够，又防宽 pattern
# 打爆上下文（无上限 content 搜索最坏可命中万级行）
DEFAULT_HEAD_LIMIT = 250
# 结果字符硬上限：与 bash/powershell 工具的输出截断一致
MAX_RESULT_CHARS = 50_000
# rg 单行长度上限：防 base64/minified 单行瞬间打爆结果预算
MAX_COLUMNS = 500

# 版本控制目录：搜索噪声大户，恒排除
VCS_DIRS_TO_EXCLUDE = (".git", ".svn", ".hg", ".bzr", ".jj", ".sl")

TOOL_NAME = "grep"

TOOL_DESCRIPTION = """基于 ripgrep 的文件内容搜索。

使用指引：
- 搜索文件内容一律优先用本工具，不要用 bash/powershell 调 grep/rg（本工具已处理好路径权限、超时与结果截断）
- pattern 支持完整正则（ripgrep 语法；字面花括号需转义，如 interface\\{\\}）
- output_mode："content" 显示匹配行（支持 -A/-B/-C/context 上下文行、-n 行号、head_limit/offset 分页）；"files_with_matches"（默认）只列文件路径；"count" 显示每文件匹配数
- 用 glob（如 "*.py"、"*.{ts,tsx}"，可空格/逗号分隔多个）或 type（如 py、js、rust）过滤文件
- 跨行 pattern（如 struct \\{[\\s\\S]*?field）需 multiline: true
- 结果被截断时（返回中带 limit 提示）可用 offset 翻页；head_limit=0 表示不限制（慎用，大结果集浪费上下文）
"""

# ==================== rg 定位（条件注册依据） ====================

_rg_path: Optional[str] = None
_rg_checked: bool = False


def rg_path() -> Optional[str]:
    """系统 rg 可执行文件路径；未安装返回 None。检测结果进程内缓存。"""
    global _rg_path, _rg_checked
    if not _rg_checked:
        _rg_path = shutil.which("rg")
        _rg_checked = True
    return _rg_path


def rg_available() -> bool:
    """rg 是否可用（registry 据此决定是否注册 grep 工具）。"""
    return rg_path() is not None


def reset_rg_cache() -> None:
    """重置 rg 检测缓存（仅测试用）。"""
    global _rg_path, _rg_checked
    _rg_path = None
    _rg_checked = False


# ==================== 输入纠偏（模型偶发把数字/布尔传成字符串） ====================


def coerce_int(value: Any) -> Optional[int]:
    """宽松的 int 纠偏："30" → 30；无法解析返回 None（按未传处理）。

    只接受合法的整数字面量（含字符串形态），其余原样判废——容忍模型的
    常见失误，但不掩盖真正的错误输入（对齐 semanticNumber 的哲学）。
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    if isinstance(value, str) and re.fullmatch(r"-?\d+", value.strip()):
        return int(value.strip())
    return None


def coerce_bool(value: Any, default: bool) -> bool:
    """宽松的 bool 纠偏："true"/"false" 字符串 → bool。"""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes")
    return bool(value)


# ==================== 参数构造（纯函数，可单测） ====================


def split_glob_patterns(glob: str) -> List[str]:
    """拆分 glob 参数为独立模式列表。

    先按空白拆分；含 {} 的片段不再按逗号拆（保护 *.{ts,tsx} 这类花括号
    展开模式），其余片段再按逗号拆。
    """
    patterns: List[str] = []
    for raw in glob.split():
        if "{" in raw and "}" in raw:
            patterns.append(raw)
        else:
            patterns.extend(p for p in raw.split(",") if p)
    return [p for p in patterns if p]


def build_rg_args(
    pattern: str,
    *,
    output_mode: str,
    context: Optional[int] = None,
    context_c: Optional[int] = None,
    context_before: Optional[int] = None,
    context_after: Optional[int] = None,
    show_line_numbers: bool = True,
    case_insensitive: bool = False,
    file_type: Optional[str] = None,
    glob: Optional[str] = None,
    multiline: bool = False,
) -> List[str]:
    """构建 rg 命令行参数（不含 rg 本体与目标路径）。

    上下文参数优先级：context > -C > (-B + -A)；仅 content 模式生效。
    pattern 以 - 开头时用 -e 传递，防 rg 误解析为命令行选项。
    """
    args = ["--hidden"]
    for d in VCS_DIRS_TO_EXCLUDE:
        args += ["--glob", f"!{d}"]
    args += ["--max-columns", str(MAX_COLUMNS)]

    if multiline:
        args += ["-U", "--multiline-dotall"]
    if case_insensitive:
        args.append("-i")

    if output_mode == "files_with_matches":
        args.append("-l")
    elif output_mode == "count":
        args.append("-c")

    if output_mode == "content":
        if show_line_numbers:
            args.append("-n")
        if context is not None:
            args += ["-C", str(context)]
        elif context_c is not None:
            args += ["-C", str(context_c)]
        else:
            if context_before is not None:
                args += ["-B", str(context_before)]
            if context_after is not None:
                args += ["-A", str(context_after)]

    if pattern.startswith("-"):
        args += ["-e", pattern]
    else:
        args.append(pattern)

    if file_type:
        args += ["--type", file_type]
    if glob:
        for p in split_glob_patterns(glob):
            args += ["--glob", p]
    return args


# ==================== 分页 ====================


def apply_head_limit(
    items: List[str], limit: Optional[int], offset: int = 0
) -> Tuple[List[str], Optional[int]]:
    """应用 offset/limit 分页（等价 `| tail -n +offset | head -limit`）。

    Returns:
        (切片结果, applied_limit)。limit=0 = 无上限逃生舱；applied_limit
        仅在真发生截断时非 None——未截断不回传，避免误导模型以为还有结果。
    """
    if offset < 0:
        offset = 0
    if limit == 0:
        return items[offset:], None
    effective = DEFAULT_HEAD_LIMIT if limit is None else limit
    sliced = items[offset : offset + effective]
    truncated = len(items) - offset > effective
    return sliced, (effective if truncated else None)


def _pagination_note(applied_limit: Optional[int], offset: int) -> str:
    """分页附注；无分页信息返回空串。"""
    parts = []
    if applied_limit is not None:
        parts.append(f"limit={applied_limit}，结果已截断，可用 offset 继续翻页")
    if offset > 0:
        parts.append(f"offset={offset}")
    return ", ".join(parts)


# ==================== rg 子进程 ====================


@dataclass(frozen=True)
class RgRunResult:
    """rg 子进程结果。error 非 None 时 lines 无意义。"""

    lines: Tuple[str, ...]
    error: Optional[str] = None
    # 超时但有部分结果（已丢弃可能不完整的最后一行），调用方应附加提示
    timed_out: bool = False


def _decode_lines(raw: bytes) -> List[str]:
    return [
        line.rstrip("\r")
        for line in raw.decode("utf-8", errors="replace").split("\n")
        if line != ""
    ]


def execute_rg(args: List[str], target: Path) -> RgRunResult:
    """执行 rg 子进程并归一化 exit code / 超时语义。

    - exit 0/1 → 成功（1 = 无匹配，空结果）
    - 超时零结果 → error（区分「没搜完」与「无匹配」）
    - 超时有部分结果 → 返回部分结果，丢弃最后一行（可能是半行）
    - exit 2 等 → error（附 stderr 摘要）
    """
    exe = rg_path()
    if exe is None:
        return RgRunResult(
            (),
            error="Error: 未找到 rg（ripgrep）。请安装 ripgrep 后重试，或改用 bash 的 grep。",
        )
    cmd = [exe, *args, str(target)]
    logger.debug("[grep] Executing: %s", cmd)
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=RG_TIMEOUT_S)
    except subprocess.TimeoutExpired as e:
        partial = _decode_lines(e.stdout or b"")
        if len(partial) > 1:
            # 最后一行可能是半行（进程在写途中被杀），丢弃
            return RgRunResult(tuple(partial[:-1]), timed_out=True)
        return RgRunResult(
            (),
            error=(
                f"Error: 搜索超时（{RG_TIMEOUT_S}s）。搜索可能命中了文件但未在时限内"
                "完成——请缩小 path 范围或改用更具体的 pattern 重试。"
            ),
        )
    except OSError as e:
        return RgRunResult((), error=f"Error: rg 执行失败: {e}")

    if r.returncode in (0, 1):
        return RgRunResult(tuple(_decode_lines(r.stdout)))
    stderr = (r.stderr or b"").decode("utf-8", errors="replace").strip()
    return RgRunResult((), error=f"Error: rg 退出码 {r.returncode}: {stderr[:500]}")


# ==================== 路径安全与化简 ====================


def resolve_search_path(
    path: Optional[str], workdir: Path, resolve, require_dir: bool = False
) -> Tuple[Optional[Path], Optional[str]]:
    """搜索目标路径解析（与 read_file 同一安全通路，ADR-0021）。

    grep/glob 工具共用的公共入口。

    Args:
        path: 工具入参路径；None/空串 → workdir 本身
        workdir: 工作目录（路径安全边界）
        resolve: 门禁解析函数（guard.resolve_guarded_path）；None = safe_path
            硬拒绝逃逸
        require_dir: True 时要求目标为已存在的目录（glob 工具）

    Returns:
        (Path, None) 放行；(None, error_msg) 拒绝
    """
    if not path:
        return workdir, None
    if resolve is not None:
        resolved, err = resolve(path, workdir, False)
        if err is not None:
            return None, err
    else:
        try:
            resolved = safe_path(path, workdir)
        except Exception as e:
            return None, f"Error: {e}"
    if not resolved.exists():
        return None, f"Error: 路径不存在: {path}"
    if require_dir and not resolved.is_dir():
        return None, f"Error: 路径不是目录: {path}"
    return resolved, None


def _strip_target_prefix(raw: str, target: Path) -> str:
    """rg 输出路径化简为 target 相对形式（rg 按传入的 target 原样拼前缀输出）。

    目录搜索 '<target>/a/f.txt…' → 'a/f.txt…'；
    单文件搜索 content/count 行 '<target>:12:…' → '12:…'；
    单文件搜索 files 模式行恰为 target 本身 → 文件名。
    未命中前缀原样返回（防御：不假设 rg 输出形态）。
    """
    base = str(target)
    if raw.startswith(base + os.sep):
        return raw[len(base) + 1 :]
    if raw.startswith(base + ":"):
        return raw[len(base) + 1 :]
    if raw == base:
        return os.path.basename(raw)
    return raw


def _sort_files_by_mtime(lines: List[str]) -> List[str]:
    """按 mtime 倒序（最近修改优先——隐性相关性启发式）。

    rg 扫描与 stat 之间文件可能已被删除：stat 失败按 mtime=0 排末尾，
    不拖垮整批。mtime 相同按路径字典序，保证排序稳定可测。
    """

    def _mtime(p: str) -> float:
        try:
            return os.stat(p).st_mtime
        except OSError:
            return 0.0

    return sorted(lines, key=lambda p: (-_mtime(p), p))


# ==================== 三种输出模式的格式化 ====================


def _format_content_mode(
    lines: List[str], target: Path, limit: Optional[int], offset: int
) -> str:
    if not lines:
        return "未找到匹配内容"
    # 先截断后加工：路径化简是 per-line 成本，不为被丢弃的行支付
    kept, applied = apply_head_limit(lines, limit, offset)
    body = "\n".join(_strip_target_prefix(line, target) for line in kept)
    note = _pagination_note(applied, offset)
    if note:
        body += f"\n\n[分页: {note}]"
    return body


def _format_count_mode(
    lines: List[str], target: Path, limit: Optional[int], offset: int
) -> str:
    if not lines:
        return "未找到匹配"
    kept, applied = apply_head_limit(lines, limit, offset)
    display = [_strip_target_prefix(line, target) for line in kept]
    total_matches = 0
    file_count = 0
    for line in display:
        _, sep, count_part = line.rpartition(":")
        if sep and count_part.isdigit():
            total_matches += int(count_part)
            file_count += 1
    summary = f"\n\n共 {total_matches} 处匹配，分布在 {file_count} 个文件"
    note = _pagination_note(applied, offset)
    if note:
        summary += f"（{note}）"
    return "\n".join(display) + summary


def _format_files_mode(
    lines: List[str], target: Path, limit: Optional[int], offset: int
) -> str:
    if not lines:
        return "未找到匹配文件"
    sorted_files = _sort_files_by_mtime(lines)
    kept, applied = apply_head_limit(sorted_files, limit, offset)
    display = [_strip_target_prefix(p, target) for p in kept]
    header = f"共 {len(display)} 个文件匹配"
    note = _pagination_note(applied, offset)
    if note:
        header += f"（{note}）"
    return header + "\n" + "\n".join(display)


def cap_result(text: str) -> str:
    """50000 字符硬上限（框架层不统一截断工具输出，工具须自我兜底）。

    grep/glob 工具共用。
    """
    if len(text) <= MAX_RESULT_CHARS:
        return text
    return (
        text[:MAX_RESULT_CHARS]
        + f"\n\n[输出已截断（{MAX_RESULT_CHARS} 字符上限）。请缩小 path 范围、"
        "改用更具体的 pattern，或用 head_limit/offset 分页]"
    )


# ==================== 工具主入口 ====================


def run_grep(
    pattern: str,
    workdir,
    *,
    path: Optional[str] = None,
    glob: Optional[str] = None,
    output_mode: str = "files_with_matches",
    context: Any = None,
    context_c: Any = None,
    context_before: Any = None,
    context_after: Any = None,
    show_line_numbers: Any = True,
    case_insensitive: Any = False,
    file_type: Optional[str] = None,
    head_limit: Any = None,
    offset: Any = 0,
    multiline: Any = False,
    resolve=None,
) -> str:
    """grep 工具主入口。

    Args:
        pattern: 正则表达式（ripgrep 语法）
        workdir: 工作目录（path 未传时的搜索目标，也是路径安全边界）
        path: 搜索的文件或目录（可选；默认工作目录）
        glob: 文件过滤 glob（rg --glob）
        output_mode: content / files_with_matches / count
        context / context_c / context_before / context_after: 上下文行数
            （对应 -C/-C/-B/-A；优先级 context > -C > -B/-A，仅 content 模式）
        show_line_numbers: content 模式显示行号（-n，默认 True）
        case_insensitive: 忽略大小写（-i）
        file_type: 文件类型过滤（rg --type，如 py、js、rust）
        head_limit: 结果条数上限（默认 250；0 = 不限制，慎用）
        offset: 跳过的条数（分页用，默认 0）
        multiline: 多行模式（rg -U --multiline-dotall）
        resolve: 门禁路径解析函数（guard.resolve_guarded_path）；
            None = safe_path 硬拒绝逃逸（默认，非门禁链路）

    Returns:
        格式化的结果文本或错误信息
    """
    workdir = Path(workdir)
    if not pattern or not isinstance(pattern, str):
        return "Error: pattern 不能为空"
    if output_mode not in ("content", "files_with_matches", "count"):
        return (
            f"Error: 未知 output_mode: {output_mode}"
            "（可选 content / files_with_matches / count）"
        )

    target, err = resolve_search_path(path, workdir, resolve)
    if err is not None:
        return err

    args = build_rg_args(
        pattern,
        output_mode=output_mode,
        context=coerce_int(context),
        context_c=coerce_int(context_c),
        context_before=coerce_int(context_before),
        context_after=coerce_int(context_after),
        show_line_numbers=coerce_bool(show_line_numbers, True),
        case_insensitive=coerce_bool(case_insensitive, False),
        file_type=file_type,
        glob=glob,
        multiline=coerce_bool(multiline, False),
    )
    result = execute_rg(args, target)
    if result.error is not None:
        return result.error

    limit = coerce_int(head_limit)
    off = coerce_int(offset) or 0
    lines = list(result.lines)

    if output_mode == "content":
        text = _format_content_mode(lines, target, limit, off)
    elif output_mode == "count":
        text = _format_count_mode(lines, target, limit, off)
    else:
        text = _format_files_mode(lines, target, limit, off)

    if result.timed_out:
        text += "\n\n（注意：搜索超时，以上为超时前的部分结果，可能不完整）"
    return cap_result(text)


# ==================== 工具定义与处理器装配 ====================


def make_grep_tools(workdir, guard_enabled: bool = False):
    """创建 grep 工具定义与处理器。

    Args:
        workdir: 工作目录
        guard_enabled: 是否启用外部访问门禁（ADR-0021）——True 时 path
            逃逸走门禁三态处置；False 走 safe_path 硬拒绝（TUI/CLI 默认）

    Returns:
        (工具定义列表, 处理器字典)
    """
    resolve = None
    if guard_enabled:
        from .guard import resolve_guarded_path

        resolve = resolve_guarded_path

    tools: List[Dict] = [
        {
            "name": TOOL_NAME,
            "description": TOOL_DESCRIPTION,
            "input_schema": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "搜索的正则表达式（ripgrep 语法）",
                    },
                    "path": {
                        "type": "string",
                        "description": "搜索的文件或目录（rg PATH）。默认为工作目录；仅限工作目录内",
                    },
                    "glob": {
                        "type": "string",
                        "description": '文件过滤 glob（如 "*.js"、"*.{ts,tsx}"），可空格/逗号分隔多个——映射 rg --glob',
                    },
                    "output_mode": {
                        "type": "string",
                        "enum": ["content", "files_with_matches", "count"],
                        "description": '输出模式："content" 显示匹配行（支持 -A/-B/-C/context、-n、head_limit/offset）；"files_with_matches"（默认）只列文件路径；"count" 显示每文件匹配数',
                    },
                    "-B": {
                        "type": "integer",
                        "description": "每个匹配行前显示的行数（rg -B）。仅 content 模式生效",
                    },
                    "-A": {
                        "type": "integer",
                        "description": "每个匹配行后显示的行数（rg -A）。仅 content 模式生效",
                    },
                    "-C": {
                        "type": "integer",
                        "description": "context 的别名",
                    },
                    "context": {
                        "type": "integer",
                        "description": "每个匹配行前后各显示的行数（rg -C）。仅 content 模式生效",
                    },
                    "-n": {
                        "type": "boolean",
                        "description": "显示行号（rg -n）。仅 content 模式生效，默认 true",
                    },
                    "-i": {
                        "type": "boolean",
                        "description": "忽略大小写（rg -i）",
                    },
                    "type": {
                        "type": "string",
                        "description": "文件类型过滤（rg --type）。常用：py、js、rust、go、java",
                    },
                    "head_limit": {
                        "type": "integer",
                        "description": "结果条数上限（content=行数，files_with_matches=文件数，count=条目数）。默认 250；传 0 表示不限制（慎用，大结果集浪费上下文）",
                    },
                    "offset": {
                        "type": "integer",
                        "description": "跳过前 N 条再应用 head_limit（分页用）。默认 0",
                    },
                    "multiline": {
                        "type": "boolean",
                        "description": "多行模式：. 可匹配换行、pattern 可跨行（rg -U --multiline-dotall）。默认 false",
                    },
                },
                "required": ["pattern"],
            },
        }
    ]

    handlers: Dict[str, Any] = {
        TOOL_NAME: lambda **kw: run_grep(
            kw["pattern"],
            workdir,
            path=kw.get("path"),
            glob=kw.get("glob"),
            output_mode=kw.get("output_mode") or "files_with_matches",
            context=kw.get("context"),
            context_c=kw.get("-C"),
            context_before=kw.get("-B"),
            context_after=kw.get("-A"),
            show_line_numbers=kw.get("-n", True),
            case_insensitive=kw.get("-i", False),
            file_type=kw.get("type"),
            head_limit=kw.get("head_limit"),
            offset=kw.get("offset", 0),
            multiline=kw.get("multiline", False),
            resolve=resolve,
        )
    }
    return tools, handlers
