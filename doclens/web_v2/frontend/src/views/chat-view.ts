import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import { loadSessionMemory } from "../utils/session-memory";
import type { Session, ChatMessage, ToolStep, PendingAsk } from "../state/types";
import { chatStream, stopChat } from "../api/chat";
import type { ChatStreamEvent } from "../api/chat";
import { validateAskQuestions } from "../api/ask";
import "../components/ask-card";
import { createSession, listSessions, clearSessions, renameSession, starSession, rewindSession, fetchSessionDetail, compactSession } from "../api/sessions";
import { fetchPreview } from "../api/preview";
import type { PageMarker, PstAttachmentInfo } from "../api/preview";
import { isPstFilePath, isPstEmailPath } from "../api/pst";
import { listSkillsManage } from "../api/skills";
import type { SkillInfo } from "../api/skills";
import { getRecentSkillNames, recordSkillUse, RECENT_SKILLS_MENU_CAP } from "../state/recent-skills";
import { buildChatTimeline, mergeTimeline } from "./chat-timeline";
import type { RewindDivider } from "./chat-timeline";
import { formatTokens } from "../utils/format";
// 向后兼容再导出：mapSessionItemsToMessages 已迁至 chat-timeline（纯函数模块）
export { mapSessionItemsToMessages } from "./chat-timeline";
import "../components/skill-toolbox-dialog";
import "../components/session-rename-dialog";
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

/** 将一个流式事件不可变地应用到 messages，返回新数组；非 assistant 末条则原样返回。 */
export function applyStreamEvent(messages: ChatMessage[], ev: ChatStreamEvent): ChatMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return messages;
  const head = messages.slice(0, -1);

  if (ev.type === "token") {
    return [...head, { ...last, content: last.content + ev.text }];
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
        radial-gradient(720px 280px at 50% -80px, rgba(0, 100, 224, 0.08), transparent 70%);
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
      flex: 0 0 var(--preview-pane-width, 420px);
      min-width: 300px;
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
    /* 移动端预览 overlay */
    .preview-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-card-bg);
      display: flex;
      flex-direction: column;
      z-index: 10;
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
  /** 当前渲染的 ask 卡片载荷（交互态→摘要态由卡片内部管理；
   *  与 store.pendingAsk 分离：提交后输入恢复但摘要保留至流结束） */
  @state() private _activeAsk: PendingAsk | null = null;
  @state() private historySessions: Session[] = [];
  /** 会话列表高亮 id：重启恢复的「上次会话」（纯展示，不拉消息流）；
   *  进入会话后跟随真实 id，返回 initial 清空。 */
  @state() private _highlightSessionId: string | null = null;
  @state() private _clearing = false;
  @state() private previewOpen = false;
  @state() private previewContent = "";
  @state() private previewPath = "";
  @state() private previewLanguage = "text";
  @state() private previewPages: PageMarker[] | null = null;
  @state() private previewAttachments: PstAttachmentInfo[] | null = null;
  @state() private previewWritable = false;
  @state() private previewError: "NOT_INDEXED" | null = null;
  @state() private previewDirty = false;
  @state() private _previewPaneWidth = ChatView.PREVIEW_PANE_WIDTH_DEFAULT;
  /** 对话技能候选（ADR-0016 §1：全部启用技能）；null = 未加载/加载中 */
  @state() private _skillCandidates: SkillInfo[] | null = null;
  @state() private _skillCandidatesError: string | null = null;
  /** 技能选择对话框开关（caret 菜单「选择技能…」触发） */
  @state() private _skillDialogOpen = false;
  @state() private _renameDialogOpen = false; // 会话标题改名对话框（focus-header more 菜单）
  @state() private _infoDialogOpen = false;   // 会话信息对话框（more 菜单，2026-09-17）
  /** 压缩上下文确认框开关（more 菜单「压缩上下文」→ 确认后才执行） */
  @state() private _compactDialogOpen = false;
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
  @state() private _rewindDialog: { seq: number; content: string; deadCount: number } | null = null;
  private _unsubscribe?: () => void;
  /** 当前流式请求的中断控制器；_stop() 会 abort 它并通知后端停。 */
  private _abortController: AbortController | null = null;
  /** 断开续跑轮询定时器（ADR-0028）：恢复态 generating 占位期间 5s 轮询
   *  detail，跑完自动刷新展示；离开会话/停止后清除。 */
  private _genPollTimer?: number;

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
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

  /** 菜单「选择技能…」→ 弹技能选择对话框（刷新候选保证最新）。 */
  private _onSkillBrowse = () => {
    this._skillDialogOpen = true;
    void this._loadSkillCandidates();
  };

  private _onSkillDialogPick = (e: CustomEvent<{ skill: SkillInfo }>) => {
    this._skillDialogOpen = false;
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
        onClick: () => { this._compactDialogOpen = true; },
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
   *  条目，下轮起上下文从摘要开始；对话流展示不受影响。 */
  private async _compactSession() {
    const session = this.viewState.currentSession;
    if (!session || this._compacting) return;
    this._compacting = true;
    this._pushToast("正在压缩会话历史…", "info", 60000);
    try {
      const body = await compactSession(session.id);
      this._pushToast(
        `已压缩（约 ${formatTokens(body.pre_tokens ?? 0)} → ${formatTokens(body.post_tokens ?? 0)} tokens）`,
        "success", 4000,
      );
      void this._refreshCompaction();
    } catch (err) {
      this._pushToast(`压缩失败：${(err as Error)?.message || err}`, "error", 5000);
    } finally {
      this._compacting = false;
    }
  }

  /** 确认压缩：关框后执行（_compactSession 自带防重入与结果 toast）。 */
  private _onCompactConfirm = (): void => {
    this._compactDialogOpen = false;
    void this._compactSession();
  };

  private _onCompactCancel = (): void => {
    this._compactDialogOpen = false;
  };

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
  }

  /** 启动自动恢复（ADR-0028）：上次会话仍在后台生成 → 直接进入该会话
   *  恢复态（generating 占位 + 轮询），否则保持 initial 只高亮。 */
  private async _autoResumeIfGenerating(sessionId: string): Promise<void> {
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

  private get viewState() {
    return store.getState().chat;
  }

  private async _submit(e: CustomEvent<{ value: string }>) {
    this._resetPreview();
    const message = e.detail.value;

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
      await this._ensureSession(message, message);
      await this._sendMessage(message, true);
      return;
    }
    await this._sendMessage(message);
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
  private async _ensureSession(title: string, message: string, mode?: "skill"): Promise<void> {
    const created = await createSession({ type: "chat", title: title.slice(0, 60), preview: message.slice(0, 100), mode });
    this._sessionUsage = null; // 新会话：清空上一会话的上下文占用
    this._rewindDividers = []; // 新会话：无回退边界
    this._rewindDialog = null;
    actions.setChatState({
      state: "focus",
      currentSession: {
        id: created.id, type: "chat", title: title.slice(0, 60),
        preview: message.slice(0, 100), mode, updated_at: new Date().toISOString(),
        message_count: 0,
      },
      messages: [{ role: "user", content: message }],
      streaming: true,
    });
  }

  /** 追加用户消息并发起流式请求（会话已就位）。
   *  firstOfSession=true 时用户气泡已由 _ensureSession 加入，不重复追加。 */
  private async _sendMessage(message: string, firstOfSession = false): Promise<void> {
    if (!firstOfSession) {
      actions.setChatState({
        messages: [...this.viewState.messages, { role: "user", content: message }],
        streaming: true,
      });
    } else {
      actions.setChatState({ streaming: true });
    }

    const sessionId = store.getState().chat.currentSession!.id;

    // message_user / message_ai 均由后端统一落库（ADR-0028）——前端不再
    // 写 DB（收尾展示条目 message_ai 与本轮 message_user 都在 chat.py），
    // 断开续跑/正常完成/停止丢弃的落库口径由后端单一掌控。

    // assistant 占位 + 起始 messages（不可变）
    const placeholder: ChatMessage = { role: "assistant", content: "" };
    let messages = [...store.getState().chat.messages, placeholder];
    actions.setChatState({ messages });

    // 建立中断控制器：_stop() 会 abort 它 + 通知后端停（abort 抛 AbortError 走静默路径）
    this._abortController = new AbortController();

    try {
      for await (const ev of chatStream({ message, session_id: sessionId }, this._abortController.signal)) {
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
        } else if (ev.type !== "done") {
          messages = applyStreamEvent(messages, ev);
          actions.setChatState({ messages });
        }
      }

      // 展示层 message_ai 已由后端统一落库（ADR-0028）；前端只在本地
      // 维持流式视图（重进会话时经 detail 重建）
      this._loadHistory();
    } catch (err) {
      if (this._isAbortError(err)) {
        // 用户主动停止：保留已生成的半截回答（2026-09-22 语义变更：后端
        // 同步落库 message_ai，重进会话可见；原「UI==DB 都丢弃」废弃）。
        // 残留 running 步骤标记为中断，不弹错误 toast
        messages = finalizeInterruptedMessages(messages);
        actions.setChatState({ messages });
        this._loadHistory();
      } else {
        // 连接中断 / 异常：保留已收到内容，把残留 running 步骤标记为中断。
        // 断开续跑自愈（ADR-0028）：后端可能仍在生成——重拉 detail 接管：
        // generating → 恢复态占位 + 轮询；已完成 → 直接展示补写结果。
        messages = finalizeInterruptedMessages(messages);
        actions.setChatState({ messages });
        actions.setError(`对话失败: ${(err as Error).message}`);
        const cur = store.getState().chat.currentSession;
        if (cur && cur.id === sessionId) {
          void this._loadSession(cur);
        }
      }
    } finally {
      this._abortController = null;
      // 流结束即撤下交互卡片：问答已由消息内 tool trace 持久化展示，
      // 外挂卡片（_activeAsk）只服务悬置期交互，留着会重复/残留
      this._activeAsk = null;
      actions.setChatState({ streaming: false, pendingAsk: null });
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
    this._highlightSessionId = null; // 「新对话」返回后不残留旧高亮
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
    this.previewContent = "";
    this.previewPath = "";
    this.previewLanguage = "text";
    this.previewPages = null;
    this.previewAttachments = null;
    this.previewWritable = false;
    this.previewError = null;
    this.previewDirty = false;
  }

  private async _loadSession(s: Session) {
    this._resetPreview();
    this._activeAsk = null;
    this._highlightSessionId = s.id;
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
  private _onReask(e: CustomEvent<{ content: string }>): void {
    const content = e.detail?.content ?? "";
    if (!content) return;
    this.draft = content;
    this.requestUpdate();
    // 流式期间输入框禁用，不抢焦点；停止后再点重问可聚焦编辑
    if (!this.viewState.streaming) {
      const ib = this.renderRoot.querySelector("input-box") as { focus?: () => void } | null;
      ib?.focus?.();
    }
  }

  /** 点击 user 气泡的「回退到这里」：算折叠数并弹确认框（ADR-2026-09-19）。 */
  private _onRewind(e: CustomEvent<{ seq: number; content: string }>): void {
    if (this.viewState.streaming) return; // 流式期间按钮已禁用，双保险
    const anchorSeq = e.detail.seq;
    // 折叠数 = 锚点及其后的活消息（锚点回填输入框，同样从时间线消失）
    const deadCount = this.viewState.messages.filter(
      (m) => m.seq !== undefined && m.seq >= anchorSeq,
    ).length;
    this._rewindDialog = { seq: anchorSeq, content: e.detail.content, deadCount };
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

  /** 压缩上下文确认框宿主（<dialog> 由 updated() showModal）。 */
  private _renderCompactDialog() {
    if (!this._compactDialogOpen) return nothing;
    return html`
      <dialog @cancel=${this._onCompactCancel}>
        <compact-confirm-dialog
          @compact-confirm=${this._onCompactConfirm}
          @cancel=${this._onCompactCancel}
        ></compact-confirm-dialog>
      </dialog>`;
  }

  /** PST 邮件列表行点击 → 打开派生邮件预览（与点击引用同路径）。 */
  private _onOpenPstEmail = async (e: CustomEvent<{ path: string }>): Promise<void> => {
    await this._safeAction(async () => {
      await this._openPreviewPath(e.detail.path);
    });
  };

  /** 按路径加载预览并打开预览栏（引用点击与 PST 邮件行点击共用）。 */
  private async _openPreviewPath(path: string): Promise<void> {
    this.previewError = null;
    // PST 物理文件：预览 = 分页邮件列表组件（自取数），不走 /api/preview
    if (isPstFilePath(path)) {
      this.previewContent = "";
      this.previewPath = path;
      this.previewLanguage = "text";
      this.previewWritable = false;
      this.previewPages = null;
      this.previewAttachments = null;
      this.previewOpen = true;
      return;
    }
    const result = await fetchPreview(path);
    if (result.ok) {
      this.previewContent = result.content;
      this.previewPath = result.path;
      this.previewLanguage = result.language;
      this.previewWritable = result.writable;
      this.previewPages = result.pages;
      this.previewAttachments = result.attachments;
      this.previewOpen = true;
    } else if (result.notIndexed) {
      this.previewError = "NOT_INDEXED";
      this.previewContent = "";
      this.previewPath = path;
      this.previewWritable = false;
      this.previewPages = null;
      this.previewAttachments = null;
      this.previewOpen = true;
    } else {
      this._pushToast(`预览失败：${result.message}`, "error", 5000);
    }
  }

  private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>): void => {
    this.previewDirty = e.detail.dirty;
  };

  private _closePreview = async (): Promise<void> => {
    await this._safeAction(() => {
      this.previewOpen = false;
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

  private async _safeAction(action: () => void | Promise<void>): Promise<void> {
    if (this.previewDirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return;
      const pp = this.shadowRoot?.querySelector("preview-pane") as any;
      pp?.discard?.();
      this.previewDirty = false;
    }
    await action();
  }

  private _onPreviewSaved = (): void => {
    this.previewDirty = false;
    this._pushToast("已保存", "success", 2500);
  };

  private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>): void => {
    this._pushToast(`保存失败：${e.detail.message}`, "error", 5000);
  };

  private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>): void => {
    // 清掉可能残留的编辑脏标志（上传可能发生在 edit 模式下），避免
    // 后续切换结果时弹出陈旧的"丢弃修改？"确认框
    this.previewDirty = false;
    this._pushToast(`已覆盖：${e.detail.path}`, "success", 2500);
    // 上传是外部覆盖（不像 PUT /api/preview 已含新内容），必须重新拉取
    void this._reloadPreview();
  };

  private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>): void => {
    this._pushToast(`上传失败：${e.detail.message}`, "error", 5000);
  };

  /** 上传成功后用：按当前 previewPath 重新拉取完整预览内容（不缩行范围）。 */
  private async _reloadPreview(): Promise<void> {
    if (!this.previewPath) return;
    const r = await fetchPreview(this.previewPath);
    if (r.ok) {
      this.previewContent = r.content;
      this.previewLanguage = r.language;
      this.previewWritable = r.writable;
      this.previewPages = r.pages;
      this.previewAttachments = r.attachments;
    }
  }

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
            heroicon="sparkles"
            heading="与你的知识库对话"
            subheading="用自然语言提问，AI 会自动检索当前工作目录{workdir} 的知识库并引用原文回答"
            .modes=${[
              { label: "自动检索", icon: "search" },
              { label: "引用原文", icon: "book-open" },
            ]}
            .examples=${[
              "总结上周写过的所有技术文档",
              "找出所有提到 X 的段落并对比",
              "这篇文章的核心观点是什么？",
            ]}
            .workdir=${store.getState().status?.workdir ?? ""}
          ></welcome-pane>
          <history-list
            title="历史会话"
            type="chat"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            .activeId=${this._highlightSessionId}
            @select=${this._onHistorySelect}
            @toggle-star=${this._onToggleStar}
            @clear=${this._onClearHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              class="text-input"
              placeholder="问 Doclens 任何问题..."
              .buttonLabel=${"发送"}
              multiline
              .value=${this.draft}
              .skillItems=${this._recentSkillItems}
              .slashItems=${this._skillCandidates}
              @input-change=${(e: any) => (this.draft = e.detail.value)}
              @skill-menu-open=${this._onSkillMenuOpen}
              @skill-pick=${this._onSkillMenuPick}
              @skill-browse=${this._onSkillBrowse}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
        ${this._renderSkillDialog()}
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
      .pages=${this.previewPages}
      .attachments=${this.previewAttachments}
      ?showBack=${isPstEmailPath(this.previewPath)}
      backLabel="邮件列表"
      @back=${this._onPreviewBack}
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}>
    </preview-pane>`;
    return html`
      <toast-stack></toast-stack>
      <div class="focus-body">
        <focus-header
          back-label="新对话"
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
            @reference-click=${this._onReferenceClick}
            @reask=${this._onReask}
            @rewind=${this._onRewind}
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
            placeholder=${s.pendingAsk ? "请先回答上方的问题…" : "继续对话..."}
            .buttonLabel=${"发送"}
            multiline
            ?streaming=${s.streaming || !!s.pendingAsk}
            .value=${this.draft}
            .skillItems=${this._recentSkillItems}
            .slashItems=${this._skillCandidates}
            @input-change=${(e: any) => (this.draft = e.detail.value)}
            @skill-menu-open=${this._onSkillMenuOpen}
            @skill-pick=${this._onSkillMenuPick}
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
