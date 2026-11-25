/** chat-view 对话框宿主模板（AP-1 拆分第二步：模板域外迁）。
 *
 * 9 个 `_render*Dialog` 私有渲染器此前内联在 chat-view.ts（God Object 的
 * 「模板域」职责）——它们全是纯函数：入参 = 状态 + 回调，出参 = 模板。
 * 本模块把它们收为具名导出函数，chat-view 只保留状态与回调接线。
 *
 * 约定：每个函数在「不显示」时返回 nothing（调用方无条件放入模板即可）。
 */
import { html, nothing } from "lit";
import "../components/c-dialog";

import type { Session } from "../state/types";
import type { SkillInfo } from "../api/skills";

/** 导入确认框状态（phase=confirm/exists/busy；webview 直传路径无文件字节）。 */
export interface ImportDialogState {
  fileName: string;
  title: string;
  count: number;
  phase: "confirm" | "exists" | "busy";
  data: unknown | null;
  webview: boolean;
}

/** 压缩上下文模态框状态（确认 → 压缩中 → 完成/失败）。 */
export interface CompactDialogState {
  phase: "confirm" | "running" | "done" | "error";
  preTokens: number;
  postTokens: number;
  errorMessage: string;
  compactedText: string;
  auto?: boolean;
}

/** 回退确认框载荷。 */
export interface RewindDialogState {
  seq: number;
  content: string;
  deadCount: number;
  images?: { data: string; media_type: string }[];
}

/** 删轮确认框载荷。 */
export interface DeleteTurnDialogState {
  seq: number;
  content: string;
  turnMessageCount: number;
  submitting: boolean;
  errorMessage: string;
}

/** 会话信息弹窗的用量/压缩汇总（视图侧已算好的口径）。 */
export interface SessionInfoDialogProps {
  sessionId: string;
  used: number | null;
  usedIsEstimate: boolean;
  contextWindow: number;
  cacheReadTotal: number | null;
  inputTotal: number | null;
  calls: number;
  lastCallRead: number | null;
  lastCallUsed: number;
  compactionCount: number;
  lastCompactedAt: string | null;
  lastPreTokens: number | null;
}

/** 技能选择对话框宿主。 */
export function renderSkillDialog(props: {
  open: boolean;
  skills: SkillInfo[] | null;
  error: string | null;
  onPick: (e: CustomEvent<{ skill: SkillInfo }>) => void;
  onCancel: () => void;
}) {
  if (!props.open) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <skill-toolbox-dialog
        .skills=${props.skills}
        .error=${props.error}
        @pick=${props.onPick}
        @cancel=${props.onCancel}
      ></skill-toolbox-dialog>
    </c-dialog>`;
}

/** 员工选择对话框宿主（数字员工，ADR-0062）。 */
export function renderEmployeeDialog(props: {
  open: boolean;
  employees: import("../api/employees").Employee[] | null;
  error: string | null;
  busy: boolean;
  onPick: (e: CustomEvent<{ employee: import("../api/employees").Employee }>) => void;
  onCancel: () => void;
}) {
  if (!props.open) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <employee-picker-dialog
        .employees=${props.employees}
        .error=${props.error}
        .busy=${props.busy}
        @pick=${props.onPick}
        @cancel=${props.onCancel}
      ></employee-picker-dialog>
    </c-dialog>`;
}

/** 会话标题改名对话框宿主。 */
export function renderRenameDialog(props: {
  open: boolean;
  session: Session | null;
  onSubmit: (e: CustomEvent<{ title: string }>) => void;
  onCancel: () => void;
}) {
  if (!props.open || !props.session) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <session-rename-dialog
        .currentTitle=${props.session.title}
        @submit=${props.onSubmit}
        @cancel=${props.onCancel}
      ></session-rename-dialog>
    </c-dialog>`;
}

/** 视觉能力拦截对话框宿主（ADR-0034 L3）。 */
export function renderVisionGateDialog(props: {
  open: boolean;
  modelName: string;
  onGotoSettings: () => void;
  onCancel: () => void;
}) {
  if (!props.open) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <vision-gate-dialog
        .modelName=${props.modelName}
        @goto-settings=${props.onGotoSettings}
        @cancel=${props.onCancel}
      ></vision-gate-dialog>
    </c-dialog>`;
}

/** 兜底切换后下一回合提醒对话框宿主（ADR-0061 补充）。 */
export function renderFallbackReminderDialog(props: {
  open: boolean;
  baseModel: string;
  fallbackModel: string;
  onProceed: () => void;
  onGotoSettings: () => void;
  onCancel: () => void;
}) {
  if (!props.open) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <fallback-reminder-dialog
        .baseModel=${props.baseModel}
        .fallbackModel=${props.fallbackModel}
        @proceed=${props.onProceed}
        @goto-settings=${props.onGotoSettings}
        @cancel=${props.onCancel}
      ></fallback-reminder-dialog>
    </c-dialog>`;
}

/** 插话输入对话框宿主（ADR-0048）。 */
export function renderInterjectDialog(props: {
  open: boolean;
  onSubmit: (e: CustomEvent<{ text: string }>) => void;
  onCancel: () => void;
}) {
  if (!props.open) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <interject-dialog
        @submit=${props.onSubmit}
        @cancel=${props.onCancel}
      ></interject-dialog>
    </c-dialog>`;
}

/** 会话信息对话框宿主（2026-09-17）。 */
export function renderInfoDialog(props: {
  open: boolean;
  info: SessionInfoDialogProps | null;
  onClose: () => void;
  onCopyFailed: () => void;
}) {
  if (!props.open || !props.info) return nothing;
  const i = props.info;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onClose}>
      <session-info-dialog
        .sessionId=${i.sessionId}
        .used=${i.used}
        .usedIsEstimate=${i.usedIsEstimate}
        .contextWindow=${i.contextWindow}
        .cacheReadTotal=${i.cacheReadTotal}
        .inputTotal=${i.inputTotal}
        .calls=${i.calls}
        .lastCallRead=${i.lastCallRead}
        .lastCallUsed=${i.lastCallUsed}
        .compactionCount=${i.compactionCount}
        .lastCompactedAt=${i.lastCompactedAt}
        .lastPreTokens=${i.lastPreTokens}
        @close=${props.onClose}
        @copy-failed=${props.onCopyFailed}
      ></session-info-dialog>
    </c-dialog>`;
}

/** 回退确认框宿主。 */
export function renderRewindDialog(props: {
  state: RewindDialogState | null;
  sessionId: string | null;
  onConfirm: (e: CustomEvent<{ pointSeq: number; restoreFiles: boolean }>) => void;
  onCancel: () => void;
}) {
  const d = props.state;
  if (!d || !props.sessionId) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <rewind-dialog
        .sessionId=${props.sessionId}
        .pointSeq=${d.seq}
        .anchorContent=${d.content}
        .deadCount=${d.deadCount}
        @rewind-confirm=${props.onConfirm}
        @cancel=${props.onCancel}
      ></rewind-dialog>
    </c-dialog>`;
}

/** 删轮确认框宿主。 */
export function renderDeleteTurnDialog(props: {
  state: DeleteTurnDialogState | null;
  onConfirm: (e: CustomEvent<{ pointSeq: number }>) => void;
  onCancel: () => void;
}) {
  const d = props.state;
  if (!d) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${(e: Event) => {
      if (d.submitting) e.preventDefault();
      else props.onCancel();
    }}>
      <turn-delete-dialog
        .pointSeq=${d.seq}
        .anchorContent=${d.content}
        .turnMessageCount=${d.turnMessageCount}
        .submitting=${d.submitting}
        .errorMessage=${d.errorMessage}
        @turn-delete-confirm=${props.onConfirm}
        @cancel=${props.onCancel}>
      </turn-delete-dialog>
    </c-dialog>`;
}

/** 压缩上下文模态框宿主（running 态拦截 ESC，模态锁定页面）。 */
export function renderCompactDialog(props: {
  state: CompactDialogState | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const d = props.state;
  if (!d) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${(e: Event) => {
      if (d.phase === "running") e.preventDefault();
      else props.onCancel();
    }}>
      <compact-confirm-dialog
        .phase=${d.phase}
        .preTokens=${d.preTokens}
        .postTokens=${d.postTokens}
        .errorMessage=${d.errorMessage}
        .compactedText=${d.compactedText}
        @compact-confirm=${props.onConfirm}
        @cancel=${props.onCancel}
      ></compact-confirm-dialog>
    </c-dialog>`;
}

/** 孪生复制确认框宿主（2026-10-10）。 */
export function renderForkDialog(props: {
  session: Session | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const s = props.session;
  if (!s) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${props.onCancel}>
      <fork-confirm-dialog
        .sessionTitle=${s.title}
        @fork-confirm=${props.onConfirm}
        @cancel=${props.onCancel}
      ></fork-confirm-dialog>
    </c-dialog>`;
}

/** 导入确认框宿主（2026-10-29 取代 window.confirm）。 */
export function renderImportDialog(props: {
  state: ImportDialogState | null;
  onConfirm: (e: CustomEvent<{ asCopy: boolean }>) => void;
  onCancel: () => void;
}) {
  const d = props.state;
  if (!d) return nothing;
  return html`
    <c-dialog ?open=${true} @cancel=${(e: Event) => {
      if (d.phase === "busy") e.preventDefault();
      else props.onCancel();
    }}>
      <import-confirm-dialog
        .fileName=${d.fileName}
        .sessionTitle=${d.title}
        .itemCount=${d.count}
        .phase=${d.phase}
        ?webview=${d.webview}
        @import-confirm=${props.onConfirm}
        @cancel=${props.onCancel}
      ></import-confirm-dialog>
    </c-dialog>`;
}
