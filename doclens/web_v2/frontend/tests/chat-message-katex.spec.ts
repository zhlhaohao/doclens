import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-message";
import { ChatMessageEl } from "../src/components/chat-message";

/**
 * AI 气泡 KaTeX 公式渲染（独立于 md-viewer 的全局 marked 配置）。
 *
 * 回归背景：聊天气泡曾用裸 marked.parse，KaTeX 扩展只在 md-viewer 的
 * ensureMdConfigured() 注册到全局 marked（打开过文档预览才生效）——
 * 纯聊天场景公式以 $...$ 原文显示。修复后 chat-message 使用独立
 * createMathMarked() 实例 + 内联 katex CSS。
 */
describe("<chat-message> KaTeX 公式", () => {
  const aiMsg = (content: string) => ({ role: "assistant", content }) as any;

  it("renders inline math $...$ as .katex", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${aiMsg("质能方程 $E=mc^2$ 著名")}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;

    const katex = el.shadowRoot!.querySelector(".katex");
    expect(katex).toBeTruthy();
    expect(el.shadowRoot!.querySelector("p")!.textContent).toContain("质能方程");
  });

  it("renders block math $$...$$ as .katex-display", async () => {
    const md = "前文\n\n$$\n\\frac{a}{b} + \\sqrt{c}\n$$\n\n后文";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${aiMsg(md)}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector(".katex-display")).toBeTruthy();
  });

  it("renders single-line $$...$$ (arxiv-style) as display math", async () => {
    const md = "推导：\n\n$$ $\\rho(ab)=\\rho(a)\\rho(b)$ ( $\\forall a,b\\in G$ ) $$\n\n如上";
    const el = await fixture(
      html`<chat-message role="assistant" .message=${aiMsg(md)}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector(".katex-display")).toBeTruthy();
    expect(el.shadowRoot!.textContent).not.toContain("$$");
  });

  it("does not let underscores in formulas become <em>", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${aiMsg("$x_i + y_i$")}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector("em")).toBeNull();
    expect(el.shadowRoot!.querySelector(".katex")).toBeTruthy();
  });

  it("keeps currency-like dollar signs as plain text", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${aiMsg("价格是 $100 和 $200")}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector(".katex")).toBeNull();
    expect(el.shadowRoot!.textContent).toContain("$100");
  });

  it("survives sanitize (visible .katex-html spans preserved)", async () => {
    const el = await fixture(
      html`<chat-message role="assistant" .message=${aiMsg("$E=mc^2$")}></chat-message>`,
    ) as ChatMessageEl;
    await el.updateComplete;

    // 气泡渲染链路 chatMarked.parse → linkifyReferences → sanitizeHtml → innerHTML，
    // 可视渲染靠 .katex-html 的 span 树，必须扛过 DOMPurify
    const visible = el.shadowRoot!.querySelector(".katex-html");
    expect(visible).toBeTruthy();
    expect(visible!.textContent).toContain("E");
  });

  /** 真实会话回归（arxiv/2512.13927 总结，2026-08-18）：marked-katex 标准规则
   *  在 CJK 语境漏判的行内公式（开 $ 前非空格 / 闭 $ 后 CJK 标点）。 */
  const cjkCases: Array<[string, string]> = [
    // [用例名, markdown 源]
    ["开 $ 紧贴连字符", "每个 type-$l$ 张量为 $(2l+1)$ 维"],
    ["闭 $ 后接 CJK 左括号", "方程 $\\mathbf{A}\\mathbf{X}-\\mathbf{X}\\mathbf{B}=0$（vec 后变成线性零空间问题）数值得到"],
    ["闭 $ 后接 CJK 右括号+分号", "Linear(32→$(2\\min(l,k)+1) m_i m_o$)；每对 $(k,l)$ 共享"],
    ["闭 $ 后接 CJK 分号", "总权重 $\\psi\\cdot\\varphi$；(iii) 高 type 边特征"],
    ["开 $ 前是中文冒号", "注意力分数：$\\alpha_{ij}=\\text{softmax}_j(q_i\\cdot k_{ij}/\\sqrt{d})$，逐节点归一化"],
    ["开 $ 前是中文逗号", "边级消息，$W^{lkV}$ 与 key 同结构"],
    ["含转义竖线的长公式", "解的结构：$\\mathbf{W}^{lk}(\\mathbf{x})=\\sum_{J=|k-l|}^{k+l}\\varphi^{lk}_J(\\|\\mathbf{x}\\|)\\,\\mathbf{W}^{lk}_J(\\mathbf{x})$，其中径向"],
  ];
  for (const [name, src] of cjkCases) {
    it(`CJK 行内公式：${name}`, async () => {
      const el = await fixture(
        html`<chat-message role="assistant" .message=${aiMsg(src)}></chat-message>`,
      ) as ChatMessageEl;
      await el.updateComplete;
      const md = el.shadowRoot!.querySelector(".md-body")!;
      // 所有 $...$ 都被认领：正文文本节点里不再有 $
      expect(md.textContent).not.toContain("$");
      expect(md.querySelector(".katex")).toBeTruthy();
      // 公式未被 emphasis/escape 啃烂：无 <em> 泄漏
      expect(md.querySelector("em")).toBeNull();
    });
  }
});
