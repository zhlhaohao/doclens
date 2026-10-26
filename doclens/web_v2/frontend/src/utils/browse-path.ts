/** 整机浏览路径工具（ADR-0049）。
 *
 * 路径双形态单一判定源（与后端 files_browse.py 同口径）：
 * - 相对 POSIX（"a/b"）= workdir 内（现状语义）；
 * - Windows 绝对（"D:/a/b"，正斜杠规范形）= 任意位置只读浏览。
 *
 * 「此电脑」虚拟层用哨兵 DRIVES_SENTINEL（"~drives"）——只存在于前端
 * store 的 currentDir/treeCache 键，绝不发给后端（后端有独立
 * /api/files/drives 端点）。
 */

/** 盘符（X:/ 或 X:\）或 UNC（//server/…）开头 = 绝对路径形态。 */
const ABSOLUTE_RE = /^[A-Za-z]:[\\/]|^\/\//;

/** 「此电脑」虚拟层哨兵——仅前端 store 内使用。 */
export const DRIVES_SENTINEL = "~drives";

/** path 是否为绝对路径形态（workdir 外浏览态）。 */
export function isAbsoluteBrowsePath(p: string): boolean {
  return p.length > 0 && ABSOLUTE_RE.test(p);
}

/** currentDir 是否处于「此电脑」虚拟层。 */
export function isDrivesLayer(dir: string): boolean {
  return dir === DRIVES_SENTINEL;
}

/** 浏览目录是否在工作目录之外（绝对路径 or 此电脑层）。
 *  外部态 = 只读浏览：写操作/搜索/技能工具箱禁用（ADR-0049）。 */
export function isOutsideWorkdir(dir: string): boolean {
  return isAbsoluteBrowsePath(dir) || isDrivesLayer(dir);
}

/** 拼接目录与条目名：dir 空 → name；绝对/相对统一 "/" 分隔。 */
export function joinBrowsePath(dir: string, name: string): string {
  if (!dir) return name;
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

/** 上溯一级目录（ADR-0049 唯一的「走出去」入口在 workdir 根，见 caller）。
 *  返回 null = 无可上溯（已是「此电脑」层）。
 *  - "D:/" → DRIVES_SENTINEL（盘符根之上是此电脑）
 *  - "D:/a/b" → "D:/a"；"D:/a" → "D:/"
 *  - "a/b" → "a"；"a" → ""（workdir 根）
 *  - "" → 需要调用方拿 workdir 绝对路径（本函数不知 workdir，
 *    交由 parentOfBrowseRoot 处理；直传 "" 返回 null 防误用） */
export function parentBrowsePath(dir: string): string | null {
  if (isDrivesLayer(dir)) return null;
  if (isAbsoluteBrowsePath(dir)) {
    const norm = dir.replace(/\\+/g, "/").replace(/\/+$/, "");
    const idx = norm.lastIndexOf("/");
    if (idx <= 0) return DRIVES_SENTINEL;
    // 切到 "/" 处；若父级就是盘符（"D:/a" → "D:/"）保留尾斜杠——
    // 裸 "D:" 不是合法目录形态
    const parent = norm.slice(0, idx + 1);
    return /^[A-Za-z]:\/$/.test(parent) ? parent : parent.replace(/\/$/, "");
  }
  if (dir === "") return null;
  const idx = dir.lastIndexOf("/");
  return idx <= 0 ? "" : dir.slice(0, idx);
}

/** workdir 根（""）的上溯目标：workdir 的父目录绝对路径。
 *  workdir 未知/根盘符本身（无父）时返回 null（上溯按钮置灰）。 */
export function parentOfBrowseRoot(workdirAbs: string | null | undefined): string | null {
  if (!workdirAbs) return null;
  const norm = workdirAbs.replace(/[\\/]+/g, "/").replace(/\/+$/, "");
  // "D:/知识库" → "D:/"；"D:" 或 "D:/"（盘符根本身）→ null
  const idx = norm.lastIndexOf("/");
  if (idx <= 0) return null;
  return `${norm.slice(0, idx + 1)}`;
}

export interface BreadcrumbSegment {
  label: string;
  path: string;
  /** 非末段可点击跳转；末段静态文本。 */
}

/** currentDir 拆成可导航分段。
 *  - "" → [{根目录}]
 *  - "a/b" → [{根目录},{a},{b}]（现状语义）
 *  - "D:/x/y" → [{此电脑},{D:},{x},{y}]（ADR-0049 绝对链）
 *  - DRIVES_SENTINEL → [{此电脑}] */
export function breadcrumbSegments(dir: string): BreadcrumbSegment[] {
  if (isDrivesLayer(dir)) return [{ label: "此电脑", path: DRIVES_SENTINEL }];
  if (isAbsoluteBrowsePath(dir)) {
    // 规范形：去尾斜杠；盘符根（"D:/" → "D:"）split 后首段即盘符。
    // 各段 path：盘符段 = "D:/"（带斜杠合法形态），其后段不带尾斜杠。
    const norm = dir.replace(/\\+/g, "/").replace(/\/+$/, "");
    const parts = norm.split("/").filter(Boolean);
    const segs: BreadcrumbSegment[] = [
      { label: "此电脑", path: DRIVES_SENTINEL },
    ];
    parts.forEach((part, i) => {
      if (i === 0 && /^[A-Za-z]:$/.test(part)) {
        segs.push({ label: part, path: `${part}/` });
      } else if (i === 0) {
        segs.push({ label: part, path: `//${part}` }); // UNC server 段
      } else {
        const prev = segs[segs.length - 1].path;
        segs.push({
          label: part,
          path: prev.endsWith("/") ? `${prev}${part}` : `${prev}/${part}`,
        });
      }
    });
    return segs;
  }
  const parts = dir.split("/").filter(Boolean);
  return [
    { label: "根目录", path: "" },
    ...parts.map((name, i) => ({
      label: name,
      path: parts.slice(0, i + 1).join("/"),
    })),
  ];
}
