import { request, streamSSE } from "./client";
import type { AskQuestionPayload } from "./ask";

/** token 用量（2026-09-17）：每次 LLM 调用后发，最后一条即该轮上下文峰值占用。 */
export interface UsagePayload {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  context_window: number;
}

export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "thinking"; delta: string }
  | { type: "tool_call"; tool_use_id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; name: string; output: string; is_error: boolean; duration_ms?: number }
  | { type: "ask"; request_id: string; questions: AskQuestionPayload[] }
  | { type: "references"; items: { path: string }[] }
  | { type: "toast"; level: "error" | "info" | "success"; detail: string }
  | { type: "compact"; phase: "start" | "done"; detail: string; pre_tokens?: number; post_tokens?: number }
  | { type: "usage" } & UsagePayload
  | { type: "interject_ack"; question: string; tool_use_id: string }
  | { type: "interject_report"; tool_use_id: string; text: string }
  | { type: "done"; reason?: string }
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

/** 单张对话图片（ADR-0034）：前端压缩后的 base64（不含 data: 前缀）。 */
export interface ChatImage {
  data: string;
  media_type: string;
}

export async function* chatStream(
  req: { message: string; session_id?: string; images?: ChatImage[] },
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  for await (const ev of streamSSE("/api/chat", req, signal)) {
    if (ev.event === "token") {
      const d = parseData("token", ev.data);
      if (d) yield { type: "token", text: String(d.text ?? "") };
    } else if (ev.event === "thinking") {
      // 思考流增量（2026-10-05）：被动接收的模型推理文字，ephemeral 不落库
      const d = parseData("thinking", ev.data);
      if (d) yield { type: "thinking", delta: String(d.delta ?? "") };
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
    } else if (ev.event === "compact") {
      // 回合末自动压缩进度（ADR-0044）：前端弹不可关闭模态进度框
      const d = parseData("compact", ev.data);
      if (d) {
        yield {
          type: "compact",
          phase: (d.phase === "done" ? "done" : "start"),
          detail: String(d.detail ?? ""),
          pre_tokens: d.pre_tokens as number | undefined,
          post_tokens: d.post_tokens as number | undefined,
        };
      }
    } else if (ev.event === "usage") {
      const d = parseData("usage", ev.data);
      if (d) {
        yield {
          type: "usage",
          input_tokens: Number(d.input_tokens ?? 0),
          output_tokens: Number(d.output_tokens ?? 0),
          cache_creation_input_tokens: Number(d.cache_creation_input_tokens ?? 0),
          cache_read_input_tokens: Number(d.cache_read_input_tokens ?? 0),
          context_window: Number(d.context_window ?? 0),
        };
      }
    } else if (ev.event === "interject_ack") {
      // 插话送达确认（ADR-0048）：检查点消费，前端建插话卡（含用户原话）
      const d = parseData("interject_ack", ev.data);
      if (d) {
        yield {
          type: "interject_ack",
          question: String(d.question ?? ""),
          tool_use_id: String(d.tool_use_id ?? ""),
        };
      }
    } else if (ev.event === "interject_report") {
      // 插话汇报全文（ADR-0048）：一次性推送（非逐 token）
      const d = parseData("interject_report", ev.data);
      if (d) {
        yield {
          type: "interject_report",
          tool_use_id: String(d.tool_use_id ?? ""),
          text: String(d.text ?? ""),
        };
      }
    } else if (ev.event === "done") {
      // reason 仅对话式提问（ADR-0033）终止时携带（waiting_user）；
      // 正常完成的终端 done data 为空
      const d = parseData("done", ev.data);
      yield { type: "done", reason: d?.reason as string | undefined };
    } else if (ev.event === "error") {
      const d = parseData("error", ev.data);
      yield { type: "error", detail: String(d?.detail ?? "未知错误") };
    } else {
      console.warn(`[chat] 未知 SSE 事件类型，跳过: ${ev.event}`);
    }
  }
}

/** 请求中断指定 session 的 AI 生成（fire-and-forget；失败静默，不阻塞前端收尾）。
 *  5s 超时兜底（ADR-0035）：后端 stop 端点等收尾（≤2s）才返回，极端情况下
 *  请求可能挂起——不设超时会把 _stop() 的 abort 卡住，UI 停在流式态。 */
export async function stopChat(sessionId: string): Promise<void> {
  try {
    await request<{ ok: boolean }>("/api/chat/stop", {
      method: "POST",
      json: { session_id: sessionId },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* 停止是尽力而为：网络/鉴权失败不影响前端把对话收尾 */
  }
}

/** 插话结果：ok = 已写入槽位；pending = 槽位已占用（单槽位不排队）；
 *  not_running = 会话不在生成中（竞态兜底）。 */
export type InterjectResult = "ok" | "pending" | "not_running" | "error";

/** 生成中途插话（ADR-0048）：写入会话级单槽位，agent 在下一个循环顶检查点
 *  消费（suppress_tools 纯文字汇报 → 循环继续，回合不结束）。 */
export async function interject(sessionId: string, text: string): Promise<InterjectResult> {
  try {
    await request<{ ok: boolean }>("/api/chat/interject", {
      method: "POST",
      json: { session_id: sessionId, text },
      signal: AbortSignal.timeout(5000),
    });
    return "ok";
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "INTERJECT_PENDING") return "pending";
    if (code === "SESSION_NOT_RUNNING") return "not_running";
    return "error";
  }
}
