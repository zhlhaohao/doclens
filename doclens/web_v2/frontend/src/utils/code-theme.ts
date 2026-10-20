/** 代码预览主题偏好（ADR-0036 两态 → ADR-0043 升级三态，localStorage 持久化）。
 *
 * 仅作用于 preview-pane 的行号视图（代码/txt/兜底文本共用渲染路径）：
 * "auto"（默认）= 跟随应用主题（深夜 → 深色；Meta 白/暖纸 → 浅色）；
 * "light" = 强制浅色（现状 Meta 白底）；"dark" = 强制深色（GitHub dark）。
 * 用户显式设置过 = 固定覆盖跟随；未设置/清除记录 = 回到 auto。
 * md 文档内代码块、diff 视图、其他预览形态不消费（它们跟随应用主题）。
 * 与 font-scale 同构：机器级纯显示偏好，即选即生效。
 */

export type CodeTheme = "auto" | "light" | "dark";

const KEY = "cortex.preview.codeTheme";

export const CODE_THEME_DEFAULT: CodeTheme = "auto";

/** 读取持久化主题；无记录或值非法时返回默认 "auto"。
 *  历史两态值（"light"/"dark"）是合法的显式固定态，照常返回。 */
export function readCodeTheme(): CodeTheme {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return CODE_THEME_DEFAULT;
  }
  return raw === "light" || raw === "dark" ? raw : CODE_THEME_DEFAULT;
}

/** 代码主题变更事件名（自定义 window 事件；订阅方如 cm-editor）。 */
export const CODE_THEME_CHANGE_EVENT = "cortex-code-theme-change";

/** 写入主题（仅接受三态值，其余静默忽略）。 */
export function writeCodeTheme(theme: CodeTheme): void {
  if (theme !== "auto" && theme !== "light" && theme !== "dark") return;
  try {
    if (theme === "auto") {
      // 回到跟随：清除记录（保持「未显式设置 = auto」的存储语义）
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, theme);
    }
  } catch {
    // 配额满等写入失败：静默降级，不影响预览
  }
  // 通知订阅方（编辑态高亮需跟着换色板）
  try {
    window.dispatchEvent(
      new CustomEvent(CODE_THEME_CHANGE_EVENT, { detail: { theme } }),
    );
  } catch {
    // 无 window 环境（SSR/测试）时忽略
  }
}

/** 订阅代码主题变更，返回取消订阅函数。 */
export function onCodeThemeChange(cb: (theme: CodeTheme) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ theme?: CodeTheme }>).detail;
    if (detail?.theme) cb(detail.theme);
  };
  window.addEventListener(CODE_THEME_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CODE_THEME_CHANGE_EVENT, handler);
}
