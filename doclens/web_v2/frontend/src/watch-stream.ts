/** SSE 订阅 /api/watch/events，写入 store.watcher + watchRecentChanges；
 * reindex 完成时派发 cortex:watch-reindexed toast 事件。带断线退避重连。
 *
 * 替代旧的 watch-polling.ts（每 5s 轮询 GET /api/watch/status）。streamSSE 基于
 * fetch 流式读取，没有原生 EventSource 的自动重连，因此在 run() 里手写
 * 「流结束/出错 → 等 RECONNECT_DELAY_MS → 重新订阅」循环。 */
import { streamSSE } from "./api/client";
import { actions } from "./state/store";
import type { GitSyncStatus, WatchChange, WatcherStatus } from "./state/types";

const RECONNECT_DELAY_MS = 3000;

interface StatusSnapshot {
  enabled?: boolean;
  watcher?: WatcherStatus | null;
  recent_changes?: WatchChange[];
  sync?: GitSyncStatus | null;
}

interface ReindexedPayload {
  success?: boolean;
  doc_count?: number;
  failed_count?: number;
}

let controller: AbortController | null = null;
let stopped = true;
let reconnectTimer: number | null = null;

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw || "{}") as T;
  } catch {
    return null;
  }
}

function applyStatus(s: StatusSnapshot): void {
  actions.setWatcherStatus(s.watcher ?? null);
  actions.setWatchRecentChanges(s.recent_changes ?? []);
  actions.setSyncStatus(s.sync ?? null);
}

function dispatchReindexedToast(d: ReindexedPayload): void {
  // reindexed 仅在实际 reindex 完成时触发（连接首推只有 status），无需去抖。
  window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", {
    detail: { doc_count: d.doc_count ?? null },
  }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      resolve();
    }, ms);
  });
}

async function run(): Promise<void> {
  while (!stopped) {
    try {
      const signal = controller?.signal;
      if (!signal) return;
      for await (const ev of streamSSE("/api/watch/events", {}, signal)) {
        if (stopped) break;
        if (ev.event === "status") {
          const s = safeParse<StatusSnapshot>(ev.data);
          if (s) applyStatus(s);
        } else if (ev.event === "reindexed") {
          const d = safeParse<ReindexedPayload>(ev.data);
          if (d) dispatchReindexedToast(d);
        }
      }
      // 流正常结束（服务端关闭）→ 若未主动停止则重连
    } catch {
      // abort（主动停止）或网络错误：若已停止则退出，否则重连
    }
    if (stopped) return;
    await delay(RECONNECT_DELAY_MS);
  }
}

export function startWatchStream(): void {
  if (!stopped) return;
  stopped = false;
  controller = new AbortController();
  void run();
}

export function stopWatchStream(): void {
  stopped = true;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  controller?.abort();
  controller = null;
}
