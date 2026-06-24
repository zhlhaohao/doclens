import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/views/files-view";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";
import { filesApi } from "../src/api/files";
import { fetchPreview } from "../src/api/preview";

// Mock filesApi
vi.mock("../src/api/files", () => ({
  filesApi: {
    list: vi.fn().mockResolvedValue({ path: "", entries: [], total: 0 }),
    stats: vi.fn().mockResolvedValue({ file_count: 0, dir_count: 0, total_size_bytes: 0 }),
    attrs: vi.fn().mockResolvedValue({
      name: "", path: "", is_dir: false, size: 0,
      modified_at: "", indexed: false, writable: true, has_child_dirs: false,
      created_at: "", extension: null, is_protected: false,
    }),
    mkdir: vi.fn().mockResolvedValue({ ok: true, path: "", reindex_triggered: true }),
    remove: vi.fn().mockResolvedValue({ ok: true, deleted: "", reindex_triggered: true }),
    move: vi.fn().mockResolvedValue({ moved: [], skipped: [] }),
    rename: vi.fn().mockResolvedValue({}),
    upload: vi.fn().mockResolvedValue({}),
  },
}));

// Mock fetchPreview
vi.mock("../src/api/preview", () => ({
  fetchPreview: vi.fn().mockResolvedValue({
    ok: true,
    path: "a.md",
    content: "# hello",
    language: "markdown",
    writable: false,
    pages: null,
  }),
  isFullFilePreview: vi.fn(() => false),
}));

describe("files-view", () => {
  beforeEach(() => {
    resetStore(store);
    vi.clearAllMocks();
  });

  it("renders desktop-layout when viewport is wide", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".desktop-layout")).toBeTruthy();
    document.body.removeChild(el);
  });

  it("opens mkdir dialog on action mkdir", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("action", { detail: { name: "mkdir" }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("mkdir-dialog")).toBeTruthy();
    document.body.removeChild(el);
  });

  it("opens rename dialog only when exactly 1 selected", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("action", { detail: { name: "rename" }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("rename-dialog")).toBeFalsy();
    document.body.removeChild(el);
  });

  it("upload action opens native file picker", async () => {
    const realInput = document.createElement("input");
    const clickSpy = vi.spyOn(realInput, "click").mockImplementation(() => {});
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "input") return realInput;
      return origCreate(tag);
    });
    const el = origCreate("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("action", { detail: { name: "upload" }, bubbles: true, composed: true }),
    );
    expect(clickSpy).toHaveBeenCalled();
    document.body.removeChild(el);
    realInput.remove();
    createSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("opens delete dialog when selection is non-empty", async () => {
    actions.setFilesState({ selectedPaths: ["foo.txt"] });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("action", { detail: { name: "delete" }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("delete-dialog")).toBeTruthy();
    document.body.removeChild(el);
  });

  it("cancel closes the open dialog", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("action", { detail: { name: "mkdir" }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("mkdir-dialog")).toBeTruthy();
    el.shadowRoot.querySelector("mkdir-dialog").dispatchEvent(
      new CustomEvent("cancel", { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("mkdir-dialog")).toBeFalsy();
    document.body.removeChild(el);
  });

  it("loads directory contents when file-list activates a directory", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const listSpy = filesApi.list as ReturnType<typeof vi.fn>;
    listSpy.mockClear();
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("activated", {
        detail: { path: "subdir", is_dir: true },
        bubbles: true, composed: true,
      }),
    );
    // Wait a microtask for the async _onFileListActivated handler
    await new Promise(r => setTimeout(r, 0));
    expect(listSpy).toHaveBeenCalledWith("subdir");
    document.body.removeChild(el);
  });

  it("updating currentDir when a directory is activated (so file-list re-renders)", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(store.getState().files.currentDir).toBe("");
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("activated", {
        detail: { path: "docs", is_dir: true },
        bubbles: true, composed: true,
      }),
    );
    await new Promise(r => setTimeout(r, 0));
    expect(store.getState().files.currentDir).toBe("docs");
    document.body.removeChild(el);
  });

  it("clicking a file loads preview via fetchPreview", async () => {
    const spy = fetchPreview as ReturnType<typeof vi.fn>;
    spy.mockClear();
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("activated", {
        detail: { path: "a.md", is_dir: false },
        bubbles: true, composed: true,
      }),
    );
    await new Promise(r => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledWith("a.md");
    document.body.removeChild(el);
  });
});
