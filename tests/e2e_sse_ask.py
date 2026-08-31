"""SSE 聊天链路 + ask_user_question 端到端测试（独立脚本，非 pytest 用例）。

针对 async 改造（StreamingAgent 直跑 ASGI 主 loop）的真实服务 E2E：
前置：应用已启动（默认 http://127.0.0.1:7861，可用 E2E_BASE_URL 覆盖），
真实 LLM（~/.cortex/.env 提供 PLANIFY_*）与真实知识库索引。

用例：
  T1 基础聊天     —— 搜索类问题：tool_call → tool_result → token → done 顺序
  T2 ask 全流程   —— ask 事件 → respond 回传 → agent 继续生成 → done
  T3 ask 挂起停止 —— ask 悬置时 /chat/stop（改造修复点：应秒级结束而非 300s）
  T4 respond 兜底 —— 不存在的 request_id 返回 ok=false
  T5 流式中途停止 —— 生成中 stop，流应立即终结
  T6 会话持久化   —— T2 轮次落库，详情可回读

用法：
  ../cortex/.venv/Scripts/python.exe tests/e2e_sse_ask.py
"""
import json
import os
import sys
import time
from typing import Any, Iterator

import requests

BASE = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:7861")
ASK_TRIGGER = (
    "这是一个 E2E 测试任务：请立即调用 ask_user_question 工具向我提问，"
    "问题为「E2E 测试环境选哪个？」，header 为「测试环境」，两个选项："
    "「本地（推荐）」（本地跑更快）与「云端」（免装环境）。"
    "不要用文字直接提问，必须使用工具。问完后等待我的回答，"
    "然后根据我的选择用一句话确认。"
)
# 秒级兜底阈值：远小于 ASK_TIMEOUT_SECONDS=300，大于正常网络/收尾耗时
STOP_DEADLINE_S = 30.0

results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" —— {detail}" if detail else ""))


def new_session(title: str) -> str:
    r = requests.post(f"{BASE}/api/sessions", json={
        "type": "chat", "title": title, "preview": "",
    }, timeout=10)
    r.raise_for_status()
    return r.json()["id"]


def sse_chat(message: str, session_id: str) -> Iterator[tuple[str, dict]]:
    """POST /api/chat 并按序 yield (event, data)。"""
    with requests.post(
        f"{BASE}/api/chat",
        json={"message": message, "session_id": session_id},
        stream=True,
        timeout=(10, 120),
    ) as r:
        r.raise_for_status()
        event, data = "", ""
        for raw in r.iter_lines(decode_unicode=True):
            if raw is None:
                continue
            if raw.startswith("event:"):
                event = raw[len("event:"):].strip()
            elif raw.startswith("data:"):
                data = raw[len("data:"):].strip()
            elif raw == "" and event:
                yield event, json.loads(data or "{}")
                event, data = "", ""


def collect_until_done(message: str, session_id: str,
                       deadline_s: float = 120.0) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for ev, data in sse_chat(message, session_id):
        events.append((ev, data))
        if ev in ("done", "error"):
            break
        if time.monotonic() > 0 and len(events) > 500:  # 防御性上限
            break
    return events


def stop(session_id: str) -> dict:
    r = requests.post(f"{BASE}/api/chat/stop",
                      json={"session_id": session_id}, timeout=10)
    r.raise_for_status()
    return r.json()


def t1_basic_chat() -> None:
    sid = new_session("e2e-t1-基础聊天")
    events = collect_until_done(
        "知识库里有哪些关于量子计算的文档？请先搜索再简要回答。", sid)
    kinds = [e for e, _ in events]
    calls = [d for e, d in events if e == "tool_call"]
    results_ev = [d for e, d in events if e == "tool_result"]
    tokens = [d for e, d in events if e == "token"]

    record("T1a 收到 tool_call 事件", len(calls) >= 1,
           f"tool_call×{len(calls)}: {[c.get('name') for c in calls][:3]}")
    record("T1b 收到 tool_result 事件", len(results_ev) >= 1,
           f"tool_result×{len(results_ev)}")
    record("T1c tool_result 无错误", all(not d.get("is_error") for d in results_ev),
           str([d.get("is_error") for d in results_ev]))
    record("T1d 正文 token 非空", any(d.get("text", "").strip() for d in tokens),
           f"token 长度 {[len(d.get('text', '')) for d in tokens]}")
    record("T1e done 收尾且无 error", kinds[-1] == "done" and "error" not in kinds,
           f"事件序列 {kinds[:8]}{'…' if len(kinds) > 8 else ''}")

    # 顺序：首个 tool_call 在首个 tool_result 之前；token 在 done 之前
    idx = {k: (kinds.index(k) if k in kinds else -1) for k in
           ("tool_call", "tool_result", "token", "done")}
    record("T1f 事件顺序 call→result→token→done",
           0 <= idx["tool_call"] < idx["tool_result"] < idx["token"] < idx["done"],
           str(idx))


def t2_ask_roundtrip() -> dict:
    sid = new_session("e2e-t2-ask全流程")
    t0 = time.monotonic()
    ask_ev: dict | None = None
    post_ask_events: list[tuple[str, dict]] = []
    done = False

    for ev, data in sse_chat(ASK_TRIGGER, sid):
        if ev == "ask" and ask_ev is None:
            ask_ev = data
            questions = json.loads(data["questions_json"])["questions"]
            first = questions[0]
            label = first["options"][0]["label"]
            r = requests.post(f"{BASE}/api/ask/respond", json={
                "request_id": data["request_id"],
                "session_id": sid,
                "answers": [{
                    "question": first["question"],
                    "selected": [label],
                    "other": None,
                }],
            }, timeout=10)
            record("T2b respond 命中 {ok:true}", r.json() == {"ok": True, "submitted": True},
                   r.text)
        elif ask_ev is not None:
            post_ask_events.append((ev, data))
        if ev in ("done", "error"):
            done = True
            break

    record("T2a 收到 ask 事件（结构合法）", ask_ev is not None,
           "" if ask_ev is None else ask_ev["request_id"])
    if ask_ev is None:
        return {"session_id": sid}

    questions = json.loads(ask_ev["questions_json"])["questions"]
    q0 = questions[0]
    record("T2a-1 问题结构 question/header/options 齐备",
           bool(q0.get("question")) and bool(q0.get("header"))
           and 2 <= len(q0.get("options", [])) <= 4,
           json.dumps(q0, ensure_ascii=False)[:120])

    kinds = [e for e, _ in post_ask_events]
    result_texts = [str(d.get("output", "")) for e, d in post_ask_events
                    if e == "tool_result"]
    answered = any("本地" in t for t in result_texts)
    tokens = [d.get("text", "") for e, d in post_ask_events if e == "token"]
    record("T2c 答案以 tool_result 回流模型", answered,
           f"result 片段 {[t[:60] for t in result_texts][:2]}")
    record("T2d 作答后继续生成正文", any(t.strip() for t in tokens),
           f"token 长度 {[len(t) for t in tokens]}")
    record("T2e 流正常终结", done and "error" not in kinds, f"事件 {kinds}")
    record("T2f 全流程 < 120s", time.monotonic() - t0 < 120,
           f"{time.monotonic() - t0:.1f}s")
    return {"session_id": sid, "ask_ev": ask_ev, "selected": q0["options"][0]["label"]}


def t3_stop_during_ask() -> None:
    sid = new_session("e2e-t3-ask挂起停止")
    t_stop = t_end = None
    stop_resp: dict = {}
    got_ask = False

    for ev, data in sse_chat(ASK_TRIGGER, sid):
        if ev == "ask" and not got_ask:
            got_ask = True
            stop_resp = stop(sid)
            t_stop = time.monotonic()
        if ev in ("done", "error"):
            t_end = time.monotonic()
            break
        if got_ask and time.monotonic() - t_stop > STOP_DEADLINE_S:
            break  # 超兜底阈值，视为失败（requests 由外层 timeout 兜底）

    record("T3a 收到 ask 事件", got_ask)
    record("T3b stop 返回 ok=true", stop_resp.get("ok") is True, str(stop_resp))
    if t_stop is not None and t_end is not None:
        elapsed = t_end - t_stop
        record(f"T3c 停止后 {elapsed:.1f}s 内流终结（阈值 {STOP_DEADLINE_S}s）",
               elapsed < STOP_DEADLINE_S)
    else:
        record("T3c 流未在阈值内终结", False,
               f"t_stop={t_stop} t_end={t_end}")


def t4_respond_unknown() -> None:
    r = requests.post(f"{BASE}/api/ask/respond", json={
        "request_id": "req_not_exist_e2e", "answers": [],
    }, timeout=10)
    record("T4 不存在 request_id → ok=false",
           r.json() == {"ok": False, "submitted": False}, r.text)


def t5_stop_midstream() -> None:
    sid = new_session("e2e-t5-流式停止")
    t_stop = t_end = None
    started = time.monotonic()
    for ev, data in sse_chat(
        "请写一篇关于量子计算发展史的 2000 字长文，直接开始写。", sid):
        # 首个事件到达后再等 3s（确保 LLM 已在生成），然后停止
        if t_stop is None and time.monotonic() - started > 8:
            stop(sid)
            t_stop = time.monotonic()
        if ev in ("done", "error"):
            t_end = time.monotonic()
            break
        if t_stop is not None and time.monotonic() - t_stop > STOP_DEADLINE_S:
            break
    if t_stop is None or t_end is None:
        record("T5 流式停止（未触发/未收尾）", False,
               f"t_stop={t_stop} t_end={t_end}")
        return
    elapsed = t_end - t_stop
    record(f"T5 停止后 {elapsed:.1f}s 内流终结（阈值 {STOP_DEADLINE_S}s）",
           elapsed < STOP_DEADLINE_S)


def t6_session_persisted(sid: str, asked_label: str) -> None:
    r = requests.get(f"{BASE}/api/sessions/{sid}", timeout=10)
    if r.status_code != 200:
        record("T6 会话详情可回读", False, f"HTTP {r.status_code}")
        return
    detail = r.json()
    text = json.dumps(detail, ensure_ascii=False)
    # message_count/message_user/message_ai 由前端 PATCH 维护（展示层），
    # API-only 流程只落原始轮次：tool_trace + message_ai_raw（chat.py 落库契约）
    items = detail.get("items") or detail.get("session_items") or []
    kinds = [it.get("kind") for it in items]
    record("T6a 会话详情 200 且原始轮次已落库",
           "tool_trace" in kinds and "message_ai_raw" in kinds,
           f"items={len(items)}, kinds={sorted(set(kinds))}")
    record("T6b ask 选择留痕（含所选 label）", asked_label in text,
           f"查找 label「{asked_label}」")


def main() -> int:
    print(f"== SSE E2E against {BASE} ==")
    health = requests.get(f"{BASE}/api/health", timeout=5)
    if health.status_code != 200:
        print(f"server not healthy: {health.status_code}")
        return 2
    t1_basic_chat()
    ctx = t2_ask_roundtrip()
    t3_stop_during_ask()
    t4_respond_unknown()
    t5_stop_midstream()
    t6_session_persisted(ctx["session_id"], ctx.get("selected", ""))

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n== 结果：{passed}/{len(results)} 通过 ==")
    for name, ok, detail in results:
        if not ok:
            print(f"  FAIL {name}: {detail}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
