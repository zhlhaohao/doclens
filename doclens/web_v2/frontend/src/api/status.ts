// Status API client for /api/status 与 /api/watch/status
import type { SystemStatus, WatchChange, WatcherStatus } from "../state/types";

export interface WatchStatusResponse {
  enabled: boolean;
  watcher: WatcherStatus | null;
  /** 近期文件变化（GET /api/watch/status 与 SSE 快照一致携带） */
  recent_changes?: WatchChange[];
}

export async function getWatchStatus(): Promise<WatchStatusResponse> {
  const resp = await fetch("/api/watch/status", { method: "GET" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`watch/status HTTP ${resp.status}`);
  }
  return body as WatchStatusResponse;
}

export async function getStatus(): Promise<SystemStatus> {
  const resp = await fetch("/api/status", { method: "GET" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`status HTTP ${resp.status}`);
  }
  return body as SystemStatus;
}
