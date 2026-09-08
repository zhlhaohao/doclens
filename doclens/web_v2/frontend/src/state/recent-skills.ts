/** 最近技能（ADR-0016 §2）：用户显式选择技能的本地记账。
 *
 * 只记用户主动点选（对话页菜单/对话框、files 工具箱），AI 自主 load_skill 不记账。
 * 按最后选择时间倒序去重存数组（最新在头），缓存上限 CACHE_CAP 条，
 * 菜单展示时由调用方与当前候选求交后取前 MENU_CAP 个——失效条目（停用/删除）
 * 不清缓存，技能恢复启用后自然回来。
 * localStorage 不可用时静默降级为内存态（隐私模式等），不抛错。
 */

const STORAGE_KEY = "cortex.recentSkills";
/** 缓存上限（多于菜单展示数，给失效条目留出恢复空间） */
const CACHE_CAP = 10;
/** 菜单展示上限 */
export const RECENT_SKILLS_MENU_CAP = 3;

let memoryFallback: string[] | null = null;

function readAll(): string[] {
  let raw: string | null;
  try {
    const ls = globalThis.localStorage;
    // localStorage 不存在/抛错（隐私模式等）才回落内存态
    if (!ls) return memoryFallback ?? [];
    raw = ls.getItem(STORAGE_KEY);
  } catch {
    return memoryFallback ?? [];
  }
  // 键不存在 = 空；内容损坏 = 空（不回落内存态——内存态只兜「存储不可用」）
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeAll(names: string[]): void {
  memoryFallback = names;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    /* 隐私模式等写不进去：内存态已更新，本次会话内仍生效 */
  }
}

/** 最近选择的技能名，最新在头（未与候选求交，可能含已停用/删除项）。 */
export function getRecentSkillNames(): string[] {
  return readAll();
}

/** 记一笔用户显式选择：倒序去重，最新到头部，截断到缓存上限。 */
export function recordSkillUse(name: string): void {
  if (!name) return;
  const rest = readAll().filter((n) => n !== name);
  writeAll([name, ...rest].slice(0, CACHE_CAP));
}
