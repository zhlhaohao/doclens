// MCP 服务器配置 API client（ADR-0014）。字段名与后端 Pydantic 输出一致（snake_case）。
// transport: stdio（本地子进程）| http（Streamable HTTP）| sse（旧版 SSE）。
// env/headers 的值 GET 时脱敏为 "***"；更新时值传 "***" 表示该项未改动。

export type McpTransport = "stdio" | "http" | "sse";
export type McpServerStatus = "disabled" | "connecting" | "ok" | "failed";

export interface McpServerRuntime {
  server_id: string;
  status: McpServerStatus;
  tool_count: number;
  error?: string | null;
}

export interface McpServer {
  id: string;
  name: string;
  transport: McpTransport;
  enabled: boolean;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  url: string;
  headers: Record<string, string>;
  timeout: number;
  notes: string;
  runtime: McpServerRuntime;
}

export interface McpToolInfo {
  name: string;
  description: string;
  registered_name: string;
}

export class McpApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`MCP API error ${status}`);
    this.name = "McpApiError";
  }
}

async function handle<T>(resp: Response): Promise<T> {
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new McpApiError(resp.status, body);
  return body as T;
}

export async function listMcpServers(): Promise<McpServer[]> {
  const data = await handle<{ servers: McpServer[] }>(
    await fetch("/api/mcp/servers"),
  );
  return data.servers;
}

export interface McpServerInput {
  name: string;
  transport: McpTransport;
  enabled?: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
  notes?: string;
}

export async function createMcpServer(input: McpServerInput): Promise<McpServer> {
  return handle<McpServer>(
    await fetch("/api/mcp/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

/** 更新：仅传改动的字段。env/headers 值 "***" = 保留原值。 */
export async function updateMcpServer(
  id: string,
  updates: Partial<McpServerInput>,
): Promise<McpServer> {
  return handle<McpServer>(
    await fetch(`/api/mcp/servers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }),
  );
}

export async function setMcpServerEnabled(
  id: string,
  enabled: boolean,
): Promise<McpServer> {
  return handle<McpServer>(
    await fetch(`/api/mcp/servers/${id}/enabled`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
  );
}

export async function deleteMcpServer(id: string): Promise<void> {
  await handle<{ ok: boolean }>(
    await fetch(`/api/mcp/servers/${id}`, { method: "DELETE" }),
  );
}

export async function listMcpServerTools(id: string): Promise<{
  tools: McpToolInfo[];
  truncated: boolean;
}> {
  return handle(await fetch(`/api/mcp/servers/${id}/tools`));
}

export async function reconnectMcpServer(id: string): Promise<void> {
  await handle<{ ok: boolean }>(
    await fetch(`/api/mcp/servers/${id}/reconnect`, { method: "POST" }),
  );
}
