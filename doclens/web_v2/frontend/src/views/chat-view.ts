import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import { loadSessionMemory } from "../utils/session-memory";
import type { Session, ChatMessage, ToolStep, PendingAsk } from "../state/types";
import { chatStream, stopChat, interject } from "../api/chat";
import type { ChatStreamEvent } from "../api/chat";
import { validateAskQuestions } from "../api/ask";
import "../components/ask-card";
import { createSession, listSessions, clearSessions, renameSession, starSession, rewindSession, fetchSessionDetail, compactSession, exportSession, sessionExportUrl, sessionExportFileName, importSession, sessionImportUploadUrl, duplicateSession } from "../api/sessions";
import { router } from "../router/router";
import { PreviewController } from "../utils/preview-controller";
import { isPstFilePath, isPstEmailPath } from "../api/pst";
import { downloadFromUrl } from "../utils/download";
import { jsbridgeDownloadAvailable, jsbridgeUploadAvailable, pickAndUploadFiles } from "../utils/jsbridge";
import { listSkillsManage } from "../api/skills";
import type { SkillInfo } from "../api/skills";
import { getRecentSkillNames, recordSkillUse, RECENT_SKILLS_MENU_CAP } from "../state/recent-skills";
import { buildChatTimeline, mergeTimeline } from "./chat-timeline";
import type { RewindDivider } from "./chat-timeline";
import type { ChatStream } from "../components/chat-stream";
// 向后兼容再导出：mapSessionItemsToMessages 已迁至 chat-timeline（纯函数模块）
export { mapSessionItemsToMessages } from "./chat-timeline";
import "../components/skill-toolbox-dialog";
import "../components/session-rename-dialog";
import "../components/fork-confirm-dialog";
import "../components/session-info-dialog";
import "../components/rewind-dialog";
import "../components/compact-confirm-dialog";
import "../components/pst-email-list";
import "../components/preview-pane";
import "../components/toast-stack";
import type { ToastStack } from "../components/toast-stack";

/** 斜杠技能调用的提交校验结果（checkSlashSubmit）：
 *  non-slash = 普通消息直接发送；ok = 合法斜杠调用（记录最近技能后发送）；
 *  unknown = 未知技能名，阻断发送并提示（后端对漏网斜杠按普通文本处理）。 */
export type SlashCheck =
  | { type: "non-slash" }
  | { type: "ok"; name: string }
  | { type: "unknown"; name: string };

/** 提交校验：首字符 / 即技能模式，技能名 = 首个空白前的片段；
 *  合法集合 = 对话技能候选（启用 ∧ 未删除 ∧ 用户可调用，与引导菜单同源）。 */
export function checkSlashSubmit(
  message: string,
  candidates: { name: string }[] | null,
): SlashCheck {
  if (!message.startsWith("/")) return { type: "non-slash" };
  const name = message.slice(1).split(/\s/, 1)[0];
  if ((candidates ?? []).some((c) => c.name === name)) return { type: "ok", name };
  return { type: "unknown", name };
}

/** 流事件归属判定（导出供单测）：本次流只许写回发起它的会话。
 *  用户中途切到别的对话/回欢迎页后，事件静默丢弃——否则别的对话会实时
 *  冒出本轮的思考步骤与工具卡片（「另一个页面同步收到实时消息」）。 */
export function streamOwnedBy(
  chat: { state: string; currentSession: { id: string } | null },
  sessionId: string,
): boolean {
  return chat.state === "focus" && chat.currentSession?.id === sessionId;
}

/** 将一个流式事件不可变地应用到 messages，返回新数组；非 assistant 末条则原样返回。 */
export function applyStreamEvent(messages: ChatMessage[], ev: ChatStreamEvent): ChatMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return messages;
  const head = messages.slice(0, -1);

  if (ev.type === "token") {
    return [...head, { ...last, content: last.content + ev.text }];
  }
  if (ev.type === "thinking") {
    // 正文已开始即不再累积（前端「正文首 token 撤思考」同一语义的写入侧）
    if (last.content !== "") return messages;
    return [...head, { ...last, thinking: (last.thinking ?? "") + ev.delta }];
  }
  if (ev.type === "tool_call") {
    const step: ToolStep = { tool_use_id: ev.tool_use_id, name: ev.name, input: ev.input, status: "running" };
    return [...head, { ...last, tool_steps: [...(last.tool_steps ?? []), step] }];
  }
  if (ev.type === "tool_result") {
    const tool_steps = (last.tool_steps ?? []).map((s) =>
      s.tool_use_id === ev.tool_use_id
        ? { ...s, output: ev.output, is_error: ev.is_error, duration_ms: ev.duration_ms,
            status: (ev.is_error ? "error" : "done") as ToolStep["status"] }
        : s
    );
    return [...head, { ...last, tool_steps }];
  }
  if (ev.type === "references") {
    return [...head, { ...last, references: ev.items }];
  }
  return messages;
}

/** 流式中断（连接断开 / 异常）时调用：把残留 running 步骤标记为 error（output「（已中断）」）。
 *  无 running 步骤则原样返回同一引用。 */
export function finalizeInterruptedMessages(messages: ChatMessage[]): ChatMessage[] {
  const hasRunning = messages.some(
    (m) => m.role === "assistant" && (m.tool_steps ?? []).some((s) => s.status === "running"),
  );
  if (!hasRunning) return messages;
  return messages.map((m) => {
    if (m.role !== "assistant" || !m.tool_steps) return m;
    return {
      ...m,
      tool_steps: m.tool_steps.map((s) =>
        s.status === "running"
          ? { ...s, status: "error" as const, is_error: true, output: s.output ?? "（已中断）" }
          : s,
      ),
    };
  });
}

/** 会话 usage 状态：占用口径（最近一次调用）+ 命中率口径（全会话累计）。 */
export interface SessionUsageState {
  /** 最近一次调用的总输入 = input + cache_read + cache_creation（上下文峰值占用） */
  used: number;
  contextWindow: number;
  /** 全会话累计 cache_read tokens（命中率分子） */
  cacheReadTotal: number;
  /** 全会话累计总输入 tokens（命中率分母） */
  inputTotal: number;
  /** 全会话 LLM 调用次数 */
  calls: number;
  /** 最后一条 usage 条目的 seq（压缩晚于此值 → 占用显示压缩后估算） */
  lastSeq: number;
}

/** 单条 usage 样本（SSE 事件或落库条目解析后的四字段）。 */
interface UsageSample {
  input: number;
  read: number;
  creation: number;
  contextWindow: number;
  /** 条目 seq（SSE 实时事件无 seq，用 MAX_SAFE_INTEGER 表「晚于一切落库条目」） */
  seq: number;
}

/** 把一条 usage 样本不可变地并入聚合状态——SSE 实时事件与恢复态
 *  items 聚合共用同一口径（used 取末条 / cache_read·总输入·次数累计），
 *  漏改一处则「流式期间」与「刷新后」显示分叉。 */
export function applyUsageEvent(
  prev: SessionUsageState | null,
  sample: UsageSample,
): SessionUsageState {
  const used = sample.input + sample.read + sample.creation;
  return prev === null
    ? {
        used,
        contextWindow: sample.contextWindow,
        cacheReadTotal: sample.read,
        inputTotal: used,
        calls: 1,
        lastSeq: sample.seq,
      }
    : {
        ...prev,
        used,
        cacheReadTotal: prev.cacheReadTotal + sample.read,
        inputTotal: prev.inputTotal + used,
        calls: prev.calls + 1,
        lastSeq: Math.max(prev.lastSeq, sample.seq),
      };
}

/** 从 session_items 聚合全部 kind="usage" 条目（会话信息弹窗）：
 *  used 取最后一条（上下文占用），cache_read/总输入/调用次数全程累加
 *  （累计缓存命中率，2026-09-17 与 LLM trace 落盘同期加）；
 *  单条坏 JSON 跳过，不影响其余聚合。 */
export function aggregateUsage(
  items: Array<{ kind: string; payload: string; seq?: number }>,
): SessionUsageState | null {
  let state: SessionUsageState | null = null;
  for (const item of items) {
    if (item.kind !== "usage") continue;
    let p: Record<string, unknown>;
    try {
      p = JSON.parse(item.payload) as Record<string, unknown>;
    } catch {
      continue;
    }
    state = applyUsageEvent(state, {
      input: Number(p.input_tokens ?? 0),
      read: Number(p.cache_read_input_tokens ?? 0),
      creation: Number(p.cache_creation_input_tokens ?? 0),
      contextWindow: Number(p.context_window ?? 0),
      seq: Number(item.seq ?? -1),
    });
  }
  return state;
}

/** 会话信息弹窗分母优先实时窗口：detail 携带当前 runtime 配置值（与压缩
 *  决策同源）时覆盖 usage 历史快照——配置热更后旧会话显示不再停滞旧窗口；
 *  live ≤ 0（agent 未装配）或无 usage 数据时保持原值。 */
export function applyLiveWindow(
  usage: SessionUsageState | null,
  liveWindow: number,
): SessionUsageState | null {
  if (usage === null || !(liveWindow > 0)) return usage;
  return { ...usage, contextWindow: liveWindow };
}

/** 会话压缩信息（会话信息弹窗，ADR-0026）： */
export interface SessionCompactionState {
  /** 全会话压缩次数（kind="compacted" 条目数） */
  count: number;
  /** 最近一次压缩时间（条目 created_at，ISO 字符串；旧后端无此字段为 null） */
  lastAt: string | null;
  /** 最近一次压缩前的估算 tokens */
  lastPreTokens: number;
  /** 最近一次压缩后的消息负载估算 tokens（不含 system prompt/工具表） */
  lastPostTokens: number;
  /** 最后一条 compacted 条目的 seq（晚于 usage.lastSeq → 占用显示估算） */
  lastSeq: number;
}

/** 从 session_items 聚合全部 kind="compacted" 条目（会话信息弹窗）：
 *  计数 + 最后一条（按 seq 序遍历取最后，含 created_at / pre_tokens /
 *  post_tokens / seq）；单条坏 JSON 计数但跳过元数据读取；无条目返回 null。 */
export function aggregateCompaction(
  items: Array<{ kind: string; payload: string; created_at?: string | null; seq?: number }>,
): SessionCompactionState | null {
  let count = 0;
  let lastAt: string | null = null;
  let lastPreTokens = 0;
  let lastPostTokens = 0;
  let lastSeq = -1;
  for (const item of items) {
    if (item.kind !== "compacted") continue;
    count += 1;
    try {
      const p = JSON.parse(item.payload) as Record<string, unknown>;
      lastPreTokens = Number(p.pre_tokens ?? 0);
      lastPostTokens = Number(p.post_tokens ?? 0);
    } catch {
      // 坏 JSON 仍计数，元数据沿用上一条
    }
    lastAt = item.created_at ?? lastAt;
    lastSeq = Math.max(lastSeq, Number(item.seq ?? -1));
  }
  if (count === 0) return null;
  return { count, lastAt, lastPreTokens, lastPostTokens, lastSeq };
}

@customElement("chat-view")
export class ChatView extends LitElement {
  static readonly PREVIEW_PANE_WIDTH_KEY = "cortex.chatPreviewWidth";
  static readonly PREVIEW_PANE_WIDTH_DEFAULT = 420;
  static readonly PREVIEW_PANE_WIDTH_MIN = 300;
  static readonly PREVIEW_PANE_WIDTH_MAX = 900;

  static styles = css`
    /* 视觉能力拦截对话框（ADR-0034） */
    .vision-gate { max-width: 360px; padding: 4px; }
    .vision-gate h3 { margin: 0 0 8px; font-size: 16px; }
    .vision-gate p { margin: 0 0 8px; color: var(--cortex-text-muted); font-size: 14px; line-height: 1.5; }
    .vision-gate .vision-gate-hint { color: var(--cortex-text-subtle); font-size: 13px; }
    .vision-gate-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .vision-gate-actions button {
      border: none; border-radius: var(--cortex-radius-pill, 100px);
      padding: 8px 18px; font-size: 14px; cursor: pointer;
    }
    .vision-gate-actions .secondary { background: transparent; color: var(--cortex-text-muted); border: 1px solid var(--cortex-border); }
    .vision-gate-actions .primary { background: var(--cortex-primary); color: var(--cortex-on-primary); }
    /* 插话输入框（ADR-0048）：与 vision-gate 同规格的小 dialog */
    .interject-dialog { max-width: 380px; padding: 4px; display: block; }
    .interject-dialog h3 { margin: 0 0 8px; font-size: 16px; }
    .interject-dialog .interject-hint {
      margin: 0 0 10px; color: var(--cortex-text-subtle); font-size: 13px; line-height: 1.5;
    }
    .interject-dialog textarea {
      width: 100%; box-sizing: border-box; resize: vertical;
      border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-md);
      padding: 8px 10px; font-size: 14px; font-family: var(--cortex-font);
      background: var(--cortex-surface); color: var(--cortex-text);
    }
    .interject-dialog textarea:focus-visible { outline: 2px solid var(--cortex-primary); outline-offset: -1px; }
    .interject-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .interject-actions button {
      border: none; border-radius: var(--cortex-radius-pill, 100px);
      padding: 8px 18px; font-size: 14px; cursor: pointer;
    }
    .interject-actions .secondary { background: transparent; color: var(--cortex-text-muted); border: 1px solid var(--cortex-border); }
    .interject-actions .primary { background: var(--cortex-primary); color: var(--cortex-on-primary); }
    .interject-actions .primary:disabled { opacity: 0.5; cursor: not-allowed; }
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-view-bg);
      /* shadow 内不受全局 border-box reset 影响，须显式声明：
         content-box 下 .input-bar 的 max-width:token 不含 padding(48px)，
         输入框比 initial 态 .input-row 里的宽 48px，两态切换时跳动 */
      box-sizing: border-box;
    }
    *, *::before, *::after { box-sizing: border-box; }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      /* 顶部蓝色光晕：让白色卡片从背景中浮出，增加层次感 */
      background:
        radial-gradient(720px 280px at 50% -80px, color-mix(in srgb, var(--cortex-primary) 8%, transparent), transparent 70%);
    }
    .input-row {
      /* 底部留白与搜索页 .input-row 一致（space-4=16px），保证两页输入框距底边等高 */
      padding: 6px var(--cortex-space-6) var(--cortex-space-4);
      flex-shrink: 0;
    }
    /* 输入框对齐日记记录页的紧凑尺寸（默认 ≈48px/11px 偏大） */
    .text-input {
      --min-h: calc(var(--cortex-fs-md) * 1.5 + 14px);   /* ≈36px，随字号缩放 */
      --cortex-input-pad-y: 6px;
    }
    .focus-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-bar {
      /* 底部留白与搜索页输入框一致（space-4=16px），顶部保持 space-3 */
      padding: var(--cortex-space-3) var(--cortex-space-6) var(--cortex-space-4);
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
      background: var(--cortex-view-bg);
    }
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }
    /* 悬置卡（ask-card）可收缩内滚后，多问堆叠时会把消息区压到 0——
       留最小保底，答题期间仍可见最后一两条消息上下文。row 布局
       （桌面有预览）下列高本就 stretch，此规则无实际影响。 */
    .focus-main chat-stream {
      min-height: 96px;
    }
    /* 桌面 preview 关闭：chat-stream 与 ask-card 同步居中限宽（卡片不超消息区） */
    @media (min-width: 1024px) {
      .focus-main:not(.has-preview) chat-stream,
      .focus-main:not(.has-preview) ask-card {
        max-width: var(--content-max-width, 1080px);
        margin: 0 auto;
        width: 100%;
      }
    }
    /* 桌面 preview 打开：水平排布，chat-stream 让位 */
    @media (min-width: 1024px) {
      .focus-main.has-preview {
        flex-direction: row;
        padding: var(--cortex-space-3);
      }
      .focus-main.has-preview chat-stream,
      .focus-main.has-preview ask-card {
        flex: 1 1 0;
        min-width: 0;
        max-width: none;
      }
    }
    .focus-main .splitter {
      flex: 0 0 4px;
      cursor: col-resize;
      background: var(--cortex-border-muted);
      transition: background 0.15s;
    }
    .focus-main .splitter:hover,
    .focus-main .splitter:active {
      background: var(--cortex-primary);
    }
    .focus-main .preview-pane-wrap {
      flex: 0 1 var(--preview-pane-width, 420px);
      min-width: 180px;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      position: relative;
      background: var(--cortex-card-bg);
      border-radius: var(--cortex-radius-lg);
      border: 1px solid var(--cortex-border-muted);
    }
    .focus-main .preview-close {
      position: absolute;
      top: 6px;
      right: 8px;
      z-index: 2;
      width: 26px;
      height: 26px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .focus-main .preview-close:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .focus-main .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-md);
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-6);
      margin: var(--cortex-space-3);
      text-align: center;
    }
    /* 移动端：桌面 splitter / preview-pane-wrap 隐藏 */
    @media (max-width: 1023px) {
      .focus-main .splitter,
      .focus-main .preview-pane-wrap,
      .focus-main .desktop-only {
        display: none;
      }
      /* 输入框贴近屏幕左右（原 space-6=24px 留白偏宽）；
         initial 态 .input-row 与 focus 态 .input-bar 同步收紧，保证两态等宽 */
      .input-row,
      .input-bar { padding-left: var(--cortex-space-2); padding-right: var(--cortex-space-2); }
      /* 移动端对话框占满屏幕宽度，与 files-view 决议一致 */
      dialog {
        width: 100vw;
        max-width: 100vw;
        max-height: calc(100vh - 16px);
        border-radius: var(--cortex-radius-md);
      }
      dialog > * { padding: var(--cortex-space-4); }
    }
    /* 技能选择对话框宿主 chrome（Meta 平铺浮层：hairline 边框 + 24px 圆角 + level-2 阴影），
       与 files-view/diary-view 的 dialog 规格一致；此前无样式，吃的是浏览器默认外观 */
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      box-sizing: border-box;
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      max-width: 90vw;
    }
    dialog::backdrop { background: rgba(0, 0, 0, 0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
    /* 移动端预览 overlay。**不得设 z-index**（2026-09-29 修复：对话页
       参考资料 PDF 在移动浏览器灰屏的真根因）——z-index 会创建层叠
       上下文，把 document.body 下 z-index:1 的 pdf-viewer portal 整个
       压在下面（canvas 画好但被挡死）。去掉后：overlay（absolute 定位）
       仍画在静态消息流之上（背景遮罩语义不变），而 portal（定位 + z:1）
       反超 overlay（z:auto）显露 canvas；toc-drawer（z:30）等内部浮层
       在根上下文直接比较，仍正确盖住 canvas。 */
    .preview-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-card-bg);
      display: flex;
      flex-direction: column;
    }
    /* 移动端预览打开时隐藏对话顶栏：focus-header 因 backdrop-filter 需
       z-index:10，会浮在 z:auto 的 preview-overlay 之上（预览界面露出
       顶栏的「新会话」返回钮——点了回 initial 而非关闭预览，2026-09-29
       修复）。预览层的返回由 preview-pane 自带 mobile-header 承担。 */
    @media (max-width: 1023px) {
      .focus-body.has-preview > focus-header {
        display: none;
      }
    }
    @media (min-width: 1024px) {
      .preview-overlay {
        display: none;
      }
    }
    @media (min-width: 1024px) {
      /* 桌面端：居中列布局，避免全宽拉伸。initial 与 focus 两态共用同一
         列宽（--content-max-width），保证发送首条消息切换状态时输入框不跳动 */
      .initial-stack {
        max-width: var(--content-max-width, 1080px);
        margin: 0 auto;
        width: 100%;
      }
      .input-bar {
        max-width: var(--content-max-width, 1080px);
        margin: 0 auto;
        width: 100%;
      }
    }
  `;

  @state() private draft = "";
  /** 待回填输入框的图片附件（ADR-0034）：重问/回退锚点带的图，经绑定
   *  .images 传给 input-box 暂存区；用户手动增删后以组件内状态为准。 */
  @state() private _pendingImages: { data: string; media_type: string }[] = [];
  /** 视觉能力拦截对话框（ADR-0034 L3）：当前模型不支持视觉时弹出，引导
   *  跳设置页切换；拦截的消息/图保留在草稿与暂存区。 */
  @state() private _visionGateOpen = false;
  /** 当前渲染的 ask 卡片载荷（交互态→摘要态由卡片内部管理；
   *  与 store.pendingAsk 分离：提交后输入恢复但摘要保留至流结束） */
  @state() private _activeAsk: PendingAsk | null = null;
  @state() private historySessions: Session[] = [];
  /** 会话列表高亮 id：重启恢复的「上次会话」（纯展示，不拉消息流）；
   *  进入会话后跟随真实 id，返回 initial 清空。 */
  @state() private _highlightSessionId: string | null = null;
  @state() private _clearing = false;
  /** WebView 原生导入进行中（防重复拉起选择器）。 */
  private _importing = false;
  @state() private previewOpen = false;
  /** 预览状态机（P1-2 收敛，同 search 策略：只回填 content+tokens）。 */
  private _preview = new PreviewController(this, {
    getPane: () => this.shadowRoot?.querySelector("preview-pane") ?? null,
  });
  private get previewContent() { return this._preview.content; }
  private get previewPath() { return this._preview.path; }
  private get previewLanguage() { return this._preview.language; }
  private get previewWritable() { return this._preview.writable; }
  private get previewError() { return this._preview.notIndexed ? "NOT_INDEXED" as const : null; }
  private get previewPages() { return this._preview.pages; }
  private get previewPageStarts() { return this._preview.pageStarts; }
  private get previewTokens() { return this._preview.tokens; }
  private get previewAttachments() { return this._preview.attachments; }
  /** 文件字节数（ADR-0046 编辑阈值判定用）。 */
  private get previewSizeBytes() { return this._preview.sizeBytes; }
  @state() private _previewPaneWidth = ChatView.PREVIEW_PANE_WIDTH_DEFAULT;
  /** 对话技能候选（ADR-0016 §1：全部启用技能）；null = 未加载/加载中 */
  @state() private _skillCandidates: SkillInfo[] | null = null;
  @state() private _skillCandidatesError: string | null = null;
  /** 技能选择对话框开关（caret 菜单「选择技能…」触发） */
  @state() private _skillDialogOpen = false;
  @state() private _renameDialogOpen = false; // 会话标题改名对话框（focus-header more 菜单）
  /** 孪生复制确认框待复制的源会话（null = 关闭）；确认后执行复制。 */
  @state() private _forkDialogSession: Session | null = null;
  @state() private _infoDialogOpen = false;   // 会话信息对话框（more 菜单，2026-09-17）
  /** 压缩上下文模态框（more 菜单「压缩上下文」）：单框三态——确认 →
   *  压缩中（模态 spinner，禁止操作页面）→ 完成/失败（框内展示效果）。
   *  null = 关闭。 */
  @state() private _compactDialog: {
    phase: "confirm" | "running" | "done" | "error";
    preTokens: number;
    postTokens: number;
    errorMessage: string;
    /** 压缩产物可读转录（done 态 copy 按钮拷贝供人审核，2026-10-10） */
    compactedText: string;
    /** auto = 回合末自动压缩（SSE compact 事件驱动，ADR-0044）；
     *  手动入口（confirm 态）为 undefined。 */
    auto?: boolean;
  } | null = null;
  /** 手动压缩进行中（防重复触发；LLM 摘要调用可达数十秒） */
  private _compacting = false;
  /** 当前会话 usage（占用口径 = 最近一次调用总输入；命中率口径 = 全会话累计）；
   *  SSE usage 事件逐条累加，恢复会话时从 items 的 kind="usage" 条目聚合。 */
  @state() private _sessionUsage: SessionUsageState | null = null;
  /** 当前会话压缩信息（ADR-0026）：无 SSE，恢复会话 / 打开弹窗时从
   *  items 的 kind="compacted" 条目聚合刷新。 */
  @state() private _sessionCompaction: SessionCompactionState | null = null;
  /** 回退折叠条（ADR-0027）：_loadSession 时从 rewound 边界构建；
   *  新会话 / 返回 initial 清空。 */
  @state() private _rewindDividers: RewindDivider[] = [];
  /** 回退确认框载荷（null = 关闭）：seq 锚点 / content 回填内容 / deadCount 折叠数。 */
  @state() private _rewindDialog: {
    seq: number; content: string; deadCount: number;
    /** 锚点图片（ADR-0034）：确认后回填附件暂存区 */
    images?: { data: string; media_type: string }[];
  } | null = null;
  private _unsubscribe?: () => void;
  /** 当前流式请求的中断控制器；_stop() 会 abort 它并通知后端停。 */
  private _abortController: AbortController | null = null;
  /** 断开续跑轮询定时器（ADR-0028）：恢复态 generating 占位期间 5s 轮询
   *  detail，跑完自动刷新展示；离开会话/停止后清除。 */
  private _genPollTimer?: number;
  /** 插话在途（ADR-0048）：true = 已提交待送达（按钮「已插入」禁点），
   *  interject_ack 送达后回落；回合结束由丢弃 toast 兜底复位。 */
  @state() private _interjectPending = false;
  /** 插话输入框（ADR-0048）：true = 打开原生 dialog。 */
  @state() private _interjectDialogOpen = false;

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
    // 会话库恢复完成（ADR-0047 SSE sessions_restored）：重拉历史列表；
    // 当前打开的会话若已不存在（比备份旧），清空消息流回到欢迎页。
    window.addEventListener("cortex:sessions-restored", this._onSessionsRestored);
    this._unsubscribe = store.subscribe(() => {
      this.requestUpdate();
      this._consumePendingSkillChat();
    });
    this._loadPreviewPaneWidth();
    // 消费跨视图会话加载请求（来自 history-view）
    const pending = store.getState().pendingSession;
    if (pending && pending.type === "chat") {
      actions.setPendingSession(null);
      this._loadSession(pending);
    }
    // 启动恢复：上次会话在列表中高亮（幂等纯读；消息流不自动拉）。
    // 例外（ADR-0028）：上次会话仍在后台生成 → 自动进入恢复态（占位 +
    // 轮询），用户不用手点也能看到续跑结果。
    this._highlightSessionId = loadSessionMemory().chat?.sessionId ?? null;
    if (this._highlightSessionId) {
      void this._autoResumeIfGenerating(this._highlightSessionId);
    }
    this._consumePendingSkillChat();
    // 预拉技能候选（caret 菜单要展示最近技能，与候选求交）
    void this._loadSkillCandidates();
  }

  updated() {
    // 对话框用 showModal（top-layer + backdrop + ESC 关闭），与 files-view 一致。
    // 可能有多个 dialog 宿主（技能选择 / 会话改名），逐个处理。
    for (const dlg of this.renderRoot.querySelectorAll("dialog")) {
      if (!dlg.open) dlg.showModal();
    }
  }

  /** 拉取对话技能候选 = 全部启用且未删除的技能（ADR-0016 §1，与工具箱白名单独立）。 */
  private async _loadSkillCandidates() {
    try {
      const items = await listSkillsManage();
      this._skillCandidates = items
        .filter((s) => s.enabled && !s.deleted)
        .map((s) => ({ name: s.name, description: s.description, icon: s.icon }));
      this._skillCandidatesError = null;
    } catch (e) {
      this._skillCandidatesError = (e as Error)?.message || "技能列表加载失败";
    }
  }

  /** 传给 input-box 的最近技能项：与候选求交（停用/删除静默消失）取前 3；
   *  候选全空 → null（caret 隐藏，退化为普通发送按钮，ADR-0016 §5）。 */
  private get _recentSkillItems(): { name: string; icon?: string }[] | null {
    const cands = this._skillCandidates;
    if (cands !== null && cands.length === 0) return null;
    if (!cands) return []; // 未加载：caret 可用，菜单暂只显示「选择技能…」
    const byName = new Map(cands.map((c) => [c.name, c]));
    return getRecentSkillNames()
      .filter((n) => byName.has(n))
      .slice(0, RECENT_SKILLS_MENU_CAP)
      .map((n) => ({ name: n, icon: byName.get(n)!.icon }));
  }

  /** caret 菜单打开：刷新候选（设置页可能刚改过启用状态），recents 重算随之更新。 */
  private _onSkillMenuOpen = () => {
    void this._loadSkillCandidates();
  };

  /** 预填技能前缀 `/name `（尾随空格，斜杠下拉不会误弹），聚焦输入框续写问题。 */
  private _prefillSkill(name: string) {
    this.draft = `/${name} `;
    this.renderRoot.querySelector<HTMLInputElement>("input-box.text-input")?.focus();
  }

  /** 空输入时从 caret 菜单选技能：预填 `/name `（用户续写问题后发送），
   *  而非直接发送——没有可发送的问题（2026-10-21：caret 空输入不再禁用）。 */
  private _onSkillPickEmpty = (e: CustomEvent<{ name: string }>) => {
    this._prefillSkill(e.detail.name);
  };

  /** 菜单「选择技能…」→ 弹技能选择对话框（刷新候选保证最新）。 */
  private _onSkillBrowse = () => {
    this._skillDialogOpen = true;
    void this._loadSkillCandidates();
  };

  private _onSkillDialogPick = (e: CustomEvent<{ skill: SkillInfo }>) => {
    this._skillDialogOpen = false;
    if (!this.draft.trim()) {
      this._prefillSkill(e.detail.skill.name);
      return;
    }
    void this._sendWithSkill(e.detail.skill.name);
  };

  private _onSkillDialogCancel = () => {
    this._skillDialogOpen = false;
  };

  private _onSkillMenuPick = (e: CustomEvent<{ name: string }>) => {
    void this._sendWithSkill(e.detail.name);
  };

  /** focus-header more 菜单动作：刷新/会话改名/会话信息（仅当前会话存在时出现）。 */
  private get _headerActions() {
    if (!this.viewState.currentSession) return [];
    return [
      {
        label: "刷新会话",
        icon: "refresh-cw",
        onClick: () => { void this.refresh(); },
      },
      {
        label: "重命名会话",
        icon: "pencil",
        onClick: () => { this._renameDialogOpen = true; },
      },
      {
        label: "压缩上下文",
        icon: "archive",
        // 先弹确认框（压缩不可逆替换上下文 + 摘要调用耗时数十秒）
        onClick: () => {
          this._compactDialog = {
            phase: "confirm", preTokens: 0, postTokens: 0, errorMessage: "",
            compactedText: "",
          };
        },
      },
      {
        label: "导出会话",
        icon: "download",
        // ADR-0038：全保真 JSON 浏览器下载（跨实例记忆转移）；纯读不互斥流式
        onClick: () => { void this._exportSession(); },
      },
      {
        label: "会话信息",
        icon: "info",
        // 打开时顺带刷新压缩信息（无 SSE 通道，打开时 re-fetch 聚合补偿实时性）
        onClick: () => {
          this._refreshCompaction();
          this._infoDialogOpen = true;
        },
      },
    ];
  }

  /** 手动压缩当前会话历史（ADR-0026 手动入口）：LLM 摘要落库 compacted
   *  条目，下轮起上下文从摘要开始；对话流展示不受影响。压缩期间模态框
   *  保持打开（running 态）锁定页面交互，完成/失败切换框内结果展示。 */
  private async _compactSession() {
    const session = this.viewState.currentSession;
    if (!session || this._compacting) return;
    this._compacting = true;
    this._compactDialog = {
      phase: "running", preTokens: 0, postTokens: 0, errorMessage: "",
      compactedText: "",
    };
    try {
      const body = await compactSession(session.id);
      this._compactDialog = {
        phase: "done",
        preTokens: body.pre_tokens ?? 0,
        postTokens: body.post_tokens ?? 0,
        errorMessage: "",
        compactedText: body.compacted_text ?? "",
      };
      void this._refreshCompaction();
    } catch (err) {
      this._compactDialog = {
        phase: "error", preTokens: 0, postTokens: 0,
        errorMessage: (err as Error)?.message || String(err),
        compactedText: "",
      };
    } finally {
      this._compacting = false;
    }
  }

  /** 确认压缩：切换模态框为 running 态后执行（_compactSession 自带防重入）。 */
  private _onCompactConfirm = (): void => {
    void this._compactSession();
  };

  private _onCompactCancel = (): void => {
    // running 态不允许关闭（拦截 ESC/backdrop；模态 spinner 必须停留到出结果）
    if (this._compactDialog?.phase === "running") return;
    this._compactDialog = null;
  };

  /** auto 压缩模态兜底收尾（ADR-0044）：SSE done 已到而压缩 done 事件
   *  丢失/未发（未触发压缩、网络丢包）时撤下 running 模态，防止卡死
   *  页面；正常路径 done 事件已先行切换为 done 态，此处 no-op。 */
  private _finalizeAutoCompactDialog(): void {
    const d = this._compactDialog;
    if (d?.auto && d.phase === "running") this._compactDialog = null;
  }

  /** 重新拉取 detail 并聚合压缩信息（会话信息弹窗打开时刷新）。 */
  private async _refreshCompaction() {
    const session = this.viewState.currentSession;
    if (!session) return;
    try {
      const body = await fetchSessionDetail(session.id);
      this._sessionCompaction = aggregateCompaction(body.items || []);
    } catch {
      // 拉取失败保留上次聚合结果
    }
  }

  private _onRenameSubmit = async (e: CustomEvent<{ title: string }>) => {
    const session = this.viewState.currentSession;
    this._renameDialogOpen = false;
    if (!session) return;
    try {
      const res = await renameSession(session.id, e.detail.title);
      // 同步当前会话与历史列表（updated_at 不动，历史顺序不变）
      actions.setChatState({ currentSession: { ...session, title: res.title } });
      this.historySessions = this.historySessions.map((s) =>
        s.id === session.id ? { ...s, title: res.title } : s);
      this._pushToast("已重命名", "success", 2500);
    } catch (err) {
      this._pushToast(`重命名失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  };

  private _onRenameCancel = () => {
    this._renameDialogOpen = false;
  };

  /** 历史列表星标切换（2026-09-17）：乐观更新（本地翻转+重排），失败回滚。 */
  private _onToggleStar = async (e: CustomEvent<{ session: Session; starred: boolean }>) => {
    const { session, starred } = e.detail;
    const prev = this.historySessions;
    this.historySessions = this._sortedWithStar(prev, session.id, starred);
    try {
      await starSession(session.id, starred);
      // 同步当前会话对象（加星态跟随，如 header/恢复逻辑消费）
      const cur = this.viewState.currentSession;
      if (cur && cur.id === session.id) {
        actions.setChatState({ currentSession: { ...cur, starred } });
      }
    } catch (err) {
      this.historySessions = prev;
      this._pushToast(`加星失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  };

  /** 不可变地翻转指定会话 starred 并按 (starred, updated_at) 重排。 */
  private _sortedWithStar(sessions: Session[], id: string, starred: boolean): Session[] {
    return sessions
      .map((s) => (s.id === id ? { ...s, starred } : s))
      .sort((a, b) =>
        (Number(b.starred ?? false) - Number(a.starred ?? false)) ||
        b.updated_at.localeCompare(a.updated_at));
  }

  /** 会话改名对话框宿主（<dialog> 由 updated() showModal）。 */
  private _renderRenameDialog() {
    const session = this.viewState.currentSession;
    if (!this._renameDialogOpen || !session) return nothing;
    return html`
      <dialog @cancel=${this._onRenameCancel}>
        <session-rename-dialog
          .currentTitle=${session.title}
          @submit=${this._onRenameSubmit}
          @cancel=${this._onRenameCancel}
        ></session-rename-dialog>
      </dialog>`;
  }

  /** 视觉能力拦截对话框（ADR-0034 L3）：当前模型不支持视觉，消息未发送、
   *  草稿与附件保留——「前往设置」跳模型 tab 手动切换（预设热生效）。 */
  private _renderVisionGateDialog() {
    if (!this._visionGateOpen) return nothing;
    return html`
      <dialog @cancel=${() => (this._visionGateOpen = false)}>
        <div class="vision-gate">
          <h3>当前模型不支持图像</h3>
          <p>这条消息带有图片，但当前对话模型（${store.getState().status?.model_name || "未命名"}）
            未声明视觉能力，发送会被模型忽略或报错。</p>
          <p class="vision-gate-hint">在设置 → 模型中切换到支持视觉的模型预设
            （或编辑当前预设勾选「支持视觉」），切换即时生效，回来重新发送即可。
            消息与图片已保留在输入框。</p>
          <div class="vision-gate-actions">
            <button class="secondary" @click=${() => (this._visionGateOpen = false)}>取消</button>
            <button class="primary" @click=${this._gotoModelSettings}>前往设置</button>
          </div>
        </div>
      </dialog>`;
  }

  /** 跳设置页模型 tab（ADR-0034）：写 pendingSettingsTab 再导航，keep-alive
   *  下由 store 订阅消费。 */
  private _gotoModelSettings() {
    this._visionGateOpen = false;
    actions.setPendingSettingsTab("ai");
    router.navigate("settings");
  }

  // ---- 插话（ADR-0048）----

  /** 插话输入框草稿（dialog 打开期间）。 */
  @state() private _interjectDraft = "";

  /** trace 标题栏「插话」按钮 → 打开原生 dialog（ADR-0048 决策 7）。
   *  入口在生成中才渲染（组件侧控制）；恢复态（无本地流但 generating）
   *  同样可达——按钮显隐由 chat-tool-trace 按 running 步骤判定。 */
  private _onInterjectRequest = (): void => {
    this._interjectDraft = "";
    this._interjectDialogOpen = true;
  };

  private _onInterjectCancel = (): void => {
    this._interjectDialogOpen = false;
    this._interjectDraft = "";
  };

  /** 提交插话：写会话单槽位，按钮转「已插入」等检查点送达（ack 回落）。
   *  拒绝路径（占用/不在生成）toast 提示，dialog 关闭。 */
  private _onInterjectSubmit = async (): Promise<void> => {
    const session = store.getState().chat.currentSession;
    const text = this._interjectDraft.trim();
    if (!session || !text) return;
    this._interjectDialogOpen = false;
    this._interjectDraft = "";
    const r = await interject(session.id, text);
    if (r === "ok") {
      this._interjectPending = true;
      this._pushToast("已插入，将在当前步骤完成后送达", "info", 3500);
    } else if (r === "pending") {
      this._pushToast("已有插话在等待送达，请稍候", "info", 3500);
    } else if (r === "not_running") {
      this._pushToast("会话已结束生成，直接发送消息提问即可", "info", 3500);
    } else {
      this._pushToast("插话提交失败，请重试", "error", 3500);
    }
  };

  /** 插话输入 dialog（原生 <dialog>，仓库惯例 showModal）。 */
  private _renderInterjectDialog() {
    if (!this._interjectDialogOpen) return nothing;
    return html`
      <dialog @cancel=${this._onInterjectCancel}>
        <div class="interject-dialog">
          <h3>插话</h3>
          <p class="interject-hint">向正在执行的 AI 提问或下达临时指令。当前步骤
            完成后送达，AI 只做文字汇报并继续原任务，不会被打断。</p>
          <textarea
            rows="4"
            placeholder="例如：现在进度汇报一下 / 改用方案 B / 已读文件里有线索吗"
            .value=${this._interjectDraft}
            @input=${(e: InputEvent) => {
              this._interjectDraft = (e.target as HTMLTextAreaElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              // Ctrl/Cmd+Enter 快捷提交（Enter 留给多行输入）
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void this._onInterjectSubmit();
              }
            }}></textarea>
          <div class="interject-actions">
            <button class="secondary" @click=${this._onInterjectCancel}>取消</button>
            <button class="primary" ?disabled=${!this._interjectDraft.trim()}
                    @click=${this._onInterjectSubmit}>插入</button>
          </div>
        </div>
      </dialog>`;
  }

  /** 会话信息对话框宿主（2026-09-17；<dialog> 由 updated() showModal）。 */
  private _renderInfoDialog() {
    if (!this._infoDialogOpen || !this.viewState.currentSession) return nothing;
    // 占用口径：压缩晚于最近一次 LLM 调用时，最近实测已不代表当前上下文
    // （历史已被摘要替换）——显示压缩后估算并标注；下轮对话实测覆盖
    const usage = this._sessionUsage;
    const compaction = this._sessionCompaction;
    const useEstimate =
      compaction !== null &&
      compaction.lastPostTokens > 0 &&
      compaction.lastSeq > (usage?.lastSeq ?? -1);
    const used = useEstimate
      ? compaction!.lastPostTokens
      : usage?.used ?? null;
    return html`
      <dialog @cancel=${this._onInfoClose}>
        <session-info-dialog
          .used=${used}
          .usedIsEstimate=${useEstimate}
          .contextWindow=${usage?.contextWindow ?? 0}
          .cacheReadTotal=${usage?.cacheReadTotal ?? null}
          .inputTotal=${usage?.inputTotal ?? null}
          .calls=${usage?.calls ?? 0}
          .compactionCount=${compaction?.count ?? 0}
          .lastCompactedAt=${compaction?.lastAt ?? null}
          .lastPreTokens=${compaction?.lastPreTokens ?? null}
          @close=${this._onInfoClose}
        ></session-info-dialog>
      </dialog>`;
  }

  private _onInfoClose = () => {
    this._infoDialogOpen = false;
  };

  /** 技能直发（ADR-0016 §3/§4）：斜杠形态消息（/技能名 问题）立即发往当前
   *  会话；initial 态新建会话（mode="skill"）。load_skill 提示由后端 chat.py
   *  检测斜杠前缀注入 hint（与手敲 /技能名 完全同一条链路）。 */
  private async _sendWithSkill(name: string) {
    const question = this.draft.trim();
    if (!question) return;
    recordSkillUse(name);
    const message = `/${name} ${question}`;
    this.draft = "";
    if (this.viewState.state === "initial") {
      await this._ensureSession(`${name} · ${question.slice(0, 30)}`, message, "skill");
      await this._sendMessage(message, true);
      return;
    }
    await this._sendMessage(message);
  }

  /** 刷新当前会话（more 菜单「刷新会话」入口；曾接下拉刷新手势，因与
   *  顶部滚屏手势矛盾撤下——见 pull-to-refresh.ts 注释）：重拉 detail，
   *  消息流 + generating 恢复态一次接管（断开续跑的手动收口）。 */
  async refresh(): Promise<void> {
    const s = this.viewState;
    if (s.state === "focus" && s.currentSession) {
      await this._loadSession(s.currentSession);
    } else if (s.state === "initial") {
      await this._loadHistory();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._stopGeneratingPoll();
    window.removeEventListener("cortex:sessions-restored", this._onSessionsRestored);
  }

  /** 会话库恢复完成（ADR-0047）：重拉历史；当前会话不复存在时回欢迎页。 */
  private _onSessionsRestored = (): void => {
    void this._loadHistory();
    const cur = store.getState().chat.currentSession;
    if (cur) {
      void fetchSessionDetail(cur.id, { metaOnly: true })
        .then(() => {
          // 仍存在：消息流可能是恢复前旧态，重拉
          this._loadSession(cur);
        })
        .catch(() => {
          // 会话已随恢复消失（创建晚于备份）：回欢迎页
          this._markTabSession(null);
          actions.setChatState({
            state: "initial",
            currentSession: null,
            messages: [],
            streaming: false,
            pendingAsk: null,
          });
        });
    }
  };

  /** 启动自动恢复（ADR-0028）：上次会话仍在后台生成 → 直接进入该会话
   *  恢复态（generating 占位 + 轮询），否则保持 initial 只高亮。
   *
   *  多标签页防劫持（2026-10-22）：session 记忆存 localStorage，是**全标签页
   *  共享**的——A 页正在生成时新开一页，新页会把 A 的会话自动接管过来，
   *  看起来像「另一个页面也在同步收到实时消息」。自动恢复只对本标签页
   *  生效：sessionStorage 里没有该会话（= 新开的标签页，不是刷新）就放弃。 */
  private async _autoResumeIfGenerating(sessionId: string): Promise<void> {
    if (this._tabSessionId() !== sessionId) return; // 新标签页不继承别的页的在途生成
    try {
      const body = await fetchSessionDetail(sessionId, { metaOnly: true });
      if (!body.generating) return;
      if (store.getState().chat.state !== "initial") return; // 已被用户操作抢占
      this._loadSession({
        id: body.id, type: "chat", title: body.title, preview: body.preview,
        updated_at: body.updated_at, message_count: body.message_count,
      });
    } catch {
      // 网络抖动静默放弃（保持高亮-only 的默认恢复行为）
    }
  }

  /** generating 轮询（ADR-0028）：占位期间 5s 拉 detail（metaOnly 轻量
   *  端点——只需 generating 标志，不搬全量条目），跑完自动刷新收尾展示；
   *  离开会话 / 停止后自清。 */
  private _startGeneratingPoll(sessionId: string): void {
    this._stopGeneratingPoll();
    this._genPollTimer = window.setInterval(async () => {
      const cur = store.getState().chat.currentSession;
      if (!cur || cur.id !== sessionId || store.getState().chat.state !== "focus") {
        this._stopGeneratingPoll();
        return;
      }
      try {
        const body = await fetchSessionDetail(sessionId, { metaOnly: true });
        if (!body.generating) {
          this._stopGeneratingPoll();
          await this._loadSession(cur); // 续跑完成：刷新收尾展示
        }
      } catch {
        // 网络抖动继续轮询（下个周期重试）
      }
    }, 5000);
  }

  private _stopGeneratingPoll(): void {
    if (this._genPollTimer !== undefined) {
      window.clearInterval(this._genPollTimer);
      this._genPollTimer = undefined;
    }
  }

  /** 本标签页当前挂着的会话 id（sessionStorage：按标签页隔离，刷新保留、
   *  新标签页为空）——自动恢复据此判断「是不是本页刷新」，防新开页被
   *  别的标签页的在途生成劫持（localStorage 的 session 记忆是全页共享的）。 */
  private static readonly TAB_SESSION_KEY = "cortex.chat.tabSession";

  private _tabSessionId(): string | null {
    try {
      return sessionStorage.getItem(ChatView.TAB_SESSION_KEY);
    } catch {
      return null; // 隐私模式等禁用 storage：退化为不自动恢复
    }
  }

  private _markTabSession(id: string | null): void {
    try {
      if (id) sessionStorage.setItem(ChatView.TAB_SESSION_KEY, id);
      else sessionStorage.removeItem(ChatView.TAB_SESSION_KEY);
    } catch {
      /* storage 不可用：忽略 */
    }
  }

  private async _loadHistory() {
    try {
      const { sessions } = await listSessions({ type: "chat", limit: 20 });
      this.historySessions = sessions;
    } catch (e) {
      console.warn("load history failed", e);
    }
  }

  private async _onClearHistory() {
    this._clearing = true;
    this.requestUpdate();
    try {
      const res = await clearSessions("chat");
      // 加星会话受保护：后端跳过，本地保留
      this.historySessions = this.historySessions.filter((s) => s.starred);
      if (res.skipped_starred > 0) {
        this._pushToast(
          `已清空 ${res.deleted_count} 条，${res.skipped_starred} 条加星会话保留`,
          "info", 3500);
      }
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this._clearing = false;
      this.requestUpdate();
    }
  }

  /** 导出当前会话（ADR-0038）：全保真 JSON，跨实例记忆转移。
   *  WebView 内 `<a download>`（blob URL）在 X5 无下载 UI → 走 jsbridge
   *  原生下载（写 Downloads + 系统通知）；浏览器仍走 fetch+blob。 */
  private async _exportSession(): Promise<void> {
    const cur = this.viewState.currentSession;
    if (!cur) return;
    try {
      if (jsbridgeDownloadAvailable()) {
        const r = await downloadFromUrl(
          sessionExportUrl(cur.id),
          sessionExportFileName(cur.title || ""),
        );
        if (r.via !== "jsbridge") return;
        if (r.name) this._pushToast(`已导出：${r.name}（保存在下载目录）`, "success", 3500);
        else if (r.error) this._pushToast(`导出失败：${r.error}`, "error", 5000);
        // 两字段皆空 = unauthorized 已在公共编排内跳登录，此处静默
        return;
      }
      await exportSession(cur.id);
      this._pushToast("已导出会话文件", "success", 2500);
    } catch (e) {
      this._pushToast(`导出失败：${(e as Error)?.message || e}`, "error", 5000);
    }
  }

  /** 导入会话（ADR-0038）：浏览器 = 文件选择器 → 确认（标题/条目数）→
   *  上传；WebView 内改用原生选择器 + 直传（X5 不弹 input file）。
   *  toast 报告 + 列表刷新；不自动进入（导入是数据操作不是导航操作）。 */
  private _onImportHistory(): void {
    if (jsbridgeUploadAvailable()) {
      void this._importViaJsbridge();
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void this._importSessionFile(file);
    };
    input.click();
  }

  /** WebView 原生导入：pickAndUploadFiles 选中 JSON 直传
   *  /api/sessions/import/upload（multipart），H5 不碰文件字节。
   *  服务端借 path 字段回报 imported / skipped。 */
  private async _importViaJsbridge(): Promise<void> {
    if (this._importing) return;
    this._importing = true;
    try {
      const res = await pickAndUploadFiles({
        destDir: "",
        uploadUrl: sessionImportUploadUrl(),
        maxCount: 1,
      });
      if (!res) return; // 用户在选择器取消
      if (res.unauthorized) {
        // 与 client.ts 的 401 统一钩子行为对齐
        actions.setAuthState({ authenticated: false });
        router.navigate("login");
        return;
      }
      const item = res.results[0];
      if (!item) {
        this._pushToast("导入失败：未选择文件", "error", 5000);
        return;
      }
      if (!item.ok) {
        this._pushToast(`导入失败：${item.detail || item.code || "未知错误"}`, "error", 5000);
        return;
      }
      if (item.path === "skipped") {
        this._pushToast("会话已存在，已跳过", "info", 3000);
      } else {
        this._pushToast("已导入会话", "success", 3000);
      }
      await this._loadHistory();
    } catch (e) {
      this._pushToast(`导入失败：${(e as Error)?.message || e}`, "error", 5000);
    } finally {
      this._importing = false;
    }
  }

  private async _importSessionFile(file: File): Promise<void> {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      this._pushToast("导入失败：文件不是合法 JSON", "error", 5000);
      return;
    }
    // 前端轻量预读（标题/条目数）供确认展示；完整结构校验在后端
    const d = data as { format?: unknown; session?: { title?: unknown }; items?: unknown };
    const title = typeof d.session?.title === "string" ? d.session.title : "";
    const count = Array.isArray(d.items) ? d.items.length : 0;
    const ok = window.confirm(
      `导入会话「${title || file.name}」（${count} 条记录）？\n\n` +
      "导入后可在历史会话列表中找到；已存在相同会话时将跳过。");
    if (!ok) return;
    try {
      const res = await importSession(data);
      if (res.imported > 0) {
        this._pushToast(`已导入会话「${title || file.name}」`, "success", 3000);
      } else {
        this._pushToast("会话已存在，已跳过", "info", 3000);
      }
      await this._loadHistory(); // 刷新列表（排序保留源时间戳，不自动进入）
    } catch (e) {
      this._pushToast(`导入失败：${(e as Error)?.message || e}`, "error", 5000);
    }
  }

  private get viewState() {
    return store.getState().chat;
  }

  /** 消息流元素（发送消息时强制回底——新内容在底部，用户意图明确）。 */
  private get _streamEl(): ChatStream | null {
    return this.renderRoot.querySelector("chat-stream");
  }

  private async _submit(e: CustomEvent<{ value: string; images?: { data: string; media_type: string }[] }>) {
    this._resetPreview();
    const message = e.detail.value;
    const images = e.detail.images;

    // 对话图片视觉路由（ADR-0034）：当前 LLM 预设不支持视觉时拦截发送，
    // 消息/草稿/附件全保留（切完模型回来重发）；能力位来自 /api/status。
    if (images && images.length > 0 && !store.getState().status?.llm_vision) {
      this.draft = message;
      this._pendingImages = images;
      this._visionGateOpen = true;
      return;
    }

    // 斜杠技能调用（首字符 /）：合法性硬校验（存在 ∧ 启用 ∧ 未删除 ∧ 用户可
    // 调用）。非法阻断发送并保留草稿（后端对漏网的非法斜杠按普通文本处理，
    // 不注入 hint）；合法则记录最近技能后按普通消息原样发送——hint 由后端
    // 在发送给 LLM 时注入（展示保真/落库原文）。
    if (message.startsWith("/") && this._skillCandidates === null) {
      await this._loadSkillCandidates();
    }
    const check = checkSlashSubmit(message, this._skillCandidates);
    if (check.type === "unknown") {
      this.draft = message; // 恢复草稿便于修正
      this._pushToast(
        `未知技能「/${check.name}」：删掉开头的 / 可发送普通文本，或从下拉列表选择技能`,
        "error",
        4000,
      );
      return;
    }
    if (check.type === "ok") recordSkillUse(check.name);

    this.draft = "";

    // initial 态时消息发送前先建会话（与技能对话共用路径）
    if (this.viewState.state === "initial") {
      await this._ensureSession(message, message, undefined, images);
      await this._sendMessage(message, true, images);
      return;
    }
    await this._sendMessage(message, false, images);
  }

  /** 消费跨视图技能对话请求（files 工具箱）：initial 态新建技能会话后自动发送。
   *  keep-alive 下 store 订阅持续触发；非 initial 态（已有对话）时忽略——
   *  技能对话总是新建会话，由写入方保证切视图前重置。 */
  private async _consumePendingSkillChat(): Promise<void> {
    const pending = store.getState().pendingSkillChat;
    if (!pending) return;
    actions.setPendingSkillChat(null); // 先消费，防重入
    if (this.viewState.state !== "initial") return;
    await this._ensureSession(pending.title, pending.message, pending.isSkill ? "skill" : undefined);
    await this._sendMessage(pending.message, true);
  }

  /** initial 态下创建新会话并转入 focus 态（用户气泡先行）。
   *  mode="skill" 声明技能会话（后端据此切换提取式引文策展）。 */
  private async _ensureSession(
    title: string, message: string, mode?: "skill",
    images?: { data: string; media_type: string }[],
  ): Promise<void> {
    const created = await createSession({ type: "chat", title: title.slice(0, 1000), preview: message.slice(0, 100), mode });
    this._markTabSession(created.id); // 新会话也算本页当前会话
    this._sessionUsage = null; // 新会话：清空上一会话的上下文占用
    this._rewindDividers = []; // 新会话：无回退边界
    this._rewindDialog = null;
    actions.setChatState({
      state: "focus",
      currentSession: {
        id: created.id, type: "chat", title: title.slice(0, 1000),
        preview: message.slice(0, 100), mode, updated_at: new Date().toISOString(),
        message_count: 0,
      },
      messages: [{ role: "user", content: message, images, created_at: new Date().toISOString() }],
      streaming: true,
    });
  }

  /** 追加用户消息并发起流式请求（会话已就位）。
   *  firstOfSession=true 时用户气泡已由 _ensureSession 加入，不重复追加。 */
  private async _sendMessage(
    message: string, firstOfSession = false,
    images?: { data: string; media_type: string }[],
  ): Promise<void> {
    // 发送即回底（贴底粘滞的强制出口）：用户主动发消息 = 意图明确指向
    // 底部的新内容，即使此前上滚回看冻结了视口也立即恢复跟随。
    // 同时清空「展开/收起全部思考过程」指令：新回合回到自动展开/收起，
    // 不因上次选了「收起全部」而看不到本轮执行进度（2026-10-21 决议）。
    this._streamEl?.scrollToBottom();
    this._streamEl?.resetTraceExpand();
    if (!firstOfSession) {
      actions.setChatState({
        messages: [...this.viewState.messages, { role: "user", content: message, images, created_at: new Date().toISOString() }],
        streaming: true,
      });
    } else {
      actions.setChatState({ streaming: true });
    }

    const sessionId = store.getState().chat.currentSession!.id;

    // message_user / message_ai 均由后端统一落库（ADR-0028）——前端不再
    // 写 DB（收尾展示条目 message_ai 与本轮 message_user 都在 chat.py），
    // 断开续跑/正常完成/停止丢弃的落库口径由后端单一掌控。

    // assistant 占位 + 起始 messages（不可变）；created_at 本地打戳：
    // done 落库后重进会话即为后端权威时刻（与 user 消息同律，刷新归正）
    const placeholder: ChatMessage = { role: "assistant", content: "", created_at: new Date().toISOString() };
    let messages = [...store.getState().chat.messages, placeholder];
    actions.setChatState({ messages });

    // 建立中断控制器：_stop() 会 abort 它 + 通知后端停（abort 抛 AbortError 走静默路径）
    this._abortController = new AbortController();

    // 会话归属守卫（2026-10-22 串台修复）：本流的增量只允许写回发起它的
    // 会话。用户中途切到别的对话（「返回」/历史列表/新会话）后，若继续把
    // 事件灌进 store.chat.messages，别的对话就会实时冒出本轮思考步骤与
    // 工具卡片（现象即「另一个页面同步收到实时消息」）。切换期间事件静默
    // 丢弃（连接不断，后端照常生成）；切回本会话后自动恢复实时展示。
    const stillOwn = (): boolean => streamOwnedBy(store.getState().chat, sessionId);

    try {
      for await (const ev of chatStream(
        { message, session_id: sessionId, images },
        this._abortController.signal,
      )) {
        if (!stillOwn()) continue;
        if (ev.type === "error") {
          messages = applyStreamEvent(messages, { type: "token", text: `\n\n⚠️ ${ev.detail}` });
          actions.setChatState({ messages });
        } else if (ev.type === "ask") {
          const questions = validateAskQuestions(ev.questions);
          if (questions) {
            const pending: PendingAsk = { requestId: ev.request_id, questions };
            this._activeAsk = pending;
            actions.setChatState({ pendingAsk: pending });
          }
        } else if (ev.type === "toast") {
          this._pushToast(ev.detail, ev.level, 5000);
        } else if (ev.type === "compact") {
          // 回合末自动压缩（ADR-0044）：start → 不可关闭模态 running 态；
          // done → 框内展示 pre→post 结果（「完成」按钮才可关）。
          // 手动压缩弹窗在场时让位（同一次压缩不叠两个模态）。
          if (this._compactDialog && !this._compactDialog.auto) break;
          this._compactDialog = {
            phase: ev.phase === "done" ? "done" : "running",
            preTokens: ev.pre_tokens ?? 0,
            postTokens: ev.post_tokens ?? 0,
            errorMessage: "",
            compactedText: "",
            auto: true,
          };
          if (ev.phase === "done") void this._refreshCompaction();
        } else if (ev.type === "usage") {
          // 与恢复态聚合共用 applyUsageEvent（口径单一真相源）；
          // seq = MAX_SAFE_INTEGER 表「新实测必然晚于已知 compacted 条目
          // ——占用切回实测口径」
          this._sessionUsage = applyUsageEvent(this._sessionUsage, {
            input: ev.input_tokens,
            read: ev.cache_read_input_tokens,
            creation: ev.cache_creation_input_tokens,
            contextWindow: ev.context_window,
            seq: Number.MAX_SAFE_INTEGER,
          });
        } else if (ev.type === "done" && ev.reason === "waiting_user") {
          // 对话式提问（ADR-0033）：回合因提问而终止，输入框已解锁——
          // 提示用户直接发消息作答（答案即下一条用户消息）
          this._pushToast("等待你的回复：直接发送消息回答上面的问题即可", "info", 5000);
          this._finalizeAutoCompactDialog();
        } else if (ev.type === "interject_ack") {
          // 插话送达（ADR-0048）：占位 trace 末追加 running 插话卡
          // （interject_report 到达回填 output；回合落库条目随 raw 回放一致）
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            const step: ToolStep = {
              tool_use_id: ev.tool_use_id, name: "user_interject",
              input: { question: ev.question }, status: "running",
            };
            messages = [...messages.slice(0, -1),
              { ...last, tool_steps: [...(last.tool_steps ?? []), step] }];
            actions.setChatState({ messages });
          }
          this._interjectPending = false;
        } else if (ev.type === "interject_report") {
          // 插话汇报全文（ADR-0048）：一次性回填插话卡 output
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            const tool_steps = (last.tool_steps ?? []).map((s) =>
              s.tool_use_id === ev.tool_use_id
                ? { ...s, output: ev.text, status: "done" as const }
                : s
            );
            messages = [...messages.slice(0, -1), { ...last, tool_steps }];
            actions.setChatState({ messages });
          }
        } else if (ev.type !== "done") {
          messages = applyStreamEvent(messages, ev);
          actions.setChatState({ messages });
        }
      }

      // 展示层 message_ai 已由后端统一落库（ADR-0028）；前端只在本地
      // 维持流式视图（重进会话时经 detail 重建）。切走了就别动当前会话的
      // 收尾状态（弹窗/输入锁属于正在展示的那个会话）；历史列表是全局的，
      // 照常刷新（标题/条数随本轮落库更新）。
      if (stillOwn()) this._finalizeAutoCompactDialog();
      this._loadHistory();
    } catch (err) {
      if (this._isAbortError(err)) {
        // 用户主动停止：保留已生成的半截回答（2026-09-22 语义变更：后端
        // 同步落库 message_ai，重进会话可见；原「UI==DB 都丢弃」废弃）。
        // 残留 running 步骤标记为中断，不弹错误 toast
        if (stillOwn()) {
          messages = finalizeInterruptedMessages(messages);
          actions.setChatState({ messages });
          this._loadHistory();
        }
      } else {
        // 连接中断 / 异常：保留已收到内容，把残留 running 步骤标记为中断。
        // 断开续跑自愈（ADR-0028）：后端可能仍在生成——重拉 detail 接管：
        // generating → 恢复态占位 + 轮询；已完成 → 直接展示补写结果。
        const cur = store.getState().chat.currentSession;
        const own = stillOwn();
        if (own) {
          messages = finalizeInterruptedMessages(messages);
          actions.setChatState({ messages });
        }
        actions.setError(`对话失败: ${(err as Error).message}`);
        if (cur && cur.id === sessionId) {
          void this._loadSession(cur);
        }
      }
    } finally {
      this._abortController = null;
      // 流结束即撤下交互卡片：问答已由消息内 tool trace 持久化展示，
      // 外挂卡片（_activeAsk）只服务悬置期交互，留着会重复/残留
      this._activeAsk = null;
      this._interjectPending = false; // 插话态复位（ADR-0048；丢弃 toast 已另行送达）
      // streaming 是当前展示会话的状态：切走了就不要解锁别人的输入框
      // （另开一轮的输入锁归它自己的流管）。
      if (stillOwn()) {
        actions.setChatState({ streaming: false, pendingAsk: null });
      }
    }
  }

  /** 用户点击停止：先落停止信号（await），再 abort 前端读取（ADR-0028）。
   *  顺序是断开续跑下的正确性关键——abort 触发的连接断开在后端被判断为
   *  「主动停止已请求」（interrupt 已 set）才会立刻停；颠倒顺序会让停止
   *  信号晚到/丢失，本轮被当作断开放生继续烧 token。
   *  恢复态（无本地 SSE 流，断开续跑的占位态）停止后重拉 detail 收尾展示。 */
  private async _stop(): Promise<void> {
    const sessionId = store.getState().chat.currentSession?.id;
    const ctrl = this._abortController;
    try {
      if (sessionId) await stopChat(sessionId);
    } finally {
      ctrl?.abort();
      // 恢复态：没有本地流（abort 不会触发重拉），手动刷新收尾
      if (sessionId && ctrl === null) {
        const cur = store.getState().chat.currentSession;
        if (cur && cur.id === sessionId) await this._loadSession(cur);
      }
    }
  }

  /** ask 卡片完成（已答/失效/超时）：解除输入禁用；摘要卡片保留至流结束
   *  （门禁超时摘要明确交代「已按拒绝处理」）。
   *  注意 pendingAsk 清空而 streaming 仍为 true——流在等待答案唤醒后继续。 */
  private _onAskDone(e: CustomEvent<{ requestId: string; toast?: string | null }>) {
    if (store.getState().chat.pendingAsk?.requestId === e.detail.requestId) {
      actions.setChatState({ pendingAsk: null });
    }
    // 已答结果 toast 轻提示（3s 自动消失）——超时/失效路径 toast 为空（摘要卡保留）
    if (e.detail.toast) this._pushToast(e.detail.toast, "info", 3000);
  }

  /** 判定是否为用户主动 abort（AbortController.abort 抛 AbortError）。 */
  private _isAbortError(err: unknown): boolean {
    return !!err && (err as Error).name === "AbortError";
  }

  private _backToInitial() {
    this._resetPreview();
    this._activeAsk = null;
    this._highlightSessionId = null; // 「新会话」返回后不残留旧高亮
    this._markTabSession(null); // 回到欢迎页：本页不再挂着任何会话
    this._rewindDividers = [];
    this._rewindDialog = null;
    this._stopGeneratingPoll();
    actions.setChatState({ state: "initial", currentSession: null, messages: [], pendingAsk: null });
    this._loadHistory();
  }

  /** 清空预览 pane 的全部状态（导航离开当前对话时调用，避免残留旧文档）。
   *  不重置 _previewPaneWidth（用户偏好，持久）。 */
  private _resetPreview(): void {
    this.previewOpen = false;
    this._preview.clear();
  }

  private async _loadSession(s: Session) {
    this._resetPreview();
    this._activeAsk = null;
    this._interjectPending = false;
    this._highlightSessionId = s.id;
    this._markTabSession(s.id); // 本页当前会话（自动恢复只看本页，见 _autoResumeIfGenerating）
    actions.setChatState({
      state: "focus",
      currentSession: s,
      messages: [],
      pendingAsk: null,
    });
    try {
      const body = await fetchSessionDetail(s.id);
      const { messages, dividers } = buildChatTimeline(body.items ?? []);
      // 断开续跑恢复态（ADR-0028）：会话仍在后台生成 → 末尾占位「思考中」
      // + streaming 态（禁输入，停止钮可用）+ 轮询（跑完自动刷新展示）
      const generating = !!body.generating;
      actions.setChatState({
        messages: generating
          ? [...messages, { role: "assistant", content: "" }]
          : messages,
        streaming: generating,
      });
      if (generating) this._startGeneratingPoll(s.id);
      else this._stopGeneratingPoll();
      this._rewindDividers = dividers;
      // 切换会话/刷新：视口强制回底（贴底粘滞的强制出口）——不同会话间
      // 保留的 _pinned 状态无意义，新时间线以底部为默认视位；
      // 展开指令同律清空（旧会话的「收起全部」不得带进新会话）
      this._streamEl?.scrollToBottom();
      this._streamEl?.resetTraceExpand();
      this._sessionUsage = applyLiveWindow(
        aggregateUsage(body.items ?? []),
        Number(body.context_window ?? 0),
      );
      this._sessionCompaction = aggregateCompaction(body.items ?? []);
    } catch (e) {
      console.warn("load session failed", e);
    }
  }

  private _onHistorySelect(e: CustomEvent<{ session: Session }>) {
    this._loadSession(e.detail.session);
  }

  /** 历史条目「复制会话」（2026-10-10）：先弹确认框说明复制语义，确认后
   *  调孪生复制 API → 刷新历史 → 直接进入孪生会话（复制即为了继续干活，
   *  避免再点一次）。失败 toast。 */
  private _onForkSession(e: CustomEvent<{ session: Session }>) {
    this._forkDialogSession = e.detail.session;
  }

  private _onForkCancel = () => {
    this._forkDialogSession = null;
  };

  private _onForkConfirm = async (): Promise<void> => {
    const session = this._forkDialogSession;
    this._forkDialogSession = null;
    if (!session) return;
    try {
      const twin = await duplicateSession(session.id);
      await this._loadHistory();
      // 复用 Session 形态进入会话（starred/mode 已知，免一次 get）
      this._loadSession({
        id: twin.id, type: "chat", title: twin.title, preview: twin.preview,
        updated_at: new Date().toISOString(),
        message_count: session.message_count, mode: session.mode,
      });
      this._pushToast("已复制会话，原会话保留", "success", 2500);
    } catch (err) {
      this._pushToast(`复制会话失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  };

  private _loadPreviewPaneWidth(): void {
    const saved = localStorage.getItem(ChatView.PREVIEW_PANE_WIDTH_KEY);
    if (!saved) return;
    const w = Number(saved);
    if (!Number.isNaN(w)) {
      this._previewPaneWidth = Math.max(
        ChatView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(ChatView.PREVIEW_PANE_WIDTH_MAX, w),
      );
    }
  }

  private _onSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._previewPaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(
        ChatView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(ChatView.PREVIEW_PANE_WIDTH_MAX, startWidth - (ev.clientX - startX)),
      );
      if (w !== this._previewPaneWidth) this._previewPaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(ChatView.PREVIEW_PANE_WIDTH_KEY, String(this._previewPaneWidth));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  private get _previewKeyword(): string {
    const msgs = store.getState().chat.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") return msgs[i].content;
    }
    return "";
  }

  /** 把 AI 给的参考资料格式规范化为 fetchPreview 可解析的 path。
   *  处理：markdown 链接 [text](url) → url；剥 file:// 前缀；URL decode。
   *  兼容 AI 偶发用 markdown 链接或 file URL 的情况（治本，让 click 永远能打开）。 */
  private _normalizeReferencePath(raw: string): string {
    let p = (raw ?? "").trim();
    if (!p) return "";
    // 1) 剥 markdown 链接 [text](url) → url
    const md = p.match(/^\[.*?\]\((.*?)\)$/);
    if (md) p = md[1].trim();
    // 2) 剥 file:// 前缀（file:// 或 file:/// 都处理）
    p = p.replace(/^file:\/\/\/?/i, "");
    // 3) URL decode（处理 %20 等）
    try { p = decodeURIComponent(p); } catch { /* leave as-is */ }
    return p;
  }

  private async _onReferenceClick(e: CustomEvent<{ path: string }>): Promise<void> {
    await this._safeAction(async () => {
      const path = this._normalizeReferencePath(e.detail.path);
      if (!path) {
        this._pushToast("参考路径为空", "error", 5000);
        return;
      }
      await this._openPreviewPath(path);
    });
  }

  /** 点击 user 气泡的「重问」：把问题内容拷回输入框（不自动发送，留给用户编辑/发送）。 */
  private _onReask(e: CustomEvent<{ content: string; images?: { data: string; media_type: string }[] }>): void {
    const content = e.detail?.content ?? "";
    if (!content) return;
    this.draft = content;
    this._pendingImages = e.detail?.images ?? [];
    this.requestUpdate();
    // 流式期间输入框禁用，不抢焦点；停止后再点重问可聚焦编辑
    if (!this.viewState.streaming) {
      const ib = this.renderRoot.querySelector("input-box") as { focus?: () => void } | null;
      ib?.focus?.();
    }
  }

  /** 点击 user 气泡的「回退到这里」：算折叠数并弹确认框（ADR-2026-09-19）。 */
  private _onRewind(e: CustomEvent<{ seq: number; content: string; images?: { data: string; media_type: string }[] }>): void {
    if (this.viewState.streaming) return; // 流式期间按钮已禁用，双保险
    const anchorSeq = e.detail.seq;
    // 折叠数 = 锚点及其后的活消息（锚点回填输入框，同样从时间线消失）
    const deadCount = this.viewState.messages.filter(
      (m) => m.seq !== undefined && m.seq >= anchorSeq,
    ).length;
    this._rewindDialog = {
      seq: anchorSeq, content: e.detail.content, deadCount,
      images: e.detail.images,
    };
  }

  /** 确认回退：POST → 重拉 detail（渲染新折叠条）→ 锚点内容回填输入框。 */
  private async _onRewindConfirm(
    e: CustomEvent<{ pointSeq: number; restoreFiles: boolean }>,
  ): Promise<void> {
    const session = this.viewState.currentSession;
    const anchor = this._rewindDialog;
    this._rewindDialog = null;
    if (!session || !anchor) return;
    try {
      const res = await rewindSession(
        session.id, e.detail.pointSeq, e.detail.restoreFiles,
      );
      this.draft = anchor.content;
      this._pendingImages = anchor.images ?? [];
      const f = res.files;
      const parts: string[] = [];
      if (f.restored.length) parts.push(`恢复 ${f.restored.length} 个文件`);
      if (f.deleted.length) parts.push(`删除 ${f.deleted.length} 个文件`);
      if (f.failed.length) parts.push(`${f.failed.length} 个文件处置失败`);
      this._pushToast(
        parts.length ? `已回退（${parts.join("，")}）` : "已回退",
        f.failed.length ? "info" : "success",
        4000,
      );
      await this._loadSession(session);
    } catch (err) {
      this._pushToast(`回退失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  }

  private _onRewindCancel = (): void => {
    this._rewindDialog = null;
  };

  /** 回退确认框宿主（<dialog> 由 updated() showModal）。 */
  private _renderRewindDialog() {
    const d = this._rewindDialog;
    const session = this.viewState.currentSession;
    if (!d || !session) return nothing;
    return html`
      <dialog @cancel=${this._onRewindCancel}>
        <rewind-dialog
          .sessionId=${session.id}
          .pointSeq=${d.seq}
          .anchorContent=${d.content}
          .deadCount=${d.deadCount}
          @rewind-confirm=${this._onRewindConfirm}
          @cancel=${this._onRewindCancel}>
        </rewind-dialog>
      </dialog>`;
  }

  /** 压缩上下文模态框宿主（<dialog> 由 updated() showModal）。running 态
   *  拦截 cancel（ESC/无法点 backdrop——dialog 默认无 backdrop 点击关闭），
   *  保证压缩期间模态锁定页面。 */
  private _renderCompactDialog() {
    const d = this._compactDialog;
    if (!d) return nothing;
    return html`
      <dialog @cancel=${(e: Event) => {
        if (d.phase === "running") e.preventDefault();
        else this._onCompactCancel();
      }}>
        <compact-confirm-dialog
          .phase=${d.phase}
          .preTokens=${d.preTokens}
          .postTokens=${d.postTokens}
          .errorMessage=${d.errorMessage}
          .compactedText=${d.compactedText}
          @compact-confirm=${this._onCompactConfirm}
          @cancel=${this._onCompactCancel}
        ></compact-confirm-dialog>
      </dialog>`;
  }

  /** 孪生复制确认框宿主（2026-10-10；<dialog> 由 updated() showModal）——
   *  历史列表在 initial 分支，但渲染挂 focus 分支末尾同理可行；这里挂在
   *  initial 分支（fork 按钮只出现在历史列表）。 */
  private _renderForkDialog() {
    const s = this._forkDialogSession;
    if (!s) return nothing;
    return html`
      <dialog @cancel=${this._onForkCancel}>
        <fork-confirm-dialog
          .sessionTitle=${s.title}
          @fork-confirm=${this._onForkConfirm}
          @cancel=${this._onForkCancel}
        ></fork-confirm-dialog>
      </dialog>`;
  }

  /** PST 邮件列表行点击 → 打开派生邮件预览（与点击引用同路径）。 */
  private _onOpenPstEmail = async (e: CustomEvent<{ path: string }>): Promise<void> => {
    await this._safeAction(async () => {
      await this._openPreviewPath(e.detail.path);
    });
  };

  /** 按路径加载预览并打开预览栏（引用点击与 PST 邮件行点击共用）。 */
  /** 打开引用预览：状态机在 controller；chat 差异 = 成功/未索引才开栏
   *  （其他失败仅 toast，previewOpen 保持 false——精简宿主策略）。 */
  private async _openPreviewPath(path: string): Promise<void> {
    const state = await this._preview.open(path);
    if (state.status === "ok" || state.status === "not-indexed") {
      this.previewOpen = true;
    } else if (state.status === "error") {
      this._pushToast(`预览失败：${state.message}`, "error", 5000);
    }
  }

  private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>): void => {
    this._preview.onDirtyChange(e.detail.dirty);
  };

  private _closePreview = async (): Promise<void> => {
    await this._safeAction(() => {
      this.previewOpen = false;
      this._preview.clear();
    });
  };

  /** 预览区返回：PST 派生邮件 → 回到该 PST 的邮件列表；其余关闭预览。 */
  private _onPreviewBack = async (): Promise<void> => {
    if (isPstEmailPath(this.previewPath)) {
      await this._safeAction(async () => {
        await this._openPreviewPath(this.previewPath.split("#")[0]);
      });
      return;
    }
    await this._closePreview();
  };

/** dirty 门与保存回填已收敛 preview-controller（P1-2）。 */
  private async _safeAction(action: () => void | Promise<void>): Promise<void> {
    await this._preview.safeAction(action);
  }

  private _onPreviewSaved = (e: CustomEvent<{ content: string }>): void => {
    void this._preview.onSaved(e.detail.content);
    this._pushToast("已保存", "success", 2500);
  }

  private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>): void => {
    this._pushToast(`保存失败：${e.detail.message}`, "error", 5000);
  };

  /** 预览 pane 拷贝路径结果（clipboard 不可用时可见失败）。 */
  private _onPathCopied = (e: CustomEvent<{ ok: boolean }>): void => {
    if (e.detail.ok) this._pushToast("已复制路径", "success", 2500);
    else this._pushToast("复制失败（剪贴板不可用）", "error", 5000);
  };

  /** 预览 pane 阅读书签收藏反馈（added / duplicate / full）。 */
  private _onBookmarkAdded = (): void => this._pushToast("已收藏书签", "success", 2500);
  private _onBookmarkDuplicate = (): void => this._pushToast("此处已有书签", "info", 2500);
  private _onBookmarkFull = (): void => this._pushToast("书签已满（200 条），请先清理", "error", 5000);

  private _pushToast(message: string, level: "success" | "error" | "info", duration: number): void {
    const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _renderNotIndexedHint(): unknown {
    return html`<div class="not-indexed-hint">
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`;
  }

  render() {
    const s = this.viewState;
    if (s.state === "initial") {
      return html`
        <div class="initial-stack">
          <welcome-pane
            variant="onboarding"
            heroicon="bot"
            heading="你的个人 AI 助手"
            subheading="检索 {workdir} 知识库引用原文作答，也能读写代码、执行命令帮你开发"
            .modes=${[
              { label: "知识库问答", icon: "search" },
              { label: "AI Coding", icon: "code" },
            ]}
            .examples=${[
              "总结《2025网络安全趋势报告》的核心趋势",
              "5G 与 6G 的关键技术差异是什么？",
              "对比两篇量子计算报告的观点异同",
              "把这段 Python 脚本改成异步并发并解释改动",
            ]}
            ?hideWorkdirOnMobile=${true}
            .workdir=${store.getState().status?.workdir ?? ""}
          ></welcome-pane>
          <history-list
            title="历史会话"
            type="chat"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            .activeId=${this._highlightSessionId}
            ?importable=${true}
            @select=${this._onHistorySelect}
            @toggle-star=${this._onToggleStar}
            @fork=${this._onForkSession}
            @clear=${this._onClearHistory}
            @import=${this._onImportHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              class="text-input"
              placeholder="问助手任何问题..."
              .buttonLabel=${"发送"}
              multiline
              attachments
              .value=${this.draft}
              .images=${this._pendingImages}
              .skillItems=${this._recentSkillItems}
              .slashItems=${this._skillCandidates}
              @input-change=${(e: any) => (this.draft = e.detail.value)}
              @images-change=${(e: any) => (this._pendingImages = e.detail.images)}
              @image-reject=${(e: any) => this._pushToast(e.detail.reason, "error", 4000)}
              @skill-menu-open=${this._onSkillMenuOpen}
              @skill-pick=${this._onSkillMenuPick}
              @skill-pick-empty=${this._onSkillPickEmpty}
              @skill-browse=${this._onSkillBrowse}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
        ${this._renderSkillDialog()}
        ${this._renderVisionGateDialog()}
        ${this._renderForkDialog()}
      `;
    }
    const hasPreview = this.previewOpen;
    // mobile=true 时 preview-pane 渲染自带 mobile-header（返回/目录/高亮/
    // more=字号·编辑·下载·上传），与文件/搜索 tab 移动端对齐；桌面端传
    // false 保留常规 header。mobile 模式下 noHeader 属性被忽略，无需传。
    const previewPane = (mobile: boolean) => isPstFilePath(this.previewPath)
      ? html`<pst-email-list
          .pstPath=${this.previewPath}
          @open-email=${this._onOpenPstEmail}>
        </pst-email-list>`
      : html`<preview-pane
      ?mobile=${mobile}
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .keyword=${this._previewKeyword}
      ?writable=${this.previewWritable}
      .sizeBytes=${this.previewSizeBytes}
      .pages=${this.previewPages}
      .pageStarts=${this.previewPageStarts}
      .attachments=${this.previewAttachments}
      .tokens=${this.previewTokens}
      ?showBack=${isPstEmailPath(this.previewPath)}
      backLabel="邮件列表"
      @back=${this._onPreviewBack}
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @path-copied=${this._onPathCopied}
      @bookmark-added=${this._onBookmarkAdded}
      @bookmark-duplicate=${this._onBookmarkDuplicate}
      @bookmark-full=${this._onBookmarkFull}
    </preview-pane>`;
    return html`
      <toast-stack></toast-stack>
      <div class="focus-body ${hasPreview ? "has-preview" : ""}">
        <focus-header
          back-label="新会话"
          title=${s.currentSession?.title ?? ""}
          meta=${`${s.messages.length} 条消息`}
          .actions=${this._headerActions}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main ${hasPreview ? "has-preview" : ""}"
             style="--preview-pane-width: ${this._previewPaneWidth}px">
          <chat-stream
            .nodes=${mergeTimeline(this._rewindDividers, s.messages)}
            .modelName=${store.getState().status?.model_name ?? null}
            ?rewindDisabled=${s.streaming}
            ?generating=${s.streaming}
            ?interjectPending=${this._interjectPending}
            @reference-click=${this._onReferenceClick}
            @reask=${this._onReask}
            @rewind=${this._onRewind}
            @interject-request=${this._onInterjectRequest}
            @copy-failed=${() => this._pushToast("复制失败，请手动选择文本", "error", 5000)}>
          </chat-stream>
          ${this._activeAsk
            ? html`<ask-card
                .ask=${this._activeAsk}
                @ask-done=${this._onAskDone}>
              </ask-card>`
            : null}
          ${hasPreview ? html`
            <div class="splitter desktop-only"
                 role="separator"
                 aria-orientation="vertical"
                 aria-label="调整预览栏宽度"
                 @mousedown=${this._onSplitterMouseDown}></div>
            <div class="preview-pane-wrap desktop-only">
              <button class="preview-close" type="button" aria-label="关闭预览"
                      @click=${this._closePreview}><doclens-icon name="x"></doclens-icon></button>
              ${this.previewError === "NOT_INDEXED"
                ? this._renderNotIndexedHint()
                : previewPane(false)}
            </div>` : null}
        </div>
        <div class="input-bar">
          <input-box
            class="text-input"
            placeholder=${s.pendingAsk ? "请先回答上方的问题…" : "继续提问..."}
            .buttonLabel=${"发送"}
            multiline
            attachments
            ?streaming=${s.streaming || !!s.pendingAsk}
            .value=${this.draft}
            .images=${this._pendingImages}
            .skillItems=${this._recentSkillItems}
            .slashItems=${this._skillCandidates}
            @input-change=${(e: any) => (this.draft = e.detail.value)}
            @images-change=${(e: any) => (this._pendingImages = e.detail.images)}
            @image-reject=${(e: any) => this._pushToast(e.detail.reason, "error", 4000)}
            @skill-menu-open=${this._onSkillMenuOpen}
            @skill-pick=${this._onSkillMenuPick}
            @skill-pick-empty=${this._onSkillPickEmpty}
            @skill-browse=${this._onSkillBrowse}
            @submit=${this._submit}
            @stop=${this._stop}>
          </input-box>
        </div>
      </div>
      ${hasPreview ? html`
        <div class="preview-overlay" data-ptr-off>
          ${this.previewError === "NOT_INDEXED" || isPstFilePath(this.previewPath)
            /* 未索引 / PST 邮件列表没有 preview-pane 托管头部，
               保留 focus-header 提供返回导航 */
            ? html`
                <focus-header
                  back-label="返回"
                  title=${this.previewPath}
                  @back=${this._onPreviewBack}>
                </focus-header>
                ${this.previewError === "NOT_INDEXED"
                  ? this._renderNotIndexedHint()
                  : previewPane(false)}`
            : previewPane(true)}
        </div>` : null}
      ${this._renderSkillDialog()}
      ${this._renderRenameDialog()}
      ${this._renderVisionGateDialog()}
      ${this._renderInterjectDialog()}
      ${this._renderInfoDialog()}
      ${this._renderRewindDialog()}
      ${this._renderCompactDialog()}
    `;
  }

  /** 技能选择对话框宿主（两分支共用；<dialog> 由 updated() showModal）。 */
  private _renderSkillDialog() {
    if (!this._skillDialogOpen) return nothing;
    return html`
      <dialog @cancel=${this._onSkillDialogCancel}>
        <skill-toolbox-dialog
          .skills=${this._skillCandidates}
          .error=${this._skillCandidatesError}
          @pick=${this._onSkillDialogPick}
          @cancel=${this._onSkillDialogCancel}
        ></skill-toolbox-dialog>
      </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-view": ChatView;
  }
}
