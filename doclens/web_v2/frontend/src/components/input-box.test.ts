import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./input-box";
import type { InputBox } from "./input-box";

/** 1x1 透明 GIF：_addFiles 对 GIF 走 arrayBuffer+btoa 直转路径（不经 canvas），jsdom 可测 */
const GIF_B64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeBox(): InputBox {
  const el = document.createElement("input-box") as InputBox;
  el.attachments = true;
  document.body.appendChild(el);
  return el;
}

/** 模拟 NexBox webview 环境（Android 注入 + jsbridge 函数） */
function mockWebview(jsbridgeImpl: Record<string, unknown>) {
  (window as any).Android = { messageSend: vi.fn() };
  (window as any).jsbridge = jsbridgeImpl;
}

describe("<input-box> webview 附件入口（jsbridge 通道）", () => {
  let savedAndroid: unknown;
  let savedJsbridge: unknown;

  beforeEach(() => {
    savedAndroid = (window as any).Android;
    savedJsbridge = (window as any).jsbridge;
  });

  afterEach(() => {
    if (savedAndroid === undefined) delete (window as any).Android;
    else (window as any).Android = savedAndroid;
    if (savedJsbridge === undefined) delete (window as any).jsbridge;
    else (window as any).jsbridge = savedJsbridge;
    document.body.innerHTML = "";
  });

  it("jsbridge 可用时 📎 弹「拍照/相册」菜单，不点隐藏 input", async () => {
    mockWebview({ takePhoto: vi.fn(), pickPhotos: vi.fn() });
    const box = makeBox();
    await box.updateComplete;
    const fileInput = box.shadowRoot!.querySelector<HTMLInputElement>("#img-input")!;
    const clickSpy = vi.spyOn(fileInput, "click");

    box.shadowRoot!.querySelector<HTMLButtonElement>("button.attach")!.click();
    await box.updateComplete;

    expect(clickSpy).not.toHaveBeenCalled();
    const items = box.shadowRoot!.querySelectorAll(".attach-menu .menu-item");
    expect(items.length).toBe(2);
  });

  it("点「从相册选择」→ 调 pickPhotos，回调照片进入暂存并发 images-change", async () => {
    const takePhoto = vi.fn();
    const pickPhotos = vi.fn((p: any) =>
      p.success({
        code: 0, count: 1, pickedCount: 1, truncated: false,
        photos: [{ base64: GIF_B64, mimeType: "image/gif", width: 1, height: 1, size: 43 }],
      }),
    );
    mockWebview({ takePhoto, pickPhotos });
    const box = makeBox();
    await box.updateComplete;
    const events: CustomEvent[] = [];
    box.addEventListener("images-change", (e) => events.push(e as CustomEvent));

    box.shadowRoot!.querySelector<HTMLButtonElement>("button.attach")!.click();
    await box.updateComplete;
    const items = box.shadowRoot!.querySelectorAll<HTMLElement>(".attach-menu .menu-item");
    items[1]!.click(); // 从相册选择
    await flush();
    await flush();

    expect(pickPhotos).toHaveBeenCalledTimes(1);
    expect(takePhoto).not.toHaveBeenCalled();
    expect(box.images.length).toBe(1);
    expect(box.images[0]!.media_type).toBe("image/gif");
    expect(events.length).toBeGreaterThan(0);
    // 菜单已关闭
    expect(box.shadowRoot!.querySelector(".attach-menu")).toBeNull();
  });

  it("点「拍照」→ 调 takePhoto，回调照片进入暂存", async () => {
    const takePhoto = vi.fn((p: any) =>
      p.success({ code: 0, base64: GIF_B64, mimeType: "image/gif", width: 1, height: 1, size: 43 }),
    );
    const pickPhotos = vi.fn();
    mockWebview({ takePhoto, pickPhotos });
    const box = makeBox();
    await box.updateComplete;

    box.shadowRoot!.querySelector<HTMLButtonElement>("button.attach")!.click();
    await box.updateComplete;
    const items = box.shadowRoot!.querySelectorAll<HTMLElement>(".attach-menu .menu-item");
    items[0]!.click(); // 拍照
    await flush();
    await flush();

    expect(takePhoto).toHaveBeenCalledTimes(1);
    expect(pickPhotos).not.toHaveBeenCalled();
    expect(box.images.length).toBe(1);
  });

  it("pickPhotos fail → image-reject 事件带出原生错误码文案（含 detail）", async () => {
    const pickPhotos = vi.fn((p: any) => p.fail({ code: 5, error: "decode failed" }));
    mockWebview({ takePhoto: vi.fn(), pickPhotos });
    const box = makeBox();
    await box.updateComplete;
    const rejects: CustomEvent[] = [];
    box.addEventListener("image-reject", (e) => rejects.push(e as CustomEvent));

    box.shadowRoot!.querySelector<HTMLButtonElement>("button.attach")!.click();
    await box.updateComplete;
    box.shadowRoot!.querySelectorAll<HTMLElement>(".attach-menu .menu-item")[1]!.click();
    await flush();
    await flush();

    expect(rejects.length).toBe(1);
    expect(rejects[0]!.detail.reason).toContain("照片处理失败");
    expect(rejects[0]!.detail.reason).toContain("decode failed");
  });

  it("pickPhotos cancel（用户返回）→ 静默：无暂存、无 image-reject", async () => {
    const pickPhotos = vi.fn((p: any) => p.cancel({ reason: "user canceled" }));
    mockWebview({ takePhoto: vi.fn(), pickPhotos });
    const box = makeBox();
    await box.updateComplete;
    const rejects: CustomEvent[] = [];
    box.addEventListener("image-reject", (e) => rejects.push(e as CustomEvent));

    box.shadowRoot!.querySelector<HTMLButtonElement>("button.attach")!.click();
    await box.updateComplete;
    box.shadowRoot!.querySelectorAll<HTMLElement>(".attach-menu .menu-item")[1]!.click();
    await flush();
    await flush();

    expect(box.images.length).toBe(0);
    expect(rejects.length).toBe(0);
  });

  it("jsbridge 不可用（浏览器）→ 📎 回退隐藏 input.click()", async () => {
    const box = makeBox();
    await box.updateComplete;
    const fileInput = box.shadowRoot!.querySelector<HTMLInputElement>("#img-input")!;
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    box.shadowRoot!.querySelector<HTMLButtonElement>("button.attach")!.click();
    await box.updateComplete;

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(box.shadowRoot!.querySelector(".attach-menu")).toBeNull();
  });
});
