/** 技能工具箱控制器（AP-4 拆分件）：preview-pane 内嵌的工具箱域——
 *  两段对话框（list→run）状态机、技能列表拉取、确认后拼消息派发
 *  skill-chat——此前全部内联在 preview-pane（God Object 的独立职责域之一）。
 *  files-view 的工具栏入口是另一份实现（多选路径），不在此控制器范围。
 *
 *  用法：宿主持有 `toolbox = new SkillToolboxController(this)`，
 *  渲染 `toolbox.renderDialogs()`（showModal 时机在 controller 的
 *  hostUpdated 内处理），监听 `toolbox.onRun` 回调接管 skill-chat 派发。 */

import { ReactiveController, ReactiveControllerHost } from "lit";
import { html, nothing } from "lit";
import { fetchSkills, type SkillInfo } from "../api/skills";
import { recordSkillUse } from "../state/recent-skills";
import "../components/skill-toolbox-dialog";
import "../components/skill-run-dialog";

export interface SkillRunPayload {
  skill: SkillInfo;
  /** 拼装完成的消息正文（斜杠技能 + 文件清单 + 补充要求）。 */
  message: string;
  /** 会话标题（技能名 · 首个文件名）。 */
  title: string;
}

export class SkillToolboxController implements ReactiveController {
  private host: ReactiveControllerHost;
  /** 阶段机：null=关 / list=技能清单 / run=运行确认。 */
  private _phase: "list" | "run" | null = null;
  private _skills: SkillInfo[] | null = null;
  private _error: string | null = null;
  private _picked: SkillInfo | null = null;

  /** 确认「开始对话」回调：宿主接管 skill-chat 派发（preview-pane 经事件
   *  上抛 app 层；宿主也可在此清选区等）。 */
  onRun: ((payload: SkillRunPayload) => void) | null = null;

  /** 工具箱入口可用（宿主传入判定：预览路径存在且非 PST 派生路径）。 */
  available = false;
  /** 文件清单（含 :行区间 后缀的路径，由宿主提供）。 */
  filePaths: () => string[] = () => [];

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostUpdated(): void {
    // showModal（top layer，防 PDF portal 遮挡、不受预览栏裁剪）；
    // list↔run 切换时 dialog 节点重建，需重新 showModal。
    if (this._phase) {
      const root = (this.host as unknown as HTMLElement).shadowRoot;
      const dlg = root?.querySelector("dialog") as HTMLDialogElement | null;
      if (dlg && !dlg.open) dlg.showModal();
    }
  }

  /** 是否打开中（宿主可用作入口按钮激活态）。 */
  get open(): boolean {
    return this._phase !== null;
  }

  /** 打开工具箱（拉取技能清单）。 */
  async open_(): Promise<void> {
    if (!this.available) return;
    this._picked = null;
    this._phase = "list";
    this._skills = null;
    this._error = null;
    this.host.requestUpdate();
    try {
      this._skills = await fetchSkills();
    } catch (e) {
      this._error = (e as Error).message || "技能列表加载失败";
    }
    this.host.requestUpdate();
  }

  /** 关闭（Esc/取消/完成后）。 */
  close(): void {
    this._phase = null;
    this.host.requestUpdate();
  }

  private _onPick = (e: CustomEvent<{ skill: SkillInfo }>) => {
    this._picked = e.detail.skill;
    this._phase = "run";
    this.host.requestUpdate();
  };

  /** 确认「开始对话」：拼消息（斜杠技能 + 文件清单 + 补充要求）→ onRun。 */
  private _onRunSubmit = (e: CustomEvent<{ prompt: string }>) => {
    const skill = this._picked;
    this._phase = null;
    if (!skill) {
      this.host.requestUpdate();
      return;
    }
    const paths = this.filePaths();
    const lines = [
      `/${skill.name} 按技能指引处理以下文件`,
      "",
      "文件：",
      ...paths.map((p) => `- ${p}`),
      "",
      `补充要求：${e.detail.prompt || "无"}`,
    ];
    recordSkillUse(skill.name);
    const firstFile = paths[0]?.split("/").pop() ?? paths[0] ?? "";
    this.host.requestUpdate();
    this.onRun?.({
      skill,
      message: lines.join("\n"),
      title: `${skill.name} · ${firstFile}`,
    });
  };

  /** 两段对话框渲染（宿主模板尾部无条件挂载；关闭态渲染 nothing）。 */
  renderDialogs() {
    if (this._phase === "list") {
      return html`<dialog @cancel=${(e: Event) => { e.preventDefault(); this.close(); }}>
        <skill-toolbox-dialog
          .skills=${this._skills}
          .error=${this._error}
          @pick=${this._onPick}
          @cancel=${() => this.close()}
        ></skill-toolbox-dialog>
      </dialog>`;
    }
    if (this._phase === "run" && this._picked) {
      return html`<dialog @cancel=${(e: Event) => { e.preventDefault(); this.close(); }}>
        <skill-run-dialog
          .skill=${this._picked}
          .filePaths=${this.filePaths()}
          @submit=${this._onRunSubmit}
          @cancel=${() => this.close()}
        ></skill-run-dialog>
      </dialog>`;
    }
    return nothing;
  }
}
