import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/ask-card";
import type { AskCard } from "../src/components/ask-card";
import type { AskQuestionPayload } from "../src/api/ask";
import { splitRecommended, parseAskQuestions } from "../src/api/ask";

const singleQ: AskQuestionPayload = {
  question: "选哪个方案?",
  header: "方案",
  multiSelect: false,
  options: [
    { label: "(Recommended) 方案A", description: "首选" },
    { label: "方案B", description: "备选" },
  ],
};
const multiQ: AskQuestionPayload = {
  question: "需要哪些能力?",
  header: "能力",
  multiSelect: true,
  options: [
    { label: "检索", description: "d1" },
    { label: "问答", description: "d2" },
    { label: "导出", description: "d3" },
  ],
};

async function card(ask: { requestId: string; questions: AskQuestionPayload[] }): Promise<AskCard> {
  const el = await fixture(html`<ask-card .ask=${ask}></ask-card>`) as AskCard;
  await el.updateComplete;
  return el;
}

describe("<ask-card>", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders questions with options and recommendation badge", async () => {
    const el = await card({ requestId: "r1", questions: [singleQ] });
    const labels = [...el.shadowRoot!.querySelectorAll(".opt-label")].map((n) => n.textContent);
    expect(labels[0]).toContain("方案A");
    expect(el.shadowRoot!.querySelector(".badge")!.textContent).toContain("推荐");
    // 单选渲染 radio
    expect(el.shadowRoot!.querySelector('input[type="radio"]')).toBeTruthy();
  });

  it("renders checkboxes for multiSelect", async () => {
    const el = await card({ requestId: "r2", questions: [multiQ] });
    expect(el.shadowRoot!.querySelectorAll('input[type="checkbox"]').length).toBe(3);
    expect(el.shadowRoot!.querySelectorAll('input[type="radio"]').length).toBe(0);
  });

  it("submit disabled until every question has an answer", async () => {
    const el = await card({ requestId: "r3", questions: [singleQ, multiQ] });
    const btn = el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 选第一问
    const radio = el.shadowRoot!.querySelector('input[type="radio"]') as HTMLInputElement;
    radio.click();
    await el.updateComplete;
    expect(btn.disabled).toBe(true); // 第二问仍未答
    const cb = el.shadowRoot!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    cb.click();
    await el.updateComplete;
    expect(btn.disabled).toBe(false);
  });

  it("multiSelect toggles and untoggles options", async () => {
    const el = await card({ requestId: "r4", questions: [multiQ] });
    const boxes = [...el.shadowRoot!.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    boxes[0].click();
    await el.updateComplete;
    boxes[2].click();
    await el.updateComplete;
    // 再点一次取消
    boxes[0].click();
    await el.updateComplete;
    expect(boxes[0].checked).toBe(false);
    expect(boxes[2].checked).toBe(true);
  });

  it("submits answers via respondAsk and collapses to summary", async () => {
    const respondAsk = vi.fn().mockResolvedValue({ ok: true, submitted: true });
    vi.doMock("../src/api/ask", () => ({ respondAsk }));
    const el = await card({ requestId: "r5", questions: [singleQ] });
    (el.shadowRoot!.querySelector('input[type="radio"]') as HTMLInputElement).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement).click();
    // 动态 import 的 mock 生效于组件内部的 await import()；等待摘要渲染
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;
    expect(respondAsk).toHaveBeenCalledWith(expect.objectContaining({ request_id: "r5" }));
    const summary = el.shadowRoot!.querySelector(".summary");
    expect(summary).toBeTruthy();
    expect(summary!.textContent).toContain("方案A");
  });

  it("marks expired when respond returns submitted=false", async () => {
    const respondAsk = vi.fn().mockResolvedValue({ ok: false, submitted: false });
    vi.doMock("../src/api/ask", () => ({ respondAsk }));
    const el = await card({ requestId: "r6", questions: [singleQ] });
    (el.shadowRoot!.querySelector('input[type="radio"]') as HTMLInputElement).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".expired-note")!.textContent).toContain("失效");
  });

  it("renders readonly summary from resolvedAnswers (history view)", async () => {
    const el = await fixture(html`
      <ask-card .resolvedAnswers=${[
        { question: "选哪个方案?", selected: ["方案A"], other: "补充说明" },
      ]}></ask-card>
    `) as AskCard;
    await el.updateComplete;
    const summary = el.shadowRoot!.querySelector(".summary")!;
    expect(summary.textContent).toContain("选哪个方案?");
    expect(summary.textContent).toContain("方案A");
    expect(summary.textContent).toContain("补充说明");
    // 只读态无提交按钮
    expect(el.shadowRoot!.querySelector("button.primary")).toBeNull();
  });

  it("dispatches ask-done event after submit", async () => {
    const respondAsk = vi.fn().mockResolvedValue({ ok: true, submitted: true });
    vi.doMock("../src/api/ask", () => ({ respondAsk }));
    const onDone = vi.fn();
    const el = await fixture(html`<ask-card .ask=${{ requestId: "r7", questions: [singleQ] }} @ask-done=${onDone}></ask-card>`) as AskCard;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('input[type="radio"]') as HTMLInputElement).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { requestId: "r7" } }),
    );
  });
});

describe("splitRecommended", () => {
  it("strips English prefix", () => {
    const [label, rec] = splitRecommended("(Recommended) 方案A");
    expect(label).toBe("方案A");
    expect(rec).toBe(true);
  });
  it("strips Chinese suffix", () => {
    const [label, rec] = splitRecommended("方案A（推荐）");
    expect(label).toBe("方案A");
    expect(rec).toBe(true);
  });
  it("keeps plain label", () => {
    const [label, rec] = splitRecommended("方案B");
    expect(label).toBe("方案B");
    expect(rec).toBe(false);
  });
});

describe("parseAskQuestions", () => {
  it("parses valid payload", () => {
    const qs = parseAskQuestions(JSON.stringify({ questions: [singleQ, multiQ] }));
    expect(qs!.length).toBe(2);
    expect(qs![1].multiSelect).toBe(true);
  });
  it("rejects malformed json / structure", () => {
    expect(parseAskQuestions("not json")).toBeNull();
    expect(parseAskQuestions(JSON.stringify({ questions: [] }))).toBeNull();
    expect(parseAskQuestions(JSON.stringify({ questions: [{ question: "q" }] }))).toBeNull();
    expect(
      parseAskQuestions(JSON.stringify({ questions: [{ question: "q", header: "h", options: [{ label: "A" }] }] })),
    ).toBeNull(); // 少于 2 选项
  });
});
