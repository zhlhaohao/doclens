import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatHistoryController } from "../src/utils/chat-history-controller";
import { resetStore } from "./test-utils";
import { store } from "../src/state/store";

const listSessionsMock = vi.fn();
const starSessionMock = vi.fn();
const clearSessionsMock = vi.fn();

vi.mock("../src/api/sessions", () => ({
  listSessions: (...a: unknown[]) => listSessionsMock(...a),
  starSession: (...a: unknown[]) => starSessionMock(...a),
  clearSessions: (...a: unknown[]) => clearSessionsMock(...a),
}));

function makeController(over: Record<string, unknown> = {}) {
  const host = {
    requestUpdate: () => {},
    addController: () => {},
    renderRoot: null as ParentNode | null,
  } as never as import("lit").ReactiveControllerHost & { renderRoot: ParentNode | null };
  const toasts: Array<{ message: string }> = [];
  const c = new ChatHistoryController(host, {
    toast: (message: string) => { toasts.push({ message }); },
    storageKey: "cortex.test.starPin",
    currentSessionId: () => null,
    syncCurrentSessionStar: () => {},
    ...over,
  } as never);
  return { c, toasts, host };
}

describe("ChatHistoryController（AP-1 会话历史域外迁）", () => {
  beforeEach(() => {
    resetStore(store);
    vi.clearAllMocks();
    localStorage.clear();
    listSessionsMock.mockResolvedValue({
      sessions: [
        { id: "a", title: "A", updated_at: "2026-01-01", starred: true },
        { id: "b", title: "B", updated_at: "2026-01-02", starred: false },
      ],
    });
  });

  it("load：拉第 N 页并按服务端 offset/limit 请求", async () => {
    const { c } = makeController();
    await c.load(3);
    expect(listSessionsMock).toHaveBeenCalledWith({ type: "chat", limit: 200, offset: 400 });
    expect(c.page).toBe(3);
  });

  it("load：星标置顶关闭时按时间混排（后端返回 starred DESC）", async () => {
    const { c } = makeController();
    await c.load(1);
    // 默认置顶 → 保持服务端顺序
    expect(c.sessions.map((s) => s.id)).toEqual(["a", "b"]);
    await c.setStarPin(false);
    // 关闭置顶 → 按 updated_at 降序混排
    expect(c.sessions.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("setStarPin：持久化到 localStorage", async () => {
    const { c } = makeController();
    await c.setStarPin(false);
    expect(localStorage.getItem("cortex.test.starPin")).toBe("0");
    await c.setStarPin(true);
    expect(localStorage.getItem("cortex.test.starPin")).toBe("1");
  });

  it("toggleStar：乐观翻转，失败回滚并 toast", async () => {
    starSessionMock.mockRejectedValueOnce(new Error("boom"));
    const { c, toasts } = makeController();
    await c.load(1);
    await c.toggleStar("b", true);
    expect(c.sessions.find((s) => s.id === "b")?.starred).toBe(false); // 回滚
    expect(toasts[0].message).toContain("加星失败");
  });

  it("toggleStar：成功则同步当前会话星标态", async () => {
    const synced: Array<[string, boolean]> = [];
    const { c } = makeController({
      syncCurrentSessionStar: (id: string, starred: boolean) => synced.push([id, starred]),
    });
    await c.load(1);
    await c.toggleStar("b", true);
    expect(synced).toEqual([["b", true]]);
    expect(c.sessions.find((s) => s.id === "b")?.starred).toBe(true);
  });

  it("clear：加星会话本地保留并 toast 报告", async () => {
    clearSessionsMock.mockResolvedValue({ deleted_count: 5, skipped_starred: 1 });
    const { c, toasts } = makeController();
    await c.load(1);
    await c.clear();
    expect(c.sessions.map((s) => s.id)).toEqual(["a"]); // 加星保留
    expect(toasts[0].message).toContain("已清空 5 条");
    expect(c.clearing).toBe(false);
  });

  it("hasMore：满页时有下一页", async () => {
    listSessionsMock.mockResolvedValue({
      sessions: Array.from({ length: 200 }, (_, i) => ({
        id: `s${i}`, title: "t", updated_at: "2026-01-01", starred: false,
      })),
    });
    const { c } = makeController();
    await c.load(1);
    expect(c.hasMore).toBe(true);
  });

  it("load：响应体异常（缺 sessions 字段）时兜底空列表，不崩溃", async () => {
    // 回归（AP-11）：代理错误页 / 后端字段缺失 → sessions 为 undefined，
    // 原实现直接赋值会让「历史列表长度」读取抛 TypeError，整个对话页白屏
    listSessionsMock.mockResolvedValueOnce({} as never);
    const { c } = makeController();
    await c.load(1);
    expect(c.sessions).toEqual([]);
    expect(c.hasMore).toBe(false);
  });

  it("load：响应体为 null 时同样兜底", async () => {
    listSessionsMock.mockResolvedValueOnce(null as never);
    const { c } = makeController();
    await c.load(1);
    expect(c.sessions).toEqual([]);
  });
});
