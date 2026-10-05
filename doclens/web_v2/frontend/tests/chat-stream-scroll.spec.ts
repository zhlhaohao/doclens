import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-stream";
import { ChatStream } from "../src/components/chat-stream";
import type { TimelineNode } from "../src/views/chat-timeline";

/** 贴底粘滞（stick-to-bottom，2026-10-05）：思考流高频刷新期间用户上滚
 *  回看 → 视口冻结不被拽回；贴底时恢复跟随；scrollToBottom() 强制回底。
 *  jsdom 无布局（scrollHeight/clientHeight 恒 0），stub 三属性模拟滚动几何。 */

const nodes = (n: number): TimelineNode[] =>
  Array.from({ length: n }, (_, i) => ({
    type: "message" as const,
    message: { role: "user" as const, content: `m${i}` },
  }));

/** stub 滚动几何：contentH = scrollHeight，viewH = clientHeight。 */
function stubLayout(el: ChatStream, contentH: number, viewH: number): void {
  let top = 0;
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => contentH });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => viewH });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => { top = v; },
  });
}

/** 推进 rAF（updated 的跟随滚底在下一帧执行）。 */
describe("<chat-stream> stick-to-bottom", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("follows bottom while pinned (initial default)", async () => {
    const el = await fixture(html`<chat-stream .nodes=${nodes(3)}></chat-stream>`) as ChatStream;
    stubLayout(el, 1000, 300);
    el.nodes = nodes(4); // 流式增量 → updated()
    await el.updateComplete;
    expect(el.scrollTop).toBe(1000); // 贴底跟随：滚到 scrollHeight
  });

  it("freezes viewport after user scrolls up (thinking stream refresh no longer yanks)", async () => {
    const el = await fixture(html`<chat-stream .nodes=${nodes(3)}></chat-stream>`) as ChatStream;
    stubLayout(el, 1000, 300);
    // 用户上滚到 400（距底 300 > 阈值 80）→ 脱离粘滞
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => 400,
      set: () => { /* 用户滚动位置，不被程序覆盖 */ },
    });
    el.dispatchEvent(new Event("scroll"));
    expect(el.pinned).toBe(false);
    // 流式增量继续到达（思考流刷新）→ 不再拽回底部（setter 证明未被调用）
    el.nodes = nodes(4);
    await el.updateComplete;
    expect(el.pinned).toBe(false);
  });

  it("re-pins when user scrolls back near bottom", async () => {
    const el = await fixture(html`<chat-stream .nodes=${nodes(3)}></chat-stream>`) as ChatStream;
    stubLayout(el, 1000, 300);
    let top = 400;
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (v: number) => { top = v; },
    });
    el.dispatchEvent(new Event("scroll")); // 上滚 → unpinned
    expect(el.pinned).toBe(false);
    top = 600; // 距底 100 > 阈值 80 → 仍离底
    el.dispatchEvent(new Event("scroll"));
    expect(el.pinned).toBe(false);
    top = 630; // 距底 70 ≤ 阈值 80 → 重新贴底
    el.dispatchEvent(new Event("scroll"));
    expect(el.pinned).toBe(true);
    // 恢复跟随：下一个流式增量重新滚底
    el.nodes = nodes(5);
    await el.updateComplete;
    expect(el.scrollTop).toBe(1000);
  });

  it("scrollToBottom() forces re-pin and scroll regardless of position", async () => {
    const el = await fixture(html`<chat-stream .nodes=${nodes(3)}></chat-stream>`) as ChatStream;
    let top = 0;
    stubLayout(el, 1000, 300);
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (v: number) => { top = v; },
    });
    // 用户上滚冻结
    top = 100;
    el.dispatchEvent(new Event("scroll"));
    expect(el.pinned).toBe(false);
    // 发送新消息：强制回底 + 恢复粘滞
    el.scrollToBottom();
    expect(el.pinned).toBe(true);
    expect(top).toBe(1000);
  });

  it("programmatic follow scroll does not unpin itself", async () => {
    // 程序性 scrollTop=scrollHeight 触发 scroll 事件：距底 0 ≤ 阈值，
    // _pinned 保持 true（跟随不会把自己顶下线）
    const el = await fixture(html`<chat-stream .nodes=${nodes(3)}></chat-stream>`) as ChatStream;
    stubLayout(el, 1000, 300);
    el.nodes = nodes(4); // 跟随滚底 → scrollTop=1000 → scroll 事件
    await el.updateComplete;
    el.dispatchEvent(new Event("scroll")); // 程序滚动的 scroll 回放
    expect(el.pinned).toBe(true);
  });
});
