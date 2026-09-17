import { describe, it, expect } from "vitest";
import {
  mapSessionItemsToMessages,
  aggregateUsage,
  aggregateCompaction,
} from "../src/views/chat-view";

describe("mapSessionItemsToMessages", () => {
  it("maps tool_calls to tool_steps for assistant messages", () => {
    const items = [
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
      { kind: "message_ai", payload: JSON.stringify({
        content: "a",
        tool_calls: [{ tool_use_id: "t1", name: "search", input: { q: "x" }, output: "ok", is_error: false, duration_ms: 50 }],
      }) },
    ];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].content).toBe("a");
    expect(msgs[1].tool_steps).toEqual([
      { tool_use_id: "t1", name: "search", input: { q: "x" }, output: "ok", is_error: false, duration_ms: 50, status: "done" },
    ]);
  });

  it("marks error status from is_error", () => {
    const items = [{ kind: "message_ai", payload: JSON.stringify({
      content: "a",
      tool_calls: [{ tool_use_id: "t1", name: "x", input: {}, output: "boom", is_error: true }],
    }) }];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[0].tool_steps![0].status).toBe("error");
  });

  it("restores references for assistant messages", () => {
    const items = [{ kind: "message_ai", payload: JSON.stringify({
      content: "a",
      references: [{ path: "a/b.md" }, { path: "c/d.md" }],
    }) }];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[0].references).toEqual([{ path: "a/b.md" }, { path: "c/d.md" }]);
  });

  it("omits references when payload has none (backward compatible)", () => {
    const items = [{ kind: "message_ai", payload: JSON.stringify({ content: "old answer" }) }];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[0].references).toBeUndefined();
  });

  it("backward compatible: old payload without tool_calls", () => {
    const items = [{ kind: "message_ai", payload: JSON.stringify({ content: "old answer" }) }];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs[0].content).toBe("old answer");
    expect(msgs[0].tool_steps).toBeUndefined();
  });

  it("skips non-message kinds", () => {
    const items = [
      { kind: "result", payload: JSON.stringify({ x: 1 }) },
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
    ];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs.length).toBe(1);
    expect(msgs[0].role).toBe("user");
  });
});

describe("aggregateUsage（会话信息弹窗，2026-09-17）", () => {
  it("used 取最后一条；命中率口径全程累计（cache_read/总输入/调用次数）", () => {
    const items = [
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
      { kind: "usage", seq: 1, payload: JSON.stringify({
        input_tokens: 100, output_tokens: 10,
        cache_read_input_tokens: 20, cache_creation_input_tokens: 5,
        context_window: 200000,
      }) },
      { kind: "usage", seq: 2, payload: JSON.stringify({
        input_tokens: 300, output_tokens: 20,
        cache_read_input_tokens: 60, cache_creation_input_tokens: 15,
        context_window: 200000,
      }) },
    ];
    // used = 最后一条 300+60+15 = 375；累计 cache_read = 80，
    // 累计总输入 = 125 + 375 = 500，调用 2 次；lastSeq = 最后一条 seq
    expect(aggregateUsage(items)).toEqual({
      used: 375, contextWindow: 200000,
      cacheReadTotal: 80, inputTotal: 500, calls: 2, lastSeq: 2,
    });
  });

  it("无 usage 条目返回 null", () => {
    const items = [{ kind: "message_user", payload: JSON.stringify({ content: "q" }) }];
    expect(aggregateUsage(items)).toBeNull();
  });

  it("usage 条目不影响消息映射", () => {
    const items = [
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
      { kind: "usage", payload: JSON.stringify({ input_tokens: 100, context_window: 200000 }) },
      { kind: "message_ai", payload: JSON.stringify({ content: "a" }) },
    ];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("坏 JSON 的 usage 条目跳过，不影响其余聚合", () => {
    const items = [
      { kind: "usage", payload: "{broken" },
      { kind: "usage", seq: 5, payload: JSON.stringify({
        input_tokens: 100, cache_read_input_tokens: 40,
        cache_creation_input_tokens: 10, context_window: 200000,
      }) },
    ];
    expect(aggregateUsage(items)).toEqual({
      used: 150, contextWindow: 200000,
      cacheReadTotal: 40, inputTotal: 150, calls: 1, lastSeq: 5,
    });
  });
});

describe("aggregateCompaction（会话信息弹窗，ADR-0026）", () => {
  it("计数累计；lastAt/lastPre/lastPost/lastSeq 取最后一条", () => {
    const items = [
      { kind: "compacted", seq: 3, payload: JSON.stringify({ messages: [], pre_tokens: 180000, post_tokens: 8000 }),
        created_at: "2026-09-17T10:00:00+00:00" },
      { kind: "compacted", seq: 7, payload: JSON.stringify({ messages: [], pre_tokens: 165000, post_tokens: 7600 }),
        created_at: "2026-09-17T12:30:00+00:00" },
    ];
    expect(aggregateCompaction(items)).toEqual({
      count: 2,
      lastAt: "2026-09-17T12:30:00+00:00",
      lastPreTokens: 165000,
      lastPostTokens: 7600,
      lastSeq: 7,
    });
  });

  it("无 compacted 条目返回 null", () => {
    const items = [
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
      { kind: "usage", payload: JSON.stringify({ input_tokens: 100, context_window: 200000 }) },
    ];
    expect(aggregateCompaction(items)).toBeNull();
  });

  it("坏 JSON 计数但元数据沿用上一条", () => {
    const items = [
      { kind: "compacted", seq: 3, payload: JSON.stringify({ messages: [], pre_tokens: 180000, post_tokens: 8000 }),
        created_at: "2026-09-17T10:00:00+00:00" },
      { kind: "compacted", seq: 6, payload: "{broken",
        created_at: "2026-09-17T11:00:00+00:00" },
    ];
    expect(aggregateCompaction(items)).toEqual({
      count: 2,
      lastAt: "2026-09-17T11:00:00+00:00",
      lastPreTokens: 180000,
      lastPostTokens: 8000,
      lastSeq: 6,
    });
  });

  it("created_at 缺失（旧后端）时 lastAt 为 null", () => {
    const items = [
      { kind: "compacted", payload: JSON.stringify({ messages: [], pre_tokens: 100, post_tokens: 5 }) },
    ];
    expect(aggregateCompaction(items)).toEqual({
      count: 1, lastAt: null, lastPreTokens: 100, lastPostTokens: 5, lastSeq: -1,
    });
  });

  it("旧版 compacted 条目无 post_tokens 时 lastPostTokens 为 0（不触发估算显示）", () => {
    const items = [
      { kind: "compacted", seq: 2, payload: JSON.stringify({ messages: [], pre_tokens: 100 }) },
    ];
    expect(aggregateCompaction(items)).toEqual({
      count: 1, lastAt: null, lastPreTokens: 100, lastPostTokens: 0, lastSeq: 2,
    });
  });

  it("compacted/microcompact 条目不影响消息映射（对话流不显示）", () => {
    const items = [
      { kind: "message_user", payload: JSON.stringify({ content: "q" }) },
      { kind: "compacted", payload: JSON.stringify({ messages: [], pre_tokens: 100 }) },
      { kind: "microcompact", payload: JSON.stringify({ cleared_tool_use_ids: ["t1"] }) },
      { kind: "message_ai", payload: JSON.stringify({ content: "a" }) },
    ];
    const msgs = mapSessionItemsToMessages(items);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});
