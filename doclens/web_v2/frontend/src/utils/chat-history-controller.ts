/** 会话历史域（AP-1 拆分：chat-view 的历史列表状态机）。
 *
 * 历史列表的取数与展示规则自成一体：分页拉取（服务端 offset/limit）、
 * 星标置顶开关（localStorage 持久化 + 前端混排）、乐观星标翻转与回滚、
 * 清空（加星受保护）、当前会话高亮。此前全部内联在 chat-view——
 * 迁入本 controller，视图只保留渲染与事件接线。
 */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { clearSessions, listSessions, starSession } from "../api/sessions";
import { actions, store } from "../state/store";
import type { Session } from "../state/types";

/** 历史列表每页条数（与后端分页一致）。 */
export const HISTORY_PAGE_SIZE = 200;

export interface ChatHistoryOptions {
  /** toast 报告通道。 */
  toast: (message: string, level: "success" | "error" | "info", duration: number) => void;
  /** 星标置顶开关的持久化键（localStorage）。 */
  storageKey: string;
  /** 当前会话 id（星标同步与高亮判定用）。 */
  currentSessionId: () => string | null;
  /** 同步当前会话对象的星标态。 */
  syncCurrentSessionStar: (sessionId: string, starred: boolean) => void;
}

export class ChatHistoryController implements ReactiveController {
  /** 历史列表条目。 */
  sessions: Session[] = [];
  /** 当前分页（1-based）。 */
  page = 1;
  /** 星标置顶开关（false = 加星条目按时间混排）。 */
  starPin: boolean;
  /** 会话列表高亮 id：重启恢复的「上次会话」（纯展示，不拉消息流）。 */
  highlightSessionId: string | null = null;
  /** 清空进行中（列表禁用）。 */
  clearing = false;

  private host: ReactiveControllerHost;
  private opts: ChatHistoryOptions;

  constructor(host: ReactiveControllerHost, opts: ChatHistoryOptions) {
    this.host = host;
    this.opts = opts;
    this.starPin = this._readStarPin();
    host.addController(this);
  }

  hostConnected() {}
  hostDisconnected() {}

  private _touch(): void {
    this.host.requestUpdate();
  }

  private _readStarPin(): boolean {
    try {
      return localStorage.getItem(this.opts.storageKey) !== "0";
    } catch {
      return true; // storage 不可用：默认置顶
    }
  }

  /** 是否有下一页（当前页满）。 */
  get hasMore(): boolean {
    return this.sessions.length >= HISTORY_PAGE_SIZE;
  }

  /** 拉取历史列表（服务端分页；后端固定 starred DESC 返回）。 */
  async load(page = 1): Promise<void> {
    try {
      const offset = (page - 1) * HISTORY_PAGE_SIZE;
      const res = await listSessions({
        type: "chat", limit: HISTORY_PAGE_SIZE, offset,
      });
      // 防御异常响应体（代理错误页 / 字段缺失 → sessions 为 undefined）：
      // 原实现直接赋值会让列表长度读取崩溃（整个对话页白屏）——统一兜底为空列表
      const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
      // 混排模式下按时间整理回时间线
      this.sessions = this.starPin
        ? sessions
        : [...sessions].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      this.page = page;
    } catch (e) {
      console.warn("load history failed", e);
    }
    this._touch();
  }

  /** 翻页（翻页后回到列表顶部）。 */
  async goToPage(page: number): Promise<void> {
    await this.load(page);
    // 翻页后回到列表顶部（列表在宿主的 shadow DOM 内，经 renderRoot 查）
    const host = this.host as unknown as { renderRoot?: ParentNode };
    host.renderRoot?.querySelector("history-list")?.scrollIntoView({ block: "start" });
  }

  /** 星标置顶开关：仅影响前端展示排序（后端仍按 starred DESC 返回），
   *  关闭时把已拉取的星标条目按时间混排回去。 */
  async setStarPin(value: boolean): Promise<void> {
    this.starPin = value;
    try {
      localStorage.setItem(this.opts.storageKey, value ? "1" : "0");
    } catch {
      /* storage 不可用：仅本次会话生效 */
    }
    if (!this.starPin) {
      this.sessions = [...this.sessions]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      this._touch();
    } else {
      // 重新拉第 1 页（load 内部按 starPin 整理）
      await this.load(1);
    }
  }

  /** 星标切换：乐观翻转 starred，但保持列表顺序不变（重排在下次加载历史
   *  时自然发生），失败回滚。 */
  async toggleStar(sessionId: string, starred: boolean): Promise<void> {
    const prev = this.sessions;
    this.sessions = prev.map((s) => (s.id === sessionId ? { ...s, starred } : s));
    this._touch();
    try {
      await starSession(sessionId, starred);
      // 同步当前会话对象（加星态跟随，如 header/恢复逻辑消费）
      this.opts.syncCurrentSessionStar(sessionId, starred);
    } catch (err) {
      this.sessions = prev;
      this.opts.toast(`加星失败：${(err as Error)?.message || err}`, "error", 5000);
      this._touch();
    }
  }

  /** 清空历史（加星会话受保护：后端跳过，本地保留）。 */
  async clear(): Promise<void> {
    this.clearing = true;
    this._touch();
    try {
      const res = await clearSessions("chat");
      this.sessions = this.sessions.filter((s) => s.starred);
      if (res.skipped_starred > 0) {
        this.opts.toast(
          `已清空 ${res.deleted_count} 条，${res.skipped_starred} 条加星会话保留`,
          "info", 3500,
        );
      }
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this.clearing = false;
      this._touch();
    }
  }

  /** 设置高亮会话（进入会话后跟随真实 id，返回欢迎页清空）。 */
  setHighlight(sessionId: string | null): void {
    this.highlightSessionId = sessionId;
    this._touch();
  }

  /** 同步当前会话的星标态到 store（供视图调用）。 */
  syncStarToStore(sessionId: string, starred: boolean): void {
    const cur = store.getState().chat.currentSession;
    if (cur && cur.id === sessionId) {
      actions.setChatState({ currentSession: { ...cur, starred } });
    }
  }
}
