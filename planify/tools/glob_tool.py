# -*- coding: utf-8 -*-
"""glob 工具：基于 rg --files 的文件名模式匹配。

业务逻辑对齐 Claude Code GlobTool（ADR-0023），三处有意偏离：

- 排序 newest-first（--sortr=modified）：CC 用 --sort=modified，实测为
  oldest-first，叠加 limit=100 截断后展示的恰是最旧（最不相关）的文件，
  此处修正为与 grep 工具一致的「最新修改优先」
- 补 VCS 目录排除（!.git 等六个）：CC 的 GlobTool 未排除（GrepTool 有），
  --no-ignore --hidden 下宽 pattern 会被 .git 内部对象文件污染
- 绝对路径 pattern 拆出的 baseDir 过门禁（safe_path / ADR-0021 三态）：
  CC 的权限校验只看 path 参数，绝对 pattern 的 baseDir 不过检查，照搬会
  在本项目形成 workdir 逃逸旁路

另有一处精简：CC 为 --no-ignore/--hidden 留了两个 env 开关，但实测 rg 的
whitelist --glob（本工具恒传）会覆盖 gitignore 与 hidden 过滤——被排除的
文件只要匹配 glob 就会被「复活」，开关无观测效果，故不移植（恒定开启）。

rg 执行与路径安全复用 grep 工具的公共入口（execute_rg /
resolve_search_path / cap_result）。
"""

import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .grep import (
    VCS_DIRS_TO_EXCLUDE,
    cap_result,
    execute_rg,
    resolve_search_path,
)

logger = logging.getLogger(__name__)

# 结果条数上限（对齐 CC globLimits.maxResults 默认值）。不向模型暴露分页
# 参数——文件查找场景 100 条足够，截断时以提示行引导缩小 pattern/path
MAX_RESULTS = 100

TOOL_NAME = "glob"

TOOL_DESCRIPTION = """快速的文件名模式匹配工具，适用于任意规模的代码库。

- 支持 glob 模式，如 "**/*.js"、"src/**/*.ts"
- 返回按修改时间排序的匹配文件路径（最新修改在前）
- 需要按文件名查找文件时使用本工具
- 如果是要做多轮 glob + grep 组合的开放式搜索，改用 task 工具（Explore 子代理）
"""

_GLOB_CHARS = re.compile(r"[*?[{]")
_DRIVE_ROOT = re.compile(r"^[A-Za-z]:$")


def extract_glob_base_directory(pattern: str) -> Tuple[str, str]:
    """提取 glob pattern 的静态基目录与相对模式。

    rg 的 --glob 只接受相对模式；绝对 pattern 需拆成（搜索目录, 相对模式）。
    基目录 = 第一个 glob 特殊字符（* ? [ {）之前静态前缀中的目录部分；
    无 glob 字符时是字面路径，拆为（目录, 文件名）。
    """
    m = _GLOB_CHARS.search(pattern)
    if not m:
        return os.path.dirname(pattern), os.path.basename(pattern)

    static_prefix = pattern[: m.start()]
    last_sep = max(static_prefix.rfind("/"), static_prefix.rfind(os.sep))
    if last_sep == -1:
        # glob 字符前无路径分隔符：pattern 相对搜索目录
        return "", pattern

    base_dir = static_prefix[:last_sep]
    relative_pattern = pattern[last_sep + 1 :]
    if not base_dir and last_sep == 0:
        # 根目录模式（/*.txt）：基目录为根
        base_dir = os.sep
    elif os.name == "nt" and _DRIVE_ROOT.match(base_dir):
        # Windows 盘符根（C:/*.txt）：'C:' 意为「C 盘当前目录」（相对），
        # 补分隔符才是盘符根
        base_dir += os.sep
    return base_dir, relative_pattern


def build_glob_args(search_pattern: str) -> List[str]:
    """构建 rg --files 命令行参数（不含 rg 本体与目标路径）。

    --sortr=modified：最新修改优先（对 CC oldest-first 的修正）。
    --no-ignore / --hidden 恒定开启：文件查找场景要「找得到」，被
    .gitignore 排除或隐藏的文件也应可找到。VCS 目录恒排除（! 否定 glob
    不受 whitelist 覆盖影响）。
    """
    args = [
        "--files",
        "--glob",
        search_pattern,
        "--sortr=modified",
        "--no-ignore",
        "--hidden",
    ]
    for d in VCS_DIRS_TO_EXCLUDE:
        args += ["--glob", f"!{d}"]
    return args


def _display_path(raw: str, workdir: Path) -> str:
    """rg 输出的绝对路径转 workdir 相对显示（失败保持原样，如跨盘符）。"""
    try:
        return os.path.relpath(raw, workdir)
    except ValueError:
        return raw


def run_glob(
    pattern: str,
    workdir,
    *,
    path: Optional[str] = None,
    resolve=None,
) -> str:
    """glob 工具主入口。

    Args:
        pattern: glob 模式（如 "**/*.js"）；绝对路径 pattern 会拆出静态
            基目录作为搜索根（rg --glob 只认相对模式），基目录过门禁
        workdir: 工作目录（path 未传时的搜索目录，也是路径安全边界）
        path: 搜索目录（可选；默认工作目录；须为已存在的目录）
        resolve: 门禁路径解析函数（guard.resolve_guarded_path）；
            None = safe_path 硬拒绝逃逸（默认，非门禁链路）

    Returns:
        匹配文件清单（workdir 相对路径，最新修改在前）或错误信息
    """
    workdir = Path(workdir)
    if not pattern or not isinstance(pattern, str):
        return "Error: pattern 不能为空"

    # 绝对路径 pattern：拆出静态基目录作为搜索目录。绝对 pattern 优先于
    # path 参数（对齐 CC）；baseDir 过与 path 相同的门禁通路
    search_pattern = pattern
    search_input = path
    if os.path.isabs(pattern):
        base_dir, search_pattern = extract_glob_base_directory(pattern)
        if base_dir:
            search_input = base_dir

    target, err = resolve_search_path(
        search_input, workdir, resolve, require_dir=True
    )
    if err is not None:
        return err

    result = execute_rg(build_glob_args(search_pattern), target)
    if result.error is not None:
        return result.error

    lines = list(result.lines)
    if not lines:
        return "未找到匹配文件"

    truncated = len(lines) > MAX_RESULTS
    kept = lines[:MAX_RESULTS]
    out = "\n".join(_display_path(p, workdir) for p in kept)
    if truncated:
        out += (
            f"\n\n（结果已截断：仅显示前 {MAX_RESULTS} 个，共匹配 {len(lines)} 个。"
            "请用更具体的 path 或 pattern）"
        )
    if result.timed_out:
        out += "\n\n（注意：搜索超时，以上为超时前的部分结果，可能不完整）"
    return cap_result(out)


def make_glob_tools(workdir, guard_enabled: bool = False):
    """创建 glob 工具定义与处理器。

    Args:
        workdir: 工作目录
        guard_enabled: 是否启用外部访问门禁（ADR-0021）——True 时 path 及
            绝对 pattern 的基目录走门禁三态处置；False 走 safe_path 硬拒绝

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
                        "description": '匹配文件名的 glob 模式（如 "**/*.js"、"src/**/*.ts"）',
                    },
                    "path": {
                        "type": "string",
                        "description": "搜索的目录。不指定默认工作目录；传入时必须为已存在的目录，且默认仅限工作目录内",
                    },
                },
                "required": ["pattern"],
            },
        }
    ]

    handlers: Dict[str, Any] = {
        TOOL_NAME: lambda **kw: run_glob(
            kw["pattern"], workdir, path=kw.get("path"), resolve=resolve
        )
    }
    return tools, handlers
