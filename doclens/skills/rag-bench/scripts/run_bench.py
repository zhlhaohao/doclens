# -*- coding: utf-8 -*-
"""EnterpriseRAG 单源基准测试——真实 UI 问答评测（技能 rag-bench 的执行体）。

问答不走 API、不走子代理：由 playwright-cli 驱动真实浏览器，在 Web UI 的
chat 视图逐题提问（真实 RAG 全链路）。两阶段：问答完成先出预览报告（无评分），
用户说「开始评分」后主代理逐题在线评分，再出终报。

**无默认值纪律**：测试方案（题数/题型/源）必须由用户明确——参数不齐全时
脚本拒绝执行并列出缺什么；不带任何参数时只打印题库统计（等价 stats）。

子命令：
  stats  打印题库统计（题型分布表 + source_type 单源题数表）
  pick   抽题：--n/--question-type/--out-dir 全部必填，缺一拒绝
  run    并发问答：--pick/--out-dir 必填；--workers/--timeout 可选
  ask    单题调试：--pick/--qidx/--out-dir 必填
  report 解析评分后的 answers md 出终报：--answers 必填

产物均落 --out-dir（AI 助手 data dir 下 benchmarks/），便于审查。
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import random
import re
import shutil
import statistics
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Optional

try:  # Windows 控制台 GBK 兜底
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

BENCH_SUBDIR = "benchmarks"

# 题型说明（题库全量口径；分布表用）
QUESTION_TYPE_DESC = [
    ("basic", "单一事实"),
    ("semantic", "语义理解"),
    ("intra_document_reasoning", "文档内推理"),
    ("project_related", "跨源项目题（多为跨源）"),
    ("constrained", "约束条件"),
    ("conflicting_info", "信息冲突"),
    ("completeness", "完整性"),
    ("miscellaneous", "杂项"),
    ("info_not_found", "应答“查不到”（评分特例）"),
    ("high_level", "高层概括"),
]

ANSWER_SECTION_RE = re.compile(
    r"^##\s+(?P<qid>qst_\d+)\s*\n(?P<body>.*?)(?=^##\s+qst_\d+\s*$|\Z)",
    re.M | re.S,
)


class RunTimeout(Exception):
    """子进程超时（强杀后抛出，含部分输出）。"""

    def __init__(self, cmd: list[str], timeout: float, out: str):
        super().__init__(f"timeout after {timeout:.0f}s: {' '.join(cmd[:3])}…")
        self.out = out


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------

def _fmt(x, suffix: str = "") -> str:
    return f"{x:.2f}{suffix}" if x is not None else "—"


def _avg(xs: list[float]) -> Optional[float]:
    return sum(xs) / len(xs) if xs else None


def _pct(part: int, total: int) -> str:
    return f"{part / total * 100:.1f}%（{part}/{total}）" if total else "—"


def _run(cmd: list[str], timeout: float = 120.0, on_timeout: str = "raise") -> tuple[int, str]:
    """跑子进程；到点强杀。on_timeout='raise' 抛 RunTimeout；'ignore' 返回 rc=-1。"""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired as e:
        out = ""
        for chunk in (e.stdout, e.stderr):
            if isinstance(chunk, bytes):
                out += chunk.decode("utf-8", errors="replace")
            elif chunk:
                out += str(chunk)
        if on_timeout == "ignore":
            return -1, out
        raise RunTimeout(cmd, timeout, out) from None
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def _resolve_pw(pw_bin: str) -> list[str]:
    pw = pw_bin.split()
    if not Path(pw[0]).is_file():
        resolved = shutil.which(pw[0])
        if resolved:
            pw[0] = resolved
    return pw


def acquire_run_lock(bench: Path, run_id: str) -> Path:
    """同 run_id 并发防护：30 分钟内的活跃锁直接拒绝（防两个 run 进程互踢浏览器）。"""
    lock = bench / f".run_{run_id}.lock"
    if lock.exists():
        age = time.time() - lock.stat().st_mtime
        if age < 1800:
            raise SystemExit(
                f"错误：run {run_id} 疑似已在运行（锁文件 {lock}，{age:.0f}s 前创建）。\n"
                "      不要重复发起同一 run——先 check_background 确认状态；"
                "确认无实例后删除锁文件再重跑。")
    lock.write_text(str(os.getpid()), encoding="utf-8")
    return lock


def data_dir(root: Path) -> Path:
    """语料目录的数据目录（.cortex/.doclens 取已存在者）。"""
    for name in (".cortex", ".doclens"):
        d = root / name
        if d.is_dir():
            return d
    return root / ".cortex"


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
    """默认只取 source_types == [source_type] 的纯单源题。--include-multi 放宽。"""
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
# stats：题库统计
# ---------------------------------------------------------------------------

def print_stats(questions_path: Path) -> None:
    questions = load_questions(questions_path)
    by_type = Counter(q.get("question_type", "") for q in questions)
    by_src_pure = Counter(next(iter(q["source_types"]))
                          for q in questions if len(q.get("source_types") or []) == 1)
    desc = dict(QUESTION_TYPE_DESC)

    print("## 题型分布")
    print()
    print("| 题型 | 全库题数 | 说明 |")
    print("|------|---------|------|")
    for t, _d in QUESTION_TYPE_DESC:
        print(f"| {t} | {by_type.get(t, 0)} | {desc[t]} |")
    for t, c in by_type.most_common():  # 表外新题型追加，防静默丢数
        if t not in desc:
            print(f"| {t} | {c} | — |")
    print()
    print("## source_type 单源题数")
    print()
    print("| source_type | 单源题数 |")
    print("|------|---------|")
    for s, c in by_src_pure.most_common():
        print(f"| {s} | {c} |")


def cmd_stats(args: argparse.Namespace) -> None:
    questions_path = Path(args.questions) if args.questions else Path.cwd().resolve().parent / "questions.jsonl"
    if not questions_path.exists():
        raise SystemExit(f"错误：题库不存在：{questions_path}")
    print_stats(questions_path)


# ---------------------------------------------------------------------------
# pick：抽题（方案必须明确）
# ---------------------------------------------------------------------------

def _require(params: dict[str, tuple[bool, str]], usage_hint: str) -> None:
    """缺必填参数时统一报错：列出缺失项与用法提示（无默认值纪律）。"""
    missing = [hint for ok, hint in params.values() if not ok]
    if missing:
        raise SystemExit("错误：测试方案不完整，缺以下参数（不提供默认值，须由用户明确）：\n"
                         + "\n".join(f"  - {m}" for m in missing)
                         + f"\n{usage_hint}")


def cmd_pick(args: argparse.Namespace) -> None:
    _require({
        "--n": (args.n is not None, "--n <题数>：抽多少题（用户明确）"),
        "--question-type": (bool(args.question_type),
                            "--question-type basic,semantic：测哪些题型（用户明确；全部题型传 all）"),
        "--out-dir": (bool(args.out_dir), "--out-dir <AI 助手 data dir>/benchmarks：产物目录"),
    }, "用法：pick --n 10 --question-type basic,semantic --out-dir <dir> [--seed 42]")

    workdir = Path.cwd().resolve()
    questions_path = Path(args.questions) if args.questions else workdir.parent / "questions.jsonl"
    if not questions_path.exists():
        raise SystemExit(f"错误：题库不存在：{questions_path}\n"
                         "      约定：cwd 为 source_type 目录，父目录放 questions.jsonl。")

    # source_type：显式 > 运行实例 workdir > cwd 兜底
    source_type = args.source_type
    if not source_type:
        try:
            with urllib.request.urlopen(f"{args.status_url.rstrip('/')}/api/status", timeout=5) as r:
                wd = str(json.load(r).get("workdir") or "")
            if wd:
                source_type = Path(wd).name
        except Exception:  # noqa: BLE001
            pass
    if not source_type:
        source_type = workdir.name

    questions = load_questions(questions_path)
    types = ({t.strip() for t in args.question_type.split(",") if t.strip()}
             if args.question_type.lower() != "all" else set())

    # 题型校验：拼错/不存在直接报错并列出本源可用题型
    available = Counter(q["question_type"] for q in
                        filter_questions(questions, source_type, args.include_multi))
    if types:
        bad = types - set(available)
        if bad:
            raise SystemExit(
                f"错误：题型 {sorted(bad)} 不在本 source_type 的题池中。\n"
                f"      可用题型（{source_type}）："
                + "，".join(f"{k}={v}" for k, v in available.most_common()))

    pool = filter_questions(questions, source_type, args.include_multi, types or None)
    if not pool:
        raise SystemExit(f"错误：题池为空（source_type={source_type}，types={sorted(types) or 'all'}）。"
                         "可 --include-multi 放宽，或检查题型组合。")

    n = max(1, min(args.n, len(pool)))
    seed = args.seed if args.seed is not None else random.randrange(1_000_000)
    selected = random.Random(seed).sample(pool, n)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    pick_path = out_dir / f"pick_{run_id}.json"
    pick_path.write_text(json.dumps({
        "run_id": run_id, "source_type": source_type, "seed": seed, "n": n,
        "pool_size": len(pool), "include_multi": args.include_multi,
        "question_types": sorted(types) or None,
        "questions_path": str(questions_path), "questions": selected,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"run_id: {run_id}")
    print(f"seed: {seed}")
    print(f"抽样 {n}/{len(pool)} 题（source_type={source_type}，"
          f"题型={'all' if not types else ','.join(sorted(types))}，"
          f"跨源题{'包含' if args.include_multi else '排除'}）")
    print(f"抽题清单：{pick_path}")
    print()
    print("## 任务清单（逐条 task_create）")
    for i, q in enumerate(selected, 1):
        print(f"- [{q['question_id']}] [{q.get('question_type', '')}] {q['question'][:80]}"
              f"{'…' if len(q['question']) > 80 else ''}")
    print()
    print("answers md 模板（评分阶段逐题追加；引用/耗时从 RESULTS_JSONL 抄）：")
    print(f"# RAG 基准测试作答 · {source_type} · run {run_id}")
    print("## qst_xxxx")
    print("**评分**：x/10 —— <理由>")
    print("**引用**：recall=0.50 precision=0.33")
    print("**耗时**：61.2s")
    print("**回答**：")
    print("<UI 真实回答正文>")


# ---------------------------------------------------------------------------
# ask：playwright-cli 驱动单题问答
# ---------------------------------------------------------------------------

ASK_JS_TEMPLATE = """\
async page => {
  const q = {question};
  const maxWaitMs = {timeout_ms};
  const t0 = Date.now();

  const curHash = await page.evaluate(() => location.hash);
  if (!curHash.startsWith('#/chat')) {
    await page.evaluate(() => { location.hash = '#/chat'; });
    await page.waitForTimeout(600);
  }

  await page.evaluate((question) => {
    const sr = document.querySelector('cortex-app').shadowRoot;
    const cv = sr.querySelector('chat-view:not([hidden])') || sr.querySelector('chat-view');
    const ib = cv.renderRoot.querySelector('input-box');
    const ta = ib.renderRoot.querySelector('textarea') || ib.renderRoot.querySelector('input');
    ta.value = question;
    ta.dispatchEvent(new InputEvent('input', {bubbles: true, composed: true}));
    return ta.value.length;
  }, q);
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const sr = document.querySelector('cortex-app').shadowRoot;
    const cv = sr.querySelector('chat-view:not([hidden])') || sr.querySelector('chat-view');
    const ib = cv.renderRoot.querySelector('input-box');
    // 发送主键：排除 stop/caret/attach
    const cls = (b) => (' ' + b.className + ' ');
    const btn = [...ib.renderRoot.querySelectorAll('button')]
      .find(b => !b.disabled && cls(b).indexOf(' stop ') < 0 && cls(b).indexOf(' caret ') < 0
                  && cls(b).indexOf(' attach ') < 0
                  && b.getAttribute('aria-label') !== '停止生成');
    if (btn) btn.click();
  });

  // 等流结束：textarea 解锁（后端 done 才解锁）= 权威完成信号
  const readState = () => page.evaluate(() => {
    const sr = document.querySelector('cortex-app').shadowRoot;
    const cv = sr.querySelector('chat-view:not([hidden])') || sr.querySelector('chat-view');
    const ib = cv.renderRoot.querySelector('input-box');
    const taEl = ib ? ib.renderRoot.querySelector('textarea') : null;
    const cs = cv.renderRoot.querySelector('chat-stream');
    if (!cs || !cs.shadowRoot) return {disabled: true, hasDisabledBit: !!taEl, role: '', content: ''};
    const msgs = cs.shadowRoot.querySelectorAll('chat-message');
    const last = msgs[msgs.length - 1];
    if (!last || !last.renderRoot) return {disabled: taEl ? taEl.disabled : true, hasDisabledBit: !!taEl, role: '', content: ''};
    const md = last.renderRoot.querySelector('.md-body');
    return {
      disabled: taEl ? taEl.disabled : true,
      hasDisabledBit: !!taEl,
      role: last.getAttribute('role') || '',
      content: md ? md.innerText : '',
    };
  });

  const deadline = t0 + maxWaitMs;
  let lastLen = -1, stableSince = 0;
  const finish = (obj) => '{payload_b64}' + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  while (Date.now() < deadline) {
    await page.waitForTimeout(400);
    const st = await readState();
    if (st.role === 'assistant' && st.content && !st.content.includes('思考中')) {
      if (st.hasDisabledBit) {
        if (!st.disabled) {
          return finish({ok: true, answer: st.content, wall_ms: Date.now() - t0});
        }
      } else if (st.content.length === lastLen) {
        if (Date.now() - stableSince > 1500) {
          return finish({ok: true, answer: st.content, wall_ms: Date.now() - t0});
        }
      } else {
        lastLen = st.content.length;
        stableSince = Date.now();
      }
    }
  }
  return finish({ok: false, error: 'timeout', wall_ms: Date.now() - t0});
}
"""


def _js_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def _latest_session_id(base_url: str) -> Optional[str]:
    try:
        with urllib.request.urlopen(
                f"{base_url.rstrip('/')}/api/sessions?type=chat&limit=1", timeout=15) as r:
            ss = json.load(r).get("sessions") or []
        return ss[0]["id"] if ss else None
    except Exception:  # noqa: BLE001
        return None


def ask_one(pw: list[str], session: str, url: str, question: str,
            timeout_s: float, tmp_js: Path, keep_open: bool = False) -> dict:
    """在指定浏览器会话提 1 题并等回答。返回 {ok, answer, wall_ms, error?}。"""
    js = ASK_JS_TEMPLATE.replace("{question}", _js_str(question)) \
                        .replace("{timeout_ms}", str(int(timeout_s * 1000)))
    tmp_js.parent.mkdir(parents=True, exist_ok=True)
    tmp_js.write_text(js, encoding="utf-8")

    def pw_run(sub: list[str], timeout: float = 120.0) -> tuple[int, str]:
        try:
            return _run(pw + ["-s=" + session] + sub, timeout)
        except FileNotFoundError:
            raise SystemExit(f"错误：找不到 {pw[0]}。确认已安装（npm install -g @playwright-cli@latest）。")

    rc, out = pw_run(["open", url + "/#/chat"], timeout=90)
    if rc != 0 and "already" not in out.lower():
        return {"ok": False, "error": f"open 失败：{out[:300]}", "answer": "", "wall_ms": None}
    pw_run(["goto", url + "/#/chat"], timeout=60)

    before_top = _latest_session_id(url)
    t0 = time.monotonic()
    try:
        rc, out = _run(pw + ["-s=" + session, "run-code", "--filename", str(tmp_js)],
                       timeout=timeout_s)
        timed_out = False
    except RunTimeout as e:
        rc, out = -1, e.out
        timed_out = True
    shell_ms = int((time.monotonic() - t0) * 1000)
    tmp_js.unlink(missing_ok=True)

    m = re.search(r"\{payload_b64\}([A-Za-z0-9+/=]+)", out)
    if timed_out or not m:
        reason = (f"超时 {timeout_s:.0f}s 强杀（回答失败）" if timed_out
                  else f"run-code 无有效返回：{out[:200]}")
        if not keep_open:
            pw_run(["close"], timeout=30)
        return {"ok": False, "error": reason, "answer": "",
                "wall_ms": shell_ms if timed_out else None, "shell_ms": shell_ms}
    try:
        result = json.loads(base64.b64decode(m.group(1)).decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"payload 解码失败：{e}", "answer": "",
                "wall_ms": None, "shell_ms": shell_ms}
    result["shell_ms"] = shell_ms
    if not result.get("ok"):
        result.setdefault("answer", "")
    else:
        after_top = _latest_session_id(url)
        if after_top and after_top != before_top:
            result["session_id"] = after_top
    if not keep_open:
        pw_run(["close"], timeout=30)
    return result


def fetch_session_refs(base_url: str, session_id: Optional[str],
                       answer_text: str, retries: int = 3,
                       retry_delay_s: float = 2.0) -> list[str]:
    """提取一次问答实际引用/检索到的文档路径。

    优先级：正文「参考资料」章节 → 会话 tool_trace → 正文反引号兜底。
    tool_trace 落库滞后于流结束：重试至提取数稳定（连续两次一致），
    避免读到了金标文档却判 recall=0 的假阴性。"""
    cited: list[str] = []
    m = re.search(r"^##\s+(参考资料|References)\s*$", answer_text or "", re.M)
    if m:
        section = answer_text[m.end():]
        nxt = re.search(r"^##\s", section, re.M)
        if nxt:
            section = section[:nxt.start()]
        cited = [mm.group(1) for mm in re.finditer(r"^\s*\d+\.\s+(.+?)\s*$", section, re.M)]

    if not cited and session_id:
        prev: list[str] = []
        for attempt in range(max(1, retries)):
            try:
                with urllib.request.urlopen(
                        f"{base_url.rstrip('/')}/api/sessions/{session_id}",
                        timeout=30) as r:
                    detail = json.load(r)
                batch: list[str] = []
                for it in detail.get("items") or []:
                    if it.get("kind") != "tool_trace":
                        continue
                    try:
                        tr = json.loads(it.get("payload") or "{}")
                    except json.JSONDecodeError:
                        continue
                    if tr.get("name") == "search_kb":
                        batch.extend(re.findall(r"<path>([^<>\n]+?)</path>",
                                                str(tr.get("output") or "")))
                    elif tr.get("name") == "read_document":
                        p = (tr.get("input") or {}).get("path")
                        if p:
                            batch.append(str(p))
                seen: set[str] = set()
                batch = [c for c in batch if not (c in seen or seen.add(c))]
                if batch and len(batch) == len(prev):
                    return batch
                prev = batch
                if attempt < max(1, retries) - 1:
                    time.sleep(retry_delay_s)
            except Exception:  # noqa: BLE001
                if attempt < max(1, retries) - 1:
                    time.sleep(retry_delay_s)
        if prev:
            return prev

    if not cited:
        for bm in re.finditer(r"`([^`\n]+\.\w{2,4})`", answer_text or ""):
            p = bm.group(1)
            if "/" in p or "\\" in p:
                cited.append(p)

    seen: set[str] = set()
    return [c for c in cited if not (c in seen or seen.add(c))]


def ref_metrics(cited: list[str], expected_doc_ids: list[str]) -> dict:
    prefixes = {Path(c).name.split("__")[0] for c in cited}
    hits = [d for d in expected_doc_ids if d in prefixes]
    return {
        "recall": (len(hits) / len(expected_doc_ids)) if expected_doc_ids else None,
        "precision": (len(hits) / len(prefixes)) if prefixes else None,
        "hits": hits,
        "misses": [d for d in expected_doc_ids if d not in prefixes],
        "n_cited_docs": len(prefixes),
    }


def cmd_ask(args: argparse.Namespace) -> None:
    _require({
        "--pick": (bool(args.pick), "--pick <pick json>：抽题清单"),
        "--qidx": (args.qidx is not None, "--qidx <0-based 下标>：哪一题"),
        "--out-dir": (bool(args.out_dir), "--out-dir <dir>：产物目录"),
    }, "用法：ask --pick <pick json> --qidx 0 --out-dir <dir> [--url ...] [--timeout N]")

    workdir = Path.cwd().resolve()
    pick = json.loads(Path(args.pick).read_text(encoding="utf-8"))
    qs = pick["questions"]
    if not (0 <= args.qidx < len(qs)):
        raise SystemExit(f"错误：--qidx 越界（0..{len(qs) - 1}）")
    q = qs[args.qidx]

    question = f"/knowledge-base {q['question']}\n\n（语料为全英文，请全程使用英文回答 / Answer entirely in English.）"
    tmp_dir = data_dir(workdir) / "tmp"
    result = ask_one(_resolve_pw(args.pw_bin), f"bench-{pick['run_id']}-{args.qidx}",
                     args.url.rstrip("/"), question, args.timeout,
                     tmp_dir / f"bench_ask_{pick['run_id']}_{args.qidx}.js")

    if not result.get("ok"):
        raise SystemExit(f"错误：第 {args.qidx} 题（{q['question_id']}）问答失败：{result.get('error')}")

    cited = fetch_session_refs(args.url, result.get("session_id"), result.get("answer") or "")
    metrics = ref_metrics(cited, q.get("expected_doc_ids", []))
    print(json.dumps({
        "question_id": q["question_id"], "question": q["question"],
        "answer": result["answer"], "wall_ms": result.get("wall_ms"),
        "session_id": result.get("session_id"),
        "cited_n": metrics["n_cited_docs"], "recall": metrics["recall"],
        "precision": metrics["precision"], "ref_misses": metrics["misses"],
    }, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# run：并发问答
# ---------------------------------------------------------------------------

def write_preview(pick: dict, rows: list[dict], jsonl_path: Path) -> Path:
    run_id = pick["run_id"]
    ok = [x for x in rows if x["ok"]]
    recalls = [x["recall"] for x in rows if x["recall"] is not None]
    precisions = [x["precision"] for x in rows if x["precision"] is not None]
    walls = [x["wall_ms"] / 1000 for x in rows if x.get("wall_ms")]

    lines: list[str] = []
    lines.append(f"# EnterpriseRAG 基准测试 · 预览报告（未评分） · {pick['source_type']} · {run_id}")
    lines.append("")
    lines.append(f"- 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- 抽样：{len(rows)} 题（可用池 {pick['pool_size']}，N={pick['n']}，seed={pick['seed']}，"
                 f"跨源题{'包含' if pick['include_multi'] else '排除'}）")
    lines.append("- 问答通道：真实 Web UI（playwright-cli 驱动 chat 视图）")
    lines.append(f"- 结果明细：`{jsonl_path}`")
    lines.append("")
    lines.append("## 速览")
    lines.append("")
    lines.append("| 指标 | 值 |")
    lines.append("|------|------|")
    lines.append(f"| 问答成功 | {len(ok)}/{len(rows)} |")
    lines.append(f"| 引用 recall 均值 | {_fmt(_avg(recalls))} |")
    lines.append(f"| 引用 precision 均值 | {_fmt(_avg(precisions))} |")
    lines.append(f"| recall=0 题数 | {sum(1 for x in recalls if x == 0)}/{len(recalls)} |")
    lines.append(f"| 回答耗时均值 | {_fmt(_avg(walls), 's')}（最慢 {_fmt(max(walls) if walls else None, 's')}） |")
    lines.append("| AI 评分 | 待评分（用户确认后进行） |")
    lines.append("")
    lines.append("## 逐题预览")
    for i, x in enumerate(rows, 1):
        lines.append("")
        lines.append(f"### {i}. {x['question_id']}（{x.get('qtype', '')}，"
                     f"recall {_fmt(x['recall'])}，耗时 {_fmt((x.get('wall_ms') or 0) / 1000, 's')}）")
        lines.append("")
        lines.append(f"- 问题：{x['question']}")
        lines.append(f"- 金标：{(x['gold_answer'] or '')[:300]}")
        if x["ref_misses"]:
            lines.append(f"- 未命中金标文档：{', '.join(x['ref_misses'])}")
        if not x["ok"]:
            lines.append(f"- **问答失败**：{x.get('error')}")
        else:
            lines.append(f"- 回答：{(x['answer'] or '')[:800].strip() or '（空）'}")
    lines.append("")
    path = jsonl_path.parent / f"preview_{run_id}.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def cmd_run(args: argparse.Namespace) -> None:
    _require({
        "--pick": (bool(args.pick), "--pick <pick json>：抽题清单"),
        "--out-dir": (bool(args.out_dir), "--out-dir <dir>：产物目录"),
    }, "用法：run --pick <pick json> --all --workers 3 --timeout 120 --out-dir <dir>")

    from concurrent.futures import ThreadPoolExecutor, as_completed

    workdir = Path.cwd().resolve()
    pick = json.loads(Path(args.pick).read_text(encoding="utf-8"))
    qs = pick["questions"]
    idxs = list(range(len(qs))) if args.all else list(range(min(args.n, len(qs))))
    workers = max(1, min(args.workers, len(idxs)))

    pw = _resolve_pw(args.pw_bin)
    url = args.url.rstrip("/")
    tmp_dir = data_dir(workdir) / "tmp"

    bench = Path(args.out_dir)
    bench.mkdir(parents=True, exist_ok=True)
    lock = acquire_run_lock(bench, pick["run_id"])
    jsonl_path = bench / f"results_{pick['run_id']}.jsonl"
    print(f"并发 {workers} worker × {len(idxs)} 题（url={url}）", flush=True)

    results: dict[int, dict] = {}

    def worker_loop(wid: int, queue: list[int]) -> None:
        session = f"bench-{pick['run_id']}-w{wid}"
        for i in queue:
            q = qs[i]
            question = f"/knowledge-base {q['question']}\n\n（语料为全英文，请全程使用英文回答 / Answer entirely in English.）"
            r = ask_one(pw, session, url, question, args.timeout,
                        tmp_dir / f"bench_ask_{pick['run_id']}_{i}.js", keep_open=True)
            r["qidx"] = i
            results[i] = r
            mark = "✓" if r.get("ok") else "✗"
            print(f"[{mark}] qidx={i} {q['question_id']} "
                  f"wall={(r.get('wall_ms') or 0) / 1000:.0f}s "
                  f"{('err=' + str(r.get('error'))[:80]) if not r.get('ok') else ''}", flush=True)

    try:
        queues = [idxs[i::workers] for i in range(workers)]
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = [ex.submit(worker_loop, w, queues[w]) for w in range(workers)]
            for f in as_completed(futs):
                f.result()
    finally:
        for w in range(workers):
            try:
                _run(pw + ["-s=" + f"bench-{pick['run_id']}-w{w}", "close"], timeout=30)
            except Exception:  # noqa: BLE001
                pass
        lock.unlink(missing_ok=True)

    rows = []
    for i in idxs:
        q = qs[i]
        r = results.get(i, {"ok": False, "error": "no result", "answer": ""})
        cited = (fetch_session_refs(url, r.get("session_id"), r.get("answer") or "")
                 if r.get("ok") else [])
        metrics = ref_metrics(cited, q.get("expected_doc_ids", []))
        rows.append({
            "qidx": i, "question_id": q["question_id"], "question": q["question"],
            "qtype": q.get("question_type", ""), "gold_answer": q.get("gold_answer", ""),
            "answer_facts": q.get("answer_facts", []),
            "expected_doc_ids": q.get("expected_doc_ids", []),
            "answer": r.get("answer", ""), "wall_ms": r.get("wall_ms"),
            "shell_ms": r.get("shell_ms"), "ok": r.get("ok"), "error": r.get("error"),
            "cited_n": metrics["n_cited_docs"], "recall": metrics["recall"],
            "precision": metrics["precision"], "ref_misses": metrics["misses"],
        })

    jsonl_path.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in rows),
                          encoding="utf-8")
    preview_path = write_preview(pick, rows, jsonl_path)
    print(f"results: {jsonl_path}")
    print(f"预览报告：{preview_path}")
    _recalls = [x["recall"] for x in rows if x["recall"] is not None]
    _walls = [x["wall_ms"] / 1000 for x in rows if x.get("wall_ms")]
    print(f"问答完成 {sum(1 for x in rows if x['ok'])}/{len(rows)} · "
          f"recall 均值 {_fmt(_avg(_recalls))} · 耗时均值 {_fmt(_avg(_walls), 's')}")
    print("（未评分——用户确认后逐题评分并跑 report 出终报）")
    print("\n## RESULTS_JSONL", flush=True)
    for x in rows:
        print(json.dumps(x, ensure_ascii=False), flush=True)


# ---------------------------------------------------------------------------
# report：解析评分产物 → 终报（落盘 + 打印）
# ---------------------------------------------------------------------------

def parse_answers(md_path: Path) -> dict[str, dict]:
    text = md_path.read_text(encoding="utf-8")
    sections: dict[str, dict] = {}
    for m in ANSWER_SECTION_RE.finditer(text):
        qid = m.group("qid")
        body = m.group("body")
        score: Optional[int] = None
        reason = ""
        sm = re.search(r"^\*\*评分\*\*[:：]\s*(\d{1,2})\s*/\s*10\s*[—–-]*\s*(.*)$", body, re.M)
        if sm:
            v = int(sm.group(1))
            if 1 <= v <= 10:
                score = v
            reason = sm.group(2).strip()
        else:
            nm = re.search(r"^\*\*评分\*\*[:：]\s*N/?A\s*[—–-]*\s*(.*)$", body, re.M | re.I)
            if nm:
                reason = nm.group(1).strip() or "未评分"

        def _fnum(pat: str) -> Optional[float]:
            fm = re.search(pat, body, re.M)
            try:
                return float(fm.group(1)) if fm else None
            except (ValueError, IndexError):
                return None

        recall = _fnum(r"^\*\*引用\*\*[:：].*?recall[=＝]\s*([\d.]+)")
        precision = _fnum(r"^\*\*引用\*\*[:：].*?precision[=＝]\s*([\d.]+)")

        def _secs(pat: str) -> Optional[float]:
            sm2 = re.search(pat, body)
            try:
                return float(sm2.group(1)) if sm2 else None
            except (ValueError, IndexError):
                return None

        wall_s = _secs(r"^\*\*耗时\*\*[:：]\s*([\d.]+)\s*s")
        am = re.search(r"^\*\*回答\*\*[:：]\s*\n?(.*)$", body, re.M | re.S)
        answer = (am.group(1) if am else body).strip()
        sections[qid] = {"score": score, "reason": reason, "answer": answer,
                         "recall": recall, "precision": precision, "wall_s": wall_s}
    return sections


def write_report(pick: dict, answers: dict[str, dict], answers_path: Path) -> Path:
    results = []
    for q in pick["questions"]:
        a = answers.get(q["question_id"], {})
        results.append({
            "question_id": q["question_id"], "question_type": q.get("question_type", ""),
            "question": q["question"], "gold_answer": q.get("gold_answer", ""),
            "score": a.get("score"), "reason": a.get("reason", ""),
            "answer": a.get("answer", ""),
            "recall": a.get("recall"), "precision": a.get("precision"),
            "wall_s": a.get("wall_s"),
        })
    scored = [r for r in results if r["score"] is not None]
    svals = [r["score"] for r in scored]
    recalls = [r["recall"] for r in results if r["recall"] is not None]
    precisions = [r["precision"] for r in results if r["precision"] is not None]
    walls = [r["wall_s"] for r in results if r["wall_s"] is not None]
    run_id = pick["run_id"]

    lines: list[str] = []
    lines.append(f"# EnterpriseRAG 基准测试报告 · {pick['source_type']} · {run_id}")
    lines.append("")
    lines.append(f"- 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- 语料：`{pick.get('workdir', '')}`")
    lines.append(f"- 抽样：{len(results)} 题（可用池 {pick['pool_size']}，N={pick['n']}，seed={pick['seed']}，"
                 f"跨源题{'包含' if pick['include_multi'] else '排除'}）")
    lines.append("- 问答通道：真实 Web UI（playwright-cli 驱动 chat 视图）；在线评分")
    lines.append(f"- 答案产物：`{answers_path}`")
    lines.append("")
    lines.append("## 总览")
    lines.append("")
    lines.append("| 指标 | 值 |")
    lines.append("|------|------|")
    lines.append(f"| AI 评分均值（1-10） | {_fmt(_avg(svals))} |")
    lines.append(f"| AI 评分中位数 | {_fmt(statistics.median(svals)) if svals else '—'} |")
    lines.append(f"| 及格率（评分 ≥7） | {_pct(sum(1 for s in svals if s >= 7), len(svals))} |")
    lines.append(f"| 优秀率（评分 ≥9） | {_pct(sum(1 for s in svals if s >= 9), len(svals))} |")
    lines.append(f"| 引用召回率 recall 均值 | {_fmt(_avg(recalls))}（{len(recalls)}/{len(results)} 题） |")
    lines.append(f"| 引用 precision 均值 | {_fmt(_avg(precisions))} |")
    lines.append(f"| recall=0 题数 | {sum(1 for x in recalls if x == 0)}/{len(recalls)} |")
    lines.append(f"| 回答耗时均值 | {_fmt(_avg(walls), 's')} |")
    lines.append(f"| 回答耗时中位数 | {_fmt(statistics.median(walls), 's') if walls else '—'} |")
    lines.append(f"| 回答耗时最慢/最快 | {_fmt(max(walls) if walls else None, 's')} / {_fmt(min(walls) if walls else None, 's')} |")
    lines.append(f"| 未评分 | {len(results) - len(scored)}/{len(results)} |")
    lines.append("")

    if svals:
        lines.append("## 评分分布")
        lines.append("")
        lines.append("| 区间 | 题数 | 占比 |")
        lines.append("|------|------|------|")
        for label, lo, hi in (("9-10", 9, 10), ("7-8", 7, 8), ("4-6", 4, 6), ("1-3", 1, 3)):
            c = sum(1 for s in svals if lo <= s <= hi)
            lines.append(f"| {label} | {c} | {_pct(c, len(svals))} |")
        lines.append("")

    lines.append("## 逐题明细")
    lines.append("")
    lines.append("| # | 题号 | 类型 | 评分 | recall | precision | 耗时s | 裁判理由 |")
    lines.append("|---|------|------|------|--------|-----------|-------|----------|")
    for i, r in enumerate(results, 1):
        reason = (r["reason"] or "").replace("\n", " ").replace("|", "\\|")
        score = r["score"] if r["score"] is not None else "未评分"
        lines.append(f"| {i} | {r['question_id']} | {r['question_type']} | {score} | "
                     f"{_fmt(r['recall'])} | {_fmt(r['precision'])} | "
                     f"{_fmt(r['wall_s'])} | {reason[:100]} |")
    lines.append("")

    low = [r for r in scored if r["score"] <= 5]
    if low:
        lines.append("## 低分题诊断（≤5 分）")
        lines.append("")
        for r in low:
            lines.append(f"### {r['question_id']}（{r['question_type']}，{r['score']} 分）")
            lines.append("")
            lines.append(f"- 问题：{r['question']}")
            lines.append(f"- 金标：{(r['gold_answer'] or '')[:400]}")
            lines.append(f"- 评分理由：{r['reason']}")
            lines.append(f"- 答案摘录：{(r['answer'] or '')[:600] or '（空）'}")
            lines.append("")

    unscored = [r for r in results if r["score"] is None]
    if unscored:
        lines.append("## 未评分清单")
        lines.append("")
        for r in unscored:
            lines.append(f"- **{r['question_id']}**：{r['reason'] or '（无评分行）'}")
        lines.append("")

    path = answers_path.parent / f"report_{run_id}.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def cmd_report(args: argparse.Namespace) -> None:
    _require({
        "--answers": (bool(args.answers), "--answers <answers md>：评分后的答案产物"),
    }, "用法：report --answers <answers_<run_id>.md>")

    answers_path = Path(args.answers)
    if not answers_path.exists():
        raise SystemExit(f"错误：答案产物不存在：{answers_path}")

    m = re.search(r"answers_(\w+)\.md$", answers_path.name)
    if not m:
        raise SystemExit(f"错误：文件名须为 answers_<run_id>.md：{answers_path.name}")
    run_id = m.group(1)
    pick_path = answers_path.parent / f"pick_{run_id}.json"
    if not pick_path.exists():
        raise SystemExit(f"错误：找不到抽题清单 {pick_path}")
    pick = json.loads(pick_path.read_text(encoding="utf-8"))
    pick["workdir"] = str(Path.cwd().resolve())

    answers = parse_answers(answers_path)
    missing = [q["question_id"] for q in pick["questions"] if q["question_id"] not in answers]
    if missing:
        raise SystemExit(f"错误：答案产物缺少 {len(missing)} 题：{', '.join(missing[:10])}"
                         + ("…" if len(missing) > 10 else ""))

    report = write_report(pick, answers, answers_path)
    scored = [answers[q["question_id"]] for q in pick["questions"]
              if answers[q["question_id"]]["score"] is not None]
    print(f"报告：{report}")
    if scored:
        vals = [a["score"] for a in scored]
        print(f"评分均值 {_avg(vals):.2f} / 中位数 {statistics.median(vals):.1f} / "
              f"≥7 分 {sum(1 for s in vals if s >= 7)}/{len(vals)}")
    else:
        print("警告：没有任何评分行，报告只有作答明细。")

    print("\n## REPORT_CONTENT", flush=True)
    print(report.read_text(encoding="utf-8"), flush=True)


# ---------------------------------------------------------------------------
# main：无参数 = stats；子命令必填参数无默认
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(
        description="EnterpriseRAG 真实 UI 基准测试（无默认值：测试方案须用户明确；"
                    "不带参数时只打印题库统计）")
    sub = ap.add_subparsers(dest="cmd")

    p_stats = sub.add_parser("stats", help="题库统计（题型分布表 + 各源单源题数表）")
    p_stats.add_argument("--questions", default="", help="覆盖题库路径（默认 ../questions.jsonl）")
    p_stats.set_defaults(func=cmd_stats)

    p_pick = sub.add_parser("pick", help="抽题（--n/--question-type/--out-dir 必填）")
    p_pick.add_argument("--n", type=int, required=True, help="抽题数（用户明确，无默认）")
    p_pick.add_argument("--question-type", required=True,
                        help="题型逗号分隔（用户明确，无默认；全部题型传 all）")
    p_pick.add_argument("--out-dir", required=True, help="产物目录（AI 助手 data dir 下 benchmarks）")
    p_pick.add_argument("--seed", type=int, default=None, help="随机种子（复现用）")
    p_pick.add_argument("--source-type", default="", help="覆盖自动推导（显式 > 实例 workdir > cwd）")
    p_pick.add_argument("--questions", default="", help="覆盖题库路径")
    p_pick.add_argument("--status-url", default="http://127.0.0.1:7860", help="实例状态地址（推导 source_type 用）")
    p_pick.add_argument("--include-multi", action="store_true", help="纳入跨源题（默认纯单源）")
    p_pick.set_defaults(func=cmd_pick)

    p_run = sub.add_parser("run", help="并发问答（--pick/--out-dir 必填）")
    p_run.add_argument("--pick", required=True, help="pick_<run_id>.json")
    p_run.add_argument("--out-dir", required=True, help="产物目录")
    p_run.add_argument("--all", action="store_true", help="跑全部抽中题（否则须 --n）")
    p_run.add_argument("--n", type=int, default=0, help="跑前 N 题")
    p_run.add_argument("--workers", type=int, default=3, help="并行浏览器数（默认 3）")
    p_run.add_argument("--url", default="http://127.0.0.1:7860", help="被测 Web UI 地址")
    p_run.add_argument("--timeout", type=float, default=120.0, help="单题超时秒（默认 120，强杀算失败）")
    p_run.add_argument("--pw-bin", default="playwright-cli", help="playwright-cli 命令")
    p_run.set_defaults(func=cmd_run)

    p_ask = sub.add_parser("ask", help="单题调试（--pick/--qidx/--out-dir 必填）")
    p_ask.add_argument("--pick", required=True, help="pick_<run_id>.json")
    p_ask.add_argument("--qidx", type=int, required=True, help="题下标（0-based）")
    p_ask.add_argument("--out-dir", required=True, help="产物目录")
    p_ask.add_argument("--url", default="http://127.0.0.1:7860", help="被测 Web UI 地址")
    p_ask.add_argument("--timeout", type=float, default=120.0, help="单题超时秒")
    p_ask.add_argument("--pw-bin", default="playwright-cli", help="playwright-cli 命令")
    p_ask.set_defaults(func=cmd_ask)

    p_rep = sub.add_parser("report", help="终报（--answers 必填）")
    p_rep.add_argument("--answers", required=True, help="answers_<run_id>.md")
    p_rep.set_defaults(func=cmd_report)

    args = ap.parse_args()
    if not args.cmd:
        # 无任何参数：只打印题库统计（不跑测）
        questions_path = Path.cwd().resolve().parent / "questions.jsonl"
        if not questions_path.exists():
            raise SystemExit(f"错误：题库不存在：{questions_path}\n"
                             "      无参数模式只列统计；测试请用 stats/pick/run/ask/report 子命令。")
        print_stats(questions_path)
        return
    args.func(args)


if __name__ == "__main__":
    main()
