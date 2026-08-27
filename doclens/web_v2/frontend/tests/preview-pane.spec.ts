import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/preview-pane";
import "../src/components/md-editor";
import { MdViewer } from "../src/components/md-viewer";
import type { PreviewPane } from "../src/components/preview-pane";

const FONT_SCALE_KEY = "cortex.files.mdFontScalePct";

describe("<preview-pane> markdown branch", () => {
  it("renders <md-viewer> when language is markdown", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# Title"
        .line=${1}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const mdv = el.shadowRoot!.querySelector("md-viewer");
    expect(mdv).toBeTruthy();
    expect((mdv as any).line).toBe(1);
  });

  it("renders plain text view for other languages", async () => {
    const el = await fixture(html`
      <preview-pane language="python" content="print('hi')"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeNull();
    expect(el.shadowRoot!.querySelector(".body")).toBeTruthy();
  });
});

describe("<preview-pane> edit mode", () => {
  it("shows [编辑] button when writable=true and language=markdown", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".edit-btn");
    expect(btn).toBeTruthy();
  });

  it("hides [编辑] button when writable=false", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".edit-btn")).toBeNull();
  });

  it("clicking [编辑] switches to <md-editor>", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hello" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor");
    expect(editor).toBeTruthy();
    expect((editor as any).originalContent).toBe("# hello");
  });

  it("md-editor cancel event switches back to <md-viewer>", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hello" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    editor.dispatchEvent(new CustomEvent("cancel", {}));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeTruthy();
  });

  it("forwards dirty-change from md-editor", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hello" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    let received: any = null;
    el.addEventListener("dirty-change", (e: any) => (received = e.detail));
    editor.dispatchEvent(new CustomEvent("dirty-change", { detail: { dirty: true } }));
    expect(received).toEqual({ dirty: true });
  });

  it("content prop change forces back to preview mode", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# a" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeTruthy();
    el.content = "# b";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeTruthy();
  });

  it("discard() forces back to preview mode (public method)", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# a" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".edit-btn") as HTMLElement).click();
    await el.updateComplete;
    el.discard();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeNull();
  });
});

describe("<preview-pane> 预览↔编辑锚点一致性（视野首行）", () => {
  const md = "# A\n\npara one\n\n# B\n\npara two\n";

  it("预览→编辑：enterEdit 用 viewer.topSourceLine() 捕获锚点，editor.scrollToLine 恢复同源行", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content=${md} writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const viewer = el.shadowRoot!.querySelector("md-viewer") as any;
    // 视野首行 = 4（para one 块内插值行）：stub 捕获结果
    const topSpy = vi.spyOn(viewer, "topSourceLine").mockReturnValue(4);
    el.enterEdit();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    expect(editor).toBeTruthy();
    // updated() 异步 await editor.updateComplete 后才调 scrollToLine —— 等一拍
    await new Promise((r) => setTimeout(r, 0));
    expect(topSpy).toHaveBeenCalled();
    // 锚点已传递：编辑器侧滚到的行 = 捕获的视野首行
    const anchor = topSpy.mock.results[0]?.value;
    expect((el as any)._anchorLine).toBe(anchor);
  });

  it("编辑→预览：退出编辑用 editor.topLine() 捕获，viewer.scrollToSourceLine 恢复同源行", async () => {
    const scrollSpy = vi.spyOn(MdViewer.prototype, "scrollToSourceLine").mockImplementation(() => {});
    const el = await fixture(html`
      <preview-pane language="markdown" content=${md} writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    editor.topLine = () => 4; // 视野首行 = 源行 4
    editor.dispatchEvent(new CustomEvent("cancel", {}));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    expect(scrollSpy).toHaveBeenCalledWith(4, "auto");
  });
});

describe("<preview-pane> noHeader prop", () => {
  it("does not render .header in markdown preview branch when noHeader=true", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hi" ?noHeader=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".header")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-viewer")).toBeTruthy();
  });

  it("does not render .header in edit mode when noHeader=true", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# hi" writable ?noHeader=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".header")).toBeNull();
    expect(el.shadowRoot!.querySelector("md-editor")).toBeTruthy();
  });
});

describe("<preview-pane> download button", () => {
  it("renders download button in markdown preview header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".download-btn")).toBeTruthy();
  });

  it("renders download button in plain-text preview header", async () => {
    const el = await fixture(html`
      <preview-pane language="python" content="print('hi')" path="a.py"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".download-btn")).toBeTruthy();
  });

  it("renders download button in edit mode header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".download-btn")).toBeTruthy();
  });

  it("does not render download button when noHeader=true", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" ?noHeader=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".download-btn")).toBeNull();
  });

  it("clicking download button triggers anchor click with server URL", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="sub/doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const created: HTMLAnchorElement[] = [];
    // 捕获 document.createElement('a') 创建的锚点，断言其 href 和 click 调用
    const origCreate = document.createElement.bind(document);
    const origAppend = document.body.appendChild.bind(document.body);
    const origRemove = document.body.removeChild.bind(document.body);
    (document as any).createElement = (tag: string) => {
      const node = origCreate(tag);
      if (tag.toLowerCase() === "a") {
        node.click = () => created.push(node as HTMLAnchorElement);
        node.setAttribute = function (name: string, value: string) {
          (HTMLAnchorElement.prototype as any).setAttribute.call(this, name, value);
        };
      }
      return node;
    };
    document.body.appendChild = <any>((n: Node) => {
      origAppend(n);
      return n;
    });
    document.body.removeChild = <any>((n: Node) => {
      origRemove(n);
      return n;
    });

    try {
      (el.shadowRoot!.querySelector(".download-btn") as HTMLElement).click();
    } finally {
      (document as any).createElement = origCreate;
      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    }

    expect(created.length).toBe(1);
    const href = created[0].getAttribute("href") || "";
    expect(href).toContain("/api/preview/download");
    expect(href).toContain(encodeURIComponent("sub/doc.md"));
  });
});

describe("<preview-pane> upload button", () => {
  it("renders upload button in markdown preview header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeTruthy();
  });

  it("renders upload button in plain-text preview header", async () => {
    const el = await fixture(html`
      <preview-pane language="python" content="print('hi')" path="a.py"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeTruthy();
  });

  it("renders upload button in edit mode header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeTruthy();
  });

  it("does not render upload button when noHeader=true", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" ?noHeader=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeNull();
  });

  it("clicking upload button triggers hidden file input click", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    const clickSpy = vi.fn();
    input.click = clickSpy;

    (el.shadowRoot!.querySelector(".upload-btn") as HTMLElement).click();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("file pick + confirm OK dispatches upload-success event", async () => {
    vi.stubGlobal("confirm", () => true);
    vi.stubGlobal("fetch", vi.fn());
    const fetchSpy = vi.mocked(fetch);
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          path: "doc.md",
          bytes_written: 3,
          reindex_triggered: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const detailPromise = new Promise((resolve) => {
      el.addEventListener("upload-success", (e: any) => resolve(e.detail));
    });

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["abc"], "doc1_a1b2c3.md", { type: "text/markdown" });
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new Event("change"));

    const detail: any = await detailPromise;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/preview/upload");
    expect(init?.method).toBe("POST");
    expect(detail).toEqual({ path: "doc.md" });

    vi.unstubAllGlobals();
  });

  it("confirm cancelled does not call fetch", async () => {
    vi.stubGlobal("confirm", () => false);
    vi.stubGlobal("fetch", vi.fn());
    const fetchSpy = vi.mocked(fetch);

    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["abc"], "doc1_a1b2c3.md");
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("upload failure dispatches upload-failed event with message", async () => {
    vi.stubGlobal("confirm", () => true);
    vi.stubGlobal("fetch", vi.fn());
    const fetchSpy = vi.mocked(fetch);
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "NOT_INDEXED", detail: "hash+stem 不匹配" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;

    const detailPromise = new Promise((resolve) => {
      el.addEventListener("upload-failed", (e: any) => resolve(e.detail));
    });

    const input = el.shadowRoot!.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["abc"], "wrong_deadbe.md");
    Object.defineProperty(input, "files", { value: [file], writable: false });
    input.dispatchEvent(new Event("change"));

    const detail: any = await detailPromise;
    expect(detail.message).toContain("NOT_INDEXED");

    vi.unstubAllGlobals();
  });
});

describe("<preview-pane> pages pass-through", () => {
  it("passes pages prop to md-viewer", async () => {
    const pages = [{ label: "第 1 页", line_start: 1 }];
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" .pages=${pages}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const mdv = el.shadowRoot!.querySelector("md-viewer") as any;
    expect(mdv).toBeTruthy();
    expect(mdv.pages).toEqual(pages);
  });

  it("defaults pages to null when not provided", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const mdv = el.shadowRoot!.querySelector("md-viewer") as any;
    expect(mdv.pages).toBeNull();
  });
});

describe("<preview-pane> html branch", () => {
  it("renders <iframe class='html-frame'> when language=html", async () => {
    const el = await fixture(html`
      <preview-pane
        language="html"
        content="<h1>Hi</h1><p>Hello</p>"
        path="page.html">
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const frame = el.shadowRoot!.querySelector("iframe.html-frame") as HTMLIFrameElement;
    expect(frame).toBeTruthy();
    expect(frame.getAttribute("srcdoc")).toBe("<h1>Hi</h1><p>Hello</p>");
  });

  it("uses sandbox=allow-scripts (no allow-same-origin)", async () => {
    const el = await fixture(html`
      <preview-pane language="html" content="<p>x</p>"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const frame = el.shadowRoot!.querySelector("iframe.html-frame") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
  });

  it("does NOT show edit button for html", async () => {
    const el = await fixture(html`
      <preview-pane
        language="html"
        content="<p>x</p>"
        writable>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".edit-btn")).toBeNull();
  });

  it("shows download + upload buttons for html", async () => {
    const el = await fixture(html`
      <preview-pane
        language="html"
        content="<p>x</p>"
        path="page.html">
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".download-btn")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".upload-btn")).toBeTruthy();
  });

  it("hides header when noHeader=true for html", async () => {
    const el = await fixture(html`
      <preview-pane
        noHeader
        language="html"
        content="<p>x</p>">
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".header")).toBeNull();
    expect(el.shadowRoot!.querySelector("iframe.html-frame")).toBeTruthy();
  });

  it("does not render iframe for non-html languages", async () => {
    const el = await fixture(html`
      <preview-pane language="python" content="print('hi')"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("iframe.html-frame")).toBeNull();
  });
});

describe("<preview-pane> mobile header", () => {
  it("does not render .mobile-header by default", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mobile-header")).toBeNull();
    // 桌面 .header 仍渲染
    expect(el.shadowRoot!.querySelector(".header")).toBeTruthy();
  });

  it("renders .mobile-header with back / filename / more when mobile=true", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="docs/sub/readme.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const mh = el.shadowRoot!.querySelector(".mobile-header");
    expect(mh).toBeTruthy();
    // 文件名只取 basename
    expect(mh!.querySelector(".mobile-filename")!.textContent).toBe("readme.md");
    expect(mh!.querySelector(".mobile-back")).toBeTruthy();
    expect(mh!.querySelector(".mobile-more")).toBeTruthy();
  });

  it("hides desktop .header when mobile=true (no double bar)", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".header")).toBeNull();
  });

  it("clicking mobile-back dispatches 'back' event (bubbles+composed)", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    let received = false;
    el.addEventListener("back", () => (received = true));
    (el.shadowRoot!.querySelector(".mobile-back") as HTMLElement).click();
    expect(received).toBe(true);
  });

  it("clicking mobile-more opens dropdown with edit/download/upload", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        writable
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mobile-menu")).toBeNull();
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const menu = el.shadowRoot!.querySelector(".mobile-menu");
    expect(menu).toBeTruthy();
    // menuitem 三项（字号 stepper 的 ± 按钮带 role=menuitem 之外的 group）
    const items = menu!.querySelectorAll('button[role="menuitem"]');
    // writable=true: 编辑/下载/上传 三项
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain("编辑");
    expect(items[1].textContent).toContain("下载");
    expect(items[2].textContent).toContain("上传");
  });

  it("dropdown omits edit when writable=false", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const items = el.shadowRoot!.querySelectorAll('.mobile-menu button[role="menuitem"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("下载");
    expect(items[1].textContent).toContain("上传");
  });

  it("clicking mobile-more twice closes the dropdown", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const more = el.shadowRoot!.querySelector(".mobile-more") as HTMLElement;
    more.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mobile-menu")).toBeTruthy();
    more.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mobile-menu")).toBeNull();
  });

  it("dropdown item '编辑' enters edit mode", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        writable
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const items = el.shadowRoot!.querySelectorAll('.mobile-menu button[role="menuitem"]');
    (items[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("md-editor")).toBeTruthy();
  });

  it("dropdown item '上传' triggers hidden file input click", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const clickSpy = vi.fn();
    input.click = clickSpy;
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    // 非 writable：菜单 menuitem [下载, 上传]
    const items = el.shadowRoot!.querySelectorAll('.mobile-menu button[role="menuitem"]');
    (items[1] as HTMLElement).click();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("dropdown item '下载' triggers anchor click with server URL", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="sub/doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;

    const created: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    const origAppend = document.body.appendChild.bind(document.body);
    const origRemove = document.body.removeChild.bind(document.body);
    (document as any).createElement = (tag: string) => {
      const node = origCreate(tag);
      if (tag.toLowerCase() === "a") {
        node.click = () => created.push(node as HTMLAnchorElement);
        node.setAttribute = function (name: string, value: string) {
          (HTMLAnchorElement.prototype as any).setAttribute.call(this, name, value);
        };
      }
      return node;
    };
    document.body.appendChild = <any>((n: Node) => { origAppend(n); return n; });
    document.body.removeChild = <any>((n: Node) => { origRemove(n); return n; });

    try {
      const items = el.shadowRoot!.querySelectorAll('.mobile-menu button[role="menuitem"]');
      // 非 writable 时菜单 menuitem 为 [下载, 上传]
      (items[0] as HTMLElement).click();
    } finally {
      (document as any).createElement = origCreate;
      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    }
    expect(created.length).toBe(1);
    const href = created[0].getAttribute("href") || "";
    expect(href).toContain("/api/preview/download");
    expect(href).toContain(encodeURIComponent("sub/doc.md"));
  });

  it("outside click closes the dropdown", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mobile-menu")).toBeTruthy();
    // 触发 document 上的 click，composedPath 不含 preview-pane
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mobile-menu")).toBeNull();
  });

  it("edit mode in mobile: md-editor hides redundant filename (mobile bar already shows it)", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="docs/readme.md"
        writable
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    expect(editor).toBeTruthy();
    // mobile=true 透传给 md-editor
    expect(editor.hasAttribute("mobile")).toBe(true);
    // 编辑器 toolbar 不再渲染 .path
    const toolbarPath = editor.shadowRoot!.querySelector(".toolbar .path");
    expect(toolbarPath).toBeNull();
    // 但保存/取消按钮仍在
    expect(editor.shadowRoot!.querySelector(".save-btn")).toBeTruthy();
    expect(editor.shadowRoot!.querySelector(".cancel-btn")).toBeTruthy();
  });

  it("edit mode in desktop: md-editor still shows filename in toolbar", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="docs/readme.md"
        writable>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    const editor = el.shadowRoot!.querySelector("md-editor") as any;
    expect(editor.hasAttribute("mobile")).toBe(false);
    const toolbarPath = editor.shadowRoot!.querySelector(".toolbar .path");
    expect(toolbarPath).toBeTruthy();
    expect(toolbarPath!.textContent).toBe("docs/readme.md");
  });
});

describe("<preview-pane> keyword highlight", () => {
  it("renders highlight button in markdown preview header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-btn")).toBeTruthy();
  });

  it("header buttons carry icon + .btn-label (hover tooltip pattern)", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const cases: Array<[string, string]> = [
      [".edit-btn", "编辑"],
      [".download-btn", "下载"],
      [".upload-btn", "上传"],
      [".highlight-btn", "高亮"],
    ];
    for (const [sel, label] of cases) {
      const btn = el.shadowRoot!.querySelector(sel);
      expect(btn, sel).toBeTruthy();
      expect(btn!.querySelector("doclens-icon"), sel).toBeTruthy();
      const span = btn!.querySelector(".btn-label");
      expect(span, sel).toBeTruthy();
      expect(span!.textContent, sel).toBe(label);
    }
  });

  it("does not render highlight button for html / plain-text branches", async () => {
    const htmlEl = await fixture(html`
      <preview-pane language="html" content="<p>x</p>" path="page.html"></preview-pane>
    `) as PreviewPane;
    await htmlEl.updateComplete;
    expect(htmlEl.shadowRoot!.querySelector(".highlight-btn")).toBeNull();

    const textEl = await fixture(html`
      <preview-pane language="python" content="print('hi')" path="a.py"></preview-pane>
    `) as PreviewPane;
    await textEl.updateComplete;
    expect(textEl.shadowRoot!.querySelector(".highlight-btn")).toBeNull();
  });

  it("does not render highlight button in edit mode header", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" writable></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    el.enterEdit();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-btn")).toBeNull();
  });

  it("clicking highlight button opens input bar; input syncs to md-viewer keyword", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# 物联网 平台" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-bar")).toBeNull();

    (el.shadowRoot!.querySelector(".highlight-btn") as HTMLElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(".highlight-bar input") as HTMLInputElement;
    expect(input).toBeTruthy();

    input.value = "物联网";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const mdv = el.shadowRoot!.querySelector("md-viewer") as any;
    await mdv.updateComplete;
    expect(mdv.keyword).toBe("物联网");
    expect(mdv.shadowRoot!.querySelectorAll("mark.keyword-hit").length).toBeGreaterThan(0);
  });

  it("clear button empties keyword and closes the bar", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# 物联网" path="doc.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".highlight-btn") as HTMLElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(".highlight-bar input") as HTMLInputElement;
    input.value = "物联网";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;

    (el.shadowRoot!.querySelector(".highlight-clear") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-bar")).toBeNull();
    const mdv = el.shadowRoot!.querySelector("md-viewer") as any;
    await mdv.updateComplete;
    expect(mdv.keyword).toBe("");
    expect(mdv.shadowRoot!.querySelectorAll("mark.keyword-hit").length).toBe(0);
  });

  it("path change resets highlight input and closes the bar", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# 物联网" path="a.md"></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".highlight-btn") as HTMLElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(".highlight-bar input") as HTMLInputElement;
    input.value = "物联网";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;

    el.path = "b.md";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-bar")).toBeNull();
    const mdv = el.shadowRoot!.querySelector("md-viewer") as any;
    expect(mdv.keyword).toBe("");
  });

  it("mobile: highlight button sits left of mobile-more, toggles the same bar", async () => {
    const el = await fixture(html`
      <preview-pane language="markdown" content="# T" path="doc.md" ?mobile=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const mh = el.shadowRoot!.querySelector(".mobile-header")!;
    const hl = mh.querySelector(".mobile-highlight") as HTMLElement;
    const more = mh.querySelector(".mobile-more") as HTMLElement;
    expect(hl).toBeTruthy();
    // DOM 顺序：highlight 在 more 之前
    expect(
      hl.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    hl.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".highlight-bar")).toBeTruthy();
  });

  it("mobile: hides highlight button for non-markdown content", async () => {
    const el = await fixture(html`
      <preview-pane language="python" content="print(1)" path="a.py" ?mobile=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mobile-highlight")).toBeNull();
  });
});

describe("<preview-pane> scroll memory (rememberScroll)", () => {
  const KEY = "cortex.files.previewScroll";
  const md = "# T\n\nfoo\n\nbar\n\nbaz\n";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** fixture 一个 rememberScroll 的 markdown preview-pane，返回 el 和 viewer。 */
  async function mountScrollPane(path: string, content = md) {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        path=${path}
        content=${content}
        ?rememberScroll=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    const viewer = el.shadowRoot!.querySelector("md-viewer") as any;
    return { el, viewer };
  }

  it("restores saved line on open (scrollToSourceLine with saved line, auto)", async () => {
    localStorage.setItem(KEY, JSON.stringify({ "a.md": 12 }));
    const spy = vi.spyOn(MdViewer.prototype, "scrollToSourceLine").mockImplementation(() => {});
    await mountScrollPane("a.md");
    // updated() 里 await viewer.updateComplete 后才恢复 —— 等一拍宏任务
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledWith(12, "auto");
  });

  it("does not restore when no record exists", async () => {
    const spy = vi.spyOn(MdViewer.prototype, "scrollToSourceLine").mockImplementation(() => {});
    await mountScrollPane("no-record.md");
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not restore when saved line is 1 (top)", async () => {
    localStorage.setItem(KEY, JSON.stringify({ "a.md": 1 }));
    const spy = vi.spyOn(MdViewer.prototype, "scrollToSourceLine").mockImplementation(() => {});
    await mountScrollPane("a.md");
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not restore when rememberScroll is off (search/chat 不受影响)", async () => {
    localStorage.setItem(KEY, JSON.stringify({ "a.md": 12 }));
    const spy = vi.spyOn(MdViewer.prototype, "scrollToSourceLine").mockImplementation(() => {});
    const el = await fixture(html`
      <preview-pane language="markdown" path="a.md" content=${md}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not restore for non-markdown content", async () => {
    localStorage.setItem(KEY, JSON.stringify({ "a.py": 12 }));
    const spy = vi.spyOn(MdViewer.prototype, "scrollToSourceLine").mockImplementation(() => {});
    const el = await fixture(html`
      <preview-pane language="python" path="a.py" content="print(1)" ?rememberScroll=${true}></preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).not.toHaveBeenCalled();
  });

  it("saves topSourceLine to localStorage after 300ms debounce on scroll", async () => {
    const { viewer } = await mountScrollPane("a.md");
    viewer.topSourceLine = () => 20;
    vi.useFakeTimers();
    viewer.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(300);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ "a.md": 20 });
  });

  it("flushes pending scroll position immediately when path changes", async () => {
    const { el, viewer } = await mountScrollPane("a.md");
    viewer.topSourceLine = () => 33;
    vi.useFakeTimers();
    viewer.dispatchEvent(new Event("scroll"));
    // debounce 未到期就切文件 → willUpdate path 分支应立即落盘旧文档
    el.path = "b.md";
    el.content = "# B\n\nx\n";
    await el.updateComplete;
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ "a.md": 33 });
  });

  it("scrolling back to top removes the entry (回顶部 = 清除记忆)", async () => {
    localStorage.setItem(KEY, JSON.stringify({ "a.md": 12 }));
    const { viewer } = await mountScrollPane("a.md");
    viewer.topSourceLine = () => 1;
    vi.useFakeTimers();
    viewer.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(300);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toEqual({});
  });
});

describe("<preview-pane> mobile font scale stepper", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /** fixture 一个移动端 markdown 预览并打开 More 菜单。 */
  async function mountMenu(lang = "markdown", content = "# T") {
    const el = await fixture(html`
      <preview-pane
        language=${lang}
        content=${content}
        path="doc.md"
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    return el;
  }

  it("markdown preview: menu contains stepper row with default 100%", async () => {
    const el = await mountMenu();
    const row = el.shadowRoot!.querySelector(".font-scale-row");
    expect(row).toBeTruthy();
    expect(row!.querySelector(".font-scale-value")!.textContent!.trim()).toBe("100%");
  });

  it("non-markdown preview: no stepper row", async () => {
    const el = await mountMenu("python", "print(1)");
    expect(el.shadowRoot!.querySelector(".font-scale-row")).toBeNull();
  });

  it("edit mode: no stepper row", async () => {
    const el = await fixture(html`
      <preview-pane
        language="markdown"
        content="# T"
        path="doc.md"
        writable
        ?mobile=${true}>
      </preview-pane>
    `) as PreviewPane;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".font-scale-row")).toBeTruthy();
    el.enterEdit();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".font-scale-row")).toBeNull();
  });

  it("clicking + increases by 10%, updates value & md-viewer, keeps menu open", async () => {
    const el = await mountMenu();
    const plus = el.shadowRoot!.querySelector(
      '.font-scale-btn[aria-label="放大字号"]',
    ) as HTMLButtonElement;
    plus.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".font-scale-value")!.textContent!.trim()).toBe("110%");
    // 菜单不关闭，可连点
    expect(el.shadowRoot!.querySelector(".mobile-menu")).toBeTruthy();
    const viewer = el.shadowRoot!.querySelector("md-viewer") as any;
    expect(viewer.fontScale).toBe(1.1);
    expect(viewer.style.getPropertyValue("--md-font-scale")).toBe("1.1");
  });

  it("clicking − decreases by 10% and persists to localStorage", async () => {
    const el = await mountMenu();
    const minus = el.shadowRoot!.querySelector(
      '.font-scale-btn[aria-label="缩小字号"]',
    ) as HTMLButtonElement;
    minus.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".font-scale-value")!.textContent!.trim()).toBe("90%");
    expect(localStorage.getItem(FONT_SCALE_KEY)).toBe("90");
  });

  it("consecutive clicks accumulate (连点)", async () => {
    const el = await mountMenu();
    const plus = el.shadowRoot!.querySelector(
      '.font-scale-btn[aria-label="放大字号"]',
    ) as HTMLButtonElement;
    plus.click();
    await el.updateComplete;
    plus.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".font-scale-value")!.textContent!.trim()).toBe("120%");
  });

  it("boundary 200% disables + button", async () => {
    localStorage.setItem(FONT_SCALE_KEY, "200");
    const el = await mountMenu();
    const plus = el.shadowRoot!.querySelector(
      '.font-scale-btn[aria-label="放大字号"]',
    ) as HTMLButtonElement;
    expect(plus.disabled).toBe(true);
    const minus = el.shadowRoot!.querySelector(
      '.font-scale-btn[aria-label="缩小字号"]',
    ) as HTMLButtonElement;
    expect(minus.disabled).toBe(false);
  });

  it("boundary 60% disables − button", async () => {
    localStorage.setItem(FONT_SCALE_KEY, "60");
    const el = await mountMenu();
    const minus = el.shadowRoot!.querySelector(
      '.font-scale-btn[aria-label="缩小字号"]',
    ) as HTMLButtonElement;
    expect(minus.disabled).toBe(true);
  });

  it("saved preference restores on mount and applies to md-viewer", async () => {
    localStorage.setItem(FONT_SCALE_KEY, "130");
    const el = await mountMenu();
    const viewer = el.shadowRoot!.querySelector("md-viewer") as any;
    expect(viewer.fontScale).toBe(1.3);
    expect(el.shadowRoot!.querySelector(".font-scale-value")!.textContent!.trim()).toBe("130%");
  });
});
