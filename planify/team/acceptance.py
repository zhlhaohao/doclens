"""程序验收引擎（ADR-0059 §5，spike 版）。

验收 = 对验收项的**本地判定**（不调模型）。保证「Bot 干了活」，不保证「活干对
了」——形态校验不验内容。

``run_acceptance(task_dir, output_dir, acceptance)`` 返回 (ok, failures)。
manual 项不程序判定，返回 ok=True 并记入 ``manual_items`` 由 DAG 末尾汇总。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

_CITE_RE = re.compile(r"\[\d+\]|https?://\S+|\b[\w./-]+\.(?:md|py|ts|js|txt|json|pdf|docx):\d+")


def _sections_of(text: str) -> List[str]:
    out = []
    for m in re.finditer(r"^#{1,3}\s+(.+?)\s*$", text, flags=re.M):
        out.append(m.group(1).strip())
    return out


def run_acceptance(output_dir: Path, acceptance: List[Dict[str, Any]]) -> Tuple[bool, List[str], List[Dict[str, Any]]]:
    """返回 (全部程序项是否通过, 未达标描述列表, manual 项列表)。"""
    output_dir = Path(output_dir)
    failures: List[str] = []
    manuals: List[Dict[str, Any]] = []

    for item in acceptance or []:
        check = item.get("check")
        rel = item.get("path", "")
        target = (output_dir / rel).resolve() if rel else None

        if check == "manual":
            manuals.append(item)
            continue

        if check == "exists":
            if not target or not target.exists():
                failures.append(f"exists: '{rel}' not found in {output_dir.name}/")

        elif check == "sections":
            if not target or not target.exists():
                failures.append(f"sections: '{rel}' not found")
                continue
            text = target.read_text(encoding="utf-8", errors="replace")
            found = set(_sections_of(text))
            missing = [n for n in item.get("names", []) if n not in found]
            if missing:
                failures.append(f"sections: '{rel}' missing sections {missing}")

        elif check == "min_citations":
            if not target or not target.exists():
                failures.append(f"min_citations: '{rel}' not found")
                continue
            text = target.read_text(encoding="utf-8", errors="replace")
            n = len(_CITE_RE.findall(text))
            need = int(item.get("min", 1))
            if n < need:
                failures.append(f"min_citations: '{rel}' has {n}, needs {need}")

        else:
            failures.append(f"unknown check '{check}'")

    return (not failures), failures, manuals
