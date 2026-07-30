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
  | "toggle";
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

/** 评分权重 section 标题（settings-view 据此渲染两列网格 + 恢复默认按钮）。 */
export const WEIGHT_SECTION = "评分权重";

/** 权重默认值，必须与 doclens/config.py 的 Field default 一致。 */
export const DEFAULT_WEIGHTS: Record<string, string> = {
  CORTEX_WEIGHT_KEYWORD_MATCH: "4.0",
  CORTEX_WEIGHT_FILE_NAME_MATCH: "2.0",
  CORTEX_WEIGHT_FTS_SCORE: "1.0",
  CORTEX_WEIGHT_TITLE_MATCH: "2.0",
  CORTEX_WEIGHT_PROXIMITY_MATCH: "1.0",
};

/** 「恢复默认」判定的出厂基准值（与包内 .env.example 同步）。
 *  用于 _allAtDefault：重置为模板后表单值应全部等于此处，按钮据此禁用。
 *  注意：「恢复默认」实际由 POST /api/config/reset-default 完成（拷贝 .env.example
 *  并保留 API Key），而非逐字段写这些值 —— 这样能保留注释与空行、避免掏空文件。
 *  PLANIFY_API_KEY 不在此列（密钥无出厂默认，重置时单独保留）。 */
export const FIELD_DEFAULTS: Record<string, string> = {
  PLANIFY_PROVIDER: "minimax",
  PLANIFY_PROTOCOL: "openai_compat",
  PLANIFY_BASE_URL: "",
  PLANIFY_MODEL_ID: "",
  VISION_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  VISION_MODEL: "qwen-vl-max",
  CORTEX_MAX_RESULTS: "50",
  CORTEX_MIN_SCORE_THRESHOLD: "0.3",
  CORTEX_MAX_SPAN: "50",
  CORTEX_WEIGHT_KEYWORD_MATCH: "4.0",
  CORTEX_WEIGHT_FILE_NAME_MATCH: "2.0",
  CORTEX_WEIGHT_FTS_SCORE: "1.0",
  CORTEX_WEIGHT_TITLE_MATCH: "2.0",
  CORTEX_WEIGHT_PROXIMITY_MATCH: "1.0",
  CORTEX_WEB_HOST: "127.0.0.1",
  CORTEX_WEB_PORT: "7860",
  CORTEX_MCP_ENABLED: "false",
  CORTEX_MCP_HOST: "127.0.0.1",
  CORTEX_MCP_PORT: "7880",
};

/** 后端默认值镜像（必须与 doclens/config.py 的 Field default 一致）。
 *  用于未设置（空串）时的隐式显示：slider 停在默认位置、chip/placeholder 显示默认值。 */
export const IMPLICIT_DEFAULTS: Record<string, string> = {
  CORTEX_MAX_RESULTS: "50",
  CORTEX_MIN_SCORE_THRESHOLD: "0.3",
  CORTEX_MAX_SPAN: "50",
  CORTEX_WEB_HOST: "127.0.0.1",
  CORTEX_WEB_PORT: "7860",
  CORTEX_MCP_ENABLED: "false",
  CORTEX_MCP_HOST: "127.0.0.1",
  CORTEX_MCP_PORT: "7880",
  ...DEFAULT_WEIGHTS,
};

/** LLM provider 已知预设。必须与 planify/core/llm/presets.py::PROVIDER_PRESETS 同步。 */
export const PROVIDER_OPTIONS: SettingsFieldOption[] = [
  // 国内供应商
  { value: "minimax", label: "MiniMax（默认）" },
  { value: "kimi", label: "Kimi（月之暗面）" },
  { value: "qwen", label: "阿里通义千问" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "glm", label: "智谱 GLM" },
  { value: "hunyuan", label: "腾讯混元" },
  { value: "doubao", label: "字节豆包" },
  { value: "siliconflow", label: "硅基流动" },
  // 国外供应商
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "自定义（OpenAI 兼容或 Anthropic 协议）" },
];

/** LLM provider 协议枚举。 */
export const PROTOCOL_OPTIONS: SettingsFieldOption[] = [
  { value: "anthropic", label: "Anthropic 协议" },
  { value: "openai_compat", label: "OpenAI 兼容" },
];

/** 已知预设的默认 base_url。空字符串表示使用 SDK 默认（anthropic）。 */
export const PRESET_BASE_URLS: Record<string, string> = {
  minimax: "https://api.minimaxi.com/v1",
  kimi: "https://api.moonshot.cn/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com/v1",
  glm: "https://open.bigmodel.cn/api/paas/v4/",
  hunyuan: "https://api.hunyuan.cloud.tencent.com/v1",
  doubao: "https://ark.cn-beijing.volces.com/api/v3",
  siliconflow: "https://api.siliconflow.cn/v1",
  anthropic: "",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
};

/** 已知预设的默认 protocol。 */
export const PRESET_PROTOCOLS: Record<string, string> = {
  minimax: "openai_compat",
  kimi: "openai_compat",
  qwen: "openai_compat",
  deepseek: "openai_compat",
  glm: "openai_compat",
  hunyuan: "openai_compat",
  doubao: "openai_compat",
  siliconflow: "openai_compat",
  anthropic: "anthropic",
  openai: "openai_compat",
  openrouter: "openai_compat",
  custom: "",
};

export const SETTINGS_FIELDS: SettingsField[] = [
  // ===== AI 配置 (5) =====
  {
    tab: "ai",
    section: "AI 模型与 API",
    envVar: "PLANIFY_PROVIDER",
    label: "LLM 提供商",
    component: "select",
    effect: "live",
    options: PROVIDER_OPTIONS,
    hint: "选择 LLM 提供商。已知预设会自动填入默认 base_url 和 protocol。",
  },
  {
    tab: "ai",
    section: "AI 模型与 API",
    envVar: "PLANIFY_PROTOCOL",
    label: "API 协议",
    component: "select",
    effect: "live",
    options: PROTOCOL_OPTIONS,
    hint: "已知预设下会自动选择；custom 时必填。",
  },
  {
    tab: "ai",
    section: "AI 模型与 API",
    envVar: "PLANIFY_BASE_URL",
    label: "API Base URL",
    component: "text",
    effect: "live",
    mono: true,
    hint: "Anthropic API 端点。可替换为兼容代理或本地模型服务。",
  },
  {
    tab: "ai",
    section: "AI 模型与 API",
    envVar: "PLANIFY_API_KEY",
    label: "API Key",
    component: "password",
    effect: "live",
    mono: true,
    hint: "Anthropic API 密钥。保存时写入 .env，不会回传到前端其它视图。",
  },
  {
    tab: "ai",
    section: "AI 模型与 API",
    envVar: "PLANIFY_MODEL_ID",
    label: "模型 ID",
    component: "text",
    effect: "live",
    mono: true,
    datalist: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    hint: "支持自动补全常见模型；也可手动输入自定义模型 ID。",
  },

  // ===== 视觉模型（图像文件解析，独立于 AI 对话配置） =====
  {
    tab: "ai",
    section: "🖼️ 视觉模型（图像解析）",
    envVar: "VISION_API_KEY",
    label: "API Key",
    component: "password",
    effect: "live",
    mono: true,
    hint: "视觉模型密钥，与上方 AI 对话配置完全独立。留空时图像文件只做占位索引（文件名可搜索），不做视觉解析。",
  },
  {
    tab: "ai",
    section: "🖼️ 视觉模型（图像解析）",
    envVar: "VISION_BASE_URL",
    label: "API Base URL",
    component: "text",
    effect: "live",
    mono: true,
    hint: "OpenAI 兼容端点，默认阿里百炼。图像解析由后台 worker 串行执行，不拖慢主索引。",
  },
  {
    tab: "ai",
    section: "🖼️ 视觉模型（图像解析）",
    envVar: "VISION_MODEL",
    label: "模型 ID",
    component: "text",
    effect: "live",
    mono: true,
    datalist: ["qwen-vl-max", "qwen-vl-plus", "qwen3-vl-plus", "qwen3-vl-flash"],
    hint: "具备图像识别能力的模型；切换模型后已解析的图像会在下次启动时自动重新解析。",
  },

  // ===== 搜索调优 · 结果与过滤 (3，无 section 标题) =====
  {
    tab: "search",
    envVar: "CORTEX_MAX_RESULTS",
    label: "最大搜索结果数",
    component: "number",
    effect: "live",
    min: 1,
    max: 200,
    hint: "search 工具最多返回多少篇文档",
  },
  {
    tab: "search",
    envVar: "CORTEX_MIN_SCORE_THRESHOLD",
    label: "综合评分阈值",
    component: "slider",
    effect: "live",
    min: 0,
    max: 1,
    step: 0.05,
    hint: "低于该综合分的结果被过滤，0 = 不过滤",
  },
  {
    tab: "search",
    envVar: "CORTEX_MAX_SPAN",
    label: "关键词集中度(字符)",
    component: "number",
    effect: "live",
    min: 1,
    max: 100,
    hint: "邻近度统计的关键词最大字符跨度",
  },

  // ===== 搜索调优 · 评分权重 (5) =====
  {
    tab: "search",
    section: "评分权重",
    envVar: "CORTEX_WEIGHT_KEYWORD_MATCH",
    label: "关键词匹配权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "命中的关键词越多排越前",
  },
  {
    tab: "search",
    section: "评分权重",
    envVar: "CORTEX_WEIGHT_FILE_NAME_MATCH",
    label: "文件名匹配权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "文件名含关键词的文档排更前",
  },
  {
    tab: "search",
    section: "评分权重",
    envVar: "CORTEX_WEIGHT_FTS_SCORE",
    label: "FTS 原始分权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "偏向传统 BM25 全文检索排序",
  },
  {
    tab: "search",
    section: "评分权重",
    envVar: "CORTEX_WEIGHT_TITLE_MATCH",
    label: "标题匹配权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "小节标题含关键词排更前",
  },
  {
    tab: "search",
    section: "评分权重",
    envVar: "CORTEX_WEIGHT_PROXIMITY_MATCH",
    label: "邻近度权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "关键词紧邻出现的文档排更前",
  },

  // ===== 网络监听 (4，网络监听 tab；effect restart：改后需重启 gui) =====
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
];
