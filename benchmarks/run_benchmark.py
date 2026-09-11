# -*- coding: utf-8 -*-
"""EnterpriseRAG Benchmark —— doclens GUI 对话 E2E 测试。

对 questions.jsonl 题集逐题走真实对话链路（复刻前端序列：
POST /sessions(mode=skill) → PATCH message_user → SSE POST /api/chat，
消息带 [调用技能: knowledge-base] 标记强制加载技能），评分并即时落盘。

用法（前提：GUI 已在目标语料目录启动，见 start-app.ps1 gui -C <语料>）：
    .venv/Scripts/python.exe benchmarks/run_benchmark.py
    .venv/Scripts/python.exe benchmarks/run_benchmark.py --base-url http://127.0.0.1:7860

产出（--out-dir，默认 benchmarks/results）：
    results_<run_id>.jsonl   每题一行的明细（即时追加，断点续测按 question_id 跳过）
    report_<run_id>.md       跑完/Ctrl+C 后聚合的 Markdown 报告
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

# 自举：repo 根加入 sys.path（与 start-app.ps1 的 PYTHONPATH 同思路），
# 保证 judge 能 import 本仓库的 planify（venv 里可能装着别的 worktree 的 editable）
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import httpx

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

DEFAULT_QUESTIONS = r"C:\Users\lianghao\EnterpriseRAG-Bench-Data\questions.jsonl"
SKILL_NAME = "knowledge-base"
SKILL_MESSAGE_TEMPLATE = (
    "[调用技能: {name}]\n"
    '请先 load_skill("{name}") 加载技能，然后按技能指引处理。\n'
    "\n"
    "{question}"
)
# 参考资料章节行：`1. 相对路径`
REFS_LINE_RE = re.compile(r"^\s*\d+\.\s+(.+?)\s*$", re.M)
_REFS_SECTION_RE = re.compile(r"^##\s+参考资料\s*$", re.M)


# ---------------------------------------------------------------------------
# 题目加载与范围选择
# ---------------------------------------------------------------------------

def load_questions(path: str) -> list[dict]:
    questions = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                questions.append(json.loads(line))
    return questions


def _pick_multi(label: str, options: list[tuple[str, int]]) -> set[str]:
    """多选交互：展示计数，逗号分隔选择，回车=全选，a=all，0=清空。"""
    print(f"\n{label}（逗号分隔序号或名称；回车=全选）：")
    for i, (name, count) in enumerate(options, 1):
        print(f"  {i:2d}. {name:<28s} {count:>4d} 题")
    while True:
        raw = input("> ").strip().lower()
        if not raw or raw in ("a", "all"):
            return {name for name, _ in options}
        chosen: set[str] = set()
        try:
            for part in raw.split(","):
                part = part.strip()
                if not part:
                    continue
                if part.isdigit():
                    idx = int(part)
                    if not 1 <= idx <= len(options):
                        raise ValueError
                    chosen.add(options[idx - 1][0])
                else:
                    names = {name for name, _ in options if name.lower() == part}
                    if not names:
                        raise ValueError
                    chosen |= names
            if chosen:
                return chosen
        except ValueError:
            pass
        print("  输入无效，重试（如 1,3,5 或 slack,gmail；回车=全选）")


def select_range(questions: list[dict]) -> list[dict]:
    """交互式范围选择：source_types × question_type × 最多条数。"""
    from collections import Counter

    src_counts = Counter()
    for q in questions:
        for s in q["source_types"]:
            src_counts[s] += 1
    src_options = sorted(src_counts.items(), key=lambda x: -x[1])

    type_counts = Counter(q["question_type"] for q in questions)
    type_options = sorted(type_counts.items(), key=lambda x: -x[1])

    chosen_src = _pick_multi("source_types 范围", src_options)
    chosen_type = _pick_multi("question_type 范围", type_options)

    selected = [
        q for q in questions
        if q["question_type"] in chosen_type
        and (not q["source_types"] or set(q["source_types"]) & chosen_src)
    ]

    total = len(selected)
    if not selected:
        print("所选范围内没有题目。")
        sys.exit(1)
    print(f"\n范围内共 {total} 题。")
    while True:
        raw = input(f"最多测试条数（回车=全部 {total}）：").strip()
        if not raw:
            return selected
        if raw.isdigit() and int(raw) > 0:
            return selected[: int(raw)]
        print("  请输入正整数或回车。")


# ---------------------------------------------------------------------------
# E2E 对话（复刻前端 chat-view 序列）
# ---------------------------------------------------------------------------

class ChatClient:
    """doclens GUI 对话 API 的最小 E2E 客户端。"""

    def __init__(self, base_url: str, timeout_s: float = 600.0,
                 question_timeout_s: float = 180.0):
        self._base = base_url.rstrip("/")
        self._client = httpx.Client(timeout=timeout_s)
        self._question_timeout_s = question_timeout_s

    def ask(self, question: str, title: str) -> dict:
        """跑一题：建会话 → 落用户消息 → SSE 收流到 done。

        Returns:
            {answer, tool_calls, first_token_ms, wall_ms, error}
        """
        message = SKILL_MESSAGE_TEMPLATE.format(name=SKILL_NAME, question=question)

        # 1. 建技能会话（与前端 _ensureSession 一致：type=chat, mode=skill）
        r = self._client.post(f"{self._base}/api/sessions", json={
            "type": "chat",
            "title": title[:60],
            "preview": question[:100],
            "mode": "skill",
        })
        r.raise_for_status()
        session_id = r.json()["id"]

        # 2. 用户消息先落库（后端 get_chat_history 按轮回放依赖此序）
        r = self._client.patch(f"{self._base}/api/sessions/{session_id}", json={
            "items": [{"kind": "message_user", "payload": json.dumps({"content": message}, ensure_ascii=False)}],
        })
        r.raise_for_status()

        # 3. SSE 对话（event: token/tool_call/tool_result/.../done）
        t0 = time.monotonic()
        first_token_ms: float | None = None
        tokens: list[str] = []
        tool_calls: list[dict] = []
        tool_results: list[dict] = []
        error: str | None = None

        with self._client.stream(
            "POST", f"{self._base}/api/chat",
            json={"message": message, "session_id": session_id},
        ) as resp:
            resp.raise_for_status()
            event_name = ""
            data_buf: list[str] = []
            try:
                for line in resp.iter_lines():
                    # 单题墙钟超时：超时即判失败（部分回答保留，judge 跳过）
                    if (time.monotonic() - t0) > self._question_timeout_s:
                        error = f"timeout after {self._question_timeout_s:.0f}s"
                        break
                    if line.startswith("event:"):
                        event_name = line[6:].strip()
                    elif line.startswith("data:"):
                        data_buf.append(line[5:].strip())
                    elif line == "":
                        if event_name:
                            payload = json.loads("".join(data_buf) or "{}")
                            if event_name == "token" and first_token_ms is None:
                                first_token_ms = (time.monotonic() - t0) * 1000
                            self._consume(event_name, payload, tokens, tool_calls, tool_results)
                            if event_name in ("done", "error"):
                                if event_name == "error":
                                    error = str(payload.get("detail", "unknown"))
                                break
                        event_name, data_buf = "", []
            finally:
                # 异常/早退/超时时显式关闭流：服务端凭「客户端断开」取消生成
                # （chat.py 的 CancelledError 兜底），否则连接悬挂拖死后续请求
                resp.close()

        # 超时兜底：通知服务端停止生成（不烧 token），失败可忽略
        if error and error.startswith("timeout"):
            try:
                self._client.post(f"{self._base}/api/chat/stop",
                                  json={"session_id": session_id}, timeout=10)
            except Exception:  # noqa: BLE001
                pass

        wall_ms = (time.monotonic() - t0) * 1000
        return {
            "answer": "".join(tokens),
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "first_token_ms": first_token_ms,
            "wall_ms": wall_ms,
            "error": error,
            "session_id": session_id,
        }

    @staticmethod
    def _consume(event: str, payload: dict, tokens: list[str],
                 tool_calls: list[dict], tool_results: list[dict]) -> None:
        if event == "token":
            tokens.append(str(payload.get("text", "")))
        elif event == "tool_call":
            tool_calls.append({
                "name": str(payload.get("name", "")),
                "input": payload.get("input", {}),
            })
        elif event == "tool_result":
            tool_results.append({
                "name": str(payload.get("name", "")),
                "output": str(payload.get("output", "")),
                "is_error": bool(payload.get("is_error")),
            })


# ---------------------------------------------------------------------------
# 契合度：引用文档 vs expected_doc_ids（文件名前缀匹配）
# ---------------------------------------------------------------------------

_TOOL_PATH_RE = re.compile(r"<path>([^<>\n]+?)</path>")
_DOC_LINE_RE = re.compile(r"^文档[:：]\s*(.+?)\s*$", re.M)


def extract_cited_paths(answer: str, tool_results: list[dict] | None = None) -> list[str]:
    """提取 AI 实际引用/检索到的文档路径。优先级：

    1. 「## 参考资料」章节（技能会话机器重建，正文含路径时才有）
    2. 工具结果轨迹：search_kb/grep 输出的 <path>…</path> 与
       read_document 输出的「文档: 路径」行——AI 正文不带路径时的主信号
    3. 正文反引号路径兜底
    """
    cited: list[str] = []
    m = _REFS_SECTION_RE.search(answer)
    if m:
        section = answer[m.end():]
        # 章节到下一个 ## 或文末
        nxt = re.search(r"^##\s", section, re.M)
        if nxt:
            section = section[: nxt.start()]
        for line in section.splitlines():
            lm = REFS_LINE_RE.match(line)
            if lm:
                cited.append(lm.group(1))

    if not cited and tool_results:
        for tr in tool_results:
            if tr.get("is_error"):
                continue
            out = tr.get("output") or ""
            cited.extend(_TOOL_PATH_RE.findall(out))
            cited.extend(_DOC_LINE_RE.findall(out))

    if not cited:
        # 正文兜底：反引号内的含扩展名路径（如 `github/xxx.txt`）
        for bm in re.finditer(r"`([^`\n]+\.\w{2,4})`", answer):
            p = bm.group(1)
            if "/" in p or "\\" in p:
                cited.append(p)

    # 去重保序
    seen: set[str] = set()
    return [c for c in cited if not (c in seen or seen.add(c))]


def match_score(cited: list[str], expected_doc_ids: list[str]) -> dict:
    """契合度：expected_doc_ids 是文件名前缀（dsid_xxx），按前缀命中。

    Returns:
        {recall, precision, hits, misses, extra}
    """
    cited_prefixes = {Path(c).name.split("__")[0] for c in cited}
    hits = [did for did in expected_doc_ids if did in cited_prefixes]
    misses = [did for did in expected_doc_ids if did not in cited_prefixes]
    extra = sorted(cited_prefixes - set(expected_doc_ids))
    recall = len(hits) / len(expected_doc_ids) if expected_doc_ids else None
    precision = len(hits) / len(cited_prefixes) if cited_prefixes else None
    return {
        "recall": recall,
        "precision": precision,
        "hits": hits,
        "misses": misses,
        "extra": extra,
    }


# ---------------------------------------------------------------------------
# AI 评分：judge LLM（1-10）
# ---------------------------------------------------------------------------

JUDGE_SYSTEM = (
    "You are a strict benchmark judge. Compare the candidate answer against the "
    "gold answer for the given question. Score 1-10:\n"
    "9-10: covers all key facts correctly, no contradictions.\n"
    "7-8: covers most key facts, minor omissions, no wrong facts.\n"
    "4-6: partial coverage or vague; may contain minor errors.\n"
    "1-3: mostly wrong, misses the point, or fabricates.\n"
    "Special case (info_not_found questions): the gold answer REQUIRES stating "
    "the query is not fully answerable. Score 9-10 only if the candidate "
    "explicitly says it cannot fully answer from available documents; answering "
    "with fabricated specifics scores 1-3.\n"
    "Respond with ONLY a JSON object: {\"score\": <int 1-10>, \"reason\": \"<one sentence>\"}"
)


def judge_answer(question: dict, candidate: str) -> dict:
    """judge LLM 对比 gold_answer 打 1-10 分。失败重试 2 次后返回 null。"""
    from planify.core.llm.factory import create_provider

    cfg = {
        "protocol": _env("PLANIFY_PROTOCOL", "anthropic"),
        "base_url": _env("PLANIFY_BASE_URL", ""),
        "model_id": _env("PLANIFY_MODEL_ID", ""),
        "api_key": _env("PLANIFY_API_KEY", ""),
    }
    user = (
        f"Question:\n{question['question']}\n\n"
        f"Gold answer:\n{question['gold_answer']}\n\n"
        f"Key facts to check:\n"
        + "\n".join(f"- {f}" for f in question.get("answer_facts", []))
        + f"\n\nCandidate answer:\n{candidate[:8000]}"
    )

    last_err = None
    for _attempt in range(3):
        try:
            provider = create_provider(cfg)
            resp = provider.chat(
                messages=[{"role": "user", "content": user}],
                system=JUDGE_SYSTEM,
                tools=[],
                max_tokens=300,
            )
            text = "".join(
                getattr(b, "text", "") for b in resp.content
            )
            jm = re.search(r"\{[^{}]*\"score\"[^{}]*\}", text, re.S)
            if jm:
                data = json.loads(jm.group(0))
                score = int(data["score"])
                if 1 <= score <= 10:
                    return {"score": score, "reason": str(data.get("reason", ""))}
            last_err = f"unparseable judge output: {text[:200]}"
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        time.sleep(1.5)
    return {"score": None, "reason": f"judge failed: {last_err}"}


def _env(name: str, default: str = "") -> str:
    import os
    # ~/.cortex/.env 是 GUI 激活 LLM 预设的落点；benchmark 与被测系统同源读它
    env_path = Path.home() / ".cortex" / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip()
    return os.environ.get(name, default)


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------

def _fmt(x, suffix: str = "") -> str:
    """数值格式化：None → '—'（报告与终端进度行共用）。"""
    return f"{x:.2f}{suffix}" if x is not None else "—"


def write_report(results: list[dict], run_id: str, out_dir: Path, meta: dict) -> Path:
    """聚合 Markdown 报告。"""
    ok = [r for r in results if not r.get("chat_error")]
    scores = [r["ai_score"]["score"] for r in ok if r.get("ai_score", {}).get("score") is not None]
    recalls = [r["match"]["recall"] for r in ok if r["match"]["recall"] is not None]
    precisions = [r["match"]["precision"] for r in ok if r["match"]["precision"] is not None]
    walls = [r["wall_ms"] / 1000 for r in ok if r.get("wall_ms")]
    ftts = [r["first_token_ms"] / 1000 for r in ok if r.get("first_token_ms")]

    def _avg(xs):
        return sum(xs) / len(xs) if xs else None

    lines = []
    lines.append(f"# EnterpriseRAG Benchmark 报告 · {run_id}")
    lines.append("")
    lines.append(f"- 时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- 题目文件：{meta.get('questions_path')}")
    lines.append(f"- 范围：source_types={meta.get('source_types')} / question_type={meta.get('question_types')} / 上限={meta.get('max_n')}")
    lines.append(f"- 完成：{len(ok)}/{len(results)} 题（对话失败 {len(results) - len(ok)}，评分失败 {len(ok) - len(scores)}）")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append("| 指标 | 均值 |")
    lines.append("|------|------|")
    lines.append(f"| AI 评分（1-10） | {_fmt(_avg(scores))} |")
    lines.append(f"| 契合度 recall | {_fmt(_avg(recalls))} |")
    lines.append(f"| 契合度 precision | {_fmt(_avg(precisions))} |")
    lines.append(f"| 耗时 wall（s/题） | {_fmt(_avg(walls))} |")
    lines.append(f"| 首 token（s） | {_fmt(_avg(ftts))} |")
    lines.append("")

    # 分组统计
    for dim, key in (("question_type", "question_type"), ("source_types", "source_types")):
        groups: dict[str, list[dict]] = {}
        for r in ok:
            vals = r.get(key) or []
            for v in (vals if isinstance(vals, list) else [vals]):
                groups.setdefault(v, []).append(r)
        if not groups:
            continue
        lines.append(f"## 按 {dim} 分组")
        lines.append("")
        lines.append("| 组 | 题数 | AI评分 | recall | precision | 耗时s |")
        lines.append("|----|------|-------|--------|-----------|-------|")
        for g, rs in sorted(groups.items()):
            gs = [r["ai_score"]["score"] for r in rs if r.get("ai_score", {}).get("score") is not None]
            gr = [r["match"]["recall"] for r in rs if r["match"]["recall"] is not None]
            gp = [r["match"]["precision"] for r in rs if r["match"]["precision"] is not None]
            gw = [r["wall_ms"] / 1000 for r in rs if r.get("wall_ms")]
            lines.append(
                f"| {g} | {len(rs)} | {_fmt(_avg(gs))} | {_fmt(_avg(gr))} | "
                f"{_fmt(_avg(gp))} | {_fmt(_avg(gw))} |"
            )
        lines.append("")

    # 每题明细
    lines.append("## 每题明细")
    lines.append("")
    lines.append("| # | 题号 | 类型 | AI分 | recall | precision | 耗时s | 摘要 |")
    lines.append("|---|------|------|------|--------|-----------|-------|------|")
    for i, r in enumerate(results, 1):
        score = r.get("ai_score", {}).get("score")
        ans = (r.get("answer") or "").replace("\n", " ").replace("|", "\\|")
        lines.append(
            f"| {i} | {r['question_id']} | {r.get('question_type', '')} | "
            f"{score if score is not None else '失败'} | "
            f"{_fmt(r['match']['recall'])} | {_fmt(r['match']['precision'])} | "
            f"{_fmt((r.get('wall_ms') or 0) / 1000)} | {ans[:60]} |"
        )

    # 评分失败清单
    judge_failed = [r for r in results if r.get("ai_score", {}).get("score") is None]
    if judge_failed:
        lines.append("")
        lines.append("## 评分失败清单")
        lines.append("")
        for r in judge_failed:
            lines.append(f"- **{r['question_id']}**：{r['ai_score'].get('reason', '')[:150]}")

    report_path = out_dir / f"report_{run_id}.md"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--questions", default=DEFAULT_QUESTIONS, help="questions.jsonl 路径")
    ap.add_argument("--base-url", default="http://127.0.0.1:7860", help="doclens GUI 地址")
    ap.add_argument("--out-dir", default=str(Path(__file__).parent / "results"), help="结果输出目录")
    ap.add_argument("--resume", default="", help="续测已有 JSONL 文件（缺省=同 run_id 自动发现）")
    ap.add_argument("--no-judge", action="store_true", help="跳过 AI 评分（只测契合度+耗时）")
    ap.add_argument("--timeout", type=float, default=180.0,
                    help="单题墙钟超时秒数（默认 180：超时判失败，保留部分回答、跳过评分）")
    args = ap.parse_args()

    questions_path = Path(args.questions)
    if not questions_path.exists():
        print(f"错误: 题目文件不存在: {questions_path}")
        sys.exit(1)

    questions = load_questions(str(questions_path))
    print(f"已加载 {len(questions)} 题（{questions_path}）")

    # 被测系统健康检查（用轻量根路径——/api/status 在 50 万语料上要扫全部
    # 源文件 stat，分钟级，不适合作探针）
    client = ChatClient(args.base_url, question_timeout_s=args.timeout)
    try:
        health = client._client.get(args.base_url, timeout=120)
        health.raise_for_status()
        print(f"已连接 doclens（{args.base_url}）")
    except Exception as e:
        print(f"错误: 无法连接 doclens GUI（{args.base_url}）：{e}")
        print("请先启动：pwsh -File start-app.ps1 gui -C <语料目录>")
        sys.exit(1)

    # 范围选择
    selected = select_range(questions)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    jsonl_path = Path(args.resume) if args.resume else out_dir / f"results_{run_id}.jsonl"

    # 断点续测：已完成的 question_id 跳过
    done_ids: set[str] = set()
    if jsonl_path.exists():
        for line in jsonl_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    done_ids.add(json.loads(line)["question_id"])
                except json.JSONDecodeError:
                    pass
        if done_ids:
            print(f"续测模式：{jsonl_path.name} 已有 {len(done_ids)} 题，将跳过")

    pending = [q for q in selected if q["question_id"] not in done_ids]
    if not pending:
        print("全部题目已完成（如需重跑请删除对应 JSONL 或换 --out-dir）。")
        return

    print(f"\n开始测试：{len(pending)} 题，结果即时写入 {jsonl_path}")
    print("Ctrl+C 可中断——已完成的结果已落盘，重跑将自动续测。\n")

    results: list[dict] = []
    t_start = time.monotonic()
    try:
        for i, q in enumerate(pending, 1):
            qid = q["question_id"]
            title = f"{SKILL_NAME} · {q['question'][:30]}"
            try:
                chat = client.ask(q["question"], title)
            except Exception as e:  # noqa: BLE001
                chat = {"answer": "", "tool_calls": [], "tool_results": [],
                        "first_token_ms": None, "wall_ms": None,
                        "error": str(e), "session_id": None}

            cited = extract_cited_paths(chat.get("answer") or "", chat.get("tool_results"))
            match = match_score(cited, q.get("expected_doc_ids", []))
            _failed = bool(chat.get("error"))  # 含超时：失败题不评分（部分回答保留在明细里）
            ai_score = ({"score": None, "reason": f"failed: {chat.get('error')}"}
                        if _failed or args.no_judge
                        else judge_answer(q, chat.get("answer") or ""))

            record = {
                "question_id": qid,
                "question_type": q["question_type"],
                "source_types": q["source_types"],
                "question": q["question"],
                "expected_doc_ids": q.get("expected_doc_ids", []),
                "gold_answer": q["gold_answer"],
                "answer": chat.get("answer") or "",
                "cited_paths": cited,
                "match": {k: match[k] for k in ("recall", "precision", "hits", "misses", "extra")},
                "ai_score": ai_score,
                "wall_ms": chat.get("wall_ms"),
                "first_token_ms": chat.get("first_token_ms"),
                "chat_error": chat.get("error"),
                "tool_calls": [
                    {"name": tc.get("name"), "input": tc.get("input")}
                    for tc in (chat.get("tool_calls") or [])
                ],
                "tool_result_names": [
                    tr.get("name") for tr in (chat.get("tool_results") or [])
                ],
                "session_id": chat.get("session_id"),
                "ts": datetime.now().isoformat(timespec="seconds"),
            }
            # 即时落盘（一行一题，进程被杀不丢已完成数据）
            with open(jsonl_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
            results.append(record)

            score = ai_score["score"]
            mark = "✓" if not chat.get("error") else "✗"
            print(
                f"[{i}/{len(pending)}] {qid} {mark} "
                f"recall={_fmt(match['recall'])} precision={_fmt(match['precision'])} "
                f"score={score if score is not None else 'N/A'} "
                f"{(chat.get('wall_ms') or 0) / 1000:.1f}s"
            )
    except KeyboardInterrupt:
        print("\n\n中断——已完成结果已落盘。")

    elapsed = time.monotonic() - t_start
    print(f"\n测试结束：{len(results)} 题完成，用时 {elapsed / 60:.1f} 分钟")

    # 聚合报告（含续测场景：读全量 JSONL）
    all_results = []
    for line in jsonl_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                all_results.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    meta = {
        "questions_path": str(questions_path),
        "source_types": sorted({s for q in selected for s in q["source_types"]}),
        "question_types": sorted({q["question_type"] for q in selected}),
        "max_n": len(selected),
    }
    report = write_report(all_results, jsonl_path.stem.replace("results_", ""), out_dir, meta)
    print(f"报告已生成：{report}")


if __name__ == "__main__":
    main()
