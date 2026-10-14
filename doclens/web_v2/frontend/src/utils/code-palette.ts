/** 行号视图（代码预览）配色 token 表（ADR-0036 / ADR-0043）。
 *
 * 浅色与深色两套表面 + 8 类语法色（ADR-0032 服务端分词的前端消费侧）。
 * 深色基准 = GitHub dark（canvas #0d1117）。
 * 消费方 preview-pane 经 `.body` / `.body.dark` 类切换两套 `--code-*` 变量。
 * 本文件是全前端唯一允许在组件样式之外成批定义色值的地方之一
 * （另一处 styles/tokens.css 主题层）——架构守卫白名单成员。
 */

/** 浅色（Meta 白）行号视图 token：注入 `.body` 基础规则。 */
export const codeSurfaceLight = {
  canvas: "var(--cortex-bg)",
  ink: "var(--cortex-text)",
  lineNo: "var(--cortex-text-subtle)",
  lineNoHover: "var(--cortex-primary)",
  selectedBg: "color-mix(in srgb, var(--cortex-primary) 8%, transparent)",
  selectedBar: "var(--cortex-primary)",
  hitBg: "color-mix(in srgb, var(--cortex-primary) 15%, transparent)",
  hitInk: "var(--cortex-primary)",
  clearBtnBg: "var(--cortex-surface)",
  clearBtnInk: "var(--cortex-text-muted)",
} as const;

/** 深色（GitHub dark）行号视图 token：注入 `.body.dark` 覆盖。 */
export const codeSurfaceDark = {
  canvas: "#0d1117",
  ink: "#c9d1d9",
  lineNo: "#6e7681",
  lineNoHover: "#58a6ff",
  selectedBg: "rgba(56, 139, 253, 0.15)",
  selectedBar: "#58a6ff",
  hitBg: "rgba(187, 128, 9, 0.4)",
  hitInk: "#e3b341",
  clearBtnBg: "#21262d",
  clearBtnInk: "#8b949e",
} as const;

/** 浅色 8 类语法色（克制 Meta 画布：注释 stone / 关键字 ink 深蓝黑 / 字符串森林绿 /
 *  数字赭棕 / 函数靛蓝 / 类型青蓝 / 操作符 steel / 标点 slate）。 */
export const codeTokensLight = {
  c: "var(--cortex-text-subtle)",
  k: "#0a3d91",
  s: "#0a7d33",
  n: "#a05a1f",
  f: "#4b3fd4",
  t: "#0b7285",
  o: "var(--cortex-text-caption)",
  p: "var(--cortex-text-muted)",
} as const;

/** 深色 8 类语法色（GitHub dark 语法色）。 */
export const codeTokensDark = {
  c: "#8b949e",
  k: "#ff7b72",
  s: "#a5d6ff",
  n: "#79c0ff",
  f: "#d2a8ff",
  t: "#7ee787",
  o: "#ff7b72",
  p: "#c9d1d9",
} as const;
