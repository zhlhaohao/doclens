import { describe, it, expect, vi, beforeEach } from "vitest";
import { chatStream } from "../src/api/chat";

function sseChunks(events: Array<[string, string]>): Uint8Array[] {
  return [new TextEncoder().encode(
    events.map(([e, d]) => `event: ${e}\r\ndata: ${d}\r\n\r\n`).join("")
  )];
}

describe("chatStream", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("parses tool_call / tool_result / token / done", async () => {
    const chunks = sseChunks([
      ["tool_call", JSON.stringify({ tool_use_id: "t1", name: "search", input: { query: "x" }, is_complete: true })],
      ["tool_result", JSON.stringify({ tool_use_id: "t1", name: "search", output: "found 1", is_error: false, duration_ms: 120 })],
      ["token", JSON.stringify({ text: "answer" })],
      ["done", "{}"],
    ]);
    let call = 0;
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({
        read: async () => call < chunks.length
          ? { value: chunks[call++], done: false }
          : { value: undefined, done: true },
      }) },
    });

    const out = [];
    for await (const ev of chatStream({ message: "hi" })) out.push(ev);

    expect(out).toEqual([
      { type: "tool_call", tool_use_id: "t1", name: "search", input: { query: "x" } },
      { type: "tool_result", tool_use_id: "t1", name: "search", output: "found 1", is_error: false, duration_ms: 120 },
      { type: "token", text: "answer" },
      { type: "done" },
    ]);
  });

  it("parses error event", async () => {
    const chunks = sseChunks([["error", JSON.stringify({ detail: "boom" })]]);
    let call = 0;
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({
        read: async () => call < chunks.length
          ? { value: chunks[call++], done: false }
          : { value: undefined, done: true },
      }) },
    });
    const out = [];
    for await (const ev of chatStream({ message: "hi" })) out.push(ev);
    expect(out).toEqual([{ type: "error", detail: "boom" }]);
  });
});
