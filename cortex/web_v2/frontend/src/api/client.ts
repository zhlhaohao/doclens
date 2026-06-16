/** 统一 fetch 封装 + ApiError 类型。 */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions extends RequestInit {
  json?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { ...options };
  if (options.json !== undefined) {
    init.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    init.body = JSON.stringify(options.json);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = { code: "unknown", detail: res.statusText };
    }
    throw new ApiError(res.status, body.code ?? "unknown", body.detail ?? "请求失败");
  }
  return res.json() as Promise<T>;
}

/** SSE 流读取：从 POST 请求读 text/event-stream，按 event/data 解析。 */
export async function* streamSSE(
  path: string,
  body: unknown,
): AsyncGenerator<{ event: string; data: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, "stream_failed", "流式请求失败");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      yield { event, data };
    }
  }
}
