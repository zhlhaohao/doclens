/** 探测动作状态机（AP-23 拆分件）：model-presets-section 的三兄弟探测
 *  （max_tokens 二分 / vision 行为学 / translate 连通）此前各自复制
 *  「busy 标志 + 前置校验 + try/catch(_formError)/finally 复位」样板。
 *  本类把样板收敛为一个泛型动作包装器；表单校验/回填/文案仍由宿主提供
 *  （各探测的本质差异），状态（busy/msg/error 落点）由本类管理。 */

import { ReactiveController, ReactiveControllerHost } from "lit";

export class ProbeController implements ReactiveController {
  private host: ReactiveControllerHost;

  /** 各探测动作的独立 busy 态（键 = 动作名，如 "max" / "vision" / "translate"）。 */
  private _busy = new Set<string>();
  /** 各探测动作的成功提示（null = 无）。 */
  private _msgs = new Map<string, string>();
  /** 错误落点：宿主回调（通常写 _formError）。 */
  onError: ((msg: string) => void) | null = null;
  /** 错误文案转换（复用宿主 _errMsg）。 */
  toErrMsg: ((e: unknown) => string) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  isBusy(key: string): boolean {
    return this._busy.has(key);
  }

  msg(key: string): string | null {
    return this._msgs.get(key) ?? null;
  }

  /** 包装一次探测动作：busy 置位/清零 + 错误经 onError；成功文案由
   *  action 返回（null = 不显示）。前置校验失败（action 返回 undefined
   *  之前抛 ProbeAbort）不置 busy。 */
  async run(key: string, action: () => Promise<string | null>): Promise<void> {
    this._busy.add(key);
    this._msgs.delete(key);
    this.host.requestUpdate();
    try {
      const msg = await action();
      if (msg !== null) this._msgs.set(key, msg);
    } catch (e) {
      if (e instanceof ProbeAbort) {
        this.onError?.(e.message);
        return;
      }
      this.onError?.(this.toErrMsg ? this.toErrMsg(e) : String(e));
    } finally {
      this._busy.delete(key);
      this.host.requestUpdate();
    }
  }

  hostUpdated?(): void {}
}

/** 前置校验失败（不置 busy、文案直接给 onError）。 */
export class ProbeAbort extends Error {}
