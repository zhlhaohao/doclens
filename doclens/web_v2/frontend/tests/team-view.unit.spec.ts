import { describe, it, expect } from "vitest";
import { layerSteps } from "../src/views/team-view";
import type { PlanStep, DagStep } from "../src/api/team";

const plan: PlanStep[] = [
  { step_id: "s1", depends_on: [] },
  { step_id: "s2", depends_on: [] },
  { step_id: "s3", depends_on: ["s1", "s2"] },
  { step_id: "s4", depends_on: ["s3"] },
];
const step = (id: string, status: DagStep["status"] = "pending"): DagStep => ({
  step_id: id, subject: id, assignee: null, status, task_id: null, interrupted: false, fix_rounds: 0,
});

describe("team-view · layerSteps（ADR-0060 §2：按依赖深度分层，并行同层）", () => {
  it("并行步骤同层，串行跨层", () => {
    const layers = layerSteps(plan, [step("s1"), step("s2"), step("s3"), step("s4")]);
    expect(layers.map((l) => l.map((s) => s.step_id))).toEqual([["s1", "s2"], ["s3"], ["s4"]]);
  });

  it("依赖引用了不存在的步骤时按 0 深度处理（校验器本应挡住）", () => {
    const p: PlanStep[] = [{ step_id: "a", depends_on: ["ghost"] }];
    expect(layerSteps(p, [step("a")]).length).toBe(1);
  });

  it("环不递归死循环（防御）", () => {
    const p: PlanStep[] = [
      { step_id: "x", depends_on: ["y"] },
      { step_id: "y", depends_on: ["x"] },
    ];
    expect(() => layerSteps(p, [step("x"), step("y")])).not.toThrow();
  });
});
