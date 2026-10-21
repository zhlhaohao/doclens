# -*- coding: utf-8 -*-
"""EnterpriseRAG 单源基准测试（doclens 对话链路 E2E）。

约定（技能 rag-bench 的执行体）：
  * 当前工作目录名 = source_type（如 ``.../EnterpriseRAG-Bench-Data/jira``）
  * 父目录的 ``questions.jsonl`` = 题库
  * 随机抽取 N 题（默认 10）→ 走 /api/chat 取答案 → LLM 裁判对比 gold_answer 打分
  * 产出 Markdown 报告 + 逐题 JSONL 明细（写入语料的数据目录下 benchmarks/）

用法（cwd = 语料目录，如 C:/Users/lianghao/EnterpriseRAG-Bench-Data/jira）：
    python <skills>/rag-bench/scripts/run_bench.py            # 默认抽 10 题
    python <skills>/rag-bench/scripts/run_bench.py --n 20 --seed 42
    python <skills>/rag-bench/scripts/run_bench.py --list     # 只看题库分布

被测实例：自动在 CORTEX_WEB_PORT..+9 间探测 /api/status，取 workdir 与当前目录
一致者；没有匹配实例时报错并给出启动指引（不会误测别的语料）。
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import statistics
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Optional

try:  # Windows 控制台 GBK 会炸掉英文引号/中文，统一 UTF-8 输出
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

SKILL_NAME_DEFAULT = "knowledge-base"
SKILL_MESSAGE_TEMPLATE = (
    "[调用技能: {name}]\n"
    '请先 load_skill("{name}") 加载技能，然后按技能指引处理。\n'
    "\n"
    "{question}\n"
    "\n"
    "（语料为全英文，请全程使用英文回答 / Answer entirely in English.）"
)
PLAIN_MESSAGE_TEMPLATE = (
    "{question}\n"
    "\n"
    "（语料为全英文，请全程使用英文回答 / Answer entirely in English.）"
)

REFS_LINE_RE = re.compile(r"^\s*\d+\.\s+(.+?)\s*$", re.M)
_REFS_SECTION_RE = re.compile(r"^##\s+(参考资料|References)\s*$", re.M)
_TOOL_PATH_RE = re.compile(r"<path>([^<>\n]+?)</path>")
_DOC_LINE_RE = re.compile(r"^文档[:：]\s*(.+?)\s*$", re.M)
_SCORE_RE = re.compile(r"\{[^{}]*\"score\"[^{}]*\}", re.S)

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
    "Judge only factual agreement with the gold answer; ignore verbosity, "
    "formatting and citation style.\n"
    "Respond with ONLY a JSON object: {\"score\": <int 1-10>, \"reason\": \"<one sentence>\"}"
)


# ---------------------------------------------------------------------------
# 小型工具
# ---------------------------------------------------------------------------

def _env(name: str, default: str = "") -> str:
    """进程环境优先，其次 ~/.cortex/.env（GUI 激活 LLM 预设的落点）。"""
    val = os.environ.get(name)
    if val:
        return val
    env_path = Path.home() / ".cortex" / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip()
    return default


def _normcase(p: str | Path) -> str:
    return os.path.normcase(os.path.abspath(str(p)))


def _fmt(x, suffix: str = "") -> str:
    return f"{x:.2f}{suffix}" if x is not None else "—"


def _avg(xs: list[float]) -> Optional[float]:
    return sum(xs) / len(xs) if xs else None


def _pct(part: int, total: int) -> str:
    return f"{part / total * 100:.1f}%（{part}/{total}）" if total else "—"


def data_dir(root: Path) -> Path:
    """语料目录的数据目录（开发版 .cortex / 发行版 .doclens，取已存在者）。"""
    for name in (".doclens", ".cortex"):
        d = root / name
        if d.is_dir():
            return d
    return root / ".doclens"


# ---------------------------------------------------------------------------
# 题库
# ---------------------------------------------------------------------------

def load_questions(path: Path) -> list[dict]:
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def filter_questions(questions: list[dict], source_type: str, include_multi: bool,
                     question_types: Optional[set[str]] = None) -> list[dict]:
    """筛出本语料可作答的题。

    默认只取 ``source_types == [source_type]`` 的纯单源题——跨源题（如
    jira+confluence 的 project_related）需要别的语料，单源语料下必然答不全，
    计入会系统性拉低分数。``--include-multi`` 可放宽为「包含本 source_type」。
    """
    picked = []
    for q in questions:
        sts = set(q.get("source_types") or [])
        if include_multi:
            if source_type not in sts:
                continue
        else:
            if sts != {source_type}:
                continue
        if question_types and q.get("question_type") not in question_types:
            continue
        picked.append(q)
    return picked


# ---------------------------------------------------------------------------
# 被测实例发现
# ---------------------------------------------------------------------------

def _status(base_url: str, timeout: float = 30.0) -> dict:
    with urllib.request.urlopen(base_url.rstrip("/") + "/api/status", timeout=timeout) as r:
        return json.load(r)


def discover_base_url(workdir: Path, override: str = "", allow_mismatch: bool = False,
                      extra_ports: int = 10) -> tuple[str, dict]:
    """找到 workdir 与当前目录一致的 doclens 实例。"""
    candidates: list[str] = []
    if override:
        candidates.append(override.rstrip("/"))
    else:
        base = 7860
        try:
            base = int(_env("CORTEX_WEB_PORT", "7860") or 7860)
        except ValueError:
            pass
        ports = list(dict.fromkeys(list(range(base, base + extra_ports)) + list(range(7860, 7870))))
        candidates = [f"http://127.0.0.1:{p}" for p in ports]

    seen: list[tuple[str, str]] = []
    for url in candidates:
        try:
            st = _status(url)
        except Exception:  # noqa: BLE001
            continue
        wd = str(st.get("workdir") or "")
        if wd and _normcase(wd) == _normcase(workdir):
            return url, st
        seen.append((url, wd))

    if override and override.rstrip("/") in [u for u, _ in seen]:
        st = _status(override)
        if allow_mismatch:
            return override.rstrip("/"), st
        raise SystemExit(
            f"错误：{override} 的 workdir 是 {st.get('workdir')!r}，与当前目录 {str(workdir)!r} 不一致。\n"
            "      基准测试必须在被测语料目录启动的实例上跑；确需跨语料测试请加 --allow-mismatch。"
        )

    lines = [f"错误：未找到 workdir = {workdir} 的 doclens 实例。"]
    if seen:
        lines.append("已探测到的其它实例：")
        lines.extend(f"  - {u}  workdir={wd or '?'}" for u, wd in seen)
    lines.append("")
    lines.append("启动被测实例（后台，隐藏窗口）：")
    lines.append(
        '  CORTEX_NO_BROWSER=1 pwsh -NoProfile -Command "Start-Process -FilePath pwsh '
        f"-ArgumentList '-File','<repo>/start-app.ps1','gui','-C','{workdir}' -WindowStyle Hidden\""
    )
    lines.append("启动后等 /api/status 的 workdir 与 index_building=false 再重跑本脚本。")
    raise SystemExit("\n".join(lines))


# ---------------------------------------------------------------------------
# 对话客户端（复刻前端 chat-view 序列）
# ---------------------------------------------------------------------------

class ChatClient:
    def __init__(self, base_url: str, timeout_s: float = 900.0,
                 question_timeout_s: float = 240.0):
        import httpx  # 延迟导入：--list 等纯本地操作不依赖

        self._base = base_url.rstrip("/")
        self._client = httpx.Client(timeout=timeout_s)
        self._question_timeout_s = question_timeout_s

    def ask(self, question: str, title: str, skill: Optional[str] = SKILL_NAME_DEFAULT) -> dict:
        message = (
            SKILL_MESSAGE_TEMPLATE.format(name=skill, question=question)
            if skill else PLAIN_MESSAGE_TEMPLATE.format(question=question)
        )
        # 1. 建会话（技能会话 mode=skill；纯问答不指定 mode）
        payload = {"type": "chat", "title": title[:60], "preview": question[:100]}
        if skill:
            payload["mode"] = "skill"
        r = self._client.post(f"{self._base}/api/sessions", json=payload)
        r.raise_for_status()
        session_id = r.json()["id"]

        # 2. 用户消息先落库（后端按轮回放依赖此序）
        r = self._client.patch(f"{self._base}/api/sessions/{session_id}", json={
            "items": [{"kind": "message_user",
                       "payload": json.dumps({"content": message}, ensure_ascii=False)}],
        })
        r.raise_for_status()

        # 3. SSE 取流
        t0 = time.monotonic()
        first_token_ms: Optional[float] = None
        tokens: list[str] = []
        tool_calls: list[dict] = []
        tool_results: list[dict] = []
        error: Optional[str] = None

        with self._client.stream("POST", f"{self._base}/api/chat",
                                 json={"message": message, "session_id": session_id}) as resp:
            resp.raise_for_status()
            event_name = ""
            data_buf: list[str] = []
            try:
                for line in resp.iter_lines():
                    if (time.monotonic() - t0) > self._question_timeout_s:
                        error = f"timeout after {self._question_timeout_s:.0f}s"
                        break
                    if line.startswith("event:"):
                        event_name = line[6:].strip()
                    elif line.startswith("data:"):
                        data_buf.append(line[5:].strip())
                    elif line == "":
                        if event_name:
                            try:
                                data = json.loads("".join(data_buf) or "{}")
                            except json.JSONDecodeError:
                                data = {}
                            if event_name == "token" and first_token_ms is None:
                                first_token_ms = (time.monotonic() - t0) * 1000
                            self._consume(event_name, data, tokens, tool_calls, tool_results)
                            if event_name in ("done", "error"):
                                if event_name == "error":
                                    error = str(data.get("detail") or data.get("message") or "unknown")
                                break
                        event_name, data_buf = "", []
            finally:
                # 早退/超时必须显式关流，否则服务端继续生成、连接悬挂
                resp.close()

        if error and error.startswith("timeout"):
            try:
                self._client.post(f"{self._base}/api/chat/stop",
                                  json={"session_id": session_id}, timeout=10)
            except Exception:  # noqa: BLE001
                pass

        return {
            "answer": "".join(tokens),
            "tool_calls": [{"name": tc.get("name"), "input": tc.get("input")} for tc in tool_calls],
            "tool_results": tool_results,
            "first_token_ms": first_token_ms,
            "wall_ms": (time.monotonic() - t0) * 1000,
            "error": error,
            "session_id": session_id,
        }

    @staticmethod
    def _consume(event: str, payload: dict, tokens: list[str],
                 tool_calls: list[dict], tool_results: list[dict]) -> None:
        if event == "token":
            tokens.append(str(payload.get("text", "")))
        elif event == "tool_call":
            tool_calls.append({"name": str(payload.get("name", "")),
                               "input": payload.get("input", {})})
        elif event == "tool_result":
            tool_results.append({"name": str(payload.get("name", "")),
                                 "output": str(payload.get("output", "")),
                                 "is_error": bool(payload.get("is_error"))})

    def close(self) -> None:
        self._client.close()


# ---------------------------------------------------------------------------
# 引用契合度（expected_doc_ids 是文件名前缀 dsid_xxx）
# ---------------------------------------------------------------------------

def extract_cited_paths(answer: str, tool_results: Optional[list[dict]] = None) -> list[str]:
    """提取实际引用/检索到的文档路径（参考资料章节 → 工具轨迹 → 正文兜底）。"""
    cited: list[str] = []
    m = _REFS_SECTION_RE.search(answer or "")
    if m:
        section = answer[m.end():]
        nxt = re.search(r"^##\s", section, re.M)
        if nxt:
            section = section[: nxt.start()]
        cited = [mm.group(1) for mm in REFS_LINE_RE.finditer(section)]

    if not cited and tool_results:
        for tr in tool_results:
            if tr.get("is_error"):
                continue
            out = tr.get("output") or ""
            cited.extend(_TOOL_PATH_RE.findall(out))
            cited.extend(_DOC_LINE_RE.findall(out))

    if not cited:
        for bm in re.finditer(r"`([^`\n]+\.\w{2,4})`", answer or ""):
            p = bm.group(1)
            if "/" in p or "\\" in p:
                cited.append(p)

    seen: set[str] = set()
    return [c for c in cited if not (c in seen or seen.add(c))]


def match_score(cited: list[str], expected_doc_ids: list[str]) -> dict:
    prefixes = {Path(c).name.split("__")[0] for c in cited}
    hits = [d for d in expected_doc_ids if d in prefixes]
    misses = [d for d in expected_doc_ids if d not in prefixes]
    extra = sorted(prefixes - set(expected_doc_ids))
    return {
        "recall": len(hits) / len(expected_doc_ids) if expected_doc_ids else None,
        "precision": len(hits) / len(prefixes) if prefixes else None,
        "hits": hits, "misses": misses, "extra": extra,
    }


# ---------------------------------------------------------------------------
# LLM 裁判
# ---------------------------------------------------------------------------

def _judge_config() -> dict:
    return {
        "protocol": _env("PLANIFY_PROTOCOL", "anthropic"),
        "base_url": _env("PLANIFY_BASE_URL", ""),
        "model_id": _env("PLANIFY_MODEL_ID", ""),
        "api_key": _env("PLANIFY_API_KEY", ""),
    }


def judge_answer(question: dict, candidate: str, judge_model: str = "") -> dict:
    """LLM 裁判对比 gold_answer 打 1-10 分；失败重试 3 次后返回 score=None。"""
    try:
        from planify.core.llm.factory import create_provider
    except ImportError:
        return {"score": None,
                "reason": "cannot import planify —— 请用装有 planify 的解释器运行（见 SKILL.md 环境检查）"}

    cfg = _judge_config()
    if judge_model:
        cfg["model_id"] = judge_model
    user = (
        f"Question:\n{question['question']}\n\n"
        f"Gold answer:\n{question.get('gold_answer', '')}\n\n"
        "Key facts to check:\n"
        + "\n".join(f"- {f}" for f in question.get("answer_facts", []))
        + f"\n\nCandidate answer:\n{(candidate or '')[:8000]}"
    )
    last_err = None
    for _attempt in range(3):
        try:
            provider = create_provider(cfg)
            resp = provider.chat(
                messages=[{"role": "user", "content": user}],
                system=JUDGE_SYSTEM,
                tools=[],
                max_tokens=2000,  # 推理模型会先吃 reasoning token，留足余量
            )
            text = "".join(getattr(b, "text", "") for b in resp.content)
            m = _SCORE_RE.search(text)
            data = None
            if m:
                try:
                    data = json.loads(m.group(0))
                except json.JSONDecodeError:
                    data = None
            if data is None:
                sm = re.search(r'"score"\s*:\s*(\d{1,2})', text)
                data = {"score": int(sm.group(1)), "reason": ""} if sm else None
            if data is not None:
                score = int(data["score"])
                if 1 <= score <= 10:
                    return {"score": score, "reason": str(data.get("reason", "")), "judge_model": cfg["model_id"]}
            last_err = f"unparseable judge output: {text[:200]}"
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        time.sleep(1.5)
    return {"score": None, "reason": f"judge failed: {last_err}", "judge_model": cfg["model_id"]}


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------

def write_report(results: list[dict], out_dir: Path, meta: dict) -> Path:
    ok = [r for r in results if not r.get("chat_error")]
    scores = [r["ai_score"]["score"] for r in ok if r.get("ai_score", {}).get("score") is not None]
    recalls = [r["match"]["recall"] for r in ok if r["match"]["recall"] is not None]
    precisions = [r["match"]["precision"] for r in ok if r["match"]["precision"] is not None]
    walls = [r["wall_ms"] / 1000 for r in ok if r.get("wall_ms")]

    lines: list[str] = []
    lines.append(f"# EnterpriseRAG 基准测试报告 · {meta['source_type']} · {meta['run_id']}")
    lines.append("")
    lines.append(f"- 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- 语料目录：`{meta['workdir']}`")
    lines.append(f"- 题库：`{meta['questions_path']}`")
    lines.append(f"- 抽样：{len(results)} 题（可用池 {meta['pool_size']}，N={meta['n']}，seed={meta['seed']}，"
                 f"跨源题{'包含' if meta['include_multi'] else '排除'}）")
    lines.append(f"- 被测实例：`{meta['base_url']}`（workdir 已校验；索引 {meta['indexed_docs']} 篇，"
                 f"模型 {meta['model_name'] or '?'}）")
    lines.append(f"- 答题模式：{'技能 ' + meta['skill'] if meta['skill'] else '纯问答'}"
                 f"；裁判模型：{meta['judge_model'] or '?'}")
    lines.append(f"- 明细：`{meta['jsonl_path']}`")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append("| 指标 | 值 |")
    lines.append("|------|------|")
    lines.append(f"| AI 评分均值（1-10） | {_fmt(_avg(scores))} |")
    lines.append(f"| AI 评分中位数 | {_fmt(statistics.median(scores)) if scores else '—'} |")
    lines.append(f"| 及格率（评分 ≥7） | {_pct(sum(1 for s in scores if s >= 7), len(scores))} |")
    lines.append(f"| 优秀率（评分 ≥9） | {_pct(sum(1 for s in scores if s >= 9), len(scores))} |")
    lines.append(f"| 引用 recall | {_fmt(_avg(recalls))} |")
    lines.append(f"| 引用 precision | {_fmt(_avg(precisions))} |")
    lines.append(f"| recall=0 题数 | {sum(1 for x in recalls if x == 0)}/{len(recalls)} |")
    lines.append(f"| 平均耗时（s/题） | {_fmt(_avg(walls))} |")
    lines.append(f"| 对话失败 | {len(results) - len(ok)}/{len(results)} |")
    lines.append(f"| 评分失败 | {len(ok) - len(scores)}/{len(ok)} |")
    lines.append("")

    if scores:
        buckets = [("9-10", 9, 10), ("7-8", 7, 8), ("4-6", 4, 6), ("1-3", 1, 3)]
        lines.append("## 评分分布")
        lines.append("")
        lines.append("| 区间 | 题数 | 占比 |")
        lines.append("|------|------|------|")
        for label, lo, hi in buckets:
            c = sum(1 for s in scores if lo <= s <= hi)
            lines.append(f"| {label} | {c} | {_pct(c, len(scores))} |")
        lines.append("")

    lines.append("## 逐题明细")
    lines.append("")
    lines.append("| # | 题号 | 类型 | 评分 | recall | precision | 耗时s | 裁判理由 |")
    lines.append("|---|------|------|------|--------|-----------|-------|----------|")
    for i, r in enumerate(results, 1):
        score = r.get("ai_score", {}).get("score")
        reason = (r.get("ai_score", {}).get("reason") or "").replace("\n", " ").replace("|", "\\|")
        lines.append(
            f"| {i} | {r['question_id']} | {r.get('question_type', '')} | "
            f"{score if score is not None else '失败'} | "
            f"{_fmt(r['match']['recall'])} | {_fmt(r['match']['precision'])} | "
            f"{_fmt((r.get('wall_ms') or 0) / 1000)} | {reason[:100]} |"
        )
    lines.append("")

    low = [r for r in results if (r.get("ai_score", {}).get("score") or 99) <= 5]
    if low:
        lines.append("## 低分题诊断（≤5 分）")
        lines.append("")
        for r in low:
            lines.append(f"### {r['question_id']}（{r.get('question_type', '')}，{r['ai_score']['score']} 分）")
            lines.append("")
            lines.append(f"- 问题：{r['question']}")
            lines.append(f"- 金标：{(r.get('gold_answer') or '')[:400]}")
            lines.append(f"- 裁判：{r['ai_score'].get('reason', '')}")
            lines.append(f"- 命中/缺失：hits={len(r['match']['hits'])} / misses={len(r['match']['misses'])}")
            lines.append(f"- 答案摘录：{(r.get('answer') or '')[:600].strip() or '（空）'}")
            lines.append("")

    failed = [r for r in results if r.get("chat_error")]
    if failed:
        lines.append("## 失败题清单")
        lines.append("")
        for r in failed:
            lines.append(f"- **{r['question_id']}**：{r['chat_error']}")
        lines.append("")

    judge_failed = [r for r in ok if r.get("ai_score", {}).get("score") is None]
    if judge_failed:
        lines.append("## 评分失败清单")
        lines.append("")
        for r in judge_failed:
            lines.append(f"- **{r['question_id']}**：{r['ai_score'].get('reason', '')[:200]}")
        lines.append("")

    path = out_dir / f"report_{meta['run_id']}.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description="EnterpriseRAG 单源基准测试（cwd 名 = source_type，父目录 questions.jsonl）")
    ap.add_argument("--n", type=int, default=10, help="随机抽样题数（默认 10）")
    ap.add_argument("--seed", type=int, default=None, help="随机种子（记录到报告，便于复现）")
    ap.add_argument("--source-type", default="", help="覆盖 cwd 推导的 source_type")
    ap.add_argument("--questions", default="", help="覆盖题库路径（默认 ../questions.jsonl）")
    ap.add_argument("--base-url", default="", help="被测实例地址（默认自动探测）")
    ap.add_argument("--allow-mismatch", action="store_true", help="允许实例 workdir 与 cwd 不一致")
    ap.add_argument("--out-dir", default="", help="结果目录（默认 <语料>/.doclens/benchmarks）")
    ap.add_argument("--resume", default="", help="续测已有 results_*.jsonl")
    ap.add_argument("--include-multi", action="store_true",
                    help="纳入跨源题（source_types 含本源）——默认只取纯单源题")
    ap.add_argument("--question-type", default="", help="只测某类题型（逗号分隔，如 basic,semantic）")
    ap.add_argument("--skill", default=SKILL_NAME_DEFAULT, help=f"答题技能（默认 {SKILL_NAME_DEFAULT}；空串=纯问答）")
    ap.add_argument("--timeout", type=float, default=240.0, help="单题墙钟超时秒数（默认 240）")
    ap.add_argument("--judge-model", default="", help="裁判模型 id（默认同被测 PLANIFY_MODEL_ID）")
    ap.add_argument("--no-judge", action="store_true", help="跳过 LLM 评分（只测引用与耗时）")
    ap.add_argument("--list", action="store_true", help="只打印题库分布，不跑测")
    args = ap.parse_args()

    workdir = Path.cwd().resolve()
    source_type = args.source_type or workdir.name
    questions_path = Path(args.questions) if args.questions else workdir.parent / "questions.jsonl"

    if not questions_path.exists():
        raise SystemExit(f"错误：题库不存在：{questions_path}\n"
                         "      约定：cwd 为 source_type 目录（如 .../jira），父目录放 questions.jsonl。")

    questions = load_questions(questions_path)
    types = {t for t in (args.question_type.split(",") if args.question_type else []) if t.strip()}
    pool = filter_questions(questions, source_type, args.include_multi, types or None)

    if args.list:
        from collections import Counter
        by_src = Counter()
        for q in questions:
            for s in q.get("source_types") or []:
                by_src[s] += 1
        print(f"题库：{questions_path}（{len(questions)} 题）")
        print("按 source_type：" + "，".join(f"{k}={v}" for k, v in by_src.most_common()))
        print(f"本目录 source_type = {source_type!r}，纯单源题 {len(filter_questions(questions, source_type, False, types or None))} 题，"
              f"含跨源 {len(filter_questions(questions, source_type, True, types or None))} 题")
        print("题型分布：" + "，".join(f"{k}={v}" for k, v in
                                   Counter(q["question_type"] for q in pool).most_common()))
        return

    if not pool:
        raise SystemExit(f"错误：题库中没有 source_types == ['{source_type}'] 的题。"
                         "可加 --include-multi 放宽，或检查目录名/--source-type。")

    n = max(1, min(args.n, len(pool)))
    seed = args.seed if args.seed is not None else random.randrange(1_000_000)
    rng = random.Random(seed)
    selected = rng.sample(pool, n)

    # 被测实例（先校验 workdir，避免测错语料）
    base_url, status = discover_base_url(workdir, args.base_url, args.allow_mismatch)
    if status.get("index_building"):
        raise SystemExit("错误：被测实例仍在建索引（index_building=true），请等索引完成后再跑。")
    indexed = status.get("indexed_docs")
    model_name = status.get("model_name") or ""
    print(f"实例 {base_url}  workdir={status.get('workdir')}  已索引 {indexed} 篇  模型 {model_name}")
    print(f"抽样 {n}/{len(pool)} 题（source_type={source_type}, seed={seed}）")

    out_dir = Path(args.out_dir) if args.out_dir else data_dir(workdir) / "benchmarks"
    out_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    jsonl_path = Path(args.resume) if args.resume else out_dir / f"results_{run_id}.jsonl"

    done_ids: set[str] = set()
    if jsonl_path.exists():
        for line in jsonl_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                try:
                    done_ids.add(json.loads(line)["question_id"])
                except json.JSONDecodeError:
                    pass
        if done_ids:
            print(f"续测：{jsonl_path.name} 已有 {len(done_ids)} 题，跳过")

    pending = [q for q in selected if q["question_id"] not in done_ids]
    if not pending:
        print("所选题目均已完成。")
    else:
        print(f"结果实时追加至 {jsonl_path}\n")
        client = ChatClient(base_url, question_timeout_s=args.timeout)
        t_start = time.monotonic()
        try:
            for i, q in enumerate(pending, 1):
                title = f"bench-{source_type} · {q['question'][:40]}"
                try:
                    chat = client.ask(q["question"], title, args.skill or None)
                except Exception as e:  # noqa: BLE001
                    chat = {"answer": "", "tool_calls": [], "tool_results": [],
                            "first_token_ms": None, "wall_ms": None,
                            "error": f"{type(e).__name__}: {e}", "session_id": None}

                cited = extract_cited_paths(chat.get("answer") or "", chat.get("tool_results"))
                match = match_score(cited, q.get("expected_doc_ids", []))
                failed = bool(chat.get("error"))
                if failed or args.no_judge:
                    ai_score = {"score": None,
                                "reason": f"failed: {chat.get('error')}" if failed else "no-judge"}
                else:
                    ai_score = judge_answer(q, chat.get("answer") or "", args.judge_model)

                record = {
                    "question_id": q["question_id"],
                    "question_type": q.get("question_type"),
                    "source_types": q.get("source_types"),
                    "question": q["question"],
                    "expected_doc_ids": q.get("expected_doc_ids", []),
                    "gold_answer": q.get("gold_answer", ""),
                    "answer_facts": q.get("answer_facts", []),
                    "answer": chat.get("answer") or "",
                    "cited_paths": cited,
                    "match": {k: match[k] for k in ("recall", "precision", "hits", "misses", "extra")},
                    "ai_score": ai_score,
                    "wall_ms": chat.get("wall_ms"),
                    "first_token_ms": chat.get("first_token_ms"),
                    "chat_error": chat.get("error"),
                    "tool_calls": chat.get("tool_calls"),
                    "tool_result_names": [tr.get("name") for tr in chat.get("tool_results") or []],
                    "session_id": chat.get("session_id"),
                    "ts": datetime.now().isoformat(timespec="seconds"),
                }
                with open(jsonl_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")

                print(f"[{i}/{len(pending)}] {q['question_id']} "
                      f"{'✗' if failed else '✓'} "
                      f"score={ai_score['score'] if ai_score['score'] is not None else 'N/A'} "
                      f"recall={_fmt(match['recall'])} precision={_fmt(match['precision'])} "
                      f"{(chat.get('wall_ms') or 0) / 1000:.0f}s", flush=True)
        except KeyboardInterrupt:
            print("\n中断——已完成结果已落盘，可用 --resume 续测。", flush=True)
        finally:
            client.close()
        print(f"\n本轮用时 {(time.monotonic() - t_start) / 60:.1f} 分钟")

    # 聚合报告（含续测：读全量 JSONL）
    all_results: list[dict] = []
    for line in jsonl_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                all_results.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    if not all_results:
        print("没有可汇总的结果。")
        return

    meta = {
        "run_id": jsonl_path.stem.replace("results_", ""),
        "source_type": source_type,
        "workdir": str(workdir),
        "questions_path": str(questions_path),
        "pool_size": len(pool),
        "n": n,
        "seed": seed,
        "include_multi": args.include_multi,
        "base_url": base_url,
        "indexed_docs": indexed,
        "model_name": model_name,
        "skill": args.skill,
        "judge_model": (all_results[0].get("ai_score") or {}).get("judge_model", "") if all_results else "",
        "jsonl_path": str(jsonl_path),
    }
    report = write_report(all_results, out_dir, meta)
    print(f"报告：{report}")

    # 终端速览（技能据此向用户汇报）
    scores = [r["ai_score"]["score"] for r in all_results
              if not r.get("chat_error") and (r.get("ai_score") or {}).get("score") is not None]
    if scores:
        print(f"评分均值 {_avg(scores):.2f} / 中位数 {statistics.median(scores):.1f} / "
              f"≥7 分 {sum(1 for s in scores if s >= 7)}/{len(scores)}")


if __name__ == "__main__":
    main()
