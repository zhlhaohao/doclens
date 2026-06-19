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
