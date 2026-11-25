/** 最近员工（数字员工，ADR-0062）：用户显式选择员工的本地记账。
 *
 * 与「最近技能」同构：只记用户主动点选（对话框 / 菜单），按最后选择时间倒序
 * 去重存数组（最新在头），菜单展示时与当前员工候选求交取前 MENU_CAP 个——
 * 已删除员工不清缓存，自然消失。localStorage 不可用时静默降级为内存态。
 */

const STORAGE_KEY = "cortex.recentEmployees";
const CACHE_CAP = 10;
export const RECENT_EMPLOYEES_MENU_CAP = 3;

let memoryFallback: string[] | null = null;

function readAll(): string[] {
  let raw: string | null;
  try {
    const ls = globalThis.localStorage;
    if (!ls) return memoryFallback ?? [];
    raw = ls.getItem(STORAGE_KEY);
  } catch {
    return memoryFallback ?? [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeAll(ids: string[]): void {
  memoryFallback = ids;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* 隐私模式等：内存态已更新，本次会话内仍生效 */
  }
}

/** 最近选择的员工 id，最新在头（未与候选求交）。 */
export function getRecentEmployeeIds(): string[] {
  return readAll();
}

/** 记一笔用户显式选择：倒序去重，最新到头部，截断到缓存上限。 */
export function recordEmployeeUse(id: string): void {
  if (!id) return;
  const rest = readAll().filter((n) => n !== id);
  writeAll([id, ...rest].slice(0, CACHE_CAP));
}
