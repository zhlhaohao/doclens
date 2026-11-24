"""Pi Bot 内置角色 → planify/roles/<id>/role.json 转换（ADR-0058 §4/§5，一次性脚本）。

来源：C:\\Users\\lianghao\\github\\PiBot\\packages\\teams\\builtin\\roles\\*.pibot\\team.json
产物：planify/roles/<role_id>/role.json + skills/<skill>/{zh,en}/SKILL.md

映射规则：
  permissionOverrides.run_command=never → forbid [bash, powershell, background_run]
  permissionOverrides.run_command=always → tools += bash（默认全能力工具）
  permissionOverrides.write_file=never → forbid [write_file, edit_file]
    （BotRunner 的 FORCED 集仍注入限路径 write_file 供写记忆——正是评审 M2 的三层约束）
  send_out → 无对应，丢弃
  systemPrompt → persona；norms 原样；avatar*/quickPrompts → ui；needs/autoCheck 原样
  model/thinkingLevel → model/thinking_level（本期不生效）

SKILL.md：frontmatter pibot-contract→contract、pibot-params→params、pibot-name→display_name、
pibot-version 丢弃；正文原样（Pi Bot 专属工具段落的改写另见 convert 之后的处理说明）。

用法：.venv/Scripts/python.exe scripts/import_pibot_roles.py [--src <PiBot 根>]
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROLES_OUT = ROOT / "planify" / "roles"

ALL_CAPABILITY_TOOLS = ["read_file", "grep", "glob", "write_file", "edit_file", "bash", "load_skill"]
SHELL_TOOLS = ["bash", "powershell", "background_run"]

#: 本系统的授权决策（非 Pi Bot 原文）——按角色显式追加工具。只允许具体工具名，
#: 不开 `mcp__*` 通配：角色 = 用户授予的权限包（CONTEXT「角色」条目），通配会让
#: 新接入的任何 MCP server 自动对所有该角色 Bot 可用。
#: researcher：Pi Bot 给的是「不能联网、不能跑命令」；本系统只补搜索/抓网页的
#: anysearch 三件（它的 norms 本就要求「附本次实际抓取的 URL」），不开 shell。
LOCAL_TOOL_GRANTS = {
    "researcher": [
        "mcp__anysearch__search",
        "mcp__anysearch__batch_search",
        "mcp__anysearch__extract",
    ],
}

#: 对应的 description 口径修订（Pi Bot 原文说「不能联网」——与授权不符时改写）
_LOCAL_DESC_PATCH = {
    "researcher": {
        "zh": ("基于**本地文件与 anysearch 网页搜索/抓取**查资料、做调研（不能跑命令），结论附来源；"
               "写调研产物（md）。需要执行命令的任务派给有 shell 的角色"),
        "en": ("Researches from **local files and anysearch web search/extraction** (no shell), cites every conclusion; "
               "writes research artifacts (md). Assign command-running tasks to a role with shell"),
    },
}


def _perm(overrides: dict, role_id: str | None = None) -> dict:
    tools = list(ALL_CAPABILITY_TOOLS)
    forbid = []
    rc = overrides.get("run_command")
    if rc == "never":
        forbid += SHELL_TOOLS
        tools = [t for t in tools if t not in SHELL_TOOLS]
    wf = overrides.get("write_file")
    if wf == "never":
        forbid += ["write_file", "edit_file"]
        tools = [t for t in tools if t not in ("write_file", "edit_file")]
    if role_id and role_id in LOCAL_TOOL_GRANTS:
        for t in LOCAL_TOOL_GRANTS[role_id]:
            if t not in tools and t not in forbid:
                tools.append(t)
    return {"tools": tools, "forbid": forbid}


def _convert_skill_md(text: str) -> tuple:
    """frontmatter 改名；返回 (新文本, contract 字典或 None)。"""
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return text, None
    fm_body, body = m.group(1), m.group(2)
    out_lines = []
    contract = None
    for line in fm_body.splitlines():
        if line.startswith("  pibot-contract:"):
            try:
                contract = json.loads(line.split(":", 1)[1].strip().strip('"').encode().decode("unicode_escape") if "\\u" in line else json.loads(line.split(":", 1)[1].strip()))
            except Exception:  # noqa: BLE001
                raw = line.split(":", 1)[1].strip()
                contract = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
            out_lines.append(f"  contract: {json.dumps(contract, ensure_ascii=False)}")
        elif line.startswith("  pibot-params:"):
            out_lines.append("  params:" + line.split(":", 1)[1])
        elif line.startswith("  pibot-name:"):
            out_lines.append("  display_name:" + line.split(":", 1)[1])
        elif line.startswith("  pibot-version:"):
            continue
        else:
            out_lines.append(line)
    body = _prepend_env_note(body)
    return "---\n" + "\n".join(out_lines) + "\n---\n" + body, contract


# Pi Bot 的 Office/协作工具在 planify 不存在。不逐句改正文（39 文件易改坏方法论，
# 且上游更新无法重导）——顶部加环境说明，Bot 读到即知如何替代。
_ENV_NOTE_ZH = """> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

"""

_ENV_NOTE_EN = """> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

"""


def _prepend_env_note(body: str) -> str:
    # 按正文语言判断（中文字符占比）
    zh_chars = len(re.findall(r"[\u4e00-\u9fff]", body[:2000]))
    note = _ENV_NOTE_ZH if zh_chars > 50 else _ENV_NOTE_EN
    return note + body.lstrip("\n")


def convert_role(src_dir: Path, role_id: str) -> dict:
    team = json.loads((src_dir / "team.json").read_text(encoding="utf-8"))
    b = team["bots"][0]
    role = {
        "id": role_id,
        "version": b["role"]["version"],
        "name": b["role"]["name"],
        "category": b["role"]["category"],
        "description": _LOCAL_DESC_PATCH.get(role_id, b["description"]),
        "persona": b["systemPrompt"],
        "norms": b.get("norms", {"zh": "", "en": ""}),
        "model": b.get("model"),
        "thinking_level": b.get("thinkingLevel"),
        "permissions": _perm(b.get("permissionOverrides", {}) or {}, role_id),
        "skills": [s["folder"] for s in b.get("skills", []) if s.get("enabled", True)],
        "ui": {
            "avatar": {"shape": b.get("avatarShape"), "color": b.get("avatarColor"), "eyes": b.get("avatarEyes")},
            "quick_prompts": b.get("quickPrompts", []),
        },
        "needs": {"vision": b.get("needs", {}).get("vision", False),
                  "image_generation": b.get("needs", {}).get("imageGeneration", False)},
        "auto_check": b.get("autoCheck", False),
        "source": "Pi Bot (https://github.com/w01fb0ss/PiBot) Apache-2.0; ported 2026-11-24",
    }
    return role


def convert_skills(src_dir: Path, out_dir: Path, role_id: str) -> list:
    """拷贝 skills/<name>/{zh,en}/SKILL.md，改 frontmatter。返回 [skill 名]。"""
    skills_root = src_dir / "skills" / role_id
    names = []
    if not skills_root.exists():
        return names
    for skill_dir in sorted(p for p in skills_root.iterdir() if p.is_dir()):
        for lang in ("zh", "en"):
            src_md = skill_dir / lang / "SKILL.md"
            if not src_md.exists():
                continue
            dst = out_dir / "skills" / skill_dir.name / lang / "SKILL.md"
            dst.parent.mkdir(parents=True, exist_ok=True)
            text, _ = _convert_skill_md(src_md.read_text(encoding="utf-8"))
            dst.write_text(text, encoding="utf-8")
            # 技能可能带 references/ 等附属文件——一并拷
            for extra in (skill_dir / lang).iterdir():
                if extra.is_dir() and extra.name != "__pycache__":
                    shutil.copytree(extra, dst.parent / extra.name, dirs_exist_ok=True)
        names.append(skill_dir.name)
    return names


def main(src_root: Path) -> int:
    roles_src = src_root / "packages" / "teams" / "builtin" / "roles"
    count = 0
    for d in sorted(roles_src.glob("*.pibot")):
        role_id = d.name[:-len(".pibot")]
        role = convert_role(d, role_id)
        out = ROLES_OUT / role_id
        out.mkdir(parents=True, exist_ok=True)
        skill_names = convert_skills(d, out, role_id)
        if skill_names:
            role["skills"] = skill_names
        (out / "role.json").write_text(json.dumps(role, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{role_id:24s} v{role['version']:<3d} tools={len(role['permissions']['tools'])} forbid={role['permissions']['forbid']} skills={len(skill_names)}")
        count += 1
    print(f"\n{count} roles → {ROLES_OUT}")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=r"C:\Users\lianghao\github\PiBot")
    a = ap.parse_args()
    sys.exit(main(Path(a.src)))
