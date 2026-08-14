import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-list";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { FileEntry } from "../src/api/files";

const entries: FileEntry[] = [
  { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true, has_child_dirs: true },
  { name: "a.md", path: "a.md", is_dir: false, size: 100, modified_at: "2026-06-22T00:00:00Z", indexed: true, writable: true, has_child_dirs: false },
  { name: "b.md", path: "b.md", is_dir: false, size: 200, modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true, has_child_dirs: false },
];

describe("file-list", () => {
  beforeEach(() => resetStore(store));

  it("renders empty state when no entries", async () => {
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("目录为空");
    document.body.removeChild(el);
  });

  it("renders rows from store treeCache[currentDir]", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const rows = el.shadowRoot.querySelectorAll("file-row");
    expect(rows.length).toBe(3);
    document.body.removeChild(el);
  });

  it("toolbar rename disabled when 0 selected", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const renameBtn = el.shadowRoot.querySelector('[data-action="rename"]') as HTMLButtonElement;
    expect(renameBtn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("toolbar rename enabled when exactly 1 selected", async () => {
    actions.setFilesState({
      currentDir: "",
      treeCache: { "": entries },
      selectedPaths: ["a.md"],
    });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const renameBtn = el.shadowRoot.querySelector('[data-action="rename"]') as HTMLButtonElement;
    expect(renameBtn.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("toolbar move/delete enabled when 2+ selected", async () => {
    actions.setFilesState({
      currentDir: "",
      treeCache: { "": entries },
      selectedPaths: ["a.md", "b.md"],
    });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const moveBtn = el.shadowRoot.querySelector('[data-action="move"]') as HTMLButtonElement;
    const deleteBtn = el.shadowRoot.querySelector('[data-action="delete"]') as HTMLButtonElement;
    expect(moveBtn.disabled).toBe(false);
    expect(deleteBtn.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("dispatches action event on toolbar click", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("action", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector('[data-action="mkdir"]').click();
    expect(captured).toEqual({ name: "mkdir" });
    document.body.removeChild(el);
  });

  it("desktop toolbar buttons are icon-only with hover-tooltip labels", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const btns = el.shadowRoot.querySelectorAll(".toolbar button");
    expect(btns.length).toBe(6);
    // 每个按钮 = icon + .btn-label 文字（hover 才显示）
    for (const btn of btns) {
      expect(btn.querySelector("doclens-icon")).toBeTruthy();
      expect(btn.querySelector(".btn-label")?.textContent?.trim().length).toBeGreaterThan(0);
    }
    // 样式规则：默认隐藏、hover 浮现为 tooltip
    const cssText = (el.constructor as any).styles.cssText as string;
    expect(cssText).toMatch(/\.toolbar button \.btn-label\s*\{[^}]*display:\s*none/);
    expect(cssText).toMatch(/\.toolbar button:hover[^\{]*\.btn-label\s*\{/);
    document.body.removeChild(el);
  });

  it("toolbar copy-path disabled when 0 selected, enabled when 1+ selected", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const btn = () => el.shadowRoot.querySelector('[data-action="copy-path"]') as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    actions.setFilesState({ selectedPaths: ["a.md"] });
    await el.updateComplete;
    expect(btn().disabled).toBe(false);
    // 多选同样可用
    actions.setFilesState({ selectedPaths: ["a.md", "b.md"] });
    await el.updateComplete;
    expect(btn().disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("toolbar copy-path click dispatches action event", async () => {
    actions.setFilesState({
      currentDir: "",
      treeCache: { "": entries },
      selectedPaths: ["a.md"],
    });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("action", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector('[data-action="copy-path"]').click();
    expect(captured).toEqual({ name: "copy-path" });
    document.body.removeChild(el);
  });

  it("up button disabled at root", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const upBtn = el.shadowRoot.querySelector(".up-btn") as HTMLButtonElement;
    expect(upBtn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("up button enabled in subdirectory", async () => {
    actions.setFilesState({ currentDir: "docs", treeCache: { docs: entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const upBtn = el.shadowRoot.querySelector(".up-btn") as HTMLButtonElement;
    expect(upBtn.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("clicking up button navigates to parent dir", async () => {
    actions.setFilesState({ currentDir: "docs/sub", treeCache: { "docs/sub": entries, docs: [] } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector(".up-btn").click();
    expect(store.getState().files.currentDir).toBe("docs");
    document.body.removeChild(el);
  });

  it("clicking up button from top-level dir navigates to root", async () => {
    actions.setFilesState({ currentDir: "docs", treeCache: { docs: entries, "": [] } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector(".up-btn").click();
    expect(store.getState().files.currentDir).toBe("");
    document.body.removeChild(el);
  });

  it("forwards row 'checked' event to actions.selectEntry", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const row = el.shadowRoot.querySelector("file-row");
    expect(row).toBeTruthy();
    row.dispatchEvent(new CustomEvent("checked", {
      detail: { path: "a.md", ctrl: false, shift: false },
      bubbles: true, composed: true,
    }));
    expect(store.getState().files.selectedPaths).toEqual(["a.md"]);
    document.body.removeChild(el);
  });

  it("default checkbox click toggles (accumulates) without needing ctrl", async () => {
    actions.setFilesState({
      currentDir: "",
      treeCache: { "": entries },
      selectedPaths: ["b.md"],
    });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const rows = el.shadowRoot.querySelectorAll("file-row");
    // 点 a.md 的 checkbox（无 modifier）—— 应该 toggle 加入，而不是替换
    const aRow = Array.from(rows).find(
      (r: any) => r.entry?.path === "a.md",
    ) as any;
    aRow.dispatchEvent(new CustomEvent("checked", {
      detail: { path: "a.md", ctrl: false, shift: false },
      bubbles: true, composed: true,
    }));
    expect(store.getState().files.selectedPaths.sort()).toEqual(["a.md", "b.md"].sort());
    // 再点一次 a.md —— 移除
    aRow.dispatchEvent(new CustomEvent("checked", {
      detail: { path: "a.md", ctrl: false, shift: false },
      bubbles: true, composed: true,
    }));
    expect(store.getState().files.selectedPaths).toEqual(["b.md"]);
    document.body.removeChild(el);
  });

  it("header select-all checkbox toggles all entries", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const headerCb = el.shadowRoot.querySelector(".select-all input[type='checkbox']") as HTMLInputElement;
    expect(headerCb).toBeTruthy();
    headerCb.click();
    expect(store.getState().files.selectedPaths.sort()).toEqual(["a.md", "b.md", "docs"].sort());
    // 再点一次清空
    headerCb.click();
    expect(store.getState().files.selectedPaths).toEqual([]);
    document.body.removeChild(el);
  });

  it("header row renders 5 columns (勾选/图标/名称/大小/修改)", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const headerCells = el.shadowRoot.querySelectorAll(".header-row > *");
    expect(headerCells.length).toBe(5);
    const labels = Array.from(headerCells).map((c) =>
      (c as HTMLElement).textContent?.trim(),
    );
    expect(labels[2]).toBe("名称");
    expect(labels[3]).toBe("大小");
    expect(labels[4]).toBe("修改");
    document.body.removeChild(el);
  });

  it("header-row has 3 col-resize handles (名称/大小/修改)", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const handles = el.shadowRoot.querySelectorAll(".header-row .col-resize");
    expect(handles.length).toBe(3);
    document.body.removeChild(el);
  });

  it("col-resize mousedown + mousemove updates --col-N on host", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const handles = el.shadowRoot.querySelectorAll(".header-row .col-resize");
    // handles[0] is name column (idx=2), default 240px, drag dx=60 → 300px
    handles[0].dispatchEvent(
      new MouseEvent("mousedown", { clientX: 100, bubbles: true }),
    );
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 160 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await el.updateComplete;
    expect(el.style.getPropertyValue("--col-3")).toBe("300px");
    document.body.removeChild(el);
  });

  it("col widths persist to localStorage after drag end", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const handles = el.shadowRoot.querySelectorAll(".header-row .col-resize");
    // handles[1] is size column (idx=3), default 80px, drag dx=-50 → clamped to min 50
    handles[1].dispatchEvent(
      new MouseEvent("mousedown", { clientX: 200, bubbles: true }),
    );
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 150 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await el.updateComplete;
    const saved = localStorage.getItem("cortex.files.colWidths");
    expect(saved).toBeTruthy();
    const arr = JSON.parse(saved!);
    expect(arr[3]).toBe(50); // clamped to COL_MINS[3]=50
    document.body.removeChild(el);
    localStorage.removeItem("cortex.files.colWidths");
  });

  it("loads col widths from localStorage on connect", async () => {
    localStorage.setItem(
      "cortex.files.colWidths",
      JSON.stringify([30, 30, 300, 100, 150]),
    );
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.style.getPropertyValue("--col-3")).toBe("300px");
    expect(el.style.getPropertyValue("--col-4")).toBe("100px");
    document.body.removeChild(el);
    localStorage.removeItem("cortex.files.colWidths");
  });
});

describe("file-list mobile header", () => {
  beforeEach(() => resetStore(store));

  it("does not render .mobile-header by default", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-header")).toBeNull();
    // 桌面 .toolbar 仍渲染
    expect(el.shadowRoot.querySelector(".toolbar")).toBeTruthy();
    document.body.removeChild(el);
  });

  it("renders .mobile-header with back / path / more when mobile=true", async () => {
    actions.setFilesState({ currentDir: "docs", treeCache: { docs: entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    const mh = el.shadowRoot.querySelector(".mobile-header");
    expect(mh).toBeTruthy();
    expect(mh.querySelector(".mobile-back")).toBeTruthy();
    expect(mh.querySelector(".mobile-more")).toBeTruthy();
    // 路径以 / 包裹
    expect(mh.querySelector(".mobile-path").textContent).toBe("/docs/");
    // 桌面 .toolbar 不再渲染
    expect(el.shadowRoot.querySelector(".toolbar")).toBeNull();
    // 桌面 breadcrumb 也不渲染
    expect(el.shadowRoot.querySelector(".breadcrumb")).toBeNull();
    document.body.removeChild(el);
  });

  it("root dir shows '/' as path", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-path").textContent).toBe("/");
    document.body.removeChild(el);
  });

  it("clicking mobile-back dispatches 'back' event (bubbles+composed)", async () => {
    actions.setFilesState({ currentDir: "docs", treeCache: { docs: entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    let received = false;
    el.addEventListener("back", () => (received = true));
    (el.shadowRoot.querySelector(".mobile-back") as HTMLElement).click();
    expect(received).toBe(true);
    document.body.removeChild(el);
  });

  it("clicking mobile-more opens dropdown with all 6 actions", async () => {
    actions.setFilesState({
      currentDir: "docs",
      treeCache: { docs: entries },
      selectedPaths: ["a.md", "b.md"],
    });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-menu")).toBeNull();
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const menu = el.shadowRoot.querySelector(".mobile-menu");
    expect(menu).toBeTruthy();
    const items = menu.querySelectorAll("button");
    // 6 个：+ 新目录 / ⬆ 上传 / ✎ 重命名 / → 移动 / ⧉ 拷贝路径 / 🗑 删除
    expect(items.length).toBe(6);
    expect(items[0].textContent).toContain("新目录");
    expect(items[1].textContent).toContain("上传");
    expect(items[2].textContent).toContain("重命名");
    expect(items[3].textContent).toContain("移动");
    expect(items[4].textContent).toContain("拷贝路径");
    expect(items[5].textContent).toContain("删除");
    document.body.removeChild(el);
  });

  it("dropdown rename disabled when 0 selected; enabled when 1 selected", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const items = el.shadowRoot.querySelectorAll(".mobile-menu button");
    // 0 选中：rename (idx=2) disabled
    expect((items[2] as HTMLButtonElement).disabled).toBe(true);
    // 1 选中
    actions.setFilesState({ selectedPaths: ["a.md"] });
    await el.updateComplete;
    // 菜单仍展开（state 变化触发 re-render）
    const items2 = el.shadowRoot.querySelectorAll(".mobile-menu button");
    expect((items2[2] as HTMLButtonElement).disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("dropdown move/delete disabled when 0 selected; enabled when 1+ selected", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const items = el.shadowRoot.querySelectorAll(".mobile-menu button");
    // 0 选中（idx: 3=移动, 5=删除）
    expect((items[3] as HTMLButtonElement).disabled).toBe(true);
    expect((items[5] as HTMLButtonElement).disabled).toBe(true);
    actions.setFilesState({ selectedPaths: ["a.md"] });
    await el.updateComplete;
    const items2 = el.shadowRoot.querySelectorAll(".mobile-menu button");
    expect((items2[3] as HTMLButtonElement).disabled).toBe(false);
    expect((items2[5] as HTMLButtonElement).disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("dropdown item click dispatches correct action event", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    const seen: string[] = [];
    el.addEventListener("action", (e: Event) => seen.push((e as CustomEvent).detail.name));
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const items = el.shadowRoot.querySelectorAll(".mobile-menu button");
    // 点 + 新目录（idx=0）
    (items[0] as HTMLElement).click();
    // 重新打开下拉（点 1 次会关闭）
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    const items2 = el.shadowRoot.querySelectorAll(".mobile-menu button");
    (items2[1] as HTMLElement).click(); // 上传
    expect(seen).toEqual(["mkdir", "upload"]);
    document.body.removeChild(el);
  });

  it("outside click closes the dropdown", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-menu")).toBeTruthy();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-menu")).toBeNull();
    document.body.removeChild(el);
  });

  it("clicking on a row (inside shadow but outside menu) closes the dropdown", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-menu")).toBeTruthy();
    // 点击 file-row（shadow 内部但不在 menu 里）
    const row = el.shadowRoot.querySelector("file-row") as HTMLElement;
    expect(row).toBeTruthy();
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-menu")).toBeNull();
    document.body.removeChild(el);
  });

  it("clicking on more button (path includes .mobile-more) does NOT force-close via doc handler", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    // 先打开
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".mobile-menu")).toBeTruthy();
    // 再点一次 more —— doc 处理器不应抢先关闭（否则按钮 toggle 会重新打开）
    (el.shadowRoot.querySelector(".mobile-more") as HTMLElement).click();
    await el.updateComplete;
    // 最终状态应该是关闭（按钮 toggle 一次）
    expect(el.shadowRoot.querySelector(".mobile-menu")).toBeNull();
    document.body.removeChild(el);
  });
});
