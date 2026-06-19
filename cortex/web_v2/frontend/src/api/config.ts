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
