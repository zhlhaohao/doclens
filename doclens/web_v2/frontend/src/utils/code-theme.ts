/** 代码预览主题偏好（ADR-0036，localStorage 持久化）。
 *
 * 仅作用于 preview-pane 的行号视图（代码/txt/兜底文本共用渲染路径）：
 * light = 现状 Meta 白底；dark = GitHub dark 深底 + 语法色。
 * md 文档内代码块、diff 视图、其他预览形态不消费。
 * 与 font-scale 同构：机器级纯显示偏好，即选即生效。
 */

export type CodeTheme = "light" | "dark";

const KEY = "cortex.preview.codeTheme";

export const CODE_THEME_DEFAULT: CodeTheme = "light";

/** 读取持久化主题；无记录或值非法时返回默认 "light"。 */
export function readCodeTheme(): CodeTheme {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return CODE_THEME_DEFAULT;
  }
  return raw === "dark" ? "dark" : CODE_THEME_DEFAULT;
}

/** 写入主题（仅接受两态值，其余静默忽略）。 */
export function writeCodeTheme(theme: CodeTheme): void {
  if (theme !== "light" && theme !== "dark") return;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // 配额满等写入失败：静默降级，不影响预览
  }
}
