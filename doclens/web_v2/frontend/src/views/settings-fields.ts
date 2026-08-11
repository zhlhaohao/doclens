/** Field metadata for the settings form. Drives the metadata-driven rendering
 * in <settings-view>. Hint strings come from specs/settings-page-mockup.html.
 *
 * IMPORTANT: keep the envVar values in sync with KNOWN_KEYS in
 * cortex/web_v2/config_store.py (backend) — they are the contract between
 * the API and this UI.
 */
export type SettingsTab = "ai" | "search" | "network";
export type SettingsFieldComponent =
  | "text"
  | "number"
  | "select"
  | "password"
  | "slider"
  | "toggle"
  | "switch";
export type SettingsFieldEffect = "live" | "restart";

export interface SettingsFieldOption {
  value: string;
  label: string;
}

export interface SettingsField {
  tab: SettingsTab;
  /** 分组标题；缺省表示该字段不渲染 section 标题 */
  section?: string;
  envVar: string;
  label: string;
  component: SettingsFieldComponent;
  effect?: SettingsFieldEffect;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  mono?: boolean;
  datalist?: string[];
  options?: SettingsFieldOption[];
}

export const SETTINGS_TABS: SettingsTab[] = ["ai", "search", "network"];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  ai: "AI 配置",
  search: "搜索调优",
  network: "网络监听",
};

/** 「恢复默认」判定的出厂基准值（与包内 .env.example 同步）。
 *  用于 _allAtDefault：重置为模板后表单值应全部等于此处，按钮据此禁用。
 *  注意：「恢复默认」实际由 POST /api/config/reset-default 完成（拷贝 .env.example
 *  并保留 API Key），而非逐字段写这些值 —— 这样能保留注释与空行、避免掏空文件。
 *  模型参数（PLANIFY_* / VISION_*）由「模型预设」管理；搜索参数（CORTEX_MAX_RESULTS
 *  等 + 5 权重）由「搜索预设」管理；均不在设置页字段内，故不在此列。 */
export const FIELD_DEFAULTS: Record<string, string> = {
  CORTEX_WEB_HOST: "127.0.0.1",
  CORTEX_WEB_PORT: "7860",
  CORTEX_MCP_ENABLED: "false",
  CORTEX_MCP_HOST: "127.0.0.1",
  CORTEX_MCP_PORT: "7880",
  CORTEX_SYNC_ENABLED: "true",
};

/** 后端默认值镜像（必须与 doclens/config.py 的 Field default 一致）。
 *  用于未设置（空串）时的隐式显示：number 字段 placeholder / chip 显示默认值。 */
export const IMPLICIT_DEFAULTS: Record<string, string> = {
  CORTEX_WEB_HOST: "127.0.0.1",
  CORTEX_WEB_PORT: "7860",
  CORTEX_MCP_ENABLED: "false",
  CORTEX_MCP_HOST: "127.0.0.1",
  CORTEX_MCP_PORT: "7880",
};

export const SETTINGS_FIELDS: SettingsField[] = [
  // AI 配置 tab：模型参数由「模型预设」区块（<model-presets-section>）接管（ADR-0009）。
  // 搜索调优 tab：搜索参数由「搜索预设」区块（<search-presets-section>）接管（ADR-0010）。
  // 两者均不再有字段散填——一律通过预设一键切换。

  // ===== 百度天气 API（ai tab，模型预设区块下方；日记录入时抓城市天气用） =====
  {
    tab: "ai",
    section: "百度天气 API",
    envVar: "BAIDU_WEATHER_AK",
    label: "百度地图开放平台 AK",
    component: "password",
    hint: "供日记录入时抓取城市天气。需在百度地图开放平台申请；留空则日记不带天气（不影响其他功能）。保存后即时生效。",
  },

  // ===== 网络监听（network tab；effect restart：改后需重启 gui） =====
  {
    tab: "network",
    section: "监听地址",
    envVar: "CORTEX_WEB_HOST",
    label: "Web 监听地址",
    component: "text",
    effect: "restart",
    mono: true,
    hint: "Web UI 绑定地址。0.0.0.0 暴露局域网（无鉴权，慎用）。改后需重启；若改了端口，重启后需用新地址重新打开。",
  },
  {
    tab: "network",
    section: "监听地址",
    envVar: "CORTEX_WEB_PORT",
    label: "Web 监听端口",
    component: "number",
    effect: "restart",
    min: 1,
    max: 65535,
    hint: "Web UI 端口（1–65535）。改后需重启，重启后用新端口重新打开。",
  },
  {
    tab: "network",
    section: "监听地址",
    envVar: "CORTEX_MCP_ENABLED",
    label: "启用 MCP server",
    component: "toggle",
    effect: "restart",
    hint: "关闭时不启动 MCP HTTP server（Claude Code 的 kb-ask 等经 MCP 接入的功能将不可用）。改后需重启。",
  },
  {
    tab: "network",
    section: "监听地址",
    envVar: "CORTEX_MCP_HOST",
    label: "MCP 监听地址",
    component: "text",
    effect: "restart",
    mono: true,
    hint: "MCP server 绑定地址。非环回地址（如 0.0.0.0）需在 .env 配 CORTEX_MCP_TOKEN，否则 MCP 拒绝启动。",
  },
  {
    tab: "network",
    section: "监听地址",
    envVar: "CORTEX_MCP_PORT",
    label: "MCP 监听端口",
    component: "number",
    effect: "restart",
    min: 1,
    max: 65535,
    hint: "MCP server 端口（1–65535）。改后需重启。",
  },

  // ===== 知识库 Git 同步（ADR-0006；改后需重启 gui 才生效） =====
  {
    tab: "network",
    section: "知识库 Git 同步",
    envVar: "CORTEX_SYNC_ENABLED",
    label: "启用 Git 同步",
    component: "switch",
    effect: "restart",
    hint: "工作目录为 git 根且已配置 remote 时，定期 auto-commit → pull → push。改后需重启。",
  },
];
