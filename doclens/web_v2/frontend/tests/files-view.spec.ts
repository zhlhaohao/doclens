import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../src/views/files-view";
import { resetStore, setMobileViewport, setDesktopViewport } from "./test-utils";
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

// Mock fetchDocuments (避免真实网络请求；返回空数组即可让 _loadIndexedDocuments 走完)
vi.mock("../src/api/documents", () => ({
  fetchDocuments: vi.fn().mockResolvedValue([]),
}));

describe("files-view", () => {
  beforeEach(() => {
    resetStore(store);
    vi.clearAllMocks();
  });

  it("copy-path action copies selected paths (newline-joined) and toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    actions.setFilesState({ selectedPaths: ["docs/a.md", "b.md"] });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;

    el._onAction(new CustomEvent("action", { detail: { name: "copy-path" } }));
    expect(writeText).toHaveBeenCalledWith("docs/a.md\nb.md");
    await vi.waitFor(() => {
      expect(el.shadowRoot.textContent).toContain("已复制 2 个路径");
    });
    document.body.removeChild(el);
  });

  it("copy-path action with 0 selected does nothing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;

    el._onAction(new CustomEvent("action", { detail: { name: "copy-path" } }));
    expect(writeText).not.toHaveBeenCalled();
    document.body.removeChild(el);
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

  it("refreshes current dir after cortex:watch-reindexed (indexed 标志回填)", async () => {
    // 预置：已在 docs 目录，且该目录已缓存（indexed=false，等 reindex 完成后应刷新）
    actions.setFilesState({
      currentDir: "docs",
      treeCache: {
        docs: [{
          name: "a.md", path: "docs/a.md", is_dir: false, size: 1,
          modified_at: "", indexed: false, writable: true, has_child_dirs: false,
        }],
      },
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const listSpy = filesApi.list as ReturnType<typeof vi.fn>;
    listSpy.mockClear();

    // reindex 完成（FileWatcher 改名/新增后）派发的事件
    window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", { detail: { doc_count: 5 } }));
    await new Promise(r => setTimeout(r, 0));

    expect(listSpy).toHaveBeenCalledWith("docs");
    document.body.removeChild(el);
  });
});

describe("files-view filename search", () => {
  beforeEach(() => resetStore(store));

  it("renders file-search-box in desktop layout", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const box = el.shadowRoot.querySelector("file-search-box");
    expect(box).toBeTruthy();
    document.body.removeChild(el);
  });

  it("replaces file-list with file-search-results when search activated", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("file-search-results")).toBeTruthy();
    expect(el.shadowRoot.querySelector("file-list")).toBeNull();
    document.body.removeChild(el);
  });

  it("shows file-list again after clearFilenameSearch", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    actions.clearFilenameSearch();
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("file-list")).toBeTruthy();
    expect(el.shadowRoot.querySelector("file-search-results")).toBeNull();
    document.body.removeChild(el);
  });
});

describe("files-view mobile filename search", () => {
  beforeEach(() => {
    resetStore(store);
    setMobileViewport();
  });
  afterEach(() => {
    setDesktopViewport();
  });

  it("renders file-search-box in mobile tree pane", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-layout")).toBeTruthy();
    expect(el.shadowRoot.querySelector(".mobile-layout file-search-box")).toBeTruthy();
    document.body.removeChild(el);
  });

  it("shows file-search-results instead of file-tree when search active on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const mobile = el.shadowRoot.querySelector(".mobile-layout");
    expect(mobile.querySelector("file-search-results")).toBeTruthy();
    expect(mobile.querySelector("file-tree")).toBeNull();
    document.body.removeChild(el);
  });

  it("shows file-tree when search inactive on mobile", async () => {
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const mobile = el.shadowRoot.querySelector(".mobile-layout");
    expect(mobile.querySelector("file-tree")).toBeTruthy();
    expect(mobile.querySelector("file-search-results")).toBeNull();
    document.body.removeChild(el);
  });

  it("restores file-tree after clearing search on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    actions.clearFilenameSearch();
    await el.updateComplete;
    const mobile = el.shadowRoot.querySelector(".mobile-layout");
    expect(mobile.querySelector("file-tree")).toBeTruthy();
    expect(mobile.querySelector("file-search-results")).toBeNull();
    document.body.removeChild(el);
  });

  it("preserves search input value after returning from detail pane on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // 进入 detail 面板（搜索框被卸载）
    actions.setMobilePane("detail");
    await el.updateComplete;
    // 返回 tree 面板（搜索框重挂载）
    actions.setMobilePane("tree");
    await el.updateComplete;
    const searchBox = el.shadowRoot.querySelector(".mobile-layout file-search-box") as any;
    const input = searchBox.shadowRoot.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("read");
    document.body.removeChild(el);
  });

  it("_goBack from detail goes to tree when search active on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    actions.setMobilePane("detail");
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // detail pane 的返回键移到 preview-pane 内部的 mobile-back
    el._goBack();
    await el.updateComplete;
    expect(store.getState().files.mobilePane).toBe("tree");
    document.body.removeChild(el);
  });

  it("_goBack from detail goes to list when search inactive on mobile", async () => {
    actions.setMobilePane("detail");
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el._goBack();
    await el.updateComplete;
    expect(store.getState().files.mobilePane).toBe("list");
    document.body.removeChild(el);
  });

  it("filename result activation switches to detail pane on mobile", async () => {
    actions.setFilenameSearchQuery({
      query: "read",
      results: [{ path: "a.md", name: "a.md", size: 1, modifiedAt: "2026-06-24T00:00:00Z" }],
      totalMatches: 1,
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-search-results").dispatchEvent(
      new CustomEvent("activated", {
        detail: { path: "a.md" },
        bubbles: true, composed: true,
      }),
    );
    await new Promise(r => setTimeout(r, 0));
    expect(store.getState().files.mobilePane).toBe("detail");
    document.body.removeChild(el);
  });

  it("detail pane renders preview-pane with mobile=true and hides floating back-btn", async () => {
    actions.setMobilePane("detail");
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // 模拟已加载预览，触发 preview-pane 渲染
    el._previewPath = "a.md";
    el._previewContent = "# hi";
    el._previewLanguage = "markdown";
    await el.updateComplete;
    const pp = el.shadowRoot.querySelector("preview-pane");
    expect(pp).toBeTruthy();
    expect(pp.hasAttribute("mobile")).toBe(true);
    // 浮动的 .back-btn 不再出现（返回键由 preview-pane 内部 mobile-back 提供）
    expect(el.shadowRoot.querySelector(".back-btn")).toBeNull();
    document.body.removeChild(el);
  });

  it("list pane renders file-list with mobile=true and hides floating back-btn", async () => {
    actions.setMobilePane("list");
    actions.setFilesState({ currentDir: "docs", treeCache: { docs: [] } });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const fl = el.shadowRoot.querySelector("file-list");
    expect(fl).toBeTruthy();
    expect(fl.hasAttribute("mobile")).toBe(true);
    // 浮动的 .back-btn 不再出现（由 file-list 内部 mobile-back 提供）
    expect(el.shadowRoot.querySelector(".back-btn")).toBeNull();
    // file-list 渲染 mobile bar
    expect(fl.shadowRoot.querySelector(".mobile-header")).toBeTruthy();
    document.body.removeChild(el);
  });

  it("list pane back event from file-list calls _goBack", async () => {
    actions.setMobilePane("list");
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector("file-list").dispatchEvent(
      new CustomEvent("back", { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(store.getState().files.mobilePane).toBe("tree");
    document.body.removeChild(el);
  });
});
