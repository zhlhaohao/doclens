import { describe, it, expect, vi, beforeEach } from "vitest";

import { PreviewController } from "../src/utils/preview-controller";
import { fetchPreview } from "../src/api/preview";

vi.mock("../src/api/preview", () => ({
  fetchPreview: vi.fn(),
  isPstDerivedPath: (p: string) => p.endsWith(".pst/eml") || p.includes("/eml/"),
}));

/** 手写 host 桩（对照 chat-session-ops-controller.spec.ts 风格）。 */
function makeHost() {
  let updates = 0;
  const host = {
    requestUpdate: () => { updates++; },
    addController: () => {},
    updateComplete: Promise.resolve(true),
  } as never as import("lit").ReactiveControllerHost;
  return { host, get updates() { return updates; } };
}

function makeDoc(path: string, content: string) {
  return {
    path, content, language: "text", writable: false, synthesized: false,
    sizeBytes: null, pages: null, lineMap: null, pageStarts: null,
    attachments: null, tokens: null,
  };
}

function okResp(doc: ReturnType<typeof makeDoc>) {
  return { ok: true as const, ...doc };
}

const mockedFetchPreview = vi.mocked(fetchPreview);

/** 可手动放行的 deferred——模拟「先发后到」。 */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("PreviewController 请求代数守卫（AP-3）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("连开两文件：先发后到，迟到响应不覆盖新文档", async () => {
    const { host } = makeHost();
    const c = new PreviewController(host);
    const d1 = deferred<ReturnType<typeof okResp> | { ok: false; notIndexed: boolean; message: string; outsideWorkdir?: boolean }>();
    const d2 = deferred<ReturnType<typeof okResp> | { ok: false; notIndexed: boolean; message: string; outsideWorkdir?: boolean }>();
    mockedFetchPreview
      .mockReturnValueOnce(d1.promise as never)
      .mockReturnValueOnce(d2.promise as never);

    const p1 = c.open("a.txt");
    const p2 = c.open("b.txt");
    // 后发先到：b 先落 state
    d2.resolve(okResp(makeDoc("b.txt", "B")));
    await p2;
    expect(c.state).toMatchObject({ status: "ok" });
    expect(c.state.status === "ok" && c.state.doc.path).toBe("b.txt");

    // 先发后到：a 的迟到响应不得覆盖 b
    d1.resolve(okResp(makeDoc("a.txt", "A")));
    await p1;
    expect(c.state.status === "ok" && c.state.doc.path).toBe("b.txt");
  });

  it("clear 后迟到响应不回填空白态", async () => {
    const { host } = makeHost();
    const c = new PreviewController(host);
    const d = deferred<ReturnType<typeof okResp> | { ok: false; notIndexed: boolean; message: string; outsideWorkdir?: boolean }>();
    mockedFetchPreview.mockReturnValueOnce(d.promise as never);

    const p = c.open("a.txt");
    c.clear();
    expect(c.state.status).toBe("empty");

    d.resolve(okResp(makeDoc("a.txt", "A")));
    await p;
    expect(c.state.status).toBe("empty");
  });

  it("openHit 范围请求过期（期间有新 open）不落 state", async () => {
    const { host } = makeHost();
    const c = new PreviewController(host);

    const rangeD = deferred<Response>();
    const fullD = deferred<ReturnType<typeof okResp> | { ok: false; notIndexed: boolean; message: string; outsideWorkdir?: boolean }>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(rangeD.promise));
    mockedFetchPreview.mockReturnValueOnce(fullD.promise as never);

    const hitP = c.openHit("a.txt", 42);
    // openHit 在途时用户又全量打开了另一文件
    const openP = c.open("b.txt");
    fullD.resolve(okResp(makeDoc("b.txt", "B")));
    await openP;

    // 范围请求此刻才返回（迟到）——不得覆盖 b
    const body = { ...makeDoc("a.txt", "slice"), synthesized: false, language: "text" };
    rangeD.resolve(new Response(JSON.stringify(body), { status: 200 }));
    await hitP;
    expect(c.state.status === "ok" && c.state.doc.path).toBe("b.txt");
    vi.unstubAllGlobals();
  });

  it("正常路径不受影响：单发 open 落 state", async () => {
    const { host } = makeHost();
    const c = new PreviewController(host);
    mockedFetchPreview.mockResolvedValueOnce(okResp(makeDoc("a.txt", "A")) as never);
    await c.open("a.txt");
    expect(c.state).toMatchObject({ status: "ok" });
    expect(c.state.status === "ok" && c.state.doc.content).toBe("A");
  });
});
