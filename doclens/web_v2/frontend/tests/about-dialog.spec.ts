import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/about-dialog";
import type { AboutDialog } from "../src/components/about-dialog";

/** jsdom 无 performance resource 表 / fetch 需 mock。__BUILD_INFO__ 由
 *  vite config 的 test.define 注入（与 build 同源）。 */
function stubResources(names: string[]) {
  const orig = performance.getEntriesByType.bind(performance);
  vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) =>
    type === "resource"
      ? (names.map((n) => ({ name: `http://127.0.0.1:7860/assets/${n}` })) as never)
      : (orig(type) as never),
  );
}

describe("<about-dialog>", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closed 时不渲染内容", async () => {
    const el = await fixture<AboutDialog>(html`<about-dialog></about-dialog>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector("dialog")).toBeNull();
  });

  it("open 时显示前端构建信息与当前 bundle 文件名", async () => {
    stubResources(["index.AbCd1234.js", "index.ZxYv9876.css"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, version: "1.1.35", dev: true, started_at: "2026-08-28T01:45:38+00:00" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const el = await fixture<AboutDialog>(html`<about-dialog .open=${true}></about-dialog>`);
    await elementUpdated(el);
    const text = el.shadowRoot?.textContent ?? "";
    // __BUILD_INFO__ 注入自 vite config（git hash · 时间）
    expect(text).toContain(__BUILD_INFO__);
    // bundle 提取：只匹配 .js 的入口（css 不算）
    expect(text).toContain("index.AbCd1234.js");
    vi.unstubAllGlobals();
  });

  it("后端 /api/health 正常：显示 version + 代码状态（启动晚于修改 = 已加载最新）", async () => {
    stubResources(["index.AbCd1234.js"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: "1.1.35",
        dev: true,
        started_at: "2026-08-28T01:45:38+00:00",
        code_mtime: "2026-08-28T01:44:41+00:00",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const el = await fixture<AboutDialog>(html`<about-dialog .open=${true}></about-dialog>`);
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
    await elementUpdated(el);
    const text = el.shadowRoot?.textContent ?? "";
    expect(fetchMock).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
    expect(text).toContain("1.1.35");
    expect(text).toContain("已加载最新");
    // UTC 01:44:41 → 北京时区 09:44:41
    expect(text).toContain("代码 2026-08-28 09:44:41");
    vi.unstubAllGlobals();
  });

  it("代码修改晚于启动：显示未重启警告", async () => {
    stubResources(["index.AbCd1234.js"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: "1.1.35",
        dev: true,
        started_at: "2026-08-28T01:00:00+00:00",
        code_mtime: "2026-08-28T01:44:41+00:00", // 晚于启动 44 分钟
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const el = await fixture<AboutDialog>(html`<about-dialog .open=${true}></about-dialog>`);
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
    await elementUpdated(el);
    expect(el.shadowRoot?.textContent).toContain("有改动未重启");
    vi.unstubAllGlobals();
  });

  it("后端不可达：显示错误兜底", async () => {
    stubResources(["index.AbCd1234.js"]);
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    const el = await fixture<AboutDialog>(html`<about-dialog .open=${true}></about-dialog>`);
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
    await elementUpdated(el);
    expect(el.shadowRoot?.textContent).toContain("后端不可达");
    vi.unstubAllGlobals();
  });

  it("Esc / 关闭按钮派发 close 事件", async () => {
    stubResources(["index.AbCd1234.js"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "1.1.35", started_at: "t" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const el = await fixture<AboutDialog>(html`<about-dialog .open=${true}></about-dialog>`);
    await elementUpdated(el);
    const events: CustomEvent[] = [];
    el.addEventListener("close", (e) => events.push(e as CustomEvent));
    (el.shadowRoot?.querySelector(".close-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    expect(events).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("无 bundle 资源时显示未知", async () => {
    stubResources([]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "1.1.35", dev: true, started_at: "t" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const el = await fixture<AboutDialog>(html`<about-dialog .open=${true}></about-dialog>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.textContent).toContain("未知");
    vi.unstubAllGlobals();
  });

  it("发行版（dev=false）：只显示 doclens 版本号，裁剪全部调试信息", async () => {
    stubResources(["index.AbCd1234.js"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "1.1.35", dev: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const el = await fixture<AboutDialog>(html`<about-dialog .open=${true}></about-dialog>`);
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
    await elementUpdated(el);
    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("1.1.35");
    expect(text).not.toContain(__BUILD_INFO__);
    expect(text).not.toContain("index.AbCd1234.js");
    expect(text).not.toContain("代码状态");
    vi.unstubAllGlobals();
  });
});
