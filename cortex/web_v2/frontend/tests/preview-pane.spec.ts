import { describe, it, expect } from "vitest";
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
