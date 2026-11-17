/** 对话技能域（AP-1 拆分：chat-view 的斜杠技能与候选菜单）。
 *
 * 对话页的技能相关行为自成一体：候选取数（全部启用且未删除的技能）、
 * 最近使用项与候选求交（停用/删除静默消失）、斜杠消息提交校验
 * （首字符 / 即技能模式，合法集合 = 候选）、技能直发（/技能名 问题）。
 * 此前全部内联在 chat-view——迁入本 controller，视图只留事件接线。
 */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { listSkillsManage } from "../api/skills";
import type { SkillInfo } from "../api/skills";
import {
  getRecentSkillNames,
  recordSkillUse,
  RECENT_SKILLS_MENU_CAP,
} from "../state/recent-skills";

/** 斜杠技能调用的提交校验结果：
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

export interface ChatSkillsOptions {
  /** 预填技能前缀到输入框（尾随空格，斜杠下拉不会误弹）。 */
  prefillSkill: (name: string) => void;
  /** 以斜杠形态发送（技能名 + 当前草稿问题）。 */
  sendWithSkill: (name: string) => Promise<void> | void;
}

export class ChatSkillsController implements ReactiveController {
  /** 对话技能候选 = 全部启用且未删除的技能；null = 未加载/加载中。 */
  candidates: SkillInfo[] | null = null;
  /** 候选加载错误（对话框内展示）。 */
  error: string | null = null;
  /** 技能选择对话框开关。 */
  dialogOpen = false;

  private host: ReactiveControllerHost;
  private opts: ChatSkillsOptions;

  constructor(host: ReactiveControllerHost, opts: ChatSkillsOptions) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  hostConnected() {}
  hostDisconnected() {}

  private _touch(): void {
    this.host.requestUpdate();
  }

  /** 拉取对话技能候选（ADR-0016 §1，与工具箱白名单独立）。 */
  async loadCandidates(): Promise<void> {
    try {
      const items = await listSkillsManage();
      this.candidates = items
        .filter((s) => s.enabled && !s.deleted)
        .map((s) => ({ name: s.name, description: s.description, icon: s.icon }));
      this.error = null;
    } catch (e) {
      this.error = (e as Error)?.message || "技能列表加载失败";
    }
    this._touch();
  }

  /** 传给 input-box 的最近技能项：与候选求交（停用/删除静默消失）取前 3；
   *  候选全空 → null（caret 隐藏，退化为普通发送按钮，ADR-0016 §5）。 */
  get recentItems(): { name: string; icon?: string }[] | null {
    const cands = this.candidates;
    if (cands !== null && cands.length === 0) return null;
    if (!cands) return []; // 未加载：caret 可用，菜单暂只显示「选择技能…」
    const byName = new Map(cands.map((c) => [c.name, c]));
    return getRecentSkillNames()
      .filter((n) => byName.has(n))
      .slice(0, RECENT_SKILLS_MENU_CAP)
      .map((n) => ({ name: n, icon: byName.get(n)!.icon }));
  }

  /** caret 菜单打开：刷新候选（设置页可能刚改过启用状态），recents 重算随之更新。 */
  onMenuOpen(): void {
    void this.loadCandidates();
  }

  /** 菜单「选择技能…」→ 弹技能选择对话框（刷新候选保证最新）。 */
  openDialog(): void {
    this.dialogOpen = true;
    this._touch();
    void this.loadCandidates();
  }

  cancelDialog(): void {
    this.dialogOpen = false;
    this._touch();
  }

  /** 对话框选中技能：草稿为空 → 预填前缀供续写；否则直接以斜杠形态发送。 */
  pickFromDialog(skill: SkillInfo, hasDraft: boolean): void {
    this.dialogOpen = false;
    this._touch();
    if (!hasDraft) {
      this.opts.prefillSkill(skill.name);
      return;
    }
    void this.opts.sendWithSkill(skill.name);
  }

  /** caret 菜单选中技能：直接以斜杠形态发送。 */
  pickFromMenu(name: string): void {
    void this.opts.sendWithSkill(name);
  }

  /** 空输入时从 caret 菜单选技能：预填 `/name `（用户续写问题后发送），
   *  而非直接发送——没有可发送的问题（2026-10-21：caret 空输入不再禁用）。 */
  prefillOnly(name: string): void {
    this.opts.prefillSkill(name);
  }

  /** 提交前校验斜杠技能名；合法则记录最近技能。 */
  checkSubmit(message: string): SlashCheck {
    const check = checkSlashSubmit(message, this.candidates);
    if (check.type === "ok") recordSkillUse(check.name);
    return check;
  }

  /** 记录一次技能使用（技能直发路径）。 */
  recordUse(name: string): void {
    recordSkillUse(name);
  }
}
