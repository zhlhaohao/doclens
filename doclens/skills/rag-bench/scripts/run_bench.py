# -*- coding: utf-8 -*-
"""EnterpriseRAG 单源基准测试——真实对话链路评测（技能 rag-bench 的执行体）。

问答走被测实例的**生产对话接口**（``POST /api/chat``，SSE 流），不驱动浏览器、
不派子代理：每题新建会话 → 发斜杠技能消息 → 收流至 done。思考过程
（``thinking``）、工具轨迹（``tool_call``/``tool_result``）、正文（``token``）
与用量（``usage``）都从同一条流里取，与 Web UI 走的是完全相同的后端链路。

**被测应用由用户自行启动**：脚本不启动/不重启/不杀进程，只接受 ``--port``。

两阶段：问答完成先出预览报告（无评分），用户说「开始评分」后主代理逐题在线
评分，再出终报。

**无默认值纪律**：测试方案（题数/题型/源）必须由用户明确——参数不齐全时
脚本拒绝执行并列出缺什么；不带任何参数时只打印题库统计（等价 stats）。

子命令：
  stats  打印题库统计（题型分布表 + source_type 单源题数表）
  check  冒烟自检：问一句「你是谁？」验证链路能跑通（--port 必填）
  pick   抽题：--n/--question-type/--out-dir 全部必填，缺一拒绝
  run    问答（默认串行、每题即时落盘）：--pick/--out-dir/--port 必填
  ask    单题调试：--pick/--qidx/--out-dir/--port 必填
  report 解析评分后的 answers md 出终报：--answers 必填

产物均落 --out-dir（AI 助手 data dir 下 benchmarks/），便于审查。
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import socket
import statistics
import sys
import threading
import time
import urllib.error
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

# 斜杠技能：与被测实例里已安装的技能同名（题集为全英文语料问答）
SKILL_NAME = "knowledge-base"
LANG_SUFFIX = "\n\n（语料为全英文，请全程使用英文回答 / Answer entirely in English.）"

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


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------

def _fmt(x, suffix: str = "") -> str:
    return f"{x:.2f}{suffix}" if x is not None else "—"


def _avg(xs: list[float]) -> Optional[float]:
    return sum(xs) / len(xs) if xs else None


def _pct(part: int, total: int) -> str:
    return f"{part / total * 100:.1f}%（{part}/{total}）" if total else "—"


def base_url(port: int, host: str = "127.0.0.1") -> str:
    return f"http://{host}:{port}"


def acquire_run_lock(bench: Path, run_id: str) -> Path:
    """同 run_id 并发防护：30 分钟内的活跃锁直接拒绝（防两个 run 进程互撞）。"""
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


def _pid_alive(pid: int) -> bool:
    """跨平台探测 PID 是否存活（Windows 用 OpenProcess，POSIX 用 kill 0）。"""
    if pid <= 0:
        return False
    try:
        if os.name == "nt":
            import ctypes
            SYNCHRONIZE = 0x00100000
            h = ctypes.windll.kernel32.OpenProcess(SYNCHRONIZE, False, pid)
            if not h:
                return False
            try:
                WAIT_TIMEOUT = 0x102
                return ctypes.windll.kernel32.WaitForSingleObject(h, 0) == WAIT_TIMEOUT
            finally:
                ctypes.windll.kernel32.CloseHandle(h)
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def acquire_port_lock(bench: Path, port: int) -> Path:
    """按被测端口全局互斥：同一实例同时只允许一个 bench 问答进程（run/ask）。

    防「换个 run_id 重新 pick」绕过 per-run 锁——多进程并行会互相污染同一被测
    实例的 LLM/检索资源与耗时数据。锁内容为持有者 PID；持有进程已死视为陈锁，
    自动接管。O_CREAT|O_EXCL 原子创建，避免双进程同时抢到。"""
    lock = bench / f".bench_port_{port}.lock"
    for attempt in range(2):
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(str(os.getpid()))
            return lock
        except FileExistsError:
            try:
                holder = int(lock.read_text(encoding="utf-8").strip() or "0")
            except (OSError, ValueError):
                holder = 0
            if holder and _pid_alive(holder):
                raise SystemExit(
                    f"错误：端口 {port} 已有基准问答进程在跑（PID {holder}，锁 {lock}）。\n"
                    "      同一被测实例同时只允许一个 bench 进程——并行会互相污染耗时数据。\n"
                    "      先 check_background / 看产物确认它在跑什么，等它跑完；\n"
                    "      确认是孤儿进程（PID 已死）后删锁重试。不要另起 run。")
            if attempt == 0:  # 陈锁：持有进程已死，删除后重试一次
                lock.unlink(missing_ok=True)
                continue
    raise SystemExit(f"错误：无法获取端口锁 {lock}（重试后仍被占用）。")


# ---------------------------------------------------------------------------
# HTTP / SSE（生产对话链路，纯标准库）
# ---------------------------------------------------------------------------

def _http_error_text(e: urllib.error.HTTPError) -> str:
    try:
        raw = e.read().decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        raw = ""
    try:
        body = json.loads(raw)
        return f"HTTP {e.code} {body.get('code', '')}: {body.get('detail', '')}".strip()
    except Exception:  # noqa: BLE001
        return f"HTTP {e.code}: {raw[:200]}"


def api_get(base: str, path: str, timeout: float = 30.0) -> dict:
    with urllib.request.urlopen(base + path, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def api_post(base: str, path: str, body: dict, timeout: float = 30.0) -> dict:
    req = urllib.request.Request(
        base + path,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8", errors="replace")
    return json.loads(raw) if raw.strip() else {}


def create_session(base: str, title: str, mode: Optional[str] = "skill") -> str:
    """建聊天会话；mode='skill' → 引文走提取式策展（不做 [N] 重写）。"""
    body = {"type": "chat", "title": title[:200], "preview": ""}
    if mode:
        body["mode"] = mode
    return str(api_post(base, "/api/sessions", body)["id"])


def create_skill_session(base: str, title: str) -> str:
    """建技能会话（基准题专用）。"""
    return create_session(base, title, mode="skill")


def delete_session(base: str, session_id: str) -> bool:
    """删除会话（冒烟自检后清理，不污染用户的会话列表）。"""
    req = urllib.request.Request(base + f"/api/sessions/{session_id}", method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def stop_session(base: str, session_id: str) -> bool:
    """请求中断该会话生成（ADR-0028/0035）。

    基准测试超时后**必须**调它：客户端断开并不会让后端停——默认配置下
    agent 会续跑完本轮（耗时可达数分钟、白烧 token），且会与下一题抢
    LLM/检索资源，把后续耗时全部污染。
    """
    try:
        api_post(base, "/api/chat/stop", {"session_id": session_id}, timeout=20)
        return True
    except Exception:  # noqa: BLE001
        return False


def ask_once(base: str, session_id: str, question: str, timeout_s: float) -> dict:
    """发一轮对话并收流到 done。

    返回 ``{ok, answer, wall_ms, error?, tool_calls, thinking_chars, usage}``。
    ``wall_ms`` = 提问→done 的实测墙钟（含思考、工具、策展）。
    """
    body = json.dumps({"message": question, "session_id": session_id},
                      ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        base + "/api/chat", data=body,
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )

    texts: list[str] = []
    tool_names: list[str] = []
    thinking_chars = 0
    usage: Optional[dict] = None
    error: Optional[str] = None
    ask_hit = False
    t0 = time.monotonic()

    def _finish(ok: bool, err: Optional[str] = None) -> dict:
        return {
            "ok": ok, "answer": "".join(texts).strip(),
            "wall_ms": int((time.monotonic() - t0) * 1000),
            "error": err, "tool_calls": len(tool_names),
            "tool_names": tool_names[:20],
            "thinking_chars": thinking_chars, "usage": usage,
        }

    def _timeout() -> dict:
        """超时：先让后端停生成（否则断开续跑会白烧几分钟），再报失败。"""
        stopped = stop_session(base, session_id) if session_id else False
        return _finish(
            False,
            f"超时 {timeout_s:.0f}s（回答失败；"
            f"{'已请求停止' if stopped else '停止请求失败，后端可能仍在跑'}）",
        )

    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as r:
            event = ""
            data_lines: list[str] = []
            while True:
                if time.monotonic() - t0 > timeout_s:
                    return _timeout()
                raw = r.readline()
                if not raw:
                    break
                line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                if not line:
                    # 事件分隔：派发
                    if event:
                        payload = "\n".join(data_lines)
                        try:
                            data = json.loads(payload) if payload.strip() else {}
                        except json.JSONDecodeError:
                            data = {}
                        if event == "token":
                            texts.append(str(data.get("text", "")))
                        elif event == "thinking":
                            thinking_chars += len(str(data.get("delta", "")))
                        elif event == "tool_call":
                            tool_names.append(str(data.get("name", "")))
                        elif event == "usage":
                            usage = data
                        elif event == "error":
                            error = str(data.get("detail", "")) or "未知错误"
                        elif event == "ask":
                            ask_hit = True
                        elif event == "done":
                            if ask_hit:
                                return _finish(
                                    False, "agent 触发 ask_user_question（基准题不应交互）")
                            if error:
                                return _finish(False, error)
                            return _finish(True)
                    event, data_lines = "", []
                    continue
                if line.startswith(":"):
                    continue  # SSE 注释/心跳
                if line.startswith("event:"):
                    event = line[len("event:"):].strip()
                elif line.startswith("data:"):
                    data_lines.append(line[len("data:"):].lstrip())
    except urllib.error.HTTPError as e:
        return _finish(False, _http_error_text(e))
    except (socket.timeout, TimeoutError):
        return _timeout()
    except urllib.error.URLError as e:
        return _finish(False, f"连接失败：{e.reason}")

    if error:
        return _finish(False, error)
    if not texts:
        return _finish(False, "流已结束但没有正文（token 事件为空）")
    return _finish(True)


def require_instance(base: str, cwd: Path) -> dict:
    """前置检查：实例可达 ∧ workdir 与 cwd 一致（防测错知识库）。"""
    try:
        st = api_get(base, "/api/status", timeout=90)  # 大语料 status 需遍历全库，可能 >10s
    except Exception as e:  # noqa: BLE001
        raise SystemExit(
            f"错误：连不上被测实例 {base}（{e}）。\n"
            "      请先在目标知识库目录自行启动应用，然后传它实际监听的 --port。")
    wd = str(st.get("workdir") or "")
    if wd:
        a, b = Path(wd).resolve(), cwd.resolve()
        if str(a).lower() != str(b).lower():
            raise SystemExit(
                f"错误：实例 workdir 与当前目录不一致，拒绝开测（防测错知识库）。\n"
                f"      实例 workdir：{a}\n"
                f"      当前目录    ：{b}\n"
                "      请在目标知识库目录下运行本脚本，或换到对应实例的 --port。")
    return st


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
    questions_path = (Path(args.questions) if args.questions
                      else Path.cwd().resolve().parent / "questions.jsonl")
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
    }, "用法：pick --n 10 --question-type basic,semantic --out-dir <dir> [--port 7860] [--seed 42]")

    workdir = Path.cwd().resolve()
    questions_path = (Path(args.questions) if args.questions
                      else workdir.parent / "questions.jsonl")
    if not questions_path.exists():
        raise SystemExit(f"错误：题库不存在：{questions_path}\n"
                         "      约定：cwd 为 source_type 目录，父目录放 questions.jsonl。")

    # source_type：显式 > 运行实例 workdir（--port 可达时）> cwd 兜底
    source_type = args.source_type
    if not source_type and args.port:
        try:
            wd = str(api_get(base_url(args.port, args.host), "/api/status", timeout=90)
                     .get("workdir") or "")
            if wd:
                source_type = Path(wd).name
        except Exception:  # noqa: BLE001
            print(f"警告：{args.port} 端口不可达，source_type 回退用目录名 {workdir.name}",
                  file=sys.stderr)
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
        "question_types": sorted(types) or None, "skill_name": SKILL_NAME,
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
    print("<被测实例真实回答正文>")


def _ask_question_text(q: dict, skill_name: str) -> str:
    return f"/{skill_name} {q['question']}{LANG_SUFFIX}"


# ---------------------------------------------------------------------------
# 引用提取（会话落库后回读 tool_trace）
# ---------------------------------------------------------------------------

def fetch_session_refs(base_url_: str, session_id: Optional[str],
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
                detail = api_get(base_url_, f"/api/sessions/{session_id}", timeout=30)
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


# ---------------------------------------------------------------------------
# check：冒烟自检（一句话问答，验证整条链路能跑通）
# ---------------------------------------------------------------------------

CHECK_PROMPT = "你是谁？用一句话回答，不要调用工具。"
CHECK_SKILL_PROMPT = "用一句话确认你已加载技能，然后回答：你是谁？"


def cmd_check(args: argparse.Namespace) -> None:
    """冒烟自检：实例可达 → 建会话 → 发一句简单问题 → 收流到 done。

    只验证链路（SSE 通、有正文、能收尾），不评分、不落产物。默认问
    「你是谁？」——模型一句话就能答，不需要检索，能把「LLM 通不通」
    与「RAG 好不好」解耦。失败退出码 1，便于流水线早停。
    """
    _require({
        "--port": (args.port is not None, "--port <端口>：用户自起的被测实例端口"),
    }, "用法：check --port 7860 [--with-skill] [--prompt '你是谁？'] [--timeout 90]")

    workdir = Path.cwd().resolve()
    base = base_url(args.port, args.host)
    st = require_instance(base, workdir)

    print("## 实例")
    print(f"- 地址：{base}")
    print(f"- workdir：{st.get('workdir', '')}")
    print(f"- 已索引文档：{st.get('indexed_docs', '—')}（索引中：{st.get('index_building')}）")
    print(f"- 模型：{st.get('model_name') or '未报告'}")
    if st.get("index_building"):
        print("- 警告：索引仍在构建，检索类问题可能不完整（本次冒烟不受影响）")
    print()

    use_skill = bool(args.with_skill)
    prompt = args.prompt or (CHECK_SKILL_PROMPT if use_skill else CHECK_PROMPT)
    if use_skill and not prompt.startswith("/"):
        prompt = f"/{SKILL_NAME} {prompt}"

    sid = create_session(base, "rag-bench-check", mode="skill" if use_skill else None)
    print("## 提问")
    print(f"- 会话：{sid}")
    print(f"- 内容：{prompt}")
    r = ask_once(base, sid, prompt, args.timeout)

    print()
    print("## 结果")
    print(f"- 成功：{'是' if r['ok'] else '否'}")
    print(f"- 耗时：{(r.get('wall_ms') or 0) / 1000:.1f}s")
    print(f"- 工具调用：{r.get('tool_calls', 0)} 次"
          + (f"（{', '.join(r.get('tool_names') or [])}）" if r.get("tool_names") else ""))
    print(f"- 思考增量：{r.get('thinking_chars', 0)} 字符")
    if r.get("usage"):
        u = r["usage"]
        print(f"- 用量：in {u.get('input_tokens')} / out {u.get('output_tokens')} "
              f"/ 缓存读 {u.get('cache_read_input_tokens')}")
    if r["ok"]:
        print(f"- 回答：{r['answer']}")
    else:
        print(f"- 失败原因：{r.get('error')}")

    if not args.keep_session:
        print(f"- 清理会话：{'已删除' if delete_session(base, sid) else '删除失败（可手动删）'}")

    if not r["ok"]:
        raise SystemExit(1)
    print()
    print("链路可用——可以继续 pick / run。")


def cmd_ask(args: argparse.Namespace) -> None:
    _require({
        "--pick": (bool(args.pick), "--pick <pick json>：抽题清单"),
        "--qidx": (args.qidx is not None, "--qidx <0-based 下标>：哪一题"),
        "--out-dir": (bool(args.out_dir), "--out-dir <dir>：产物目录"),
        "--port": (args.port is not None, "--port <端口>：用户自起的被测实例端口"),
    }, "用法：ask --pick <pick json> --qidx 0 --out-dir <dir> --port 7860 [--timeout 120]")

    workdir = Path.cwd().resolve()
    base = base_url(args.port, args.host)
    require_instance(base, workdir)

    pick = json.loads(Path(args.pick).read_text(encoding="utf-8"))
    qs = pick["questions"]
    if not (0 <= args.qidx < len(qs)):
        raise SystemExit(f"错误：--qidx 越界（0..{len(qs) - 1}）")
    q = qs[args.qidx]
    skill_name = pick.get("skill_name") or SKILL_NAME

    bench = Path(args.out_dir)
    bench.mkdir(parents=True, exist_ok=True)
    port_lock = acquire_port_lock(bench, args.port)

    try:
        sid = create_skill_session(base, f"bench-{pick['run_id']}-{args.qidx}")
        result = ask_once(base, sid, _ask_question_text(q, skill_name), args.timeout)

        if not result.get("ok"):
            raise SystemExit(f"错误：第 {args.qidx} 题（{q['question_id']}）问答失败：{result.get('error')}")

        cited = fetch_session_refs(base, sid, result.get("answer") or "")
        metrics = ref_metrics(cited, q.get("expected_doc_ids", []))
        print(json.dumps({
            "question_id": q["question_id"], "question": q["question"],
            "answer": result["answer"], "wall_ms": result.get("wall_ms"),
            "session_id": sid, "tool_calls": result.get("tool_calls"),
            "thinking_chars": result.get("thinking_chars"),
            "cited_n": metrics["n_cited_docs"], "recall": metrics["recall"],
            "precision": metrics["precision"], "ref_misses": metrics["misses"],
        }, ensure_ascii=False, indent=2))
    finally:
        port_lock.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# run：逐题问答（默认串行）
# ---------------------------------------------------------------------------

def write_preview(pick: dict, rows: list[dict], jsonl_path: Path, port: int) -> Path:
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
    lines.append(f"- 问答通道：`POST /api/chat`（SSE 流，port {port}）；每题独立技能会话")
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
        lines.append(f"- 工具调用：{x.get('tool_calls', 0)} 次"
                     + (f"（{', '.join(x.get('tool_names') or [])}）" if x.get("tool_names") else ""))
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
        "--port": (args.port is not None, "--port <端口>：用户自起的被测实例端口"),
    }, "用法：run --pick <pick json> --all --port 7860 --workers 1 --timeout 300 --out-dir <dir>")

    from concurrent.futures import ThreadPoolExecutor, as_completed

    workdir = Path.cwd().resolve()
    base = base_url(args.port, args.host)
    require_instance(base, workdir)

    pick = json.loads(Path(args.pick).read_text(encoding="utf-8"))
    skill_name = pick.get("skill_name") or SKILL_NAME
    qs = pick["questions"]
    idxs = list(range(len(qs))) if args.all else list(range(min(args.n, len(qs))))
    if not idxs:
        raise SystemExit("错误：没有要跑的题——用 --all 或 --n <题数>。")
    workers = max(1, min(args.workers, len(idxs)))

    bench = Path(args.out_dir)
    bench.mkdir(parents=True, exist_ok=True)
    port_lock = acquire_port_lock(bench, args.port)
    lock = acquire_run_lock(bench, pick["run_id"])
    jsonl_path = bench / f"results_{pick['run_id']}.jsonl"
    print(f"{'串行' if workers == 1 else f'并发 {workers} worker'} × {len(idxs)} 题（{base}）",
          flush=True)
    print(f"单题超时 {args.timeout:.0f}s；每题完成即追加落盘：{jsonl_path}", flush=True)

    results: dict[int, dict] = {}
    write_lock = threading.Lock()

    def run_one(i: int) -> dict:
        """跑一题并补齐引用指标；异常一律转成失败行（不中断整批）。"""
        q = qs[i]
        # 标题带题号：同 run 重跑不产生同名会话，事后可按会话核对
        try:
            sid = create_skill_session(base, f"bench-{pick['run_id']}-{i}-{q['question_id']}")
            r = ask_once(base, sid, _ask_question_text(q, skill_name), args.timeout)
            r["session_id"] = sid
        except Exception as e:  # noqa: BLE001
            r = {"ok": False, "error": f"请求异常：{e}", "answer": "",
                 "wall_ms": None, "tool_calls": 0, "tool_names": [],
                 "thinking_chars": 0, "usage": None, "session_id": None}
        cited = (fetch_session_refs(base, r.get("session_id"), r.get("answer") or "")
                 if r.get("ok") else [])
        metrics = ref_metrics(cited, q.get("expected_doc_ids", []))
        return {
            "qidx": i, "question_id": q["question_id"], "question": q["question"],
            "qtype": q.get("question_type", ""), "gold_answer": q.get("gold_answer", ""),
            "answer_facts": q.get("answer_facts", []),
            "expected_doc_ids": q.get("expected_doc_ids", []),
            "answer": r.get("answer", ""), "wall_ms": r.get("wall_ms"),
            "session_id": r.get("session_id"), "ok": r.get("ok"), "error": r.get("error"),
            "tool_calls": r.get("tool_calls", 0), "tool_names": r.get("tool_names") or [],
            "thinking_chars": r.get("thinking_chars", 0),
            "cited_n": metrics["n_cited_docs"], "recall": metrics["recall"],
            "precision": metrics["precision"], "ref_misses": metrics["misses"],
        }

    def worker_loop(queue: list[int]) -> None:
        for i in queue:
            row = run_one(i)
            results[i] = row
            wall = (row.get("wall_ms") or 0) / 1000
            with write_lock:
                # 每题完成即追加落盘：run 被杀 / Ctrl+C / 断电都不会丢掉
                # 已跑出来的题（曾因「全跑完才写」导致 3 题白跑、零产物）
                with open(jsonl_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
                    f.flush()
            print(f"[{'✓' if row.get('ok') else '✗'}] qidx={i} {row['question_id']} "
                  f"wall={wall:.0f}s tools={row.get('tool_calls', 0)} "
                  f"{('err=' + str(row.get('error'))[:80]) if not row.get('ok') else ''}",
                  flush=True)

    # 预置空文件：第一题就挂掉也知道本次 run 存在、结果路径固定
    jsonl_path.write_text("", encoding="utf-8")

    rows: list[dict] = []
    preview_path: Optional[Path] = None
    try:
        queues = [idxs[i::workers] for i in range(workers)]
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = [ex.submit(worker_loop, q) for q in queues]
            for f in as_completed(futs):
                f.result()
    except KeyboardInterrupt:
        print("\n中断：已完成的题已落盘，正在出部分预览……", flush=True)
    finally:
        lock.unlink(missing_ok=True)
        port_lock.unlink(missing_ok=True)
        # 部分/完整都出预览：缺失题按「未跑」补齐，避免看起来像已跑完
        rows = []
        for i in idxs:
            q = qs[i]
            rows.append(results.get(i, {
                "qidx": i, "question_id": q["question_id"], "question": q["question"],
                "qtype": q.get("question_type", ""), "gold_answer": q.get("gold_answer", ""),
                "answer": "", "wall_ms": None, "ok": False,
                "error": "未跑（run 被中断）", "tool_calls": 0, "tool_names": [],
                "cited_n": 0, "recall": None, "precision": None, "ref_misses": [],
            }))
        try:
            preview_path = write_preview(pick, rows, jsonl_path, args.port)
        except Exception as e:  # noqa: BLE001
            print(f"预览生成失败：{e}", flush=True)
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
            sm2 = re.search(pat, body, re.M)
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
    lines.append("- 问答通道：`POST /api/chat`（SSE 流，生产后端链路）；在线评分")
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
        description="EnterpriseRAG 基准测试（被测应用由用户自起、传 --port；"
                    "无默认值：测试方案须用户明确；不带参数时只打印题库统计）")
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
    p_pick.add_argument("--port", type=int, default=None,
                        help="被测实例端口（可选；给了就据此推导 source_type）")
    p_pick.add_argument("--host", default="127.0.0.1", help="被测实例主机（默认 127.0.0.1）")
    p_pick.add_argument("--include-multi", action="store_true", help="纳入跨源题（默认纯单源）")
    p_pick.set_defaults(func=cmd_pick)

    p_run = sub.add_parser("run", help="问答（默认串行，--pick/--out-dir/--port 必填）")
    p_run.add_argument("--pick", required=True, help="pick_<run_id>.json")
    p_run.add_argument("--out-dir", required=True, help="产物目录")
    p_run.add_argument("--port", type=int, default=None, help="被测实例端口（用户自起的应用）")
    p_run.add_argument("--host", default="127.0.0.1", help="被测实例主机（默认 127.0.0.1）")
    p_run.add_argument("--all", action="store_true", help="跑全部抽中题（否则须 --n）")
    p_run.add_argument("--n", type=int, default=0, help="跑前 N 题")
    p_run.add_argument("--workers", type=int, default=1, help="并发问答数（默认 1：串行，耗时口径最干净）")
    p_run.add_argument("--timeout", type=float, default=300.0,
                       help="单题超时秒（默认 300；大语料单题可达 3-6 分钟，超时主动停生成并记失败）")
    p_run.set_defaults(func=cmd_run)

    p_check = sub.add_parser("check", help="冒烟自检：问一句「你是谁？」验证链路（--port 必填）")
    p_check.add_argument("--port", type=int, default=None, help="被测实例端口（用户自起的应用）")
    p_check.add_argument("--host", default="127.0.0.1", help="被测实例主机（默认 127.0.0.1）")
    p_check.add_argument("--prompt", default="", help=f"自定义问题（默认「{CHECK_PROMPT}」）")
    p_check.add_argument("--with-skill", action="store_true",
                         help="改问斜杠技能形态（/knowledge-base …），一并验证技能加载")
    p_check.add_argument("--timeout", type=float, default=90.0, help="超时秒（默认 90）")
    p_check.add_argument("--keep-session", action="store_true", help="保留冒烟会话（默认删除）")
    p_check.set_defaults(func=cmd_check)

    p_ask = sub.add_parser("ask", help="单题调试（--pick/--qidx/--out-dir/--port 必填）")
    p_ask.add_argument("--pick", required=True, help="pick_<run_id>.json")
    p_ask.add_argument("--qidx", type=int, required=True, help="题下标（0-based）")
    p_ask.add_argument("--out-dir", required=True, help="产物目录")
    p_ask.add_argument("--port", type=int, default=None, help="被测实例端口（用户自起的应用）")
    p_ask.add_argument("--host", default="127.0.0.1", help="被测实例主机（默认 127.0.0.1）")
    p_ask.add_argument("--timeout", type=float, default=300.0, help="单题超时秒（默认 300）")
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
