import { describe, it, expect } from "vitest";
import { applyStreamEvent, finalizeInterruptedMessages } from "../src/views/chat-view";
import type { ChatMessage } from "../src/state/types";

const base: ChatMessage[] = [
  { role: "user", content: "q" },
  { role: "assistant", content: "" },
];

describe("applyStreamEvent", () => {
  it("appends token to last assistant content immutably", () => {
    const next = applyStreamEvent(base, { type: "token", text: "Hi" });
    expect(next[1].content).toBe("Hi");
    expect(base[1].content).toBe("");
    expect(next).not.toBe(base);
    expect(next[1]).not.toBe(base[1]);
  });

  it("adds a running tool step on tool_call", () => {
    const next = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: { q: "x" } });
    expect(next[1].tool_steps).toEqual([
      { tool_use_id: "t1", name: "search", input: { q: "x" }, status: "running" },
    ]);
  });

  it("fills output and status=done on tool_result", () => {
    const s1 = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: {} });
    const next = applyStreamEvent(s1, { type: "tool_result", tool_use_id: "t1", name: "search", output: "ok", is_error: false, duration_ms: 10 });
    expect(next[1].tool_steps![0].output).toBe("ok");
    expect(next[1].tool_steps![0].status).toBe("done");
    expect(next[1].tool_steps![0].duration_ms).toBe(10);
  });

  it("marks status=error when is_error true", () => {
    const s1 = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: {} });
    const next = applyStreamEvent(s1, { type: "tool_result", tool_use_id: "t1", name: "search", output: "boom", is_error: true });
    expect(next[1].tool_steps![0].status).toBe("error");
    expect(next[1].tool_steps![0].is_error).toBe(true);
  });

  it("does not mutate original tool_steps array", () => {
    const s1 = applyStreamEvent(base, { type: "tool_call", tool_use_id: "t1", name: "search", input: {} });
    const origSteps = s1[1].tool_steps!;
    applyStreamEvent(s1, { type: "tool_result", tool_use_id: "t1", name: "search", output: "ok", is_error: false });
    expect(origSteps[0].output).toBeUndefined();
  });

  it("ignores events when last message is not assistant", () => {
    const onlyUser: ChatMessage[] = [{ role: "user", content: "q" }];
    expect(applyStreamEvent(onlyUser, { type: "token", text: "x" })).toBe(onlyUser);
  });
});

describe("finalizeInterruptedMessages", () => {
  it("marks running steps as error on interrupt (immutably)", () => {
    const msgs: ChatMessage[] = [
      { role: "assistant", content: "", tool_steps: [
        { tool_use_id: "t1", name: "search", input: {}, status: "running" },
      ] },
    ];
    const fixed = finalizeInterruptedMessages(msgs);
    expect(fixed).not.toBe(msgs);
    expect(fixed[0].tool_steps![0].status).toBe("error");
    expect(fixed[0].tool_steps![0].output).toBe("（已中断）");
    expect(msgs[0].tool_steps![0].status).toBe("running"); // 原 messages 未 mutate
  });

  it("returns same reference when nothing is running", () => {
    const msgs: ChatMessage[] = [
      { role: "assistant", content: "ok", tool_steps: [
        { tool_use_id: "t1", name: "search", input: {}, output: "x", status: "done" },
      ] },
    ];
    expect(finalizeInterruptedMessages(msgs)).toBe(msgs);
  });
});
