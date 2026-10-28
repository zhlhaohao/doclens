// Config API client for /api/config
import type { SettingsScope } from "../state/types";

export interface ConfigResponse {
  scope: SettingsScope;
  values: Record<string, string>;
  exists: boolean;
}

export interface ConfigSaveResult {
  ok: boolean;
  saved_path: string;
  needs_restart: boolean;
  restart_fields: string[];
}

export interface ConfigValidationErrorResponse {
  code: "VALIDATION_FAILED";
  detail: string;
  fields: { field: string; error: string }[];
}

export class ConfigApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Config API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function getConfig(scope: SettingsScope): Promise<ConfigResponse> {
  const resp = await fetch(`/api/config?scope=${scope}`, { method: "GET" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body as ConfigResponse;
}

export async function putConfig(
  scope: SettingsScope,
  values: Record<string, string>,
): Promise<ConfigSaveResult> {
  const resp = await fetch(`/api/config?scope=${scope}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body as ConfigSaveResult;
}

// 即梦配置探测（POST /api/config/probe-jimeng）：key/model 传表单当前值，
// key 为空或 *** 时后端回退已保存值
export async function probeJimeng(
  api_key: string,
  model: string,
): Promise<{ ok: boolean; message: string; model: string }> {
  const resp = await fetch("/api/config/probe-jimeng", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key, model }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body as { ok: boolean; message: string; model: string };
}

/** 即梦余额（GET /api/config/jimeng-balance）：费用中心 QueryBalanceAcct。 */
export interface JimengBalance {
  kind: "balance" | "no_credentials";
  available: number | null;
  cash: number | null;
  credit_limit: number | null;
  frozen: number | null;
  arrears: number | null;
}

export async function fetchJimengBalance(): Promise<JimengBalance> {
  const resp = await fetch("/api/config/jimeng-balance");
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body as JimengBalance;
}

export async function copyFromGlobal(): Promise<{ ok: boolean; saved_path: string }> {  const resp = await fetch("/api/config/copy-from-global", { method: "POST" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body as { ok: boolean; saved_path: string };
}

/** 重置 .env 为包内 .env.example 默认模板（保留用户 API Key），返回重置后的值。 */
export async function resetConfigDefault(scope: SettingsScope): Promise<ConfigResponse> {
  const resp = await fetch(`/api/config/reset-default?scope=${scope}`, {
    method: "POST",
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body as ConfigResponse;
}
