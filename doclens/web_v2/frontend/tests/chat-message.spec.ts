import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-message";
import { ChatMessageEl } from "../src/components/chat-message";

/** A 方案（01e38d1）：引用不再是结构化 references 属性，而是后端把工具检索结果
 *  重写进正文「## 参考资料」章节，前端 linkify 该章节的 <li> 为 .ref-link。 */
describe("<chat-message> reference links (## 参考资料 linkify)", () => {
  function refsBody(paths: string[]): string {
    return `回答正文。\n\n## 参考资料\n\n${paths.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n`;
  }

  it("renders one .ref-link per list item under ## 参考资料 with data-path", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: refsBody(["科技/a.md", "科技/b.pdf"]) } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const links = el.shadowRoot!.querySelectorAll(".ref-link");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("data-path")).toBe("科技/a.md");
    expect(links[1].getAttribute("data-path")).toBe("科技/b.pdf");
  });

  it("any file extension is clickable (not restricted to .md / dir)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: refsBody(["report.pdf", "notes.txt", "data.xlsx"]) } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(3);
  });

  it("no 参考资料 section → no .ref-link", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "回答" } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(0);
  });

  it("click .ref-link dispatches reference-click with path (composed)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: refsBody(["docs/a.md"]) } as any}></chat-message>`,
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

  it("body text outside ## 参考资料 stays plain (no .ref-link)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "见 docs/a.md 与 docs/b.md 的对比。" } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(0);
  });

  it("linkified content updates on message change (streaming append)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "回答..." } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(0);
    el.message = { role: "assistant", content: refsBody(["a.md", "b.md"]) };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".ref-link").length).toBe(2);
  });
});
