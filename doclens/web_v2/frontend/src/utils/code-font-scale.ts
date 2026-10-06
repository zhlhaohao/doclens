/** 行号视图（代码/txt/兜底文本）字号缩放偏好（localStorage 持久化）。
 *
 * 与 md-viewer 的 font-scale（utils/font-scale.ts）同构但**独立键**：
 * 等宽代码与文档正文的舒适字号不同，互不牵连。
 * 仅作用于 preview-pane 行号视图的 .body；md/pdf/html/编辑器不消费。
 */

import { clampFontScalePct } from "./font-scale";

export const CODE_FONT_SCALE_MIN_PCT = 60;
export const CODE_FONT_SCALE_MAX_PCT = 200;
export const CODE_FONT_SCALE_STEP_PCT = 10;
export const CODE_FONT_SCALE_DEFAULT_PCT = 100;

const KEY = "cortex.preview.codeFontScalePct";

/** 读取持久化的百分比档位；无记录或值非法时返回默认 100。 */
export function readCodeFontScalePct(): number {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return CODE_FONT_SCALE_DEFAULT_PCT;
  }
  if (raw === null || raw.trim() === "") return CODE_FONT_SCALE_DEFAULT_PCT;
  const pct = Number(raw);
  if (!Number.isFinite(pct)) return CODE_FONT_SCALE_DEFAULT_PCT;
  return clampFontScalePct(pct);
}

/** 写入百分比档位（越界收敛到边界；非有限数静默忽略）。 */
export function writeCodeFontScalePct(pct: number): void {
  if (!Number.isFinite(pct)) return;
  try {
    localStorage.setItem(KEY, String(clampFontScalePct(pct)));
  } catch {
    // 配额满等写入失败：静默降级，不影响预览
  }
}
