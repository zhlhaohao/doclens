import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-message";
import { ChatMessageEl } from "../src/components/chat-message";

describe("<chat-message> reference links", () => {
  it("wraps reference list items as .ref-link with data-path", async () => {
    const content = "回答正文。\n\n## 参考资料\n\n1. docs/a.md\n2. docs/b.md\n";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".md-body .ref-link");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("data-path")).toBe("docs/a.md");
    expect(links[1].getAttribute("data-path")).toBe("docs/b.md");
  });

  it("does not touch body lists (only the 参考资料 section)", async () => {
    const content = "步骤：\n\n1. 第一步\n2. 第二步\n\n## 参考资料\n\n1. x.md\n";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".md-body .ref-link");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("data-path")).toBe("x.md");
  });

  it("no 参考资料 section → no .ref-link, no error", async () => {
    const content = "只是普通回答，没有参考资料列表。";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".md-body .ref-link").length).toBe(0);
  });

  it("click .ref-link dispatches reference-click with path (composed)", async () => {
    const content = "## 参考资料\n\n1. docs/a.md\n";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content } as any}></chat-message>`,
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

  it("idempotent across streaming updates (no duplicate links)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "回答..." } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    el.message = { role: "assistant", content: "回答...\n\n## 参考资料\n\n1. a.md\n" };
    await el.updateComplete;
    el.message = { role: "assistant", content: "回答...\n\n## 参考资料\n\n1. a.md\n2. b.md\n" };
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".md-body .ref-link");
    expect(links.length).toBe(2);
  });
});
