import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/chat-tool-trace";
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
