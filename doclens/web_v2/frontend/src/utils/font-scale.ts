/** markdown 预览字号缩放偏好（localStorage 持久化）。
 *
 * 以百分比档位存储（60–200，步长 10），渲染时换算为乘数。
 * 仅作用于 preview-pane 的 md-viewer 正文；纯文本/HTML/编辑器不消费。
 */

const KEY = "cortex.files.mdFontScalePct";

export const FONT_SCALE_MIN_PCT = 60;
export const FONT_SCALE_MAX_PCT = 200;
export const FONT_SCALE_STEP_PCT = 10;
export const FONT_SCALE_DEFAULT_PCT = 100;

/** 读取持久化的百分比档位；无记录或值非法时返回默认 100。 */
export function readFontScalePct(): number {
  const raw = localStorage.getItem(KEY);
  // Number("") = 0 会被 isFinite 放行 → 空串显式视为无记录
  if (raw === null || raw.trim() === "") return FONT_SCALE_DEFAULT_PCT;
  const pct = Number(raw);
  if (!Number.isFinite(pct)) return FONT_SCALE_DEFAULT_PCT;
  return clampFontScalePct(pct);
}

/** 写入百分比档位（越界收敛到边界；非有限数静默忽略）。 */
export function writeFontScalePct(pct: number): void {
  if (!Number.isFinite(pct)) return;
  try {
    localStorage.setItem(KEY, String(clampFontScalePct(pct)));
  } catch {
    // 配额满等写入失败：静默降级，不影响预览
  }
}

/** 百分比收敛到合法范围。档位只由 stepper ±10 产出（恒为整 10 倍数），
 *  这里不做 snap-to-grid —— 避免把手写的中间值悄悄改成别的数。 */
export function clampFontScalePct(pct: number): number {
  return Math.min(FONT_SCALE_MAX_PCT, Math.max(FONT_SCALE_MIN_PCT, pct));
}

/** 百分比 → CSS 乘数（如 130 → 1.3）。 */
export function fontScaleFromPct(pct: number): number {
  return clampFontScalePct(pct) / 100;
}
