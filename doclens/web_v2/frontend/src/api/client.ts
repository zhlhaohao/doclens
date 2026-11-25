/** 统一 fetch 封装 + ApiError 类型。 */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** 401 统一处理钩子：由 app.ts 注入（跳登录页）。可注入以避免 client→app 循环依赖。 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export interface RequestOptions extends RequestInit {
  json?: unknown;
}

/** SSE 读静默超时：连接半开时 reader.read() 可能永久挂起，必须主动收口。 */
export class StreamIdleTimeoutError extends Error {
  constructor(public readonly idleTimeoutMs: number) {
    super(`SSE 连接静默超过 ${Math.round(idleTimeoutMs / 1000)} 秒`);
    this.name = "StreamIdleTimeoutError";
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { ...options };
  if (options.json !== undefined) {
    init.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    init.body = JSON.stringify(options.json);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    let body: any;
    try {
      body = await res.json();
    } catch {
      // 错误响应非 JSON（代理/网关 HTML 错误页等）：退化为 statusText，
      // ApiError 照常抛出（code=unknown）——静默的是解析，不是错误本身。
      body = { code: "unknown", detail: res.statusText };
    }
    throw new ApiError(res.status, body.code ?? "unknown", body.detail ?? "请求失败");
  }
  return res.json() as Promise<T>;
}

/** SSE 流读取：从 POST 请求读 text/event-stream，按 event/data 解析。
 *  idleTimeoutMs > 0 时限制单次 read 的等待；任何字节（含注释 ping）都会续命。 */
export async function* streamSSE(
  path: string,
  body: unknown,
  signal?: AbortSignal,
  idleTimeoutMs = 0,
): AsyncGenerator<{ event: string; data: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, "stream_failed", "流式请求失败");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const read = reader.read();
      const timeout = idleTimeoutMs > 0
        ? new Promise<never>((_resolve, reject) => {
            idleTimer = setTimeout(() => reject(new StreamIdleTimeoutError(idleTimeoutMs)), idleTimeoutMs);
          })
        : null;
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await (timeout ? Promise.race([read, timeout]) : read);
      } catch (e) {
        // Promise.race 只让调用方超时，不能停止底层 fetch；cancel 向网络栈
        // 传播取消，避免后台残留旧流。用户 abort 仍保持浏览器原生 AbortError。
        if (e instanceof StreamIdleTimeoutError) await reader.cancel(e).catch(() => {});
        throw e;
      } finally {
        if (idleTimer !== undefined) clearTimeout(idleTimer);
      }
      const { value, done } = chunk;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE 规范允许 \r\n\r\n、\r\r 或 \n\n 作为事件分隔符
      while (true) {
        const m = buffer.match(/\r\n\r\n|\r\r|\n\n/);
        if (!m || m.index === undefined) break;
        const idx = m.index;
        const sepLen = m[0].length;
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + sepLen);
        let event = "message";
        let data = "";
        let hasField = false;
        for (const line of rawEvent.split(/\r\n|\r|\n/)) {
          // SSE 注释行（以 ':' 开头）——如 sse_starlette 的保活 ping
          // （": ping - <ts>"），无字段语义，忽略；其字节已刷新 read 超时。
          if (line.startsWith(":")) continue;
          if (line.startsWith("event:")) {
            event = line.slice(6).trim();
            hasField = true;
          } else if (line.startsWith("data:")) {
            data += line.slice(5).trim();
            hasField = true;
          }
        }
        // 无任何字段的块（纯注释/空块）不是业务事件：不产出，
        // 否则会被下游当成未知事件（如 chat 的 "message"）刷警告。
        if (!hasField) continue;
        yield { event, data };
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}
