"""架构守护测试——模块依赖方向与封装边界的机械化红线。

规则来源：CLAUDE.md「模块边界规则」+ docs/ARCHITECTURE-module-boundary-review.md。
分层：doclens（业务宿主）→ planify（AI 框架）/ treesearch（索引引擎）；
planify 与 treesearch 互不依赖；底层永不 import 高层。

历史教训（全部真实发生过，本测试防复发）：
- treesearch/cli.py 曾 import planify.core.logging_config（底层依赖 AI 框架，
  导致 treesearch 无法独立发布）；
- doclens 曾 from treesearch.indexer import _file_hash 等私有成员（5 处）；
- vision_worker 曾 from doclens.diary_worker import _vision_openai（跨 worker
  私有引用）；api/diary.py 曾 import _CAPTION_PROMPT（跨层私有引用）。
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# 底层包 → 禁止 import 的高层模块根名
FORBIDDEN_ROOTS = {
    "treesearch": {"doclens", "planify"},
    "planify": {"doclens", "treesearch"},
}

# from <pkg>.<...> import a, b as c, (d)  —— 捕获 import 列表（含括号换行）
_FROM_IMPORT_RE = re.compile(
    r"^\s*from\s+(?P<mod>[\w.]+)\s+import\s+(?P<names>.+?)(?=\n\S|\n*$)",
    re.M | re.S,
)
_BARE_IMPORT_RE = re.compile(r"^\s*import\s+([\w.]+)", re.M)


def _py_sources(pkg: str) -> list[Path]:
    """包下全部 .py（排除 __pycache__；测试文件本身不扫描源码包）。"""
    root = REPO / pkg
    return [p for p in root.rglob("*.py") if "__pycache__" not in p.parts]


def test_no_upward_imports():
    """红线 1：底层模块不得 import 高层模块（doclens 永远在依赖箭头终点）。"""
    violations: list[str] = []
    for pkg, forbidden in FORBIDDEN_ROOTS.items():
        for py in _py_sources(pkg):
            src = py.read_text(encoding="utf-8", errors="replace")
            mods = [m.group(1) for m in _BARE_IMPORT_RE.finditer(src)]
            mods += [m.group("mod") for m in _FROM_IMPORT_RE.finditer(src)]
            for mod in mods:
                if mod.split(".")[0] in forbidden:
                    rel = py.relative_to(REPO).as_posix()
                    violations.append(f"{rel}: import {mod}（{pkg} 禁止依赖该模块）")
    assert not violations, "底层依赖高层：\n" + "\n".join(violations)


def test_no_cross_module_private_imports():
    """红线 2：doclens 不得引用 treesearch/planify 的下划线私有成员。

    需要使用就先公共化（去下划线导出）——见 CLAUDE.md 模块边界规则 2。
    """
    violations: list[str] = []
    for py in _py_sources("doclens"):
        src = py.read_text(encoding="utf-8", errors="replace")
        for m in _FROM_IMPORT_RE.finditer(src):
            root = m.group("mod").split(".")[0]
            if root not in ("treesearch", "planify"):
                continue
            names = re.sub(r"[()\\\n]", " ", m.group("names"))
            bad = [
                n.strip().split(" as ")[0].strip()
                for n in names.split(",")
                if n.strip().split(" as ")[0].strip().startswith("_")
            ]
            if bad:
                rel = py.relative_to(REPO).as_posix()
                violations.append(f"{rel}: from {m.group('mod')} import {', '.join(bad)}")
    assert not violations, "跨模块私有成员引用（应公共化）：\n" + "\n".join(violations)


# 红线 3（ADR-0019/0020）：全量物化调用——把全库 structure_json / index_meta
# 读进内存，百万语料 OOM / 驻留根因。doclens 搜索与变更检测链路必须走流式路径。
# 注意：单文档精确加载（load_document / load_document_by_source_path /
# load_doc_structures / load_doc_id_source_paths）与小表 get_all_failed_files
# 不在禁止之列；index_meta 单点读取用 get_index_meta(path)。
_FORBIDDEN_FULL_LOADS = (
    re.compile(r"\.load_index\("),
    re.compile(r"\.load_all_documents\("),
    re.compile(r"\bload_documents\("),
    re.compile(r"\.get_all_index_meta\("),
)


def test_doclens_no_full_document_materialization():
    """红线 3：doclens/ 下不得出现全量物化调用（含注释与文档字符串，防回潮）。"""
    violations: list[str] = []
    for py in _py_sources("doclens"):
        src = py.read_text(encoding="utf-8", errors="replace")
        for pat in _FORBIDDEN_FULL_LOADS:
            for m in pat.finditer(src):
                rel = py.relative_to(REPO).as_posix()
                violations.append(f"{rel}: {m.group(0)!r}（ADR-0019 红线：全量物化）")
    assert not violations, "doclens 全量物化回潮（ADR-0019）：\n" + "\n".join(violations)
