/** 对话员工域（数字员工，ADR-0062）：chat-view 的员工候选菜单与派活。
 *
 * 与 ChatSkillsController 同构但行为相反：技能是「发往当前会话」，员工是
 * 「新建会话派活」。只在 initial 态（无当前会话）提供入口——由宿主决定
 * 是否把 recentItems 传给 input-box（focus 态传 null 即隐藏员工段）。
 *
 * 派活 = POST /employees/{id}/dispatch → 跳转到返回的会话。
 */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import {
  dispatchEmployee,
  listEmployees,
  type DispatchResult,
  type Employee,
} from "../api/employees";
import {
  getRecentEmployeeIds,
  recordEmployeeUse,
  RECENT_EMPLOYEES_MENU_CAP,
} from "../state/recent-employees";

export interface ChatEmployeesOptions {
  /** 派活成功后跳转到该会话（宿主：setPendingSession + navigate chat）。 */
  onDispatched: (res: DispatchResult, employee: Employee) => void | Promise<void>;
  /** 派活失败提示。 */
  onError: (message: string) => void;
  /** 派活前清空输入框草稿。 */
  clearDraft: () => void;
}

export class ChatEmployeesController implements ReactiveController {
  /** 员工候选 = 全部员工（含预设缺失者，对话框内标红不可选）；null = 未加载。 */
  employees: Employee[] | null = null;
  error: string | null = null;
  dialogOpen = false;
  dispatching = false;

  private host: ReactiveControllerHost;
  private opts: ChatEmployeesOptions;

  constructor(host: ReactiveControllerHost, opts: ChatEmployeesOptions) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  hostConnected() {}
  hostDisconnected() {}

  private _touch(): void {
    this.host.requestUpdate();
  }

  async load(): Promise<void> {
    try {
      this.employees = await listEmployees();
      this.error = null;
    } catch (e) {
      this.error = (e as Error)?.message || "员工列表加载失败";
    }
    this._touch();
  }

  /** 传给 input-box 的最近员工：与候选求交取前 3；无候选 → null（隐藏员工段）。 */
  get recentItems(): { name: string; id: string; disabled?: boolean }[] | null {
    const cands = this.employees;
    if (cands === null) return []; // 未加载：菜单可开，暂只显示「选择员工…」
    if (cands.length === 0) return null;
    const byId = new Map(cands.map((c) => [c.id, c]));
    return getRecentEmployeeIds()
      .filter((id) => byId.has(id))
      .slice(0, RECENT_EMPLOYEES_MENU_CAP)
      .map((id) => {
        const c = byId.get(id)!;
        return { name: c.name, id, disabled: c.model_missing || c.review_model_missing };
      });
  }

  get hasAny(): boolean {
    return (this.employees?.length ?? 0) > 0;
  }

  onMenuOpen(): void {
    void this.load();
  }

  openDialog(): void {
    this.dialogOpen = true;
    this._touch();
    void this.load();
  }

  cancelDialog(): void {
    this.dialogOpen = false;
    this._touch();
  }

  /** 对话框/菜单选中员工 → 派活。 */
  async pick(employee: Employee, task: string): Promise<void> {
    this.dialogOpen = false;
    this._touch();
    const t = task.trim();
    if (!t) {
      this.opts.onError("请先输入一句话任务，再选择员工");
      return;
    }
    if (employee.model_missing || employee.review_model_missing) {
      this.opts.onError(`员工「${employee.name}」的模型预设缺失，请先在设置里改配`);
      return;
    }
    this.dispatching = true;
    this._touch();
    try {
      const res = await dispatchEmployee(employee.id, t);
      recordEmployeeUse(employee.id);
      this.opts.clearDraft();
      await this.opts.onDispatched(res, employee);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      this.opts.onError(err?.message || "派活失败");
    } finally {
      this.dispatching = false;
      this._touch();
    }
  }
}
