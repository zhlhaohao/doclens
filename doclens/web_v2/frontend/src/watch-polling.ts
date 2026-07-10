/** 轻量轮询 /api/watch/status，写入 store.watcher；reindex 完成时派发 toast 事件。 */
import { getWatchStatus } from "./api/status";
import { actions } from "./state/store";
import type { WatcherStatus } from "./state/types";

const POLL_INTERVAL_MS = 5000;

let timer: number | null = null;
let lastReindexAt: number | null | undefined = undefined; // undefined = 未初始化

async function tick(): Promise<void> {
  try {
    const resp = await getWatchStatus();
    const w: WatcherStatus | null = resp.watcher;
    const at = w?.last_reindex_at ?? null;
    // 仅在已初始化且时间戳变化时通知（避免首次拉取误弹）
    if (lastReindexAt !== undefined && at !== null && at !== lastReindexAt) {
      window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", {
        detail: { doc_count: w?.last_doc_count ?? null },
      }));
    }
    lastReindexAt = at;
    actions.setWatcherStatus(w);
  } catch {
    // 轮询失败静默忽略（toast 仅用于正面通知）
  }
}

export function startWatchPolling(): void {
  if (timer !== null) return;
  lastReindexAt = undefined;
  void tick();
  timer = window.setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
}

export function stopWatchPolling(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}
