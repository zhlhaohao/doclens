/** 剪贴板写入单一入口（AP-5）。
 *
 *  此前 `navigator.clipboard.writeText` 在 9 处各写一份，且：
 *  - 降级配方（非安全上下文/权限被拒时用隐藏 textarea + execCommand）
 *    只在 chat-tool-trace / compact-confirm-dialog 两处实现——其余 7 处
 *    在 HTTP 非 localhost 或 WebView 下直接失败；
 *  - md-viewer 两处 `.catch(() => {})` 静默吞错（点复制无任何反馈）；
 *  - 「已复制」反馈时长 1500ms ×5 与 2000ms ×2 两派分裂；
 *  - session-info-dialog / compact-confirm-dialog / md-viewer(1544) 的
 *    复位 setTimeout 无句柄、无 disconnectedCallback 清理。
 *
 *  归一：copyText() 单一入口（clipboard API → execCommand 降级 → false）；
 *  COPY_FEEDBACK_MS 常量；flashCopied() 承载「置位 + 定时复位 + 句柄化 +
 *  宿主卸载清理」全套（组件把 disconnectedCallback 委托给它）。
 */

/** 「已复制」反馈时长（ms）——全仓唯一口径（原 1500/2000 两派）。 */
export const COPY_FEEDBACK_MS = 1500;

/** 写入剪贴板：优先 navigator.clipboard，不可用时降级隐藏 textarea +
 *  execCommand（AP-5 前仅 2/9 站点有此降级）。全失败返回 false。
 *
 *  降级配方收自 chat-tool-trace / compact-confirm-dialog 的逐字重复实现。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err2) {
      console.warn("copy failed:", err2);
      return false;
    }
  }
}

/** 「已复制」瞬时反馈的状态机：置 true → COPY_FEEDBACK_MS 后复位。
 *  定时器句柄化；组件在 disconnectedCallback 里调 disposeCopiedFlash()
 *  清理（此前 3 处无清理）。
 *
 *  用法：
 *    private _copiedCtrl = createCopiedFlash(() => { this._copied = false; });
 *    // 成功后：this._copied = true; this._copiedCtrl.flash();
 *    // 卸载：this._copiedCtrl.dispose();（在 disconnectedCallback 内）
 */
export function createCopiedFlash(reset: () => void) {
  let timer: number | undefined;
  return {
    /** 置位反馈并安排复位（新反馈重置计时）。 */
    flash(): void {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        reset();
      }, COPY_FEEDBACK_MS);
    },
    /** 卸载清理（clearTimeout 幂等，未安排时为空操作）。 */
    dispose(): void {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    },
  };
}
