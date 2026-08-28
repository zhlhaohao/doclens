/** 四 tab 最后选择的跨重启记忆（localStorage 持久化）。
 *
 * 切 tab 本就不丢（app.ts keep-alive + 全局 store 单例）；本模块只处理
 * 重启/刷新：写入侧由 session-persistence.ts 集中订阅 store，恢复侧仅
 * 启动一次写回 store——本层是纯存储（零依赖，不 import store）。
 *
 * 语义：「选择」而非「内容」——目录/选中文件/会话 id/关键词/子 tab/
 * 日期，内容（预览、消息流、搜索结果）重启后由用户点一下再加载。
 *
 * 存储：单 JSON（读改写浅合并，与 scroll-memory 同模式）；逐字段
 * 枚举/类型校验，损坏或非法返回空。 */

import { parseLocalDate, formatDate } from "../components/diary-calendar";

const KEY = "cortex.session.lastSelection";
const MAX_SELECTED_PATHS = 100;
const MAX_STR_LEN = 4096;

export type MainView = "search" | "chat" | "files" | "diary";
export type DiaryTab = "record" | "review";

export interface SessionMemory {
  view?: MainView;
  files?: { currentDir: string; selectedPaths: string[] };
  search?: { query: string };
  chat?: { sessionId: string };
  diary?: { tab: DiaryTab; reviewDate: string };
}

const MAIN_VIEWS: readonly MainView[] = ["search", "chat", "files", "diary"];

function isPlainString(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_STR_LEN;
}

/** reviewDate 合法性：YYYY-MM-DD、真实日历日（roundtrip 挡 2026-02-31）、
 *  不晚于本地今天（未来日期无回顾意义）。 */
export function isValidReviewDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseLocalDate(s);
  if (Number.isNaN(d.getTime())) return false;
  if (formatDate(d) !== s) return false;
  const today = formatDate(new Date());
  return s <= today;
}

/** 读取并校验整份记忆；损坏/非法返回空对象。 */
export function loadSessionMemory(): SessionMemory {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const b = raw as Record<string, unknown>;
  const out: SessionMemory = {};

  const view = b.view;
  if (typeof view === "string" && (MAIN_VIEWS as readonly string[]).includes(view)) {
    out.view = view as MainView;
  }

  const files = b.files;
  if (typeof files === "object" && files !== null && !Array.isArray(files)) {
    const f = files as Record<string, unknown>;
    const currentDir = f.currentDir;
    const selectedPaths = f.selectedPaths;
    if (isPlainString(currentDir) && Array.isArray(selectedPaths)) {
      const paths = [...new Set(selectedPaths.filter(isPlainString))].slice(0, MAX_SELECTED_PATHS);
      out.files = { currentDir, selectedPaths: paths };
    }
  }

  const search = b.search;
  if (typeof search === "object" && search !== null && !Array.isArray(search)) {
    const query = (search as Record<string, unknown>).query;
    if (isPlainString(query)) out.search = { query };
  }

  const chat = b.chat;
  if (typeof chat === "object" && chat !== null && !Array.isArray(chat)) {
    const sessionId = (chat as Record<string, unknown>).sessionId;
    if (isPlainString(sessionId)) out.chat = { sessionId };
  }

  const diary = b.diary;
  if (typeof diary === "object" && diary !== null && !Array.isArray(diary)) {
    const d = diary as Record<string, unknown>;
    const tab = d.tab;
    const reviewDate = d.reviewDate;
    if (
      (tab === "record" || tab === "review") &&
      typeof reviewDate === "string" &&
      isValidReviewDate(reviewDate)
    ) {
      out.diary = { tab, reviewDate };
    }
  }

  return out;
}

/** 读改写浅合并（files/search/chat/diary 整组覆盖）；写失败静默。 */
export function saveSessionMemory(patch: Partial<SessionMemory>): void {
  const merged: SessionMemory = { ...loadSessionMemory(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // 配额满等写入失败：静默降级，不影响功能
  }
}
