/**
 * 文件列表列头排序（名称 / 大小 / 修改）。
 *
 * 排序在前端做：后端 /files/list 是「先按名称排序再切页」的两段式实现
 * （api/files.py:318-333），刻意避免对当页之外的条目做 stat（16,898 文件
 * 目录实测 ~3.7s，99% 花在 200 条以外）。按大小/修改时间排序需要全目录
 * stat，与该性能决策冲突，故排序域限定在已加载页内。
 *
 * 约定：目录恒排在前（沿用后端 is_dir desc 语义），再按所选键比较；
 * 键值相同时回落名称比较，保证顺序稳定。
 */
import type { FileEntry } from "../api/files";

export type FileSortKey = "name" | "size" | "mtime";
export type FileSortDir = "asc" | "desc";

export const FILE_SORT_KEYS: FileSortKey[] = ["name", "size", "mtime"];

const _mtimeMs = (e: FileEntry) => {
  const t = Date.parse(e.modified_at ?? "");
  return Number.isNaN(t) ? 0 : t;
};

const _cmpName = (a: FileEntry, b: FileEntry) =>
  a.name.localeCompare(b.name, "zh", { numeric: true });

/** 按所选键排序条目数组（不修改入参）。 */
export function sortFileEntries(
  entries: FileEntry[],
  key: FileSortKey,
  dir: FileSortDir,
): FileEntry[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...entries].sort((a, b) => {
    // 目录恒在前（不随方向翻转）
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let d = 0;
    if (key === "size") d = a.size - b.size;
    else if (key === "mtime") d = _mtimeMs(a) - _mtimeMs(b);
    else d = _cmpName(a, b); // name
    if (d !== 0) return d * sign;
    // 键值相同（或同向 name）：回落名称 + path 保证顺序稳定
    const byName = _cmpName(a, b);
    return byName !== 0 ? byName * sign : a.path.localeCompare(b.path) * sign;
  });
}
