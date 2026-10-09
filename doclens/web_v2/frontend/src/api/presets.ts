// 预设 API client（ADR-0009/0010）。字段名与后端 Pydantic 输出一致（snake_case）。
// kind: llm|vision（模型连接档案，含 api_key）/ search（搜索调优档案，无密钥）。
// api_key 在 GET 时脱敏为 "***"；更新时传 undefined/留空表示不改动。

export type PresetKind = "llm" | "vision" | "search" | "translate";
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
  /** 支持视觉（ADR-0034 视觉路由能力位，仅 kind=llm；未声明=不支持） */
  vision?: boolean | null;
  max_tokens?: number | null;
  // 搜索调优（search 有值；llm|vision 缺省）
  max_results?: number | null;
  min_score_threshold?: number | null;
  max_span?: number | null;
  search_context_before?: number | null;
  search_context_after?: number | null;
  weight_keyword_match?: number | null;
  weight_file_name_match?: number | null;
  weight_fts_score?: number | null;
  weight_title_match?: number | null;
  weight_proximity_match?: number | null;
  // 翻译（translate，ADR-0039）：translate_envs GET 时值脱敏为 "***"
  translate_service?: string | null;
  translate_envs?: Record<string, string> | null;
  lang_default_out?: string | null;
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
  /** 支持视觉（ADR-0034，仅 kind=llm；null=未声明走后端默认 false） */
  vision?: boolean | null;
  max_tokens?: number | null;
  // 搜索调优（search）
  max_results?: number | null;
  min_score_threshold?: number | null;
  max_span?: number | null;
  search_context_before?: number | null;
  search_context_after?: number | null;
  weight_keyword_match?: number | null;
  weight_file_name_match?: number | null;
  weight_fts_score?: number | null;
  weight_title_match?: number | null;
  weight_proximity_match?: number | null;
  // 翻译（translate，ADR-0039）
  translate_service?: string;
  translate_envs?: Record<string, string>;
  lang_default_out?: string;
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

export interface ProbeVisionResult {
  /** true = 模型读出图中密码串（真支持）；false = 拒图或静默吞图（不支持） */
  supported: boolean;
}

/** 行为学探测模型是否支持视觉（ADR-0034 增补）：后端合成随机密码串图实测。 */
export async function probeVision(
  input: ProbeMaxTokensInput,
): Promise<ProbeVisionResult> {
  return handle<ProbeVisionResult>(
    await fetch("/api/presets/probe-vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export interface ProbeTranslateInput {
  translate_service: string;
  envs?: Record<string, string>;
  /** 编辑既有预设时传，envs 值为 *** 时后端回退已存密钥 */
  preset_id?: string;
}

export interface ProbeTranslateResult {
  translation: string;
  service: string;
}

/** 翻译服务连通性探测（ADR-0039）：翻一句固定文本验证服务与密钥。 */
export async function probeTranslate(
  input: ProbeTranslateInput,
): Promise<ProbeTranslateResult> {
  return handle<ProbeTranslateResult>(
    await fetch("/api/presets/probe-translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
