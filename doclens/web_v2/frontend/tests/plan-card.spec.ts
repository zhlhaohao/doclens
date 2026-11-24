/** 计划卡（ADR-0060 §1）：kind=plan_card 回放 + 流式 plan_card 事件 → 独立消息。 */
import { describe, it, expect } from "vitest";
import { mapSessionItemsToMessages } from "../src/views/chat-timeline";
import { applyStreamEvent } from "../src/views/chat-view";
import type { ChatMessage } from "../src/state/types";

const CARD = { dag_id: 7, name: "报告", status: "draft", plan: { steps: [{ step_id: "s1", subject: "a", assignee: "remy", depends_on: [] }] } };

describe("plan_card 条目（ADR-0060 §1）", () => {
  it("detail 回放：kind=plan_card → user 侧消息带 plan_card 字段，content 为空", () => {
    const msgs = mapSessionItemsToMessages([
      { kind: "message_user", seq: 1, payload: JSON.stringify({ content: "派活" }) },
      { kind: "message_ai", seq: 2, payload: JSON.stringify({ content: "好的" }) },
      { kind: "plan_card", seq: 3, payload: JSON.stringify(CARD) },
    ]);
    expect(msgs.length).toBe(3);
    const card = msgs[2];
    expect(card.role).toBe("user");
    expect(card.content).toBe("");
    expect(card.plan_card?.dag_id).toBe(7);
    expect(card.seq).toBe(3);
  });

  it("流式 plan_card 事件：追加独立消息，不依赖末条角色、不改末条", () => {
    const before: ChatMessage[] = [
      { role: "user", content: "派活" },
      { role: "assistant", content: "正在提交…" },
    ];
    const after = applyStreamEvent(before, { type: "plan_card", ...CARD } as any);
    expect(after.length).toBe(3);
    expect(after[1]).toBe(before[1]);  // 末条原样
    expect(after[2].plan_card?.name).toBe("报告");
    // 末条是 user 时也追加（lead 先说完再调工具的形态）
    const after2 = applyStreamEvent([{ role: "user", content: "x" }], { type: "plan_card", ...CARD } as any);
    expect(after2.length).toBe(2);
  });
});
