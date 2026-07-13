import { streamSSE } from "./client";

export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_call"; tool_use_id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; name: string; output: string; is_error: boolean; duration_ms?: number }
  | { type: "references"; items: { path: string }[] }
  | { type: "toast"; level: "error" | "info" | "success"; detail: string }
  | { type: "done" }
  | { type: "error"; detail: string };

export async function* chatStream(req: { message: string; session_id?: string }): AsyncGenerator<ChatStreamEvent> {
  for await (const ev of streamSSE("/api/chat", req)) {
    if (ev.event === "token") {
      try { yield { type: "token", text: JSON.parse(ev.data).text }; } catch { /* skip */ }
    } else if (ev.event === "tool_call") {
      try {
        const d = JSON.parse(ev.data);
        yield { type: "tool_call", tool_use_id: d.tool_use_id, name: d.name, input: d.input ?? {} };
      } catch { /* skip */ }
    } else if (ev.event === "tool_result") {
      try {
        const d = JSON.parse(ev.data);
        yield {
          type: "tool_result", tool_use_id: d.tool_use_id, name: d.name,
          output: d.output ?? "", is_error: !!d.is_error, duration_ms: d.duration_ms,
        };
      } catch { /* skip */ }
    } else if (ev.event === "references") {
      try {
        const d = JSON.parse(ev.data);
        yield { type: "references", items: (d.items ?? []) as { path: string }[] };
      } catch { /* skip */ }
    } else if (ev.event === "toast") {
      try {
        const d = JSON.parse(ev.data);
        yield {
          type: "toast",
          level: (d.level ?? "error") as "error" | "info" | "success",
          detail: String(d.detail ?? ""),
        };
      } catch { /* skip */ }
    } else if (ev.event === "done") {
      yield { type: "done" };
    } else if (ev.event === "error") {
      try { yield { type: "error", detail: JSON.parse(ev.data).detail }; }
      catch { yield { type: "error", detail: "未知错误" }; }
    }
  }
}
