import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-tool-trace";
import { buildFullText } from "../src/components/chat-tool-trace";
import type { ChatToolTrace } from "../src/components/chat-tool-trace";
import type { ToolStep } from "../src/state/types";

const running: ToolStep = { tool_use_id: "t1", name: "search", input: { query: "x" }, status: "running" };
const done: ToolStep = { tool_use_id: "t1", name: "search", input: { query: "x" }, output: "found 1", is_error: false, duration_ms: 120, status: "done" };

async function trace(steps: ToolStep[]): Promise<ChatToolTrace> {
  const el = await fixture(html`<chat-tool-trace .steps=${steps}></chat-tool-trace>`) as ChatToolTrace;
  await el.updateComplete;
  return el;
}

describe("<chat-tool-trace>", () => {
  it("expands and shows spinner while a step is running", async () => {
    const el = await trace([running]);
    expect(el.shadowRoot!.querySelector(".spin")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".summary")!.textContent).toContain("进行中");
  });

  it("auto-collapses when all steps finish", async () => {
    const el = await trace([running]);
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
    el.steps = [done];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
    expect(el.shadowRoot!.querySelector(".summary")!.textContent).toContain("1 步");
  });

  it("toggles expand on summary click", async () => {
    const el = await trace([done]);
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
  });

  it("marks error step with danger styling", async () => {
    const err: ToolStep = { tool_use_id: "t1", name: "search", input: {}, output: "Error: boom", is_error: true, status: "error" };
    const el = await trace([err]);
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".step.error")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".err")).toBeTruthy();
  });

  it("truncates long output with expand-all toggle", async () => {
    const long: ToolStep = {
      tool_use_id: "t1", name: "read_document", input: {},
      output: Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n"),
      status: "done",
    };
    const el = await trace([long]);
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    const more = el.shadowRoot!.querySelector(".more");
    expect(more).toBeTruthy();
    expect(more!.textContent).toContain("展开全部");
    // 点击展开全部后，.more 消失
    (more as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more")).toBeNull();
  });
});

describe("buildFullText", () => {
  it("returns header for empty steps", () => {
    expect(buildFullText([])).toBe("思考过程（0 步）");
  });

  it("includes full untruncated input and output for one step", () => {
    const longOutput = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const text = buildFullText([{
      tool_use_id: "t1", name: "search",
      input: { query: "python", options: { limit: 10, tags: ["a", "b"] } },
      output: longOutput, status: "done",
    }]);
    expect(text).toContain("思考过程（1 步）");
    expect(text).toContain("[1] search");
    expect(text).toContain("python");
    expect(text).toContain("limit");
    expect(text).toContain("line 0");
    expect(text).toContain("line 49");
    // 全文未截断
    const outputPart = text.split("结果：\n")[1];
    expect(outputPart.split("\n").length).toBe(50);
  });

  it("includes all steps in order", () => {
    const steps: ToolStep[] = [
      { tool_use_id: "t1", name: "search", input: { q: "x" }, output: "a", status: "done" },
      { tool_use_id: "t2", name: "read_document", input: { path: "d.md" }, output: "b\nc", status: "done" },
    ];
    const text = buildFullText(steps);
    expect(text.indexOf("[1] search")).toBeLessThan(text.indexOf("[2] read_document"));
    expect(text).toContain("[2] read_document");
    expect(text).toContain("path");
  });

  it("marks empty output as (无输出)", () => {
    const text = buildFullText([{ tool_use_id: "t1", name: "x", input: {}, status: "done" }]);
    expect(text).toContain("结果：（无输出）");
  });

  it("includes error step output verbatim", () => {
    const text = buildFullText([{ tool_use_id: "t1", name: "x", input: {}, output: "Error: boom", is_error: true, status: "error" }]);
    expect(text).toContain("Error: boom");
  });
});

describe("<chat-tool-trace> copy button", () => {
  it("renders copy button in summary with default label", async () => {
    const el = await trace([done]);
    const btn = el.shadowRoot!.querySelector("button.copy-btn");
    expect(btn).toBeTruthy();
    expect(btn!.textContent?.trim()).toBe("📋");
  });

  it("clicking copy writes the full untruncated text to clipboard and flips to 已复制", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", { value: {}, configurable: true, writable: true });
    }
    Object.defineProperty(navigator.clipboard, "writeText", { value: writeSpy, configurable: true, writable: true });

    const longOutput = "x".repeat(5000); // 远超默认 5 行 / 96px 截断，确保全文
    const el = await trace([{ tool_use_id: "t1", name: "search", input: { q: "k" }, output: longOutput, status: "done" }]);
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button.copy-btn")!;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = writeSpy.mock.calls[0][0] as string;
    expect(written).toContain(longOutput); // 全文未截断
    expect(written).toContain("[1] search");
    expect(written).toContain("\"q\""); // JSON 序列化后的参数
    expect(btn.textContent?.trim()).toBe("✓ 已复制");
    expect(btn.classList.contains("copied")).toBe(true);
  });
});
