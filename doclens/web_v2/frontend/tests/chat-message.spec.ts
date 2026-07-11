import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-message";
import { ChatMessageEl } from "../src/components/chat-message";

describe("<chat-message> reference cards (structured)", () => {
  it("renders one .ref-link per reference with data-path", async () => {
    const message = {
      role: "assistant",
      content: "回答正文。",
      references: [{ path: "科技/a.md" }, { path: "科技/b.pdf" }],
    } as any;
    const el = await fixture(
      html`<chat-message role="assistant" .message=${message}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".ref-link");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("data-path")).toBe("科技/a.md");
    expect(links[1].getAttribute("data-path")).toBe("科技/b.pdf");
  });

  it("any file extension is clickable (no longer restricted to .md / dir)", async () => {
    // 旧正则要求路径含 .md 或 / 才识别；结构化数据来自工具结果，任意路径都可点
    const message = {
      role: "assistant",
      content: "x",
      references: [{ path: "report.pdf" }, { path: "notes.txt" }, { path: "data.xlsx" }],
    } as any;
    const el = await fixture(
      html`<chat-message role="assistant" .message=${message}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(3);
  });

  it("no references → no reference section, no .ref-link", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "回答" } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(0);
    expect(el.shadowRoot!.querySelector(".references")).toBeNull();
  });

  it("click .ref-link dispatches reference-click with path (composed)", async () => {
    const message = { role: "assistant", content: "回答", references: [{ path: "docs/a.md" }] } as any;
    const el = await fixture(
      html`<chat-message role="assistant" .message=${message}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener("reference-click", handler);
    const link = el.shadowRoot!.querySelector(".ref-link") as HTMLElement;
    link.click();
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0][0] as CustomEvent<{ path: string }>;
    expect(ev.detail.path).toBe("docs/a.md");
    expect(ev.composed).toBe(true);
  });

  it("does NOT parse ## 参考资料 text in body (structured references only)", async () => {
    // 旧逻辑从正文 ## 参考资料 提取路径包裹成链接；新逻辑只用结构化 references。
    // 正文里的路径文本保持纯文本，不应产生 .ref-link。
    const message = {
      role: "assistant",
      content: "回答。\n\n## 参考资料\n\n1. docs/a.md\n2. docs/b.md\n",
    } as any;
    const el = await fixture(
      html`<chat-message role="assistant" .message=${message}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(0);
  });

  it("reference cards update when references arrive after content (streaming)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "回答..." } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(0);
    el.message = { role: "assistant", content: "回答...", references: [{ path: "a.md" }, { path: "b.md" }] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(2);
  });
});
