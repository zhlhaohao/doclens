import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatSkillsController, checkSlashSubmit } from "../src/utils/chat-skills-controller";
import { resetStore } from "./test-utils";
import { store } from "../src/state/store";

const listSkillsManageMock = vi.fn();

vi.mock("../src/api/skills", () => ({
  listSkillsManage: (...a: unknown[]) => listSkillsManageMock(...a),
}));

function makeController(over: Record<string, unknown> = {}) {
  const host = {
    requestUpdate: () => {},
    addController: () => {},
  } as never as import("lit").ReactiveControllerHost;
  const prefilled: string[] = [];
  const sent: string[] = [];
  const c = new ChatSkillsController(host, {
    prefillSkill: (name: string) => prefilled.push(name),
    sendWithSkill: (name: string) => { sent.push(name); },
    ...over,
  } as never);
  return { c, prefilled, sent };
}

describe("ChatSkillsController（AP-1 对话技能域外迁）", () => {
  beforeEach(() => {
    resetStore(store);
    vi.clearAllMocks();
    localStorage.clear();
    listSkillsManageMock.mockResolvedValue([
      { name: "knowledge-base", enabled: true, deleted: false, description: "d", icon: "i" },
      { name: "disabled-one", enabled: false, deleted: false, description: "d", icon: "i" },
      { name: "deleted-one", enabled: true, deleted: true, description: "d", icon: "i" },
    ]);
  });

  it("loadCandidates：只保留启用且未删除的技能", async () => {
    const { c } = makeController();
    await c.loadCandidates();
    expect(c.candidates?.map((s) => s.name)).toEqual(["knowledge-base"]);
    expect(c.error).toBeNull();
  });

  it("loadCandidates：失败记错误（对话框内展示）", async () => {
    listSkillsManageMock.mockRejectedValueOnce(new Error("boom"));
    const { c } = makeController();
    await c.loadCandidates();
    expect(c.error).toBe("boom");
  });

  it("recentItems：候选全空 → null（caret 隐藏）", async () => {
    listSkillsManageMock.mockResolvedValueOnce([]);
    const { c } = makeController();
    await c.loadCandidates();
    expect(c.recentItems).toBeNull();
  });

  it("recentItems：未加载时返回空数组（菜单暂只显示「选择技能…」）", () => {
    const { c } = makeController();
    expect(c.recentItems).toEqual([]);
  });

  it("pickFromDialog：草稿为空 → 预填；非空 → 直发", () => {
    const { c, prefilled, sent } = makeController();
    c.pickFromDialog({ name: "knowledge-base" } as never, false);
    expect(prefilled).toEqual(["knowledge-base"]);
    expect(sent).toEqual([]);
    c.pickFromDialog({ name: "knowledge-base" } as never, true);
    expect(sent).toEqual(["knowledge-base"]);
    expect(c.dialogOpen).toBe(false);
  });

  it("checkSubmit：未知技能阻断（返回 unknown）", async () => {
    const { c } = makeController();
    await c.loadCandidates();
    expect(c.checkSubmit("/nope 问题").type).toBe("unknown");
    expect(c.checkSubmit("/knowledge-base 查量子").type).toBe("ok");
    expect(c.checkSubmit("普通问题").type).toBe("non-slash");
  });

  it("openDialog：打开并刷新候选", async () => {
    const { c } = makeController();
    c.openDialog();
    expect(c.dialogOpen).toBe(true);
    await Promise.resolve();
    expect(listSkillsManageMock).toHaveBeenCalled();
  });
});

describe("checkSlashSubmit（迁至 chat-skills-controller）", () => {
  it("首字符非 / → non-slash", () => {
    expect(checkSlashSubmit("普通", [{ name: "a" }])).toEqual({ type: "non-slash" });
  });
  it("合法技能 → ok", () => {
    expect(checkSlashSubmit("/a 问题", [{ name: "a" }])).toEqual({ type: "ok", name: "a" });
  });
  it("未知技能 → unknown", () => {
    expect(checkSlashSubmit("/b 问题", [{ name: "a" }])).toEqual({ type: "unknown", name: "b" });
  });
});
