import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-stream";
import { ChatStream } from "../src/components/chat-stream";
import type { TimelineNode } from "../src/views/chat-timeline";

/**
 * 转录内错误卡（2026-11-18）：上游原始报文（`unknown error, 715 (1000)`）
 * 不进主文案——主文案只给可读句，原始码进可展开的「技术详情」。
 */

const nodes: TimelineNode[] = [
  { type: "message", message: { role: "user", content: "问题" } },
  { type: "message", message: { role: "assistant", content: "半截回答" } },
];

async function renderStream(props: {
  lastError: string | null;
  lastErrorDetail?: string | null;
}): Promise<ChatStream> {
  const el = await fixture<ChatStream>(
    html`<chat-stream
      .nodes=${nodes}
      .lastError=${props.lastError}
      .lastErrorDetail=${props.lastErrorDetail ?? null}
    ></chat-stream>`,
  );
  await el.updateComplete;
  return el;
}

describe("chat-stream 错误卡", () => {
  it("无错误时不渲染错误卡", async () => {
    const el = await renderStream({ lastError: null });
    expect(el.shadowRoot!.querySelector(".error-card")).toBeNull();
  });

  it("主文案显示可读句，不含裸错误码", async () => {
    const el = await renderStream({
      lastError: "对话失败：模型服务暂时不可用，请稍后重试。",
      lastErrorDetail: "unknown error, 715 (1000)",
    });
    const card = el.shadowRoot!.querySelector(".error-card")!;
    expect(card).toBeTruthy();
    const msg = card.querySelector(".error-msg")!.textContent ?? "";
    expect(msg).toContain("模型服务暂时不可用");
    expect(msg).not.toContain("unknown error");
    expect(msg).not.toContain("715");
  });

  it("技术详情默认收起，展开后可见原始码", async () => {
    const el = await renderStream({
      lastError: "对话失败：模型服务暂时不可用，请稍后重试。",
      lastErrorDetail: "unknown error, 715 (1000)",
    });
    const details = el.shadowRoot!.querySelector("details.error-detail")!;
    expect(details).toBeTruthy();
    expect(details.hasAttribute("open")).toBe(false);
    expect(details.querySelector("code")!.textContent).toContain("unknown error, 715 (1000)");
  });

  it("无技术详情时不渲染 details", async () => {
    const el = await renderStream({ lastError: "对话失败：网络连接中断" });
    expect(el.shadowRoot!.querySelector("details.error-detail")).toBeNull();
  });

  it("错误卡带重试按钮（复用 reask 通道）", async () => {
    const el = await renderStream({ lastError: "对话失败：网络连接中断" });
    const btn = el.shadowRoot!.querySelector(".error-retry")!;
    expect(btn).toBeTruthy();
  });
});
