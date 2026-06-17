import { request } from "./client";
import type { Session } from "../state/types";

export interface CreateSessionResponse extends Pick<Session, "id" | "type" | "title" | "preview"> {}

export async function createSession(req: { type: "search" | "chat"; title: string; preview?: string }): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/sessions", { method: "POST", json: req });
}

export async function listSessions(params: { type?: "search" | "chat"; limit?: number; offset?: number }): Promise<{ sessions: Session[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  return request(`/api/sessions?${sp}`, { method: "GET" });
}

export async function appendSession(sessionId: string, items: Array<{ kind: string; payload: any }>, messageCount?: number): Promise<{ ok: boolean; message_count: number }> {
  return request(`/api/sessions/${sessionId}`, { method: "PATCH", json: { items, message_count: messageCount } });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
}

export async function clearSessions(type?: "search" | "chat"): Promise<{ ok: boolean; deleted_count: number }> {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  return request(`/api/sessions?${sp}`, { method: "DELETE" });
}
