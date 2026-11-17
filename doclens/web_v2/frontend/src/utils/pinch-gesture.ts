/** 双指 pinch 手势的公共几何件（AP-4 拆分件）：基线距离 → 比率 → clamp，
 *  此前 pdf-viewer 与 image-viewer 各一份实现且已漂移（clamp 风格、阈值
 *  0.3 vs 0.5、常量命名不一致），修手感时只改一处即行为分裂。
 *
 *  两 viewer 各传自己的缩放域（SCALE_MIN/MAX），clamp 公式单一真相源。 */

/** 双指触点的欧氏距离。 */
export function pinchDistance(t: TouchList): number {
  const dx = t[0].clientX - t[1].clientX;
  const dy = t[0].clientY - t[1].clientY;
  return Math.hypot(dx, dy);
}

/** pinch 基线（touchstart 时刻捕获）：两指距离 + 起始缩放值。 */
export interface PinchBase {
  dist: number;
  scale: number;
}

/** 基线比值 → 目标缩放（clamp 到 [min,max]）。dist 基线为 0 时返回 base
 *  自身（防除零——极端：双指同点落下）。 */
export function pinchScaleFrom(base: PinchBase, dist: number, min: number, max: number): number {
  const ratio = dist / (base.dist || 1);
  return Math.min(max, Math.max(min, base.scale * ratio));
}

/** wheel/步进缩放乘数（AP-7：pdf 1.1 / image 等效因子的单一来源）。 */
export const ZOOM_STEP_FACTOR = 1.1;

/** 值 clamp 到 [min,max]（缩放域公共件）。 */
export function clampScale(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
