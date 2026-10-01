/** 阅读书签 store（localStorage 持久化，2026-10-01 决议）。
 *
 * 语义与「滚动记忆」（scroll-memory）分工并存：
 * - 滚动记忆：隐式自动的「上次读到哪」，每文件单条、无 UI、LRU 逐出。
 * - 阅读书签：用户显式收藏的「我想标记的地方」，每文件可多条、有 UI、
 *   总量上限满员报错（不静默逐出——书签是用户显式资产）。
 *
 * 锚点货币 = 预览组件的滚动锚点（md/epub/docx=源行号；pdf=页号+页内偏移
 * 编码值，与 scroll-memory 的 encodePdfScrollAnchor 同体系），「尽力而为」
 * 语义——内容变更后行号可能偏移，不存内容哈希。
 *
 * 存储：单个 JSON 数组，条目按创建时间倒序（最新在前）。键序即展示序，
 * 删除后原位移除；重复/极近锚点收藏 = 静默幂等（不新增、返回已有条目）。
 */

const KEY = "cortex.files.readingBookmarks";
const MAX_TOTAL = 200;

/** md/epub/docx 链路内同文件锚点判「极近」的行距阈值（幂等去重口径）。 */
const NEAR_LINE_DISTANCE = 3;

export interface ReadingBookmark {
  /** 文件相对路径（workdir 相对，与 scroll-memory 的键同口径） */
  path: string;
  /** 锚点：md/epub/docx=源行号；pdf=encodePdfScrollAnchor 编码值 */
  anchor: number;
  /** 锚点类别（决定跳转链路与标签生成方式） */
  kind: "md" | "pdf";
  /** 自动标签：当前所在 heading 文本（md 链路）或「第 N 页」（pdf 链路） */
  label: string;
  /** 创建时间（epoch ms） */
  createdAt: number;
}

/** 结果：收藏成功 / 幂等命中（极近已有）/ 满员。 */
export type AddResult =
  | { ok: true; bookmark: ReadingBookmark; duplicate: boolean }
  | { ok: false; reason: "full" };

/** 读取全部书签（创建时间倒序）。JSON 损坏或条目非法时容错过滤。 */
export function loadBookmarks(): ReadingBookmark[] {
  let raw: unknown;
  try {
    raw = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: ReadingBookmark[] = [];
  for (const v of raw) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    if (
      typeof o.path !== "string" ||
      typeof o.anchor !== "number" ||
      !Number.isFinite(o.anchor) ||
      (o.kind !== "md" && o.kind !== "pdf") ||
      typeof o.label !== "string" ||
      typeof o.createdAt !== "number" ||
      !Number.isFinite(o.createdAt)
    ) {
      continue;
    }
    out.push({
      path: o.path,
      anchor: o.anchor,
      kind: o.kind,
      label: o.label,
      createdAt: o.createdAt,
    });
  }
  return out;
}

function saveAll(list: ReadingBookmark[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(list));
  } catch {
    // 配额满等写入失败：静默降级，不影响预览
  }
}

/** 某文件的书签（创建时间倒序）。 */
export function bookmarksFor(path: string): ReadingBookmark[] {
  if (!path) return [];
  return loadBookmarks().filter((b) => b.path === path);
}

/** md 链路同文件锚点是否「极近」（幂等去重口径：行距 ≤ 3 行）。 */
function isNearMdAnchor(a: number, b: number): boolean {
  return Math.abs(a - b) <= NEAR_LINE_DISTANCE;
}

/** pdf 链路同文件锚点是否「极近」（解码页号+比例，同页且比例差 < 0.1）。 */
function isNearPdfAnchor(a: number, b: number): boolean {
  const pageA = Math.floor(a / 10000);
  const pageB = Math.floor(b / 10000);
  if (pageA !== pageB) return false;
  const ratioA = (a % 10000) / 9999;
  const ratioB = (b % 10000) / 9999;
  return Math.abs(ratioA - ratioB) < 0.1;
}

/** 收藏一条书签。
 *  - 同文件同链路已有极近锚点 → 幂等命中（不新增，返回已有条目）
 *  - 总量满 200 → 失败 full（显式反馈，不静默逐出）
 *  - 成功 → 插入头部（最新在前） */
export function addBookmark(input: Omit<ReadingBookmark, "createdAt">): AddResult {
  if (!input.path || !Number.isFinite(input.anchor)) {
    return { ok: false, reason: "full" };
  }
  const list = loadBookmarks();
  const near = list.find(
    (b) =>
      b.path === input.path &&
      b.kind === input.kind &&
      (input.kind === "md"
        ? isNearMdAnchor(b.anchor, input.anchor)
        : isNearPdfAnchor(b.anchor, input.anchor)),
  );
  if (near) return { ok: true, bookmark: near, duplicate: true };
  if (list.length >= MAX_TOTAL) return { ok: false, reason: "full" };
  const bookmark: ReadingBookmark = { ...input, createdAt: Date.now() };
  list.unshift(bookmark);
  saveAll(list);
  return { ok: true, bookmark, duplicate: false };
}

/** 删除一条书签（path + anchor 精确匹配）。 */
export function removeBookmark(path: string, anchor: number): void {
  const list = loadBookmarks().filter(
    (b) => !(b.path === path && b.anchor === anchor),
  );
  saveAll(list);
}

/** 清空某文件全部书签（文件从库中移除时可选清理；当前决议为惰性失效，
 *  此函数供后续需要时复用）。 */
export function clearBookmarksFor(path: string): void {
  if (!path) return;
  saveAll(loadBookmarks().filter((b) => b.path !== path));
}
