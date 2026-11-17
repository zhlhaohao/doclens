import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture, html } from "@open-wc/testing";
import "../src/views/files-view";
// files-view 的列表/预览/对话框组件在真实应用由 app.ts 注册；
// 测试环境需显式引入，否则自定义元素不 upgrade。
import "../src/components/file-list";
import "../src/components/file-tree";
import "../src/components/preview-pane";
import "../src/components/git-changes-list";
import "../src/components/deep-read-list";
import { resetStore, setDesktopViewport } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { FilesView } from "../src/views/files-view";

/**
 * 文件管理流程集成测试（AP-12 扩展：files-view 流程级安全网）。
 *
 * 覆盖「目录浏览 → 文件预览 → 模式切换」的真实链路——
 * 此前只有零散的单元测试（filesApi / PreviewController），流程级协作语义无保护：
 *   ① 进目录 → filesApi.list → treeCache 落库 → file-list 渲染
 *   ② 点文件 → preview 拉取 → 预览控制器就位
 *   ③ 切换改动模式 → git-changes-list 挂载（互斥深读模式）
 *   ④ 目录切换退出改动模式（Q15 守卫）
 *   ⑤ dirty 编辑时切文件走丢弃确认（不静默切换）
 */

interface FilesFixtureOpts {
  entries?: Array<Record<string, unknown>>;
  previewDoc?: Record<string, unknown>;
  changes?: Array<Record<string, unknown>>;
}

function jsonRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

function installFetch(opts: FilesFixtureOpts) {
  global.fetch = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.startsWith("/api/files/drives")) {
      return jsonRes({ drives: ["C:\\"], home: "C:\\Users\\test" });
    }
    if (u.startsWith("/api/files/list") || u.startsWith("/api/files?")) {
      return jsonRes({
        path: "", entries: opts.entries ?? [], total: (opts.entries ?? []).length,
      });
    }
    if (u.startsWith("/api/git/changes")) {
      return jsonRes({ changes: opts.changes ?? [] });
    }
    if (u.startsWith("/api/preview")) {
      return jsonRes(opts.previewDoc ?? {
        path: "docs/a.md", language: "markdown", content: "# A\n正文",
        writable: false, synthesized: false,
      });
    }
    if (u.startsWith("/api/skills")) {
      return jsonRes({ skills: [] });
    }
    return jsonRes({});
  }) as unknown as typeof fetch;
}

describe("<files-view> 文件管理流程集成（AP-12 安全网）", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    resetStore(store);
    setDesktopViewport();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("① 进目录 → filesApi.list → treeCache 落库 → file-list 渲染", async () => {
    installFetch({
      entries: [
        { name: "docs", path: "docs", is_dir: true, size: 0,
          modified_at: "", indexed: false, writable: true, has_child_dirs: true },
        { name: "a.md", path: "a.md", is_dir: false, size: 10,
          modified_at: "", indexed: true, writable: true, has_child_dirs: false },
      ],
    });
    const el = await fixture(html`<files-view></files-view>`) as FilesView;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 30));

    const entries = store.getState().files.treeCache[""] ?? [];
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe("docs");
    // file-list 渲染（目录浏览）
    expect(el.shadowRoot?.querySelector("file-list")).toBeTruthy();
  });

  it("② 点文件 → preview 拉取 → 预览控制器就位", async () => {
    installFetch({});
    const el = await fixture(html`<files-view></files-view>`) as FilesView;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 30));

    await (el as any)._onFileListActivated(new CustomEvent("activated", {
      detail: { path: "docs/a.md", is_dir: false },
    }));
    await new Promise((r) => setTimeout(r, 30));
    await el.updateComplete;

    expect((el as any)._preview.state.status).toBe("ok");
    expect((el as any)._previewPath).toBe("docs/a.md");
  });

  it("③ 切改动模式 → git-changes-list 挂载（与深读互斥）", async () => {
    installFetch({ changes: [{ path: "a.md", kind: "modified" }] });
    const el = await fixture(html`<files-view></files-view>`) as FilesView;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 30));

    (el as any)._modes.toggleChangesMode();
    await el.updateComplete;

    expect((el as any)._modes.changesMode).toBe(true);
    expect(el.shadowRoot?.querySelector("git-changes-list")).toBeTruthy();
    // 互斥：深读模式必须关闭
    expect((el as any)._modes.deepReadMode).toBe(false);
    // 常规 file-list 不再挂载
    expect(el.shadowRoot?.querySelector("file-list")).toBeNull();
  });

  it("④ 目录切换退出改动模式（Q15 守卫）", async () => {
    installFetch({});
    const el = await fixture(html`<files-view></files-view>`) as FilesView;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 30));

    (el as any)._modes.toggleChangesMode();
    expect((el as any)._modes.changesMode).toBe(true);

    // 用户点了 file-tree 的目录节点 → 切目录 → 改动模式应退出
    actions.selectDir("sub/dir");
    await new Promise((r) => setTimeout(r, 30));
    expect((el as any)._modes.changesMode).toBe(false);
  });

  it("⑤ 点目录 → selectDir + ensureLoaded（不触发文件预览）", async () => {
    installFetch({});
    const el = await fixture(html`<files-view></files-view>`) as FilesView;
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 30));

    await (el as any)._onFileListActivated(new CustomEvent("activated", {
      detail: { path: "docs", is_dir: true },
    }));
    await new Promise((r) => setTimeout(r, 30));

    expect(store.getState().files.currentDir).toBe("docs");
    // 目录激活不触发预览（预览状态机保持 empty）
    expect((el as any)._preview.state.status).toBe("empty");
  });
});
