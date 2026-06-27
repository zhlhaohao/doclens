import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/preview-pane";
import "../src/components/md-editor";
import type { PreviewPane } from "../src/components/preview-pane";

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
    const items = menu!.querySelectorAll("button");
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
    const items = el.shadowRoot!.querySelectorAll(".mobile-menu button");
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
    const items = el.shadowRoot!.querySelectorAll(".mobile-menu button");
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
    // 非 writable：菜单 [下载, 上传]
    const items = el.shadowRoot!.querySelectorAll(".mobile-menu button");
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
      const items = el.shadowRoot!.querySelectorAll(".mobile-menu button");
      // 非 writable 时菜单为 [下载, 上传]
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
