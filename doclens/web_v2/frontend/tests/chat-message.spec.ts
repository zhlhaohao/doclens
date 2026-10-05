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

/** 思考流滑窗（2026-10-05 二修）：可滚动容器 + JS 尾锚（updated 里
 *  scrollTop=scrollHeight）——超高时显示最后两行；不足两行时 scrollTop
 *  赋值无效、内容自然从顶显示。纯 CSS 方案均缺陷：rtl 只锚水平（纵向
 *  裁底冻结头两行）；flex-end 贴底在内容不足两行时把单行压到第二行
 *  位置（首行空置）。 */
describe("<chat-message> thinking stream tail window", () => {
  const css = (): string => String((ChatMessageEl.styles as any).map?.((s: any) => String(s.cssText ?? s)).join("\n")
    ?? String((ChatMessageEl.styles as any).cssText ?? ""));

  it("tail window is a scroll container anchored by JS, not rtl/flex-end", async () => {
    const style = css();
    const block = style.slice(style.indexOf(".thinking-stream"));
    expect(block).toContain("overflow-y: auto");      // 可滚动容器
    expect(block).toContain("max-height: 3em");       // 两行限高
    expect(block).not.toContain("direction: rtl");    // rtl 只锚水平，纵向裁底 bug 根因
    expect(block).not.toContain("justify-content: flex-end"); // 不足两行时首行空置 bug 根因
  });

  it("renders thinking stream with full delta text while content empty", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "", thinking: "第一段推理" } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    const stream = el.shadowRoot!.querySelector(".thinking-stream span");
    expect(stream).toBeTruthy();
    expect(stream!.textContent).toBe("第一段推理");
    // 增量到达：textContent 跟随增长（DOM 层面增量可见，裁切由 CSS 负责）
    el.message = { role: "assistant", content: "", thinking: "第一段推理第二段推理" };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".thinking-stream span")!.textContent)
      .toBe("第一段推理第二段推理");
  });

  it("thinking stream removed once body starts", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${{ role: "assistant", content: "", thinking: "思考中..." } as any}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".thinking-stream")).toBeTruthy();
    el.message = { role: "assistant", content: "答案", thinking: "思考中..." };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".thinking-stream")).toBeNull();
  });

  it("anchors tail on thinking growth (scrollTop=scrollHeight in rAF)", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    try {
      const el = await fixture(
        html`<chat-message role="assistant" .message=${{ role: "assistant", content: "", thinking: "a" } as any}></chat-message>`,
      ) as ChatMessageEl;
      await el.updateComplete;
      // jsdom 无布局：scrollHeight 恒 0，scrollTop 赋值无效果——验证尾锚
      // 动作被触发即可（真实浏览器里布局真实，scrollTop 真实生效）
      const stream = el.shadowRoot!.querySelector(".thinking-stream") as HTMLElement;
      const setter = vi.spyOn(stream, "scrollTop", "set");
      el.message = { role: "assistant", content: "", thinking: "a".repeat(500) };
      await el.updateComplete;
      expect(setter).toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
