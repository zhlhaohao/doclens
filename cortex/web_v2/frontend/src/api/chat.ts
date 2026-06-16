import { streamSSE } from "./client";

export async function* chatStream(req: { message: string; session_id?: string; history?: Array<{ role: string; content: string }> }) {
  for await (const ev of streamSSE("/api/chat", req)) {
    if (ev.event === "token") {
      try {
        yield { type: "token" as const, text: JSON.parse(ev.data).text };
      } catch {
        /* 跳过无法解析的 chunk */
      }
    } else if (ev.event === "done") {
      yield { type: "done" as const };
    } else if (ev.event === "error") {
      try {
        yield { type: "error" as const, detail: JSON.parse(ev.data).detail };
      } catch {
        yield { type: "error" as const, detail: "未知错误" };
      }
    }
  }
}
