/** Field metadata for the settings form. Drives the metadata-driven rendering
 * in <settings-view>. Hint strings come from specs/settings-page-mockup.html.
 *
 * IMPORTANT: keep the 18 envVar values in sync with KNOWN_KEYS in
 * cortex/web_v2/config_store.py (backend) — they are the contract between
 * the API and this UI.
 */
export type SettingsTab = "ai" | "search" | "scoring" | "terminal";
export type SettingsFieldComponent =
  | "text"
  | "number"
  | "select"
  | "password"
  | "slider";
export type SettingsFieldEffect = "live" | "restart";

export interface SettingsFieldOption {
  value: string;
  label: string;
}

export interface SettingsField {
  tab: SettingsTab;
  section: string;
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

export const SETTINGS_TABS: SettingsTab[] = ["ai", "search", "scoring", "terminal"];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  ai: "AI 配置",
  search: "搜索调优",
  scoring: "评分",
  terminal: "终端",
};

export const SETTINGS_FIELDS: SettingsField[] = [
  // ===== AI 配置 (3) =====
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_BASE_URL",
    label: "API Base URL",
    component: "text",
    effect: "restart",
    mono: true,
    hint: "Anthropic API 端点。可替换为兼容代理或本地模型服务。",
  },
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_API_KEY",
    label: "API Key",
    component: "password",
    effect: "restart",
    mono: true,
    hint: "Anthropic API 密钥。保存时写入 .env，不会回传到前端其它视图。",
  },
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_MODEL_ID",
    label: "模型 ID",
    component: "text",
    effect: "restart",
    mono: true,
    datalist: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    hint: "支持自动补全常见模型；也可手动输入自定义模型 ID。",
  },

  // ===== 搜索调优 (7) =====
  {
    tab: "search",
    section: "📊 结果数量",
    envVar: "CORTEX_MAX_RESULTS",
    label: "最大结果数（跨文档）",
    component: "number",
    effect: "live",
    min: 1,
    max: 200,
    hint: "search 工具返回的最大文档数量。",
  },
  {
    tab: "search",
    section: "📊 结果数量",
    envVar: "CORTEX_MAX_NODES_PER_DOC",
    label: "每文档最大节点数",
    component: "number",
    effect: "live",
    min: 1,
    max: 20,
    hint: "同一文档返回的最大节点（段落）数。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MAX_SPAN",
    label: "关键词最大跨度",
    component: "number",
    effect: "live",
    min: 1,
    max: 100,
    hint: "窗口内匹配关键词的最大字符跨度。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_KEYWORD_MATCH",
    label: "最少关键词匹配数",
    component: "number",
    effect: "live",
    min: 0,
    max: 10,
    hint: "文档至少命中多少个关键词才进入候选。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_PROXIMITY_SCORE",
    label: "最低邻近度阈值",
    component: "select",
    effect: "live",
    options: [
      { value: "0", label: "0 — 不限制" },
      { value: "1", label: "1 — 部分紧邻" },
      { value: "2", label: "2 — 全部关键词紧邻" },
    ],
    hint: "关键词在文档中的邻近程度阈值。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_KEYWORDS_PER_LINE",
    label: "行级关键词阈值",
    component: "number",
    effect: "live",
    min: 1,
    max: 10,
    hint: "单行至少命中多少关键词才被选为\"最佳行\"。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_SCORE_THRESHOLD",
    label: "综合评分阈值",
    component: "number",
    effect: "live",
    min: 0,
    max: 1,
    step: 0.05,
    hint: "0 = 不过滤；0.3 = 轻微过滤；0.5+ 容易砍光多关键词结果。",
  },

  // ===== 评分 (5) =====
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_KEYWORD_MATCH",
    label: "关键词匹配权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "权重越大，越偏好'命中的关键词数量多'的文档（多关键词 query 时尤其重要）。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_FILE_NAME_MATCH",
    label: "文件名匹配权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "权重越大，文件名包含关键词的文档排序越靠前。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_FTS_SCORE",
    label: "FTS 原始分权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "权重越大，越偏向传统全文检索 BM25 排序（与关键词匹配度正相关）。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_TITLE_MATCH",
    label: "标题匹配权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "权重越大，节点标题（如 Markdown 小节标题）含关键词时排序越靠前。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_PROXIMITY_MATCH",
    label: "邻近度权重",
    component: "slider",
    effect: "live",
    min: 0,
    max: 10,
    step: 0.1,
    hint: "权重越大，多关键词在文档中紧邻出现的文档越受偏好。",
  },

  // ===== 终端 (3) =====
  {
    tab: "terminal",
    section: "🖥️ 终端结果显示",
    envVar: "CORTEX_MAX_CONTEXT_LINES",
    label: "上下文行数上限",
    component: "number",
    unit: "行",
    min: 0,
    max: 100,
    hint: "每个命中行向上/向下最多各显示多少行原文上下文。",
  },
  {
    tab: "terminal",
    section: "🖥️ 终端结果显示",
    envVar: "CORTEX_MAX_ANCHOR_LINES",
    label: "锚点行数上限",
    component: "number",
    unit: "行",
    min: 1,
    max: 50,
    hint: "从同一文档的所有命中行里，挑出多少个'最佳行'作为展示中心（锚点）。锚点越多，结果越完整但输出越长。",
  },
  {
    tab: "terminal",
    section: "🖥️ 终端结果显示",
    envVar: "CORTEX_CONTEXT_EXPAND_RANGE",
    label: "锚点上下文扩展范围",
    component: "number",
    unit: "行",
    min: 0,
    max: 100,
    hint: "以每个锚点为中心，向前/向后各展开多少行作为上下文（再与'上下文行数上限'取较小值）。",
  },
];
