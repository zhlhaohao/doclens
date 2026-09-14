import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/ask-card";
import type { AskCard } from "../src/components/ask-card";
import type { AskQuestionPayload } from "../src/api/ask";
import { splitRecommended, validateAskQuestions } from "../src/api/ask";

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

  it("does not revive answered card on re-render with same requestId", async () => {
    // 复现 ADR-0021 门禁确认场景：提交后 SSE 流恢复（tool_result/token 密集
    // 事件触发父组件重渲染），ask property 被赋同 requestId 的新引用——
    // 卡片不得复活成 pending（否则选项仍可再选）
    const respondAsk = vi.fn().mockResolvedValue({ ok: true, submitted: true });
    vi.doMock("../src/api/ask", () => ({ respondAsk }));
    const el = await card({ requestId: "r8", questions: [singleQ] });
    (el.shadowRoot!.querySelector('input[type="radio"]') as HTMLInputElement).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".summary")).toBeTruthy();

    // 模拟父组件重渲染：同一 requestId、新对象引用
    el.ask = { requestId: "r8", questions: [{ ...singleQ }] };
    await el.updateComplete;

    // 仍是摘要态，无交互选项、无提交按钮
    expect(el.shadowRoot!.querySelector(".summary")).toBeTruthy();
    expect(el.shadowRoot!.querySelector('input[type="radio"]')).toBeNull();
    expect(el.shadowRoot!.querySelector("button.primary")).toBeNull();

    // 不同 requestId 才重置为 pending（新悬置问题）
    el.ask = { requestId: "r9", questions: [{ ...singleQ }] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('input[type="radio"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector("button.primary")).toBeTruthy();
  });

  it("renders guard card with banner, distinct style, and no Other input", async () => {
    const guardQ: AskQuestionPayload = { ...singleQ, guard: true };
    const el = await card({ requestId: "g1", questions: [guardQ] });
    expect(el.shadowRoot!.querySelector(".card.guard")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".guard-banner")!.textContent)
      .toContain("安全确认");
    // guard 问题不提供 Other 自由文本输入（防歧义授权）
    expect(el.shadowRoot!.querySelector(".other-row input")).toBeNull();
    // 非 guard 卡片保留 Other
    const plain = await card({ requestId: "g2", questions: [singleQ] });
    expect(plain.shadowRoot!.querySelector(".other-row input")).toBeTruthy();
  });

  it("guard card times out to explicit rejected summary (not silent vanish)", async () => {
    vi.useFakeTimers();
    try {
      const onDone = vi.fn();
      const guardQ: AskQuestionPayload = { ...singleQ, guard: true };
      const el = await fixture(html`
        <ask-card .ask=${{ requestId: "gd1", questions: [guardQ] }} @ask-done=${onDone}></ask-card>
      `) as AskCard;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector(".card.guard")).toBeTruthy();

      // 超时到点：交互卡转为「已按拒绝处理」摘要（明确交代结果），不可再交互
      await vi.advanceTimersByTimeAsync(122_000);
      await el.updateComplete;
      const summary = el.shadowRoot!.querySelector(".summary")!;
      expect(summary).toBeTruthy();
      expect(el.shadowRoot!.querySelector('input[type="radio"]')).toBeNull();
      expect(el.shadowRoot!.querySelector("button.primary")).toBeNull();
      expect(summary.textContent).toContain("已按拒绝处理");
      expect(summary.textContent).toContain("并未同意");
      // 派发 ask-done（解除输入禁用；不带 dismiss——摘要保留至流结束）
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { requestId: "gd1" } }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("plain (non-guard) card has no auto-dismiss timer", async () => {
    vi.useFakeTimers();
    try {
      const el = await card({ requestId: "pd1", questions: [singleQ] });
      await vi.advanceTimersByTimeAsync(122_000);
      await el.updateComplete;
      // 普通卡片不受门禁超时影响，仍为交互态
      expect(el.shadowRoot!.querySelector(".card")).toBeTruthy();
      expect(el.shadowRoot!.querySelector("button.primary")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
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

describe("validateAskQuestions", () => {
  it("accepts valid payload", () => {
    const qs = validateAskQuestions([singleQ, multiQ]);
    expect(qs!.length).toBe(2);
    expect(qs![1].multiSelect).toBe(true);
  });
  it("rejects malformed structure", () => {
    expect(validateAskQuestions("not array")).toBeNull();
    expect(validateAskQuestions([])).toBeNull();
    expect(validateAskQuestions([{ question: "q" }])).toBeNull();
    expect(
      validateAskQuestions([{ question: "q", header: "h", options: [{ label: "A" }] }]),
    ).toBeNull(); // 少于 2 选项
  });
});
