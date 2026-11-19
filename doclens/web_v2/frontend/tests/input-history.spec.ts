import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture, html } from "@open-wc/testing";
import "../src/views/chat-view";
import "../src/components/chat-stream";
import "../src/components/input-box";
import { resetStore, setDesktopViewport } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { ChatView } from "../src/views/chat-view";
import type { InputBox } from "../src/components/input-box";

/**
 * 输入历史 ↑/↓ 回溯（打开任意历史会话都能用）。
 *
 * 覆盖两条链路：
 *   ① 历史会话：store.messages 由后端灌入（含多条 user 问题）→ ↑ 依次回溯
 *   ② 本会话新发问题：提交后立即进入历史列表 → ↑ 可回溯
 */

function jsonRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

/** session detail 响应：items = 后端 session_items（message_user/message_ai）。 */
function sessionDetail(userTexts: string[]) {
  const items = userTexts.flatMap((t, i) => [
    { kind: "message_user", payload: JSON.stringify({ content: t }), seq: i * 2 + 1 },
    { kind: "message_ai", payload: JSON.stringify({ content: `答${i}` }), seq: i * 2 + 2 },
  ]);
  return jsonRes({ items, generating: false });
}

describe("<chat-view> 输入历史 ↑/↓ 回溯", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    resetStore(store);
    setDesktopViewport();
    actions.setChatState({ state: "initial", currentSession: null, messages: [], streaming: false });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** 取 chat-view 里的 input-box 元素。 */
  async function inputBoxOf(el: ChatView): Promise<InputBox> {
    await el.updateComplete;
    return el.renderRoot.querySelector("input-box") as InputBox;
  }

  /** 触发一次 ↑ / ↓ 键。 */
  async function press(ib: InputBox, key: string) {
    await ib.updateComplete;
    const field = ib.renderRoot.querySelector(".field") as HTMLTextAreaElement;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
    field.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await ib.updateComplete;
  }

  it("① 打开历史会话：↑ 依次回溯会话里的用户问题", async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).startsWith("/api/sessions/s-hist")) {
        return sessionDetail(["第一个问题", "第二个问题", "第三个问题"]);
      }
      return jsonRes({});
    }) as unknown as typeof fetch;

    // 直接把后端会话灌进 store（等价于 _loadSession 完成后的状态）
    actions.setChatState({
      state: "focus",
      currentSession: {
        id: "s-hist", type: "chat", title: "历史会话", preview: "",
        updated_at: new Date().toISOString(), message_count: 6,
      },
      messages: [
        { role: "user", content: "第一个问题" },
        { role: "assistant", content: "答0" },
        { role: "user", content: "第二个问题" },
        { role: "assistant", content: "答1" },
        { role: "user", content: "第三个问题" },
        { role: "assistant", content: "答2" },
      ],
      streaming: false,
    });

    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    const ib = await inputBoxOf(el);

    // ↑ 取最近一条
    await press(ib, "ArrowUp");
    expect(ib.value).toBe("第三个问题");

    // 再 ↑ 取更早一条
    await press(ib, "ArrowUp");
    expect(ib.value).toBe("第二个问题");

    // ↓ 回到更近一条
    await press(ib, "ArrowDown");
    expect(ib.value).toBe("第三个问题");
  });

  it("② 历史会话：↓ 翻到底恢复未发送草稿", async () => {
    actions.setChatState({
      state: "focus",
      currentSession: {
        id: "s-hist2", type: "chat", title: "历史会话2", preview: "",
        updated_at: new Date().toISOString(), message_count: 2,
      },
      messages: [
        { role: "user", content: "旧问题" },
        { role: "assistant", content: "答" },
      ],
      streaming: false,
    });

    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    const ib = await inputBoxOf(el);

    // 先起草稿
    ib.value = "草稿";
    ib.dispatchEvent(new CustomEvent("input-change", { detail: { value: "草稿" } }));
    await ib.updateComplete;

    await press(ib, "ArrowUp");
    expect(ib.value).toBe("旧问题");

    // ↓ 翻出历史 → 恢复草稿
    await press(ib, "ArrowDown");
    expect(ib.value).toBe("草稿");
  });

  it("③ 本会话新发的问题立即进入历史列表（↑ 可回溯）", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    const ib = await inputBoxOf(el);

    // 提交一条问题（不进会话流，只看列表派生）
    actions.setChatState({
      messages: [{ role: "user", content: "刚问的" }],
    });
    await el.updateComplete;

    await press(ib, "ArrowUp");
    expect(ib.value).toBe("刚问的");
  });
});
