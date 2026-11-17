import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatSessionOpsController } from "../src/utils/chat-session-ops-controller";
import { resetStore } from "./test-utils";
import { store } from "../src/state/store";

vi.mock("../src/api/sessions", () => ({
  renameSession: vi.fn().mockResolvedValue({ title: "新标题" }),
  compactSession: vi.fn().mockResolvedValue({
    pre_tokens: 100, post_tokens: 50, compacted_text: "摘要",
  }),
  deleteTurn: vi.fn().mockResolvedValue({ message_count: 3 }),
  duplicateSession: vi.fn().mockResolvedValue({
    id: "twin", title: "副本", preview: "p",
  }),
  exportSession: vi.fn().mockResolvedValue({ ok: true }),
  importSession: vi.fn().mockResolvedValue({ imported: 1 }),
  rewindSession: vi.fn().mockResolvedValue({
    files: { restored: [], deleted: [], failed: [] },
  }),
  sessionExportUrl: vi.fn(() => "/api/sessions/export"),
  sessionExportFileName: vi.fn(() => "s.json"),
  sessionImportUploadUrl: vi.fn(() => "/api/sessions/import/upload"),
}));

function makeHost() {
  let updates = 0;
  const host = {
    requestUpdate: () => { updates++; },
    addController: () => {},
    updateComplete: Promise.resolve(true),
  } as never as import("lit").ReactiveControllerHost;
  return { host, get updates() { return updates; } };
}

function makeController(over: Partial<Record<string, unknown>> = {}) {
  const h = makeHost();
  const toasts: Array<{ message: string; level: string }> = [];
  const c = new ChatSessionOpsController(h.host, {
    toast: (message: string, level: string) => { toasts.push({ message, level }); },
    reloadHistory: () => {},
    reloadSession: () => {},
    restoreDraft: () => {},
    applyRenamedTitle: () => {},
    currentSessionId: () => "s1",
    currentSessionTitle: () => "标题",
    messages: () => [],
    streaming: () => false,
    refreshCompaction: () => {},
    ...over,
  } as never);
  return { c, toasts, h };
}

describe("ChatSessionOpsController（AP-1 会话操作域外迁）", () => {
  beforeEach(() => {
    resetStore(store);
    vi.clearAllMocks();
  });

  it("改名：成功后通知宿主同步标题并 toast", async () => {
    const applied: string[] = [];
    const { c, toasts } = makeController({
      applyRenamedTitle: (t: string) => applied.push(t),
    });
    c.openRename();
    expect(c.renameDialogOpen).toBe(true);
    await c.submitRename(new CustomEvent("submit", { detail: { title: "新标题" } }) as never);
    expect(applied).toEqual(["新标题"]);
    expect(toasts[0].message).toBe("已重命名");
    expect(c.renameDialogOpen).toBe(false);
  });

  it("压缩：确认 → running → done 态迁移", async () => {
    const { c } = makeController();
    c.openCompactConfirm();
    expect(c.compactDialog?.phase).toBe("confirm");
    await c.confirmCompact();
    expect(c.compactDialog?.phase).toBe("done");
    expect(c.compactDialog?.postTokens).toBe(50);
  });

  it("压缩：running 态不允许关闭（模态锁定）", async () => {
    const { c } = makeController();
    c.openCompactConfirm();
    const p = c.confirmCompact();
    c.cancelCompact();
    expect(c.compactDialog?.phase).toBe("running");
    await p;
    expect(c.compactDialog?.phase).toBe("done");
  });

  it("回退：算折叠数并弹确认框（流式期间禁用）", () => {
    const msgs = [
      { role: "user", content: "a", seq: 1 },
      { role: "assistant", content: "b", seq: 2 },
      { role: "user", content: "c", seq: 3 },
    ];
    const { c } = makeController({ messages: () => msgs });
    c.openRewind(new CustomEvent("rewind", {
      detail: { seq: 2, content: "b" },
    }) as never);
    expect(c.rewindDialog?.seq).toBe(2);
    // 折叠数 = 锚点及其后的活消息（seq>=2 → seq2 与 seq3 两条）
    expect(c.rewindDialog?.deadCount).toBe(2);
  });

  it("回退：流式期间不弹确认框", () => {
    const { c } = makeController({ streaming: () => true });
    c.openRewind(new CustomEvent("rewind", {
      detail: { seq: 2, content: "b" },
    }) as never);
    expect(c.rewindDialog).toBeNull();
  });

  it("删轮：算本轮消息数（锚点到下一条 user 之前）", () => {
    const msgs = [
      { role: "user", content: "a", seq: 1 },
      { role: "assistant", content: "b", seq: 2 },
      { role: "assistant", content: "c", seq: 3 },
      { role: "user", content: "d", seq: 4 },
    ];
    const { c } = makeController({ messages: () => msgs });
    c.openDeleteTurn(new CustomEvent("delete-turn", { detail: { seq: 2 } }) as never);
    expect(c.deleteTurnDialog?.seq).toBe(2);
    expect(c.deleteTurnDialog?.turnMessageCount).toBe(2);
  });

  it("删轮：确认失败时错误留在框内（不丢载荷）", async () => {
    const { deleteTurn } = await import("../src/api/sessions");
    (deleteTurn as never as { mockRejectedValueOnce: (e: Error) => void })
      .mockRejectedValueOnce(new Error("boom"));
    const { c } = makeController();
    c.openDeleteTurn(new CustomEvent("delete-turn", { detail: { seq: 2 } }) as never);
    await c.confirmDeleteTurn(new CustomEvent("turn-delete-confirm", {
      detail: { pointSeq: 2 },
    }) as never);
    expect(c.deleteTurnDialog?.submitting).toBe(false);
    expect(c.deleteTurnDialog?.errorMessage).toBe("boom");
  });

  it("孪生复制：确认后刷新历史并进入副本会话", async () => {
    const entered: string[] = [];
    const { c, toasts } = makeController({
      enterSession: (s: { id: string }) => entered.push(s.id),
    });
    c.openFork({ id: "s1", title: "标题", message_count: 2 });
    await c.confirmFork();
    expect(entered).toEqual(["twin"]);
    expect(toasts[0].message).toBe("已复制会话，原会话保留");
    expect(c.forkSession).toBeNull();
  });
});
