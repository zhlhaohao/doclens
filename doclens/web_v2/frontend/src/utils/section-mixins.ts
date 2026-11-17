/** 设置页 section 公共样板（AP-22）：_setFlash/_errMsg/_toast/_toastTimer 此前
 *  在 model-presets/mcp-servers/skills/search-presets 四个 section 逐字复制
 *  （含 3000ms 硬编码与 disconnectedCallback 清理）。归一为 mixin——
 *  Lit 官方推荐的类式 mixin 形态（构造器签名保持 LitElement 兼容）。 */

import { LitElement } from "lit";
import { state } from "lit/decorators.js";

/** toast 闪示时长（ms），四 section 原各自硬编码同值。 */
const FLASH_MS = 3000;

type Constructor<T = {}> = new (...args: any[]) => T;

/** toast 闪示 + 卸载清理。宿主模板消费 `this._toast` 渲染提示条。 */
export function ToastFlashMixin<Base extends Constructor<LitElement>>(base: Base) {
  class WithToastFlash extends base {
    @state() protected _toast: string | null = null;
    protected _toastTimer: number | undefined;

    /** 置闪示消息（3s 后自动清除；新消息重置计时）。 */
    protected _setFlash(msg: string): void {
      this._toast = msg;
      if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
      this._toastTimer = window.setTimeout(() => {
        this._toast = null;
        this._toastTimer = undefined;
      }, FLASH_MS);
    }

    disconnectedCallback(): void {
      if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
      this._toastTimer = undefined;
      super.disconnectedCallback();
    }
  }
  return WithToastFlash;
}

/** API 错误 → 用户可读文案（四 section 的 _errMsg 同构；ApiError 形状
 *  由参数注入——各 api 模块的 Error 类不同名但同构 {status, body.detail}）。 */
export function apiErrMsg(e: unknown, errCtor: new (...args: any[]) => { status: number; body: unknown }): string {
  if (e instanceof errCtor) {
    const body = e.body as { detail?: string } | null;
    return body?.detail ?? `HTTP ${e.status}`;
  }
  return (e as Error).message;
}
