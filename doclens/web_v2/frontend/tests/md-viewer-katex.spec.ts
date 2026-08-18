import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { MdViewer } from "../src/components/md-viewer";
import "../src/components/md-viewer";

/**
 * KaTeX 公式渲染：$...$ 行内 / $$...$$ 块级（marked-katex-extension）。
 *
 * 关键回归点：
 * - 公式经完整管线（marked → DOMPurify → innerHTML）后 .katex 存活——
 *   验证 sanitize 不会剥掉 KaTeX 输出的 MathML/span/class/style。
 * - 公式内的 `_` 不被 marked emphasis 误解析（无 <em> 泄漏）。
 */
describe("<md-viewer> KaTeX 公式", () => {
  it("renders inline math $...$ as .katex", async () => {
    const el = await fixture(html`
      <md-viewer content="质能方程 $E=mc^2$ 著名"></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    const katex = el.shadowRoot!.querySelector(".katex");
    expect(katex).toBeTruthy();
    expect(katex!.textContent).toContain("E");
    // 段落文本仍完整（公式前后中文未被吞）
    expect(el.shadowRoot!.querySelector("p")!.textContent).toContain("质能方程");
  });

  it("renders block math $$...$$ as .katex-display", async () => {
    const md = "前文\n\n$$\n\\frac{a}{b} + \\sqrt{c}\n$$\n\n后文";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector(".katex-display")).toBeTruthy();
    const ps = el.shadowRoot!.querySelectorAll("p");
    expect(ps.length).toBe(2); // 前文/后文两个段落，公式独立成块
  });

  it("does not let underscores in formulas become <em>", async () => {
    const el = await fixture(html`
      <md-viewer content="$x_i + y_i$"></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    // 未被公式扩展接管时，marked 会把 _i + y_ 解析成 <em>i + y</em>
    expect(el.shadowRoot!.querySelector("em")).toBeNull();
    expect(el.shadowRoot!.querySelector(".katex")).toBeTruthy();
  });

  it("renders invalid formula as source text without throwing", async () => {
    // throwOnError:false —— 非法公式渲染为红色源码而非整个 parse 失败
    const el = await fixture(html`
      <md-viewer content="$\\badcmd{$"></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector(".md-body");
    expect(body).toBeTruthy();
    expect(body!.textContent).toContain("\\badcmd");
  });

  it("renders CJK-adjacent inline math (type-$l$ / $...$（)", async () => {
    // marked-katex 标准规则要求开 $ 前是空格、闭 $ 后是西文标点，
    // 中文语境的 type-$l$、$...$（ 会漏判（cjkInlineMath 兜底）
    const el = await fixture(html`
      <md-viewer content="每个 type-$l$ 张量为 $(2l+1)$ 维；方程 $\\mathbf{A}\\mathbf{X}=0$（齐次）"></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    const body = el.shadowRoot!.querySelector(".md-body")!;
    expect(body.querySelectorAll(".katex").length).toBe(3);
    expect(body.textContent).not.toContain("$");
  });

  it("keeps currency-like dollar signs as plain text", async () => {
    // 单个 $ 或不成对的 $ 不应触发公式解析
    const el = await fixture(html`
      <md-viewer content="价格是 $100 和 $200"></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector(".katex")).toBeNull();
    expect(el.shadowRoot!.textContent).toContain("$100");
  });

  it("renders single-line $$...$$ blocks (arxiv-style) as display math", async () => {
    // arxiv 转换 md 的真实形态：定界符不独占一行，且内部嵌套 $...$
    const md = "前文\n\n$$ $\\displaystyle\\rho(ab)=\\rho(a)\\rho(b)$ ( $\\forall a,b\\in G$ ) $$\n\n后文";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector(".katex-display")).toBeTruthy();
    expect(el.shadowRoot!.textContent).not.toContain("$$");
  });

  it("keeps data-source-line aligned after single-line $$ blocks", async () => {
    // 自定义 tokenizer 不改写源文本：后续块的行号与原始 md 一致（第 3 行公式、第 5 行段落）
    const md = "前文\n\n$$ x+y $$\n\n后文";
    const el = await fixture(html`<md-viewer content=${md}></md-viewer>`) as MdViewer;
    await el.updateComplete;

    const mathDiv = el.shadowRoot!.querySelector(".katex-display")!.parentElement!;
    expect(mathDiv.getAttribute("data-source-line")).toBe("3");
    const ps = el.shadowRoot!.querySelectorAll("p");
    expect(ps[1].getAttribute("data-source-line")).toBe("5");
  });

  it("survives DOMPurify (visible katex-html spans preserved)", async () => {
    const el = await fixture(html`
      <md-viewer content="$E=mc^2$"></md-viewer>
    `) as MdViewer;
    await el.updateComplete;

    // 可视渲染靠 .katex-html 的 span 树；必须扛过 sanitize。
    // 注：无障碍用的 <math>/<annotation> MathML 子树在 jsdom 下会被剥
    // （jsdom 无 MathML 命名空间解析），真实浏览器中视 DOMPurify 配置而定；
    // 丢失仅影响读屏器，不影响可视渲染。
    const visible = el.shadowRoot!.querySelector(".katex-html");
    expect(visible).toBeTruthy();
    expect(visible!.textContent).toContain("E");
  });
});
