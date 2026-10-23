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

  it("manual expand survives run-finish auto-collapse", async () => {
    // 用户在运行中手动收起又展开（反复查看）→ 结尾为展开态；
    // 运行结束不得自动收起（尊重显式操作）
    const el = await trace([running]);
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();

    el.steps = [done];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
  });

  it("manual collapse during run suppresses auto re-expand", async () => {
    // 运行中用户手动收起 → 新一轮工具开始（running 再现）不得强制展开
    const el = await trace([running]);
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();

    const running2: ToolStep = { tool_use_id: "t2", name: "search", input: {}, status: "running" };
    el.steps = [done, running2];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
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
  it("renders icon-only copy button in summary (Lucide copy icon)", async () => {
    const el = await trace([done]);
    const btn = el.shadowRoot!.querySelector("button.copy-btn");
    expect(btn).toBeTruthy();
    expect(btn!.querySelector("doclens-icon")?.getAttribute("name")).toBe("copy");
    // icon-only：按钮默认无文字（title 提供提示）
    expect(btn!.textContent?.trim()).toBe("");
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
    // 复制成功：图标翻转为 check + 文字「已复制」
    expect(btn.textContent?.trim()).toContain("已复制");
    expect(btn.querySelector("doclens-icon")?.getAttribute("name")).toBe("check");
    expect(btn.classList.contains("copied")).toBe(true);
  });
});

/** 全局展开指令（2026-10-21「展开全部/收起全部」三钮组）：override 压过
 *  流式自动展开/收起；手动单点上报 manual=true 让宿主作废指令。 */
describe("<chat-tool-trace> expandOverride", () => {
  it("forces the block open even for a finished trace", async () => {
    const el = await trace([done]);
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
    el.expandOverride = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
    el.expandOverride = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
  });

  it("beats run-start auto-expand while override is false", async () => {
    const el = await trace([done]);
    el.expandOverride = false;
    await el.updateComplete;
    el.steps = [running]; // 自动逻辑本该展开
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
  });

  it("beats run-finish auto-collapse while override is true", async () => {
    const el = await trace([running]);
    el.expandOverride = true;
    await el.updateComplete;
    el.steps = [done]; // 自动逻辑本该收起
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeTruthy();
  });

  it("reports state changes, and manual clicks are flagged", async () => {
    const el = await trace([done]);
    const seen: { key: string; expanded: boolean; manual: boolean }[] = [];
    el.addEventListener("trace-expanded", (e) => seen.push((e as CustomEvent).detail));

    el.expandOverride = true;
    await el.updateComplete;
    expect(seen.at(-1)).toEqual({ key: "t1", expanded: true, manual: false });

    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(seen.at(-1)).toEqual({ key: "t1", expanded: false, manual: true });
  });
});

// ---- 插话（ADR-0048）----

describe("<chat-tool-trace> interjection", () => {
  const interjectWaiting: ToolStep = {
    tool_use_id: "interject_ab12", name: "user_interject",
    input: { question: "现在进度汇报一下" }, status: "running",
  };
  const interjectDone: ToolStep = {
    ...interjectWaiting, output: "已完成检索，正在写报告", status: "done",
  };

  it("generating trace shows interject button; non-generating hides it", async () => {
    // 显隐锚点是 generating（会话 streaming 态）而非 running 步骤——
    // LLM 流式间隙步骤全 done，按步骤单独判定会闪烁显隐（用户实测反馈）；
    // running 步骤作为兜底（父级状态缺失时不隐藏），故此处用 done 步骤断言隐藏。
    const el = await trace([done]);
    el.generating = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".interject-btn")).toBeTruthy();
    el.generating = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".interject-btn")).toBeNull();
  });

  it("running step keeps button visible even if generating flag is missing", async () => {
    // 兜底：父级 generating 未传 / 传错时，running 步骤仍在场即不隐藏
    const el = await trace([running]);
    el.generating = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".interject-btn")).toBeTruthy();
  });

  it("button stays visible while steps are all-done but generating", async () => {
    // 工具轮间隙（无 running 步骤）但回合生成中——按钮不消失
    const el = await trace([done]);
    el.generating = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".interject-btn")).toBeTruthy();
  });

  it("interject button reflects pending state (已插入 + disabled)", async () => {
    const el = await trace([running]);
    el.generating = true;
    await el.updateComplete;
    el.interjectPending = true;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".interject-btn") as HTMLButtonElement;
    expect(btn.textContent).toContain("已插入");
    expect(btn.disabled).toBe(true);
  });

  it("renders interject card with question and report (done state)", async () => {
    const el = await trace([interjectDone]);
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector(".interject");
    expect(card).toBeTruthy();
    expect(card!.textContent).toContain("现在进度汇报一下");
    expect(card!.textContent).toContain("已完成检索，正在写报告");
    // 不按普通工具步骤渲染（无 .step 包裹的 name 行）
    expect(el.shadowRoot!.querySelector(".step .name")).toBeNull();
  });

  it("renders waiting placeholder while report is streaming", async () => {
    const el = await trace([interjectWaiting]);
    // running 步骤自动展开
    const card = el.shadowRoot!.querySelector(".interject");
    expect(card).toBeTruthy();
    expect(card!.textContent).toContain("现在进度汇报一下");
    expect(card!.querySelector(".waiting")!.textContent).toContain("正在汇报");
  });

  it("interject click dispatches interject-request and does not toggle expand", async () => {
    const el = await trace([running]);
    el.generating = true;
    await el.updateComplete;
    let fired = 0;
    el.addEventListener("interject-request", () => fired++);
    // 手动收起（running 自动展开了）——按钮点击不应切换展开态
    el.shadowRoot!.querySelector(".summary")!.dispatchEvent(new Event("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
    (el.shadowRoot!.querySelector(".interject-btn") as HTMLButtonElement)
      .dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(fired).toBe(1);
    expect(el.shadowRoot!.querySelector(".steps")).toBeNull();
  });

  it("interject step counts toward trace visibility (not filtered)", async () => {
    // traceStepsOf 不过滤 user_interject——插话卡就在时间线内（ADR-0048 决策 8）
    const { traceStepsOf } = await import("../src/components/chat-tool-trace");
    expect(traceStepsOf([interjectDone]).length).toBe(1);
  });
});
