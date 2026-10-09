// PDF 翻译任务 API client（ADR-0039）。
// POST /api/translate 提交（串行队列）；GET events SSE 逐页进度；
// DELETE 取消。任务为进程内存态（重启即失效）。

export type TranslateOutputs = "mono" | "dual" | "both";
export type TranslateStatus =
  | "queued"
  | "running"
  | "done"
  | "error"
  | "cancelled";

export interface TranslateJobView {
  job_id: string;
  status: TranslateStatus;
  progress_done: number;
  progress_total: number;
  error?: string | null;
  result_paths: string[];
  created_at: number;
  finished_at?: number | null;
}

export interface SubmitTranslateInput {
  path: string;
  lang_in: string;
  lang_out: string;
  outputs: TranslateOutputs;
  /** 页码区间（1-based，如 "1-3,5"）；空串/undefined = 全文 */
  pages?: string;
  ultrafast?: boolean;
  ignore_cache?: boolean;
}

export class TranslateApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "TranslateApiError";
  }
}

async function handle<T>(resp: Response): Promise<T> {
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    const code = body?.error?.code ?? body?.detail?.code ?? "UNKNOWN";
    const msg = body?.error?.message ?? body?.detail ?? `HTTP ${resp.status}`;
    throw new TranslateApiError(resp.status, code, String(msg));
  }
  return body as T;
}

export async function submitTranslation(
  input: SubmitTranslateInput,
): Promise<TranslateJobView> {
  return handle<TranslateJobView>(
    await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function getTranslation(jobId: string): Promise<TranslateJobView> {
  return handle<TranslateJobView>(await fetch(`/api/translate/${jobId}`));
}

export async function cancelTranslation(
  jobId: string,
): Promise<TranslateJobView> {
  return handle<TranslateJobView>(
    await fetch(`/api/translate/${jobId}`, { method: "DELETE" }),
  );
}

export interface TranslateEvent {
  type: string; // running | progress | done | error | cancelled
  done?: number;
  total?: number;
  error?: string;
  paths?: string[];
  seconds?: number;
}

/** SSE 订阅翻译进度。返回关闭函数（组件 disconnected 时调用）。 */
export function subscribeTranslation(
  jobId: string,
  onEvent: (ev: TranslateEvent) => void,
  onOpenError?: (err: Error) => void,
): () => void {
  const es = new EventSource(`/api/translate/${jobId}/events`);
  const types = ["status", "running", "progress", "done", "error", "cancelled"];
  for (const t of types) {
    es.addEventListener(t, (e) => {
      try {
        onEvent(JSON.parse((e as MessageEvent).data) as TranslateEvent);
      } catch {
        // 忽略畸形事件
      }
    });
  }
  es.onerror = () => {
    // 终态后服务端关闭流是正常路径；其余报错交给上层
    if (es.readyState === EventSource.CLOSED) return;
    onOpenError?.(new Error("SSE connection error"));
  };
  return () => es.close();
}
