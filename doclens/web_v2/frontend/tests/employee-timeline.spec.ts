/** 数字员工（ADR-0062）前端纯函数与控制器：
 * - chat-timeline：review 条目 → 评审卡节点；返工指令并入卡内不单独成气泡，
 *   评审指令按原位渲染；与回退折叠条同 seq 时的排序；
 * - chat-employees-controller：派活校验（空任务 / 预设缺失）、
 *   成功回调与失败回调、不记最近员工。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildChatTimeline, mergeTimeline, isReworkOrder, isAssignmentBrief } from "../src/views/chat-timeline";
import { ChatEmployeesController } from "../src/utils/chat-employees-controller";
import type { Employee } from "../src/api/employees";

const dispatchMock = vi.fn();
const listMock = vi.fn();
vi.mock("../src/api/employees", () => ({
  dispatchEmployee: (...a: unknown[]) => dispatchMock(...a),
  listEmployees: (...a: unknown[]) => listMock(...a),
}));

function item(kind: string, payload: unknown, seq: number) {
  return { kind, payload: JSON.stringify(payload), seq };
}

describe("chat-timeline · 数字员工评审卡", () => {
  it("review 条目 → reviews；其后首条返工指令并入卡，不再出现在 messages", () => {
    const items = [
      item("message_user", { content: "<assignment>\n产物目录：/k/a\n</assignment>\n\n写报告" }, 0),
      item("message_ai", { content: "完成", tool_calls: [] }, 1),
      item("review", { iteration: 1, kind: "review", score: 75, threshold: 90, passed: false, issues: ["缺来源"] }, 2),
      item("message_user", { content: '<rework-order score="75" threshold="90">\n评审意见\n</rework-order>' }, 3),
      item("message_ai", { content: "已补充", tool_calls: [] }, 4),
      item("review", { iteration: 2, kind: "review", score: 93, threshold: 90, passed: true, issues: [] }, 5),
      item("message_ai", { content: " unrelated", tool_calls: [] }, 6),
    ];
    const t = buildChatTimeline(items);
    expect(t.reviews.length).toBe(2);
    expect(t.reviews[0].rework?.content).toContain("rework-order");
    expect(t.reviews[1].rework).toBeNull();          // 达标后无返工
    expect(t.messages.map((m) => m.content)).toEqual([
      "<assignment>\n产物目录：/k/a\n</assignment>\n\n写报告", "完成", "已补充", " unrelated",
    ]);
    const nodes = mergeTimeline(t.dividers, t.messages, t.reviews);
    expect(nodes.map((n) => n.type)).toEqual(["message", "message", "review", "message", "review", "message"]);
  });

  it("评审指令（<review-order>）按原位渲染为 user 气泡，不被摘出", () => {
    const order1 = '<review-order skill="r">\n请评审\n</review-order>';
    const order2 = '<review-order skill="r">\n再评一次\n</review-order>';
    const items = [
      item("message_user", { content: "<assignment>\n写报告</assignment>" }, 0),
      item("message_ai", { content: "完成", tool_calls: [] }, 1),
      item("message_user", { content: order1 }, 2),
      item("message_ai", { content: "评审中", tool_calls: [] }, 3),
      item("review", { iteration: 1, kind: "review", score: 75, threshold: 90, passed: false, issues: [] }, 4),
      item("message_user", { content: '<rework-order score="75" threshold="90">\n返工\n</rework-order>' }, 5),
      item("message_ai", { content: "已补充", tool_calls: [] }, 6),
      item("message_user", { content: order2 }, 7),
      item("review", { iteration: 2, kind: "review", score: 93, threshold: 90, passed: true, issues: [] }, 8),
    ];
    const t = buildChatTimeline(items);
    // 两条评审指令夹在工作回合与评审回合之间，原位保留
    expect(t.messages.map((m) => m.role + ":" + m.content.slice(0, 16))).toEqual([
      "user:<assignment>\n写报告", "assistant:完成", "user:" + order1.slice(0, 16), "assistant:评审中",
      "assistant:已补充", "user:" + order2.slice(0, 16),
    ]);
    // 返工指令仍并入卡；评审卡不持有评审指令
    expect(t.reviews[0].rework?.content).toContain("rework-order");
    expect(t.reviews[1].rework).toBeNull();
    expect("order" in t.reviews[0]).toBe(false);
    const nodes = mergeTimeline(t.dividers, t.messages, t.reviews);
    expect(nodes.map((n) => n.type)).toEqual([
      "message", "message", "message", "message", "review", "message", "message", "review",
    ]);
  });

  it("无产物预检条目也成卡（score=null）", () => {
    const t = buildChatTimeline([
      item("message_user", { content: "x" }, 0),
      item("review", { iteration: 1, kind: "no_artifact", score: null, threshold: 90, passed: false, issues: [] }, 1),
    ]);
    expect(t.reviews[0].review.kind).toBe("no_artifact");
    expect(t.reviews[0].review.score).toBeNull();
  });

  it("普通 user 消息不会被误并入评审卡", () => {
    const t = buildChatTimeline([
      item("review", { iteration: 1, kind: "review", score: 70, threshold: 90, passed: false, issues: [] }, 0),
      item("message_user", { content: "这是用户自己说的话" }, 1),
    ]);
    expect(t.reviews[0].rework).toBeNull();
    expect(t.messages.length).toBe(1);
  });

  it("评审卡与回退折叠条同 seq：折叠条在前", () => {
    const nodes = mergeTimeline(
      [{ pointSeq: 0, boundarySeq: 2, dead: [] }],
      [{ role: "user", content: "a", seq: 0 }],
      [{ seq: 2, review: { iteration: 1, kind: "review", score: 1, threshold: 90, passed: false, issues: [] }, rework: null }],
    );
    expect(nodes.map((n) => n.type)).toEqual(["message", "rewind-divider", "review"]);
  });

  it("标签识别", () => {
    expect(isReworkOrder('<rework-order score="1" threshold="90">x</rework-order>')).toBe(true);
    expect(isReworkOrder("rework-order")).toBe(false);
    expect(isAssignmentBrief("<assignment>\n…")).toBe(true);
  });
});

function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: "e1", name: "tom", description: "", prompt: "", tools_allow: [], tools_deny: [], skills_allow: [],
    model_preset_id: "p", review_model_preset_id: null, thinking_depth: "auto", artifact_root: "a",
    template_path: null, review_criteria: "c", score_threshold: 90, max_iterations: 5,
    created_at: "", updated_at: "", model_missing: false, review_model_missing: false, ...over,
  };
}

describe("chat-employees-controller", () => {
  beforeEach(() => { dispatchMock.mockReset(); listMock.mockReset(); localStorage.clear(); });

  function make() {
    const host = { requestUpdate: () => {}, addController: () => {} } as never;
    const calls: Record<string, unknown[]> = { ok: [], err: [], cleared: [] };
    const c = new ChatEmployeesController(host, {
      onDispatched: async (res) => { calls.ok.push(res); },
      onError: (m) => calls.err.push(m),
      clearDraft: () => calls.cleared.push(1),
    });
    return { c, calls };
  }

  it("空任务：提示而不派活", async () => {
    const { c, calls } = make();
    await c.pick(emp(), "   ");
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(calls.err[0]).toMatch(/先输入/);
  });

  it("预设缺失：提示而不派活", async () => {
    const { c, calls } = make();
    await c.pick(emp({ model_missing: true }), "写报告");
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(calls.err[0]).toMatch(/预设缺失/);
  });

  it("派活成功：清草稿、回调", async () => {
    dispatchMock.mockResolvedValue({ session_id: "s1", employee_id: "e1", artifact_dir: "a/x" });
    const { c, calls } = make();
    await c.pick(emp(), "写报告");
    expect(dispatchMock).toHaveBeenCalledWith("e1", "写报告");
    expect((calls.ok[0] as { session_id: string }).session_id).toBe("s1");
    expect(calls.cleared.length).toBe(1);
    expect(c.dispatching).toBe(false);
  });

  it("派活失败（409 同员工串行）：错误回调", async () => {
    dispatchMock.mockRejectedValue(new Error("员工「tom」有进行中的派活"));
    const { c, calls } = make();
    await c.pick(emp(), "再来一个");
    expect(calls.err[0]).toMatch(/进行中/);
    expect(calls.ok.length).toBe(0);
  });

  it("派活不记最近员工", async () => {
    dispatchMock.mockResolvedValue({ session_id: "s1", employee_id: "e1", artifact_dir: "a/x" });
    const { c } = make();
    await c.pick(emp(), "写报告");
    expect(localStorage.getItem("cortex.recentEmployees")).toBeNull();
  });
});
