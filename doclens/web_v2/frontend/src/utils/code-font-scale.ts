/** 行号视图（代码/txt/兜底文本）字号缩放偏好（localStorage 持久化）。
 *
 * 与 md-viewer 的 font-scale（utils/font-scale.ts）同构但**独立键**：
 * 等宽代码与文档正文的舒适字号不同，互不牵连。
 * 仅作用于 preview-pane 行号视图的 .body；md/pdf/html/编辑器不消费。
 *
 * （AP-5：读/写已收敛 font-scale.ts 的参数化公共件 readPctFromStorage/
 *  writePctToStorage——修复前副本已漂移：异常处理不对称 + code 侧误用
 *  md 版 clampFontScalePct，两域常量一旦分化即静默失守。）
 */

import { readPctFromStorage, writePctToStorage } from "./font-scale";

export const CODE_FONT_SCALE_MIN_PCT = 60;
export const CODE_FONT_SCALE_MAX_PCT = 200;
export const CODE_FONT_SCALE_STEP_PCT = 10;
export const CODE_FONT_SCALE_DEFAULT_PCT = 100;

const KEY = "cortex.preview.codeFontScalePct";

/** 百分比收敛到 code 域合法范围（独立于 md 域的 clampFontScalePct）。 */
export function clampCodeFontScalePct(pct: number): number {
  return Math.min(CODE_FONT_SCALE_MAX_PCT, Math.max(CODE_FONT_SCALE_MIN_PCT, pct));
}

/** 读取持久化的百分比档位；无记录或值非法时返回默认 100。 */
export function readCodeFontScalePct(): number {
  return readPctFromStorage(KEY, clampCodeFontScalePct, CODE_FONT_SCALE_DEFAULT_PCT);
}

/** 写入百分比档位（越界收敛到边界；非有限数静默忽略）。 */
export function writeCodeFontScalePct(pct: number): void {
  writePctToStorage(KEY, pct, clampCodeFontScalePct);
}
