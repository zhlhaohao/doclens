import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture, html } from "@open-wc/testing";
import "../src/views/search-view";
// search-view 只 import 了 preview-pane 的类型——组件实现在真实应用由
// app.ts 注册；测试环境需显式引入，否则 <preview-pane> 不 upgrade。
import "../src/components/preview-pane";
// search-view 的结果分组组件（search-results → file-card / file-search-box
// / input-box）在真实应用由 app.ts 注册；测试环境需显式引入。
import "../src/components/search-results";
import "../src/components/input-box";
import { resetStore, setDesktopViewport } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { SearchView } from "../src/views/search-view";

/**
 * 搜索流程集成测试（AP-12 扩展：search-view 流程级安全网）。
 *
 * 覆盖「搜 → 分组结果 → 点命中 → 预览 → 行定位」的真实链路——
 * 此前只有零散的单元测试（PreviewController / mapLineViaPredecessor），
 * 流程级协作语义无保护：
 *   ① 提交查询 → searchApi 响应 → store 分组就位 → 渲染 file-card
 *   ② 点命中行 → preview 拉取 → previewOpen + previewPath 就位
 *   ③ 行号经 lineMap 前驱换算（合成 md 命中落在块内部 → 前驱 heading）
 *   ④ 翻页 → offset 推进 → 预览清空
 *   ⑤ grep 模式走 grepApi 而非 searchApi
 */

interface SearchFixtureOpts {
  /** searchApi 返回的 groups。 */
  groups?: Array<Record<string, unknown>>;
  /** preview 接口返回的文档。 */
  previewDoc?: Record<string, unknown>;
}

let lastPreviewPath: string | null = null;

function jsonRes(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

function installFetch(opts: SearchFixtureOpts) {
  lastPreviewPath = null;
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith("/api/search")) {
      // searchApi 走 POST + JSON body（offset 在 body 不在 URL query）。
      // 后端 clamp 后回显 offset——按请求的 offset 返回（翻页断言依赖它）。
      const body = init?.body ? JSON.parse(String(init.body)) as { offset?: number } : {};
      return jsonRes({
        groups: opts.groups ?? [],
        total: (opts.groups ?? []).length,
        total_matches: (opts.groups ?? []).reduce((n, g) => n + ((g.total_matches as number) ?? 1), 0),
        offset: body.offset ?? 0, limit: 20, query: "麒麟",
        query_words: ["麒麟"], elapsed_ms: 5, source: "fts",
      });
    }
    if (u.startsWith("/api/grep")) {
      return jsonRes({
        groups: opts.groups ?? [], total: (opts.groups ?? []).length,
        total_matches: 1, offset: 0, limit: 20, query: "麒麟",
        query_words: ["麒麟"], elapsed_ms: 5, source: "grep",
      });
    }
    if (u.startsWith("/api/preview")) {
      lastPreviewPath = u;
      return jsonRes(opts.previewDoc ?? {
        path: "docs/a.md", language: "markdown", content: "# A\n正文",
        writable: false, synthesized: false,
      });
    }
    if (u.startsWith("/api/sessions")) {
      return jsonRes({ sessions: [], total: 0 });
    }
    return jsonRes({});
  }) as unknown as typeof fetch;
}

describe("<search-view> 搜索流程集成（AP-12 安全网）", () => {
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

  it("① 提交查询 → 分组落库 → 渲染 file-card", async () => {
    installFetch({
      groups: [{
        path: "docs/a.md", best_score: 1.0, total_matches: 2,
        matches: [{ line: 3, text: "含麒麟的行", spans: [[1, 3]] }],
      }],
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    await (el as any)._submit("麒麟");
    await new Promise((r) => setTimeout(r, 30));
    await el.updateComplete;

    const st = store.getState().search;
    expect(st.groups).toHaveLength(1);
    expect(st.groups[0].path).toBe("docs/a.md");
    // 分组渲染在 search-results 的 shadowRoot 内（file-card 是其子组件）
    const results = el.shadowRoot?.querySelector("search-results");
    expect(results).toBeTruthy();
    expect(results?.shadowRoot?.querySelector("file-card")).toBeTruthy();
  });

  it("② 点命中行 → 预览拉取 → previewPath 就位 + 预览控制器 ok", async () => {
    installFetch({});
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    await (el as any)._onHitSelect(new CustomEvent("hit-select", {
      detail: { hit: { path: "docs/a.md", line: 3 } },
    }));
    await new Promise((r) => setTimeout(r, 30));
    await el.updateComplete;

    expect((el as any).previewPath).toBe("docs/a.md");
    expect(lastPreviewPath).toContain("/api/preview");
    // 预览控制器状态就位（search-view 的预览显隐由 previewPath 决定，
    // 无 chat-view 的 previewOpen 布尔字段）
    expect((el as any)._preview.state.status).toBe("ok");
    expect((el as any).previewContent).toBe("# A\n正文");
  });

  it("③ 合成 md 的行号经 lineMap 前驱换算（命中落在块内部 → 前驱 heading）", async () => {
    installFetch({
      previewDoc: {
        path: "docs/a.pptx", language: "markdown", content: "# 第1页\n内容",
        writable: false, synthesized: true,
        pages: [{ line_start: 1, label: "第1页" }],
        // 后端字段是 snake_case：line_map（原始行号 → md 行号）
        line_map: { "1": 1, "8": 5 }, // 原始行 1→md 行 1；原始行 8→md 行 5
      },
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    // 命中原始行 12（>8 的最大键 = 8 → 映射到 md 行 5）
    await (el as any)._onHitSelect(new CustomEvent("hit-select", {
      detail: { hit: { path: "docs/a.pptx", line: 12 } },
    }));
    await new Promise((r) => setTimeout(r, 30));
    await el.updateComplete;

    // lineMap 前驱换算：12 落在 [8, ∞) → 前驱键 8 → md 行 5
    expect((el as any).previewLine).toBe(5);
  });

  it("④ 翻页推进 offset 且清空预览", async () => {
    installFetch({});
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    // _goToPage 要求 query 非空且 state="focus"（INITIAL_STATE 是 initial）
    actions.setSearchState({
      state: "focus", query: "麒麟", groups: [], total: 100, offset: 0, limit: 20,
    });
    await (el as any)._goToPage(3);
    await new Promise((r) => setTimeout(r, 30));
    await el.updateComplete;

    const st = store.getState().search;
    expect(st.offset).toBe(40); // 第 3 页 = (3-1)*20
    // 翻页后预览被清空（避免显示前一页的高亮）
    expect((el as any)._preview.state.status).toBe("empty");
  });

  it("⑤ grep 模式走 grepApi 而非 searchApi", async () => {
    const searchCalls: string[] = [];
    const grepCalls: string[] = [];
    installFetch({});
    const origFetch = global.fetch;
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).startsWith("/api/search")) searchCalls.push(url);
      if (String(url).startsWith("/api/grep")) grepCalls.push(url);
      return origFetch(url as string);
    }) as unknown as typeof fetch;

    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    // 切到 grep 模式（search-view 支持 keyword/grep 两模式）
    (el as any).searchMode = "grep";
    await (el as any)._submit("麒麟");
    await new Promise((r) => setTimeout(r, 30));

    expect(grepCalls.length).toBeGreaterThan(0);
    expect(searchCalls.length).toBe(0);
  });
});
