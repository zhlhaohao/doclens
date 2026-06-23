import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-row";
import type { FileEntry } from "../src/api/files";

const fileEntry: FileEntry = {
  name: "a.md", path: "a.md", is_dir: false, size: 100,
  modified_at: "2026-06-22T00:00:00Z", indexed: true, writable: true, has_child_dirs: false,
};
const dirEntry: FileEntry = {
  name: "docs", path: "docs", is_dir: true, size: 0,
  modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true, has_child_dirs: true,
};

function makeRow(entry: FileEntry, selected = false) {
  const el = document.createElement("file-row") as any;
  el.entry = entry;
  el.selected = selected;
  document.body.appendChild(el);
  return el;
}

describe("file-row", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("row body click dispatches activated with is_dir=false for files", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(captured).toEqual({ path: "a.md", is_dir: false });
  });

  it("row body click dispatches activated with is_dir=true for folders", async () => {
    const el = makeRow(dirEntry);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(captured).toEqual({ path: "docs", is_dir: true });
  });

  it("checkbox click dispatches checked and does not activate", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let activated = null;
    let checked = null;
    el.addEventListener("activated", (e: Event) => activated = (e as CustomEvent).detail);
    el.addEventListener("checked", (e: Event) => checked = (e as CustomEvent).detail);
    const ev = new MouseEvent("click", { bubbles: true, ctrlKey: true });
    el.shadowRoot.querySelector("input[type='checkbox']").dispatchEvent(ev);
    expect(activated).toBeNull();
    expect(checked).toEqual({ path: "a.md", ctrl: true, shift: false });
  });

  it("row body click does not dispatch checked", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let checked = null;
    el.addEventListener("checked", (e: Event) => checked = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(checked).toBeNull();
  });

  it("reflects selected state on checkbox", async () => {
    const el = makeRow(fileEntry, true);
    await el.updateComplete;
    const cb = el.shadowRoot.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });
});
