import { describe, it, expect } from "vitest";
import { fixture, nextFrame } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/history-item";
import type { HistoryItem } from "../src/components/history-item";

/** 收集组件样式 CSS 文本：adoptedStyleSheets（生产）+ <style>（dev）
 *  双源合并——jsdom 对 mask/computedStyle 支持不全，样式断言走源 CSS。 */
function cssTextOf(el: HistoryItem): string {
  const root = el.shadowRoot!;
  const parts: string[] = [];
  const sheets = [...(root.adoptedStyleSheets ?? [])] as CSSStyleSheet[];
  for (const s of sheets) parts.push([...s.cssRules].map((r) => r.cssText).join("\n"));
  for (const style of root.querySelectorAll("style")) parts.push(style.textContent ?? "");
  return parts.join("\n");
}

describe("<history-item> 标题尾部保可见（2026-10-26）", () => {
  it("标题在 .name-text > .name-text-inner 双层结构内，完整标题在 title", async () => {
    const el = await fixture<HistoryItem>(html`
      <history-item .session=${{
        id: "s1", type: "chat", title: "日志分析 · 深夜批次失败排查 · 第 3 部分",
        preview: "", updated_at: "2026-10-26T00:00:00Z", message_count: 5,
      }}></history-item>
    `);
    await nextFrame();
    const outer = el.shadowRoot!.querySelector(".name-text") as HTMLElement;
    const inner = outer.querySelector(".name-text-inner");
    expect(outer).toBeTruthy();
    expect(inner).toBeTruthy();
    expect(inner!.textContent).toContain("第 3 部分");
    expect(outer.getAttribute("title")).toBe(
      "日志分析 · 深夜批次失败排查 · 第 3 部分");
  });

  it("两态样式：默认左对齐；.over 态尾锚定 + 左端 24px mask 渐隐", async () => {
    const el = await fixture<HistoryItem>(html`
      <history-item .session=${{
        id: "s1", type: "chat", title: "t", preview: "",
        updated_at: "2026-10-26T00:00:00Z", message_count: 1,
      }}></history-item>
    `);
    await nextFrame();
    const css = cssTextOf(el);
    // .over 态（JS 测量溢出时加）：flex-end 尾锚定——溢出向左裁、尾部保可见
    expect(/\.name-text\.over[\s\S]*?justify-content:\s*flex-end/.test(css)).toBe(true);
    // .over 态左端渐隐 mask（视觉省略号；-webkit 前缀兜 WebView/旧内核）
    expect(/\.name-text\.over[\s\S]*?mask-image:\s*linear-gradient\(to right,\s*transparent 0,\s*black 24px\)/.test(css)).toBe(true);
    // 非 .over（短标题）：无 flex-end（正常左对齐，第一版无条件贴右的教训）
    const plainBlock = css.match(/\.name-text\s*\{[^}]*\}/)?.[0] ?? "";
    expect(plainBlock.includes("justify-content")).toBe(false);
  });

  it("grep mode-tag 不被压缩（flex-shrink:0），tag 与标题节点分离", async () => {
    const el = await fixture<HistoryItem>(html`
      <history-item .session=${{
        id: "s2", type: "search", mode: "grep",
        title: " kirin.*cache", preview: "",
        updated_at: "2026-10-26T00:00:00Z", message_count: 0,
      }}></history-item>
    `);
    await nextFrame();
    const tag = el.shadowRoot!.querySelector(".mode-tag") as HTMLElement;
    const inner = el.shadowRoot!.querySelector(".name-text-inner") as HTMLElement;
    expect(tag).toBeTruthy();
    expect(inner).toBeTruthy();
    expect(inner.textContent).toBe(" kirin.*cache");
    expect(/\.mode-tag[\s\S]*?flex-shrink:\s*0/.test(cssTextOf(el))).toBe(true);
  });
});
