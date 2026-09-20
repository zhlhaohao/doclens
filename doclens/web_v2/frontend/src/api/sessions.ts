import { request } from "./client";
import type { Session } from "../state/types";

/** 会话模式：search 用 "keyword" | "grep"；chat 技能会话用 "skill"（提取式引文策展） */
export type SessionMode = "keyword" | "grep" | "skill";

export interface CreateSessionResponse extends Pick<Session, "id" | "type" | "title" | "preview" | "mode"> {}

export async function createSession(req: { type: "search" | "chat"; title: string; preview?: string; mode?: SessionMode }): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/sessions", { method: "POST", json: req });
}

/** 按 (type, title, mode) 原子地查找或新建会话；用于 search 历史去重。 */
export async function findOrCreateSession(req: { type: "search" | "chat"; title: string; preview?: string; mode?: SessionMode }): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/api/sessions/find-or-create", { method: "POST", json: req });
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

/** 会话条目（kind/payload/seq/created_at）——buildChatTimeline/aggregate* 消费 */
export interface SessionItemDTO {
  kind: string;
  payload: string;
  seq?: number;
  created_at?: string | null;
}

/** 会话详情：元数据（generating/context_window）+ 条目列表。 */
export interface SessionDetail {
  id: string;
  type: "search" | "chat";
  title: string;
  preview: string;
  updated_at: string;
  message_count: number;
  /** 断开续跑恢复态（ADR-0028）：后端仍在生成 */
  generating: boolean;
  /** 实时上下文窗口（与压缩决策同源）；0 = 未装配，前端回落 usage 快照 */
  context_window?: number;
  items: SessionItemDTO[];
}

/** 拉取会话详情。metaOnly=true 只回元数据（items 置空）——轮询 generating
 *  等场景省全量条目传输（长会话 items 可达几百 KB）。 */
export async function fetchSessionDetail(
  sessionId: string,
  opts: { metaOnly?: boolean } = {},
): Promise<SessionDetail> {
  const qs = opts.metaOnly ? "?meta_only=true" : "";
  return request<SessionDetail>(`/api/sessions/${sessionId}${qs}`, { method: "GET" });
}

/** 手动压缩会话历史（ADR-0026）：LLM 摘要落库 compacted 条目。 */
export async function compactSession(
  sessionId: string,
): Promise<{ ok: boolean; id: string; pre_tokens: number; post_tokens: number }> {
  return request(`/api/sessions/${sessionId}/compact`, { method: "POST" });
}

/** 人工改名（2026-09-17）：后端 trim + 60 字符截断，不刷新 updated_at。 */
export async function renameSession(sessionId: string, title: string): Promise<{ ok: boolean; id: string; title: string }> {
  return request(`/api/sessions/${sessionId}/title`, { method: "PATCH", json: { title } });
}

/** 加星/取消加星（2026-09-17）：置顶 + 删除保护；不刷新 updated_at。 */
export async function starSession(sessionId: string, starred: boolean): Promise<{ ok: boolean; id: string; starred: boolean }> {
  return request(`/api/sessions/${sessionId}/star`, { method: "PATCH", json: { starred } });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request(`/api/sessions/${sessionId}`, { method: "DELETE" });
}

/** 回退文件三态清单（ADR-0027，GET rewind/preview 的 files 字段）。 */
export interface RewindFilesPlan {
  /** 将被恢复（覆盖现内容）的文件 */
  restored: string[];
  /** 将被删除（回退点时不存在）的文件 */
  deleted: string[];
  /** 无法处置的文件（无备份 / 环形淘汰 / 扫描漏检） */
  skipped: Array<{ path: string; reason: string }>;
  /** 恢复/删除尝试失败的文件（服务端逐文件容错） */
  failed: Array<{ path: string; error: string }>;
}

/** 回退预览（只读）：确认框的文件清单数据源。 */
export async function fetchRewindPreview(
  sessionId: string,
  pointSeq: number,
): Promise<RewindFilesPlan> {
  const body = await request<{ files: RewindFilesPlan }>(
    `/api/sessions/${sessionId}/rewind/preview?point_seq=${pointSeq}`,
    { method: "GET" },
  );
  return body.files;
}

/** 执行回退：文件恢复（可选）→ 落 rewound 边界 → 重算 message_count。 */
export async function rewindSession(
  sessionId: string,
  pointSeq: number,
  restoreFiles: boolean,
): Promise<{ files: RewindFilesPlan; message_count: number }> {
  return request(`/api/sessions/${sessionId}/rewind`, {
    method: "POST",
    json: { point_seq: pointSeq, restore_files: restoreFiles },
  });
}

export async function clearSessions(type?: "search" | "chat"): Promise<{ ok: boolean; deleted_count: number; skipped_starred: number }> {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  return request(`/api/sessions?${sp}`, { method: "DELETE" });
}
