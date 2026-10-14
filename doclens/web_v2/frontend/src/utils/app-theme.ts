/** 应用主题偏好（ADR-0043，localStorage 持久化）。
 *
 * 三套内置主题成套切换：light = Meta 白（默认）/ dark = 深夜（GitHub dark 系）/
 * paper = 暖纸（米黄长阅读）。纯前端实现（零后端）：
 *   - 存储：localStorage["cortex.theme"]，每设备各自记忆（与代码主题/font-scale 同惯例）
 *   - 生效：<html data-theme="..."> 属性，tokens.css 按属性重定义整套颜色 token
 *   - FOUC：index.html <head> 内联脚本在应用加载前先行挂属性（本模块启动时幂等重挂）
 * 与「代码主题」（行号视图局部三态）相互独立：代码主题的 "auto" 态跟随本主题。
 */

export type AppTheme = "light" | "dark" | "paper";

const KEY = "cortex.theme";

export const APP_THEME_DEFAULT: AppTheme = "light";

/** 切换循环顺序（app-bar 快捷钮 / 设置页色卡共用）。 */
export const APP_THEME_ORDER: AppTheme[] = ["light", "dark", "paper"];

export const APP_THEME_LABELS: Record<AppTheme, string> = {
  light: "Meta 白",
  dark: "深夜",
  paper: "暖纸",
};

/** PWA 状态栏色（meta[name=theme-color]）随主题同步。 */
const APP_THEME_META_COLOR: Record<AppTheme, string> = {
  light: "#0064E0",
  dark: "#0d1117",
  paper: "#f8f4ea",
};

/** 主题变更事件名（自定义 window 事件；订阅方如 preview-pane 的代码 auto 态）。 */
export const APP_THEME_CHANGE_EVENT = "cortex-app-theme-change";

function isAppTheme(v: unknown): v is AppTheme {
  return v === "light" || v === "dark" || v === "paper";
}

/** 读取持久化主题；无记录或值非法时返回默认 "light"。 */
export function readAppTheme(): AppTheme {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return APP_THEME_DEFAULT;
  }
  return isAppTheme(raw) ? raw : APP_THEME_DEFAULT;
}

/** 把主题挂到 <html data-theme>（幂等；默认 light 不挂属性，保持 :root 基线）。
 *  同时同步 PWA meta theme-color。 */
export function applyAppTheme(theme: AppTheme): void {
  const el = document.documentElement;
  if (theme === "light") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", APP_THEME_META_COLOR[theme]);
}

/** 写入并立即生效，广播变更事件（多组件联动重渲染）。 */
export function writeAppTheme(theme: AppTheme): void {
  if (!isAppTheme(theme)) return;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // 配额满等写入失败：静默降级，本次会话仍可切换（不持久）
  }
  applyAppTheme(theme);
  window.dispatchEvent(new CustomEvent(APP_THEME_CHANGE_EVENT, { detail: theme }));
}

/** app-bar 快捷钮：按 APP_THEME_ORDER 循环到下一主题。 */
export function cycleAppTheme(): AppTheme {
  const cur = readAppTheme();
  const next = APP_THEME_ORDER[(APP_THEME_ORDER.indexOf(cur) + 1) % APP_THEME_ORDER.length];
  writeAppTheme(next);
  return next;
}

/** 订阅主题变更（返回退订函数）。 */
export function onAppThemeChange(cb: (theme: AppTheme) => void): () => void {
  const handler = (ev: Event) => cb((ev as CustomEvent<AppTheme>).detail ?? readAppTheme());
  window.addEventListener(APP_THEME_CHANGE_EVENT, handler);
  return () => window.removeEventListener(APP_THEME_CHANGE_EVENT, handler);
}
