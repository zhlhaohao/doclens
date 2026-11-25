import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture, html } from "@open-wc/testing";
import "../src/views/chat-view";
// chat-view 只 import 了 chat-stream 的类型——组件实现在真实应用里由
// app.ts 注册；测试环境需显式引入，否则 <chat-stream> 不会 upgrade
// （_streamEl?.scrollToBottom is not a function）。
import "../src/components/chat-stream";
import { resetStore, setDesktopViewport } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { ChatView } from "../src/views/chat-view";

/**
 * 对话流程集成测试（AP-12：SSE 回合域动刀前的安全网）。
 *
 * 覆盖此前只有纯函数测试、端到端无保护的真实链路：
 *   ① 发消息 → 建会话 → SSE 流式渲染（token 累积进 messages）
 *   ② 工具步骤（tool_call → tool_result）在消息里成对出现
 *   ③ 流式结束 → streaming 解锁（输入框可再发）
 *   ④ 主动停止（stop）→ abort → 残留 running 步骤标记为中断
 *   ⑤ 切走会话 → 本流事件丢弃（不串台到别的会话）
 *   ⑥ usage 事件累加进会话占用口径
 *
 * mock 策略：按 URL 路由 fetch —— /api/sessions(POST) 建会话、
 * /api/sessions(GET) 历史、/api/chat SSE 流、/api/chat/stop 停止。
 */

interface MockOpts {
  /** SSE 事件序列（[event, data]）。 */
  events?: Array<[string, string]>;
  /** 流读取挂起（测停止/切走）：收到 abort 信号后结束。 */
  hang?: boolean;
  /** /api/status 的 model_name（激活预设名）；undefined = 返回空对象。 */
  statusModel?: string;
}

function sseBody(events: Array<[string, string]>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(
        events.map(([e, d]) => `event: ${e}\r\ndata: ${d}\r\n\r\n`).join(""),
      ));
      controller.close();
    },
  });
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

/** 可控分块流：投递给定事件后保持打开，测试可随时 close（模拟流未结束）。
 *  happy-dom 的 ReadableStream 在挂起 read 时不响应 abort，故用「手动 close」
 *  模拟流结束；停止/切走的判定改由「事件是否写进目标会话」观察。 */
function controllableSseBody(events: Array<[string, string]>) {
  const enc = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      if (events.length) {
        controller.enqueue(enc.encode(
          events.map(([e, d]) => `event: ${e}\r\ndata: ${d}\r\n\r\n`).join(""),
        ));
      }
    },
  });
  return {
    stream,
    close: () => { try { controllerRef?.close(); } catch { /* 已关闭 */ } },
    error: (e: Error) => { try { controllerRef?.error(e); } catch { /* 已关闭 */ } },
  };
}

let stopCalls = 0;
let createdSessions: Array<{ title: string; mode?: string }> = [];
/** 挂起流的控制器（测试手动结束它）。 */
let hangingStream: { close: () => void; error: (e: Error) => void } | null = null;

function installFetch(opts: MockOpts) {
  hangingStream = null;
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith("/api/sessions?") || u === "/api/sessions") {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { title: string; mode?: string };
        createdSessions.push(body);
        return jsonRes({ id: "s-new", type: "chat", title: body.title, preview: "", mode: body.mode });
      }
      return jsonRes({ sessions: [], total: 0 });
    }
    if (u === "/api/chat/stop") {
      stopCalls++;
      return jsonRes({ ok: true });
    }
    if (u === "/api/status") {
      return jsonRes(opts.statusModel ? { model_name: opts.statusModel } : {});
    }
    if (u === "/api/chat") {
      if (opts.hang) {
        // 保持流打开（测试手动 close/error）——测停止与切走的竞态
        const ctl = controllableSseBody(opts.events ?? []);
        hangingStream = ctl;
        // abort 语义对齐真实 fetch：abort → 流以 AbortError 结束
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          ctl.error(err);
        });
        return new Response(ctl.stream, {
          status: 200, headers: { "Content-Type": "text/event-stream" },
        });
      }
      return new Response(sseBody(opts.events ?? []), {
        status: 200, headers: { "Content-Type": "text/event-stream" },
      });
    }
    return jsonRes({});
  }) as unknown as typeof fetch;
}

/** 直接触发 chat-view 的提交（绕开 input-box 组件细节）。 */
async function submit(el: ChatView, text: string) {
  await (el as any)._submit(new CustomEvent("submit", { detail: { value: text } }));
}

describe("<chat-view> 对话流程集成（AP-12 安全网）", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    resetStore(store);
    setDesktopViewport();
    stopCalls = 0;
    createdSessions = [];
    actions.setChatState({
      state: "initial",
      currentSession: null,
      messages: [],
      streaming: false,
    });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("① 发消息 → 建会话 → token 累积进 messages → 流末解锁输入", async () => {
    installFetch({
      events: [
        ["token", JSON.stringify({ text: "你好" })],
        ["token", JSON.stringify({ text: "世界" })],
        ["done", "{}"],
      ],
    });
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;

    await submit(el, "提问");
    await el.updateComplete;
    // 建会话 + 消息流结束
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;

    const st = store.getState().chat;
    expect(st.state).toBe("focus");
    expect(st.currentSession?.id).toBe("s-new");
    expect(createdSessions[0]?.title).toBe("提问");
    // 用户气泡 + assistant 占位，正文累积
    const assistant = st.messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("你好世界");
    // 流结束 → 输入解锁
    expect(st.streaming).toBe(false);
  });

  it("② tool_call → tool_result 成对落入消息的 tool_steps", async () => {
    installFetch({
      events: [
        ["tool_call", JSON.stringify({ tool_use_id: "t1", name: "search", input: { q: "x" } })],
        ["tool_result", JSON.stringify({ tool_use_id: "t1", name: "search", output: "found", is_error: false })],
        ["token", JSON.stringify({ text: "答案" })],
        ["done", "{}"],
      ],
    });
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await submit(el, "查一下");
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;

    const assistant = store.getState().chat.messages.find((m) => m.role === "assistant");
    expect(assistant?.tool_steps).toHaveLength(1);
    expect(assistant?.tool_steps?.[0]).toMatchObject({
      tool_use_id: "t1", name: "search", output: "found", status: "done",
    });
  });

  it("③ 流式期间 streaming=true（输入锁定），流结束后解锁", async () => {
    // 挂起流：建会话 → 进入 streaming 后流仍未结束
    installFetch({ hang: true, events: [["token", JSON.stringify({ text: "a" })]] });
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    void submit(el, "hi");
    await new Promise((r) => setTimeout(r, 30));
    expect(store.getState().chat.streaming).toBe(true);

    // 流结束 → 解锁输入
    hangingStream?.close();
    await new Promise((r) => setTimeout(r, 30));
    expect(store.getState().chat.streaming).toBe(false);
  });

  it("④ 主动停止：调 stop 端点 + 残留 running 步骤标记为中断", async () => {
    installFetch({
      hang: true,
      events: [
        ["tool_call", JSON.stringify({ tool_use_id: "t1", name: "search", input: {} })],
      ],
    });
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    // 建会话 + 保持打开的流（tool_call 已到）——流未结束时 sendMessage
    // 永不返回，故不 await submit（后台跑）
    void submit(el, "长任务");
    await new Promise((r) => setTimeout(r, 30));

    await (el as any)._stop();
    await new Promise((r) => setTimeout(r, 30));

    expect(stopCalls).toBe(1);
    const assistant = store.getState().chat.messages.find((m) => m.role === "assistant");
    // 残留 running 步骤标记为 error + 中断输出
    expect(assistant?.tool_steps?.[0]?.status).toBe("error");
    expect(assistant?.tool_steps?.[0]?.output).toBe("（已中断）");
    // 收尾：解锁输入
    hangingStream?.close();
  });

  it("⑤ 切走会话后本流事件丢弃（不串台）", async () => {
    installFetch({
      hang: true,
      events: [
        ["token", JSON.stringify({ text: "第一个会话的内容" })],
      ],
    });
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    void submit(el, "第一个会话");
    await new Promise((r) => setTimeout(r, 30));

    // 切到别的会话（store 换 currentSession）——本流的事件应被归属守卫丢弃
    actions.setChatState({
      currentSession: {
        id: "other", type: "chat", title: "别的", preview: "",
        updated_at: new Date().toISOString(), message_count: 0,
      },
      messages: [],
    });
    await new Promise((r) => setTimeout(r, 30));

    // 「别的」会话的消息里不应出现本流的内容
    const msgs = store.getState().chat.messages;
    expect(msgs.some((m) => m.content?.includes("第一个会话的内容"))).toBe(false);
    hangingStream?.close();
  });

  it("⑥ usage 事件累加进会话占用口径（最近一次调用）", async () => {
    installFetch({
      events: [
        ["usage", JSON.stringify({
          input_tokens: 100, output_tokens: 20,
          cache_creation_input_tokens: 5, cache_read_input_tokens: 50,
          context_window: 128000,
        })],
        ["done", "{}"],
      ],
    });
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await submit(el, "算用量");
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;

    // used = input + cache_read + cache_creation = 155
    expect((el as any)._sessionUsage).toMatchObject({
      used: 155, contextWindow: 128000, calls: 1,
    });
  });

  it("⑦ 兜底切换后的下一条消息：激活预设未变 → 弹提醒框；「继续发送」放行", async () => {
    // 第一回合：fallback switched 事件 → 记下 {base, fallback}
    installFetch({
      events: [
        ["fallback", JSON.stringify({ phase: "searching", detail: "找…", from_model: "主模型A · glm-5.3", to_model: null, reason: "quota", report: [] })],
        ["fallback", JSON.stringify({ phase: "switched", detail: "已切换", from_model: "主模型A · glm-5.3", to_model: "账号B · glm-5.3", reason: "quota", report: [] })],
        ["token", JSON.stringify({ text: "兜底的回答" })],
        ["done", "{}"],
      ],
      statusModel: "主模型A",
    });
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await submit(el, "第一问");
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;
    expect((el as any)._lastSwitch).toEqual({ base: "主模型A", fallback: "账号B" });

    // 第二条消息：/api/status 仍报「主模型A」→ 拦截 + 弹提醒框，草稿回填
    await submit(el, "第二问");
    await el.updateComplete;
    expect((el as any)._fallbackReminderOpen).toBe(true);
    expect(el.draft).toBe("第二问");
    // 未发出：没有新增 user 消息（streaming 仍 false）
    const st = store.getState().chat;
    expect(st.streaming).toBe(false);
    expect(st.messages.filter((m) => m.role === "user").length).toBe(1);

    // 「继续发送」→ 关框、记录清空、消息真正发出（第二回合不再切：换普通流）
    installFetch({ events: [["token", JSON.stringify({ text: "ok" })], ["done", "{}"]], statusModel: "主模型A" });
    void (el as any)._onReminderProceed();
    await el.updateComplete;
    expect((el as any)._fallbackReminderOpen).toBe(false);
    expect((el as any)._lastSwitch).toBeNull();
    expect(store.getState().chat.streaming).toBe(true);
  });

  it("⑧ 兜底切换后的下一条消息：激活预设已变 → 不弹框直接发送", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    // 模拟上一回合切过（_loadSession 恢复形态），预设名「主模型A」
    (el as any)._lastSwitch = { base: "主模型A", fallback: "账号B" };
    actions.setChatState({ state: "focus", currentSession: { id: "s1", type: "chat", title: "t", preview: "", updated_at: "", message_count: 1 }, messages: [], streaming: false });

    installFetch({ events: [["token", JSON.stringify({ text: "ok" })], ["done", "{}"]], statusModel: "账号C" });
    const chatCalls0 = (global.fetch as any).mock.calls.length;
    await submit(el, "第二问");
    await el.updateComplete;
    expect((el as any)._fallbackReminderOpen).toBe(false);
    expect((el as any)._lastSwitch).toBeNull();
    // 直接发出：/api/chat 被调用、user 消息已追加（未拦截在输入框）
    const calls = (global.fetch as any).mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calls.includes("/api/chat")).toBe(true);
    expect(store.getState().chat.messages.filter((m) => m.role === "user").length).toBe(1);
    void chatCalls0;
  });
});
