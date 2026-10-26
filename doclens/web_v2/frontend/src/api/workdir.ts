// 工作目录热切换 API client（ADR-0043）

export interface RecentWorkdir {
  path: string;
  last_used?: string | null;
}

export interface WorkdirSwitchResult {
  ok: boolean;
  workdir: string;
  doc_count: number;
  changed: boolean;
}

export async function getRecentWorkdirs(): Promise<RecentWorkdir[]> {
  const resp = await fetch("/api/workdir/recent", { method: "GET" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(`workdir/recent HTTP ${resp.status}`);
  }
  return (body?.items ?? []) as RecentWorkdir[];
}

export async function getOrphanCount(): Promise<number> {
  try {
    const resp = await fetch("/api/workdir/orphans", { method: "GET" });
    const body = await resp.json().catch(() => null);
    if (!resp.ok) return 0;
    return Number(body?.generating ?? 0) || 0;
  } catch {
    return 0;
  }
}

export class WorkdirSwitchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function switchWorkdir(path: string): Promise<WorkdirSwitchResult> {
  const resp = await fetch("/api/workdir/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new WorkdirSwitchError(
      body?.detail ?? `切换失败（HTTP ${resp.status}）`,
      resp.status,
      body?.code ?? "UNKNOWN",
    );
  }
  return body as WorkdirSwitchResult;
}

/** 切换前轻量探测（ADR-0049）：目标目录是否已有索引库。
 *  首次切往未建索引目录会触发后台全量索引（分钟级），前端据此先弹确认。 */
export async function precheckWorkdir(path: string): Promise<{ has_index: boolean; index_path: string }> {
  const resp = await fetch("/api/workdir/precheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new WorkdirSwitchError(
      body?.detail ?? `目录无效（HTTP ${resp.status}）`,
      resp.status,
      body?.code ?? "UNKNOWN",
    );
  }
  return body as { has_index: boolean; index_path: string };
}
