"""team-dispatch 技能评测集（ADR-0059 §12 末条）。

用法（需真实 LLM——评测的是 lead 写 DAG 的能力，不能用假 provider）：

    .venv/Scripts/python.exe scripts/eval_team_dispatch.py [--model <id>] [--out <dir>]

对 5 个派活任务各跑一次 lead 回合（注入 team-dispatch 技能 + 角色清单 + 已 spawn
的 Bot 列表），抓取 lead 调 group_plan 的 plan 参数，做两层评估：

  1. 格式：程序校验器（validate_plan）通过率——自动
  2. 合理性：按任务附带的检查清单人工打分——半自动（脚本列出每项，人填 0/1）

输出：<out>/<task-id>.json（原始 plan + 校验结果 + 清单）、<out>/summary.md。

这不是 pytest：依赖网络与模型，且含人工环节。
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from planify.team import dag as D  # noqa: E402
from planify.team.roles import RoleLibrary  # noqa: E402


# ----------------------------------------------------------------- 任务集

# 每个任务：prompt（用户原话）、bots（预先 spawn 好的 Bot 名→角色）、
# checklist（人工合理性检查项，每项 0/1）
TASKS: List[Dict[str, Any]] = [
    {
        "id": "research-then-report",
        "prompt": "让一个 Bot 调研一下量子计算最近一年的进展，再让另一个基于调研结果写一份周报，要有摘要和来源。",
        "bots": {"remy": "researcher", "kit": "researcher"},
        "checklist": [
            "恰好两个步骤（调研 / 周报），没有多余的「汇总」「检查」步骤",
            "周报步骤 depends_on 调研步骤，且 inputs 显式引用调研的 deliverable",
            "两个步骤的 deliverables 路径不同（如 notes.md / weekly.md）",
            "周报步骤的 acceptance 含 sections: 摘要、来源",
        ],
    },
    {
        "id": "parallel-independent",
        "prompt": "把 ~/notes/a 和 ~/notes/b 两个目录各整理一份摘要。",
        "bots": {"remy": "researcher", "kit": "researcher"},
        "checklist": [
            "两个步骤之间**没有** depends_on（互相独立）",
            "两个步骤 assignee 不同（或都留空开放认领）",
            "两个 deliverables 路径不同",
            "每个步骤的 acceptance 至少有 exists",
        ],
    },
    {
        "id": "three-way-with-review",
        "prompt": "写一份 Notion 的产品分析报告（目标用户、定位、功能架构、竞品对比、商业模式），写完要有人审一遍再定稿。",
        "bots": {"remy": "researcher", "rev": "researcher"},
        "checklist": [
            "三个步骤：写报告 / 审查 / 定稿（或两步：写+审，审查产出 verdict）",
            "审查步骤 depends_on 写报告",
            "审查步骤的 assignee 与写报告步骤**不同**（非作者原则）",
            "审查步骤的 acceptance 含 exists（verdict 文件）",
        ],
    },
    {
        "id": "single-bot-sequential",
        "prompt": "让 remy 先列出 10 篇「大模型推理加速」方向的论文清单，然后逐篇写笔记。",
        "bots": {"remy": "researcher"},
        "checklist": [
            "两个步骤都 assignee=remy（只有一个 Bot）",
            "写笔记 depends_on 列清单（笔记依赖清单）",
            "没有凭空造出第二个 Bot 名",
        ],
    },
    {
        "id": "should-not-dispatch",
        "prompt": "帮我看一下 README.md 讲了什么。",
        "bots": {"remy": "researcher"},
        "checklist": [
            "**没有**调用 group_plan（单 Bot 能做的事直接做）",
            "若调了 spawn_teammate 也算错——这个任务不需要派活",
        ],
    },
]


# ----------------------------------------------------------------- 评测

def _build_system(roles: RoleLibrary, bots: Dict[str, str]) -> str:
    from pathlib import Path as _P
    skill_md = ROOT / "doclens" / "skills" / "team-dispatch" / "SKILL.md"
    skill_body = skill_md.read_text(encoding="utf-8") if skill_md.exists() else "(team-dispatch SKILL.md missing)"
    bot_lines = "\n".join(f"- {n}: {r}" for n, r in bots.items())
    return (
        "You are the lead agent in a coding-assistant harness. You have the normal tool set "
        "(read_file, grep, glob, write_file, edit_file, bash) and can do most tasks yourself. "
        "You ALSO have team tools (spawn_teammate, group_plan, list_teammates). "
        "Follow the team-dispatch skill below ONLY when a task genuinely needs multiple roles or parallel work.\n\n"
        f"# 团队角色\n{roles.catalog_line()}\n\n"
        f"# 已有 Bot（本会话已租借）\n{bot_lines}\n\n"
        f"<loaded-skill name=\"team-dispatch\">\n{skill_body}\n</loaded-skill>"
    )


def _real_tools(workdir: Path, bots: Dict[str, str], scope: str = "eval"):
    """用真实 plan_tools handler 当桩：list_teammates 返回真 Bot 列表，group_plan 真
    校验（lead 可据 issue 修正后重提——这才是真实回路）。预 spawn 好 Bot 并租给 scope。"""
    import tempfile
    from planify.team.hub import TeamHub
    from planify.team.plan_tools import make_plan_tools
    from planify.skills.access_state import set_current_session_id

    hub = TeamHub(Path(tempfile.mkdtemp()) / "team", RoleLibrary())
    for n, r in bots.items():
        hub.registry.spawn(n, r, scope)
    set_current_session_id(scope)
    defs, H = make_plan_tools(lambda: hub, workdir)
    keep = ("group_plan", "list_teammates", "spawn_teammate", "read_inbox", "send_message")
    defs = [d for d in defs if d["name"] in keep]
    H = {k: v for k, v in H.items() if k in keep}
    # lead 的能力工具（只给定义，不真执行——评测只看它派不派活；handler 返回占位）
    for name, desc in (("read_file", "Read a file"), ("grep", "Search file contents"), ("glob", "Find files by pattern"),
                       ("write_file", "Write a file"), ("edit_file", "Edit a file"), ("bash", "Run a shell command")):
        defs.append({"name": name, "description": desc, "input_schema": {"type": "object", "properties": {"path": {"type": "string"}, "command": {"type": "string"}, "content": {"type": "string"}}}})
        H[name] = (lambda **kw: "(eval stub) ok")
    return defs, H, hub


def _extract_plan_from_trace(trace_text: str) -> Any:
    """从 LLM 追踪文件里抓最近一次 group_plan 调用的 plan 参数。"""
    import re
    # 追踪文件是实发请求体的 md 落盘；tool_use input 里 name 为 group_plan
    matches = re.findall(r'"name"\s*:\s*"group_plan"\s*,\s*"input"\s*:\s*(\{.*?\})\s*\}', trace_text, re.S)
    if not matches:
        return None
    for raw in reversed(matches):
        try:
            inp = json.loads(raw)
            return inp.get("plan")
        except json.JSONDecodeError:
            continue
    return None


def _provider(model: str | None):
    """用宿主配置（global .env 的预设物化值）建 provider。"""
    from doclens.config import CortexConfig
    from planify.core.llm.factory import create_provider
    cfg = CortexConfig.load()
    return create_provider({
        "api_key": cfg.planify_api_key,
        "model_id": model or cfg.planify_model_id or "claude-opus-4-6",
        "base_url": cfg.planify_base_url,
        "protocol": cfg.planify_protocol,
    })


def run(model: str | None, out_dir: Path, only: set | None = None) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    roles = RoleLibrary()
    provider = _provider(model)
    results = []
    for task in TASKS:
        if only and task["id"] not in only:
            continue
        messages = [{"role": "user", "content": task["prompt"]}]
        tool_defs, tool_handlers, hub = _real_tools(ROOT, task["bots"])
        from planify.tools.basic import to_tool_defs
        tools = to_tool_defs(tool_defs)
        plan = None
        submitted_ok = False
        transcript: List[str] = []
        import time as _t
        for _ in range(8):
            for attempt in range(6):
                try:
                    resp = provider.chat(messages=messages, system=_build_system(roles, task["bots"]), tools=tools)
                    break
                except Exception as e:  # noqa: BLE001 — 429/529 过载退避
                    if attempt == 5 or not any(s in str(e) for s in ("429", "529", "overloaded", "rate")):
                        raise
                    wait = 10 * (attempt + 1)
                    print(f"[{task['id']}] overloaded, retry in {wait}s", flush=True)
                    _t.sleep(wait)
            blocks = []
            pending_calls = []
            for b in resp.content:
                bt = getattr(b, "type", None)
                if bt == "tool_use":
                    blocks.append({"type": "tool_use", "id": b.id, "name": b.name, "input": dict(b.input or {})})
                    pending_calls.append((b.id, b.name, dict(b.input or {})))
                    transcript.append(f"TOOL_CALL {b.name}: {json.dumps(b.input, ensure_ascii=False)[:400]}")
                elif bt == "text":
                    blocks.append({"type": "text", "text": b.text})
                    transcript.append(f"TEXT: {b.text[:400]}")
            messages.append({"role": "assistant", "content": blocks})
            if resp.stop_reason != "tool_use" or not pending_calls:
                break
            # 真实 handler 执行——lead 可据 group_plan 返回的 issue 修正后重提
            results_blocks = []
            for cid, cname, cinp in pending_calls:
                try:
                    out = tool_handlers[cname](**cinp)
                except Exception as e:  # noqa: BLE001
                    out = f"Error: {e}"
                transcript.append(f"TOOL_RESULT {cname}: {str(out)[:300]}")
                results_blocks.append({"type": "tool_result", "tool_use_id": cid, "content": str(out)})
                if cname == "group_plan":
                    try:
                        r = json.loads(out)
                        if r.get("ok"):
                            plan = cinp.get("plan")
                            submitted_ok = True
                    except (json.JSONDecodeError, KeyError):
                        pass
            if submitted_ok:
                break
            messages.append({"role": "user", "content": results_blocks})
        # 评估：handler 已真校验——submitted_ok 即 PASS；否则看最后一次提交的 issue
        fmt = {"ok": None, "issue": None, "repairs": []}
        if plan is not None:
            if submitted_ok:
                fmt = {"ok": True, "repairs": [], "issue": None}
            else:
                try:
                    norm = D.validate_plan(plan, role_ids=roles.ids(), bot_names=list(task["bots"]),
                                           bot_roles=task["bots"])
                    fmt = {"ok": True, "repairs": norm.get("repairs", [])}
                except D.PlanIssue as e:
                    fmt = {"ok": False, "issue": e.to_dict(), "repairs": []}
        results.append({
            "task": task["id"], "prompt": task["prompt"], "plan": plan, "format": fmt,
            "transcript": transcript,
            "checklist": [{"item": c, "score": None} for c in task["checklist"]],
        })
        (out_dir / f"{task['id']}.json").write_text(json.dumps(results[-1], indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[{task['id']}] plan={'yes' if plan else 'no'} format={'PASS' if fmt['ok'] else fmt.get('issue')} repairs={len(fmt['repairs'])}", flush=True)

    # summary
    passed = sum(1 for r in results if r["format"]["ok"])
    lines = [f"# team-dispatch 评测 — {time.strftime('%Y-%m-%d %H:%M')}", "",
             f"格式通过率：{passed}/{len(results)}", ""]
    for r in results:
        lines.append(f"## {r['task']}")
        lines.append(f"- prompt: {r['prompt']}")
        lines.append(f"- 调用 group_plan: {'是' if r['plan'] else '否'}")
        lines.append(f"- 格式校验: {'PASS' if r['format']['ok'] else r['format'].get('issue')}")
        if r["format"].get("repairs"):
            lines.append(f"- 自动修复: {r['format']['repairs']}")
        lines.append("- 合理性（人工填 0/1）：")
        for c in r["checklist"]:
            lines.append(f"  - [ ] {c['item']}")
        if r["plan"]:
            lines.append("- plan（原始提交）:")
            lines.append("```json")
            lines.append(json.dumps(r["plan"], indent=2, ensure_ascii=False))
            lines.append("```")
        if r.get("transcript"):
            lines.append("- transcript:")
            for t in r["transcript"]:
                lines.append(f"  - {t[:300]}")
        lines.append("")
    (out_dir / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\n格式通过率 {passed}/{len(results)}；人工清单见 {out_dir / 'summary.md'}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=None)
    ap.add_argument("--out", default=str(ROOT / ".doclens" / "tmp" / "team-dispatch-eval"))
    ap.add_argument("--only", default=None, help="逗号分隔的任务 id，只跑这些")
    a = ap.parse_args()
    only = set(a.only.split(",")) if a.only else None
    sys.exit(run(a.model, Path(a.out), only))
