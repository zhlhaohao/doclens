/** 设备能力检测工具。 */

/** 粗指针（触屏）设备检测：登录页据此渲染自绘数字键盘（不弹系统键盘）。
 *
 * 与 settings-view 的 1023px 视口断点语义不同：这里判定的是「设备类型」
 * 而非「屏幕宽度」——触屏笔记本算桌面（pointer: fine），iPad 算移动。
 * matchMedia 不可用（老浏览器/测试环境）时降级为 false（桌面分支）。
 */
export function isCoarsePointer(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}
