import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../src/components/session-info-dialog";

async function mount(props: Partial<import("../src/components/session-info-dialog").SessionInfoDialog> = {}) {
  const el = document.createElement("session-info-dialog") as import("../src/components/session-info-dialog").SessionInfoDialog;
  Object.assign(el, {
    used: 12000,
    contextWindow: 128000,
    calls: 3,
    ...props,
  });
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe("<session-info-dialog> 会话 ID 行", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("sessionId 非空时首行渲染会话 ID + copy 按钮", async () => {
    const el = await mount({ sessionId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    const row = el.shadowRoot!.querySelector(".id-row");
    expect(row).toBeTruthy();
    // 首行位置：在「上下文占用」之前
    const labels = Array.from(el.shadowRoot!.querySelectorAll(".label")).map((n) => n.textContent);
    expect(labels.indexOf("会话 ID")).toBe(0);
    expect(labels).toContain("上下文占用");
    expect(row!.querySelector(".id-text")?.textContent).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    const btn = row!.querySelector<HTMLButtonElement>("button.copy-btn");
    expect(btn).toBeTruthy();
    expect(btn!.querySelector("doclens-icon")?.getAttribute("name")).toBe("copy");
    expect(btn!.getAttribute("title")).toBe("复制会话 ID");
  });

  it("无数据分支（used=null）也显示会话 ID 行", async () => {
    const el = await mount({ sessionId: "01ARZ3NDEK", used: null, contextWindow: 0 });
    expect(el.shadowRoot!.querySelector(".id-row")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".empty")?.textContent).toContain("暂无上下文数据");
  });

  it("sessionId 为空时隐藏整行", async () => {
    const el = await mount({ sessionId: "" });
    expect(el.shadowRoot!.querySelector(".id-row")).toBeNull();
  });

  it("点击 copy 写入剪贴板并翻转为 check/已复制", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", { value: {}, configurable: true, writable: true });
    }
    Object.defineProperty(navigator.clipboard, "writeText", { value: writeSpy, configurable: true, writable: true });

    const el = await mount({ sessionId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>("button.copy-btn")!;
    btn.click();
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalled());
    await el.updateComplete;

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(btn.querySelector("doclens-icon")?.getAttribute("name")).toBe("check");
    expect(btn.getAttribute("title")).toBe("已复制");

    // 1.5s 后恢复
    vi.advanceTimersByTime(1600);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("button.copy-btn")!.querySelector("doclens-icon")?.getAttribute("name")).toBe("copy");
  });

  it("clipboard 不可用时冒泡 copy-failed", async () => {
    const writeSpy = vi.fn().mockRejectedValue(new Error("denied"));
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", { value: {}, configurable: true, writable: true });
    }
    Object.defineProperty(navigator.clipboard, "writeText", { value: writeSpy, configurable: true, writable: true });

    const el = await mount({ sessionId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    const failed = new Promise<void>((res) =>
      el.addEventListener("copy-failed", () => res()));
    el.shadowRoot!.querySelector<HTMLButtonElement>("button.copy-btn")!.click();
    await failed;
    expect(el.shadowRoot!.querySelector("button.copy-btn")!.classList.contains("copied")).toBe(false);
  });
});
