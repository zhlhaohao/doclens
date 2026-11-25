/** 团队 API（ADR-0060）：Bot 列表 / Bot 会话 / DAG。隔离校验在后端 require_bot。 */
import { request, ApiError } from "./client";
import type { SessionItemDTO } from "./sessions";

export type BotStatus = "working" | "idle" | "shutdown";
export type DagStatus = "draft" | "active" | "paused" | "stalled" | "done" | "cancelled";
export type StepStatus = "pending" | "ready" | "in_progress" | "verifying" | "done" | "failed" | "superseded";

export interface BotTaskRef {
  dag_id: number;
  step_id: number | null;
  subject: string;
}

export interface BotInfo {
  name: string;
  role: string;
  status: BotStatus;
  leased_by: string | null;
  created_by: string | null;
  alive: boolean;
  memory_summary: string;
  task: BotTaskRef | null;
}

export interface DagStep {
  step_id: string;
  subject: string | null;
  assignee: string | null;
  status: StepStatus;
  task_id: number | null;
  interrupted: boolean;
  fix_rounds: number;
}

export interface PlanStep {
  step_id: string;
  subject?: string;
  instructions?: string;
  role?: string;
  assignee?: string;
  depends_on?: string[];
  deliverables?: { id: string; path: string }[];
  acceptance?: { check: string; path?: string; names?: string[]; min?: number; note?: string }[];
}

export interface DagInfo {
  id: number;
  name: string;
  status: DagStatus;
  output_dir: string;
  stall_reason: string | null;
  failed_step: string | null;
  llm_calls: number;
  steps: DagStep[];
  plan: { steps: PlanStep[] };
}

export interface BotSessionDetail {
  bot_session_id: string | null;
  generating: boolean;
  last_persisted_seq: number;
  items: SessionItemDTO[];
}

export async function listBots(sessionId: string): Promise<BotInfo[]> {
  const r = await request<{ bots: BotInfo[] }>(`/api/team/bots?session_id=${encodeURIComponent(sessionId)}`);
  return r.bots;
}

export async function listDags(sessionId: string): Promise<DagInfo[]> {
  const r = await request<{ dags: DagInfo[] }>(`/api/team/dags?session_id=${encodeURIComponent(sessionId)}`);
  return r.dags;
}

export async function fetchBotSession(bot: string, sessionId: string): Promise<BotSessionDetail> {
  return request<BotSessionDetail>(
    `/api/team/bots/${encodeURIComponent(bot)}/session?session_id=${encodeURIComponent(sessionId)}`);
}

export async function sendToBot(bot: string, sessionId: string, text: string): Promise<{ ok: boolean; mode: string }> {
  return request(`/api/team/bots/${encodeURIComponent(bot)}/send`, {
    method: "POST", json: { session_id: sessionId, text },
  });
}

export async function stopBot(bot: string, sessionId: string): Promise<{ ok: boolean; dags_paused: number }> {
  return request(`/api/team/bots/${encodeURIComponent(bot)}/stop`, {
    method: "POST", json: { session_id: sessionId },
  });
}

export async function deleteBot(bot: string, sessionId: string): Promise<{ ok: boolean }> {
  return request(`/api/team/bots/${encodeURIComponent(bot)}/delete?session_id=${encodeURIComponent(sessionId)}`, {
    method: "POST",
  });
}

/** 新建或租借 Bot（团队页直达）：不存在→创建；空闲→本会话租借；被其他会话占用→409。 */
export async function createBot(name: string, role: string, sessionId: string): Promise<{ ok: boolean; name: string; role: string }> {
  return request("/api/team/bots", { method: "POST", json: { session_id: sessionId, name, role } });
}

/** 全部预制角色（从 /api/team/roles 取；团队页「新建 Bot」下拉用）。 */
export async function listRoles(): Promise<{ id: string; name: string; description: string }[]> {
  const r = await request<{ roles: { id: string; name: string; description: string }[] }>("/api/team/roles");
  return r.roles;
}

export async function dagAction(dagId: number, action: string, sessionId: string, stepId?: string): Promise<Record<string, unknown>> {
  return request(`/api/team/dags/${dagId}/${action}`, { method: "POST", json: { session_id: sessionId, step_id: stepId ?? null } });
}

// ------------------------------------------------------------------ SSE（GET）

export type BotStreamEvent =
  | { event: "snapshot"; data: { text_so_far: string; last_persisted_seq: number; generating: boolean } }
  | { event: "text_delta"; data: { text: string } }
  | { event: "tool_call"; data: { tool_use_id: string; name: string; input: Record<string, unknown>; complete: boolean } }
  | { event: "persisted"; data: { kind: string; seq: number } }
  | { event: "round_end"; data: Record<string, never> }
  | { event: "status"; data: { alive: boolean } }
  | { event: "ping"; data: Record<string, never> };

/** 订阅 Bot 会话实时流（GET SSE；client.streamSSE 是 POST 版，此处独立实现）。 */
export async function* streamBotEvents(bot: string, sessionId: string, signal: AbortSignal): AsyncGenerator<BotStreamEvent> {
  const res = await fetch(
    `/api/team/bots/${encodeURIComponent(bot)}/stream?session_id=${encodeURIComponent(sessionId)}`, { signal });
  if (!res.ok || !res.body) {
    if (res.status === 409) {
      const body = await res.json().catch(() => ({ detail: "Bot 被其他会话占用" }));
      throw new ApiError(409, body.code ?? "BOT_LEASED", body.detail ?? "Bot 被其他会话占用");
    }
    throw new ApiError(res.status, "stream_failed", "Bot 会话流连接失败");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    while (true) {
      const m = buffer.match(/\r\n\r\n|\r\r|\n\n/);
      if (!m || m.index === undefined) break;
      const raw = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      let event = "message";
      let data = "";
      for (const line of raw.split(/\r\n|\r|\n/)) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "message" && !data) continue;
      yield { event, data: data ? JSON.parse(data) : {} } as BotStreamEvent;
    }
  }
}

export { ApiError };
