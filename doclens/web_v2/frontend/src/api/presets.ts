// 预设 API client（ADR-0009/0010）。字段名与后端 Pydantic 输出一致（snake_case）。
// kind: llm|vision（模型连接档案，含 api_key）/ search（搜索调优档案，无密钥）。
// api_key 在 GET 时脱敏为 "***"；更新时传 undefined/留空表示不改动。

export type PresetKind = "llm" | "vision" | "search";
export type PresetProtocol = "anthropic" | "openai_compat";

export interface Preset {
  id: string;
  name: string;
  kind: PresetKind;
  // 模型连接（llm|vision 有值；search 缺省）
  protocol?: PresetProtocol;
  base_url?: string;
  model_id?: string;
  api_key?: string;
  context_window?: number | null;
  max_tokens?: number | null;
  // 搜索调优（search 有值；llm|vision 缺省）
  max_results?: number | null;
  min_score_threshold?: number | null;
  max_span?: number | null;
  weight_keyword_match?: number | null;
  weight_file_name_match?: number | null;
  weight_fts_score?: number | null;
  weight_title_match?: number | null;
  weight_proximity_match?: number | null;
}

export interface ActivateResult {
  ok: boolean;
  preset: Preset;
  note?: string | null;
}

export class PresetsApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Presets API error ${status}`);
    this.name = "PresetsApiError";
  }
}

async function handle<T>(resp: Response): Promise<T> {
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new PresetsApiError(resp.status, body);
  return body as T;
}

export async function listPresets(kind?: PresetKind): Promise<Preset[]> {
  const qs = kind ? `?kind=${kind}` : "";
  const data = await handle<{ presets: Preset[] }>(await fetch(`/api/presets${qs}`));
  return data.presets;
}

export interface NewPresetInput {
  name: string;
  kind: PresetKind;
  // 模型连接（llm|vision）
  protocol?: PresetProtocol;
  base_url?: string;
  model_id?: string;
  api_key?: string;
  context_window?: number | null;
  max_tokens?: number | null;
  // 搜索调优（search）
  max_results?: number | null;
  min_score_threshold?: number | null;
  max_span?: number | null;
  weight_keyword_match?: number | null;
  weight_file_name_match?: number | null;
  weight_fts_score?: number | null;
  weight_title_match?: number | null;
  weight_proximity_match?: number | null;
}

/** 创建预设。input 不含 id（由后端生成）。 */
export async function createPreset(input: NewPresetInput): Promise<Preset> {
  return handle<Preset>(
    await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

/** 更新预设：仅传改动的字段。api_key 不传=不改动，空串=清空。 */
export async function updatePreset(
  id: string,
  updates: Partial<Omit<NewPresetInput, "kind">>,
): Promise<Preset> {
  return handle<Preset>(
    await fetch(`/api/presets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }),
  );
}

export async function deletePreset(id: string): Promise<void> {
  await handle<{ ok: boolean }>(
    await fetch(`/api/presets/${id}`, { method: "DELETE" }),
  );
}

/** 切换预设：后端物化进 global .env + 清 local 残留 + reload_config。 */
export async function activatePreset(id: string): Promise<ActivateResult> {
  return handle<ActivateResult>(
    await fetch(`/api/presets/${id}/activate`, { method: "POST" }),
  );
}

export interface ProbeMaxTokensInput {
  protocol: PresetProtocol;
  base_url: string;
  model_id: string;
  /** 留空（编辑既有预设时）须传 preset_id，后端用已存密钥 */
  api_key?: string;
  preset_id?: string;
}

export interface ProbeMaxTokensResult {
  max_tokens: number;
  attempts: number;
}

/** 二分探测服务端允许的 max_tokens 上限（约 18 次请求，可能耗时数十秒）。 */
export async function probeMaxTokens(
  input: ProbeMaxTokensInput,
): Promise<ProbeMaxTokensResult> {
  return handle<ProbeMaxTokensResult>(
    await fetch("/api/presets/probe-max-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
