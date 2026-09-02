import { request, streamSSE } from "./client";
import type { AskQuestionPayload } from "./ask";

export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_call"; tool_use_id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; name: string; output: string; is_error: boolean; duration_ms?: number }
  | { type: "ask"; request_id: string; questions: AskQuestionPayload[] }
  | { type: "references"; items: { path: string }[] }
  | { type: "toast"; level: "error" | "info" | "success"; detail: string }
  | { type: "done" }
  | { type: "error"; detail: string };

/** 解析失败不中断流，但至少留 warning——契约错误不应双向隐形 */
function parseData(eventName: string, raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    console.warn(`[chat] SSE ${eventName} 事件 data 解析失败，跳过:`, e);
    return null;
  }
}

export async function* chatStream(
  req: { message: string; session_id?: string },
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  for await (const ev of streamSSE("/api/chat", req, signal)) {
    if (ev.event === "token") {
      const d = parseData("token", ev.data);
      if (d) yield { type: "token", text: String(d.text ?? "") };
    } else if (ev.event === "tool_call") {
      const d = parseData("tool_call", ev.data);
      if (d) {
        yield {
          type: "tool_call",
          tool_use_id: String(d.tool_use_id ?? ""),
          name: String(d.name ?? ""),
          input: (d.input ?? {}) as Record<string, unknown>,
        };
      }
    } else if (ev.event === "tool_result") {
      const d = parseData("tool_result", ev.data);
      if (d) {
        yield {
          type: "tool_result",
          tool_use_id: String(d.tool_use_id ?? ""),
          name: String(d.name ?? ""),
          output: String(d.output ?? ""),
          is_error: !!d.is_error,
          duration_ms: d.duration_ms as number | undefined,
        };
      }
    } else if (ev.event === "ask") {
      const d = parseData("ask", ev.data);
      if (d) {
        // questions 为结构化数组直传（后端已校验），免二次 JSON.parse
        yield {
          type: "ask",
          request_id: String(d.request_id ?? ""),
          questions: (d.questions ?? []) as AskQuestionPayload[],
        };
      }
    } else if (ev.event === "references") {
      const d = parseData("references", ev.data);
      if (d) yield { type: "references", items: (d.items ?? []) as { path: string }[] };
    } else if (ev.event === "toast") {
      const d = parseData("toast", ev.data);
      if (d) {
        yield {
          type: "toast",
          level: (d.level ?? "error") as "error" | "info" | "success",
          detail: String(d.detail ?? ""),
        };
      }
    } else if (ev.event === "done") {
      yield { type: "done" };
    } else if (ev.event === "error") {
      const d = parseData("error", ev.data);
      yield { type: "error", detail: String(d?.detail ?? "未知错误") };
    } else {
      console.warn(`[chat] 未知 SSE 事件类型，跳过: ${ev.event}`);
    }
  }
}

/** 请求中断指定 session 的 AI 生成（fire-and-forget；失败静默，不阻塞前端收尾）。 */
export async function stopChat(sessionId: string): Promise<void> {
  try {
    await request<{ ok: boolean }>("/api/chat/stop", {
      method: "POST",
      json: { session_id: sessionId },
    });
  } catch {
    /* 停止是尽力而为：网络/鉴权失败不影响前端把对话收尾 */
  }
}
