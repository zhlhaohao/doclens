/** 会话导入/导出的 WebView 分支（X5 不弹 input file / 无下载 UI）。
 *
 * 覆盖：导出走 jsbridge 原生下载（绝对 URL + 文件名），浏览器仍走 <a>；
 * 导出文件名 slug 与后端 Content-Disposition 同构。
 */
import { describe, it, expect, vi, afterEach } from "vitest";

import { downloadFromUrl } from "../src/utils/download";
import { sessionExportFileName, sessionExportUrl, sessionImportUploadUrl } from "../src/api/sessions";

const g = globalThis as unknown as {
  window: Window & { Android?: unknown; jsbridge?: unknown };
};

function enterWebview() {
  // AndroidGlobal 只声明了 messageSend：跨 WebView 兼容留的 syndMessageSend
  // 不在该契约内，mock 按契约补齐即可
  g.window.Android = { messageSend: vi.fn() };
  g.window.jsbridge = {
    downloadFile: vi.fn((p: { downloadUrl: string; fileName?: string; success(v: unknown): void }) => {
      p.success({ code: 0, name: "已保存.json", savedTo: "/Downloads/x.json", bytes: 10, notified: true });
    }),
    pickAndUploadFiles: vi.fn(),
    // 其余 jsbridge 能力（拍照/相册/同步通道）本用例不触达：按契约补齐占位
    takePhoto: vi.fn(),
    pickPhotos: vi.fn(),
    sendToNative: vi.fn(),
    syncSendToNative: vi.fn(),
  };
}

afterEach(() => {
  delete g.window.Android;
  delete g.window.jsbridge;
  vi.restoreAllMocks();
});

describe("sessionExportFileName", () => {
  it("保留字母数字与中日韩文字，非法字符折叠为连字符", () => {
    const name = sessionExportFileName("周报 / 2026: Q3");
    expect(name).toMatch(/^周报-2026-Q3-\d{8}\.json$/);
  });

  it("空标题退化为 session", () => {
    expect(sessionExportFileName("   ")).toMatch(/^session-\d{8}\.json$/);
  });
});

describe("downloadFromUrl（会话导出）", () => {
  it("webview 内走 jsbridge 原生通道：绝对 URL + 显式文件名", async () => {
    enterWebview();
    const r = await downloadFromUrl(sessionExportUrl("S1"), "会话-20261021.json");
    expect(r).toEqual({ via: "jsbridge", name: "已保存.json" });
    expect(g.window.jsbridge).toBeTruthy();
    const fn = (g.window.jsbridge as unknown as { downloadFile: ReturnType<typeof vi.fn> }).downloadFile;
    const arg = fn.mock.calls[0][0] as { downloadUrl: string; fileName?: string };
    expect(arg.downloadUrl).toBe(`${window.location.origin}/api/sessions/S1/export`);
    expect(arg.fileName).toBe("会话-20261021.json");
  });

  it("浏览器内仍走 <a> 兜底（不触 jsbridge）", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const r = await downloadFromUrl(sessionExportUrl("S1"), "x.json");
    expect(r).toEqual({ via: "anchor" });
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe("sessionImportUploadUrl", () => {
  it("指向 WebView 原生直传端点", () => {
    expect(sessionImportUploadUrl()).toBe(`${window.location.origin}/api/sessions/import/upload`);
  });
});
