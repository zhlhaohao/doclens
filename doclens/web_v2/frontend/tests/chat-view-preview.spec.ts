import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/views/chat-view";
import { ChatView } from "../src/views/chat-view";
import { store, actions } from "../src/state/store";
import { resetStore, setDesktopViewport, setMobileViewport } from "./test-utils";

const baseMessages = [
  { role: "user", content: "量子计算" },
  { role: "assistant", content: "答案。\n\n## 参考资料\n\n1. docs/a.md\n" },
];

function focusChat() {
  actions.setChatState({
    state: "focus",
    currentSession: {
      id: "s1", type: "chat", title: "t", preview: "p",
      updated_at: new Date().toISOString(), message_count: 2,
    },
    messages: baseMessages as any,
    streaming: false,
  });
}

function mockPreviewOk() {
  global.fetch = vi.fn(async (url: string) => {
    if (String(url).startsWith("/api/preview")) {
      return new Response(
        JSON.stringify({ path: "docs/a.md", language: "markdown", content: "# A", writable: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("<chat-view> reference preview", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    resetStore(store);
    focusChat();
    setDesktopViewport();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reference-click opens preview pane on desktop + fills state", async () => {
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(true);
    expect((el as any).previewPath).toBe("docs/a.md");
    expect((el as any).previewContent).toBe("# A");
    expect(el.shadowRoot!.querySelector(".focus-main preview-pane")).toBeTruthy();
  });

  it("previewOpen=false does not render preview-pane nor splitter", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".focus-main preview-pane")).toBeNull();
    expect(el.shadowRoot!.querySelector(".focus-main .splitter")).toBeNull();
  });

  it("NOT_INDEXED → previewError set + pane area shows hint", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: "NOT_INDEXED", detail: "not indexed" }),
        { status: 404, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/x.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewError).toBe("NOT_INDEXED");
    expect((el as any).previewOpen).toBe(true);
    expect(el.shadowRoot!.querySelector(".focus-main .not-indexed-hint")).toBeTruthy();
  });

  it("fetch failure (non-NOT_INDEXED) → previewOpen stays false", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: "INTERNAL", detail: "boom" }),
        { status: 500, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(false);
  });

  it("mobile viewport renders .preview-overlay with preview-pane", async () => {
    setMobileViewport();
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".preview-overlay")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".preview-overlay preview-pane")).toBeTruthy();
  });

  it("_closePreview sets previewOpen=false", async () => {
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(true);
    (el as any)._closePreview();
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(false);
  });

  it("_onPreviewSaved resets previewDirty=false (blocks spurious discard confirm)", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    (el as any).previewDirty = true;
    (el as any)._onPreviewSaved();
    expect((el as any).previewDirty).toBe(false);
  });

  it("splitter drag RIGHT narrows the (right-side) preview pane", async () => {
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    const splitter = el.shadowRoot!.querySelector(".focus-main .splitter") as HTMLElement;
    expect(splitter).toBeTruthy();
    const widthBefore = (el as any)._previewPaneWidth as number;
    splitter.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 200 })); // 右拖 +100
    await el.updateComplete;
    expect((el as any)._previewPaneWidth).toBe(widthBefore - 100);
  });

  it("splitter drag LEFT widens the (right-side) preview pane", async () => {
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    const splitter = el.shadowRoot!.querySelector(".focus-main .splitter") as HTMLElement;
    const widthBefore = (el as any)._previewPaneWidth as number;
    splitter.dispatchEvent(new MouseEvent("mousedown", { clientX: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 120 })); // 左拖 -80
    await el.updateComplete;
    expect((el as any)._previewPaneWidth).toBe(widthBefore + 80);
  });

  it("_backToInitial clears preview state (no residual pane after returning)", async () => {
    mockPreviewOk();
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({ detail: { path: "docs/a.md" } } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(true);
    expect((el as any).previewPath).toBe("docs/a.md");
    (el as any)._backToInitial();
    await el.updateComplete;
    expect((el as any).previewOpen).toBe(false);
    expect((el as any).previewPath).toBe("");
    expect((el as any).previewContent).toBe("");
  });

  it("_normalizeReferencePath strips markdown link + file:// + URL-decodes", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    const norm = (p: string) => (el as any)._normalizeReferencePath(p);
    // AI 偶发的 markdown 链接 + file URL（"海洋深处"对话复现）
    expect(norm("[深海生物新物种发现.md](file:///C:/Users/lianghao/github/cortex/test_work_dir/生命科学/深海生物新物种发现.md)"))
      .toBe("C:/Users/lianghao/github/cortex/test_work_dir/生命科学/深海生物新物种发现.md");
    // file:/// 三斜杠
    expect(norm("file:///C:/a/b.md")).toBe("C:/a/b.md");
    // file:// 双斜杠
    expect(norm("file://relative/x.md")).toBe("relative/x.md");
    // 纯相对路径（不变）
    expect(norm("生命科学/x.md")).toBe("生命科学/x.md");
    // URL decode（中文 %E7%94%9F = 生）
    expect(norm("file:///C:/.../%E7%94%9F%E5%91%BD%E7%A7%91%E5%AD%A6.md"))
      .toBe("C:/.../生命科学.md");
    // 空
    expect(norm("")).toBe("");
    expect(norm("   ")).toBe("");
  });

  it("reference-click normalizes AI markdown link + file:// path before fetchPreview", async () => {
    // 端到端：AI 给的 [x](file:///...) 经清洗后 fetchPreview 收到正确 path，preview 打开
    let capturedPath = "";
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).startsWith("/api/preview")) {
        // 用字符串 regex 解析（jsdom 下 new URL('/api/preview?...') 无 base 会抛）
        const m = String(url).match(/[?&]path=([^&]*)/);
        capturedPath = m ? decodeURIComponent(m[1]) : "";
        return new Response(
          JSON.stringify({ path: capturedPath, language: "text", content: "ok", writable: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    await (el as any)._onReferenceClick({
      detail: { path: "[x.md](file:///C:/test/path/x.md)" },
    } as any);
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect(capturedPath).toBe("C:/test/path/x.md");
    expect((el as any).previewOpen).toBe(true);
  });
});
