/** download-overlay 组件测试（preview-pane 与 files-view 共用的下载中遮罩）。 */
import { describe, it, expect, afterEach } from "vitest";
import "../src/components/download-overlay";

function mount() {
  const el = document.createElement("download-overlay") as any;
  document.body.appendChild(el);
  return el;
}

describe("download-overlay", () => {
  afterEach(() => {
    document.querySelectorAll("download-overlay").forEach((e) => e.remove());
  });

  it("open=false 不渲染遮罩", async () => {
    const el = mount();
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".download-overlay")).toBeNull();
  });

  it("open=true 渲染 role=status 遮罩与默认文案", async () => {
    const el = mount();
    el.open = true;
    await el.updateComplete;
    const box = el.shadowRoot.querySelector(".download-overlay");
    expect(box).not.toBeNull();
    expect(box.getAttribute("role")).toBe("status");
    expect(box.textContent).toContain("下载中…");
  });

  it("label 可自定义", async () => {
    const el = mount();
    el.open = true;
    el.label = "正在导出…";
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("正在导出…");
  });
});
