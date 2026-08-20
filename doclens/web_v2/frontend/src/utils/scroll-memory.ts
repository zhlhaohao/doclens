/** 文件预览滚动位置记忆（localStorage 持久化）。
 *
 * 锚点货币 = 源行号（md-viewer.topSourceLine()），不存像素 scrollTop：
 * 内容 reflow（lazy 图片加载、窗口变宽）下行号锚点更稳健。
 * 行号是「尽力而为」语义——文件内容变更后可能偏移，不存内容哈希。
 *
 * 存储：单个 JSON map，path → line，LRU 上限 MAX_ENTRIES 条防无限增长。
 * line <= 1（视口在顶部）时删除该条：回到顶部 = 清除记忆。
 */

const KEY = "cortex.files.previewScroll";
const MAX_ENTRIES = 200;

/** 读取整张 map；JSON 损坏或值非法时容错返回过滤后的结果。 */
export function loadScrollMemory(): Record<string, number> {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 1) out[k] = Math.floor(v);
  }
  return out;
}

/** 读某 path 的记忆行号；无记录返回 null。 */
export function readScrollLine(path: string): number | null {
  if (!path) return null;
  const line = loadScrollMemory()[path];
  return line === undefined ? null : line;
}

/** 写入某 path 的行号；line <= 1 删除该条（回顶部 = 清除记忆）。LRU 超上限逐出最老。 */
export function writeScrollLine(path: string, line: number): void {
  if (!path || !Number.isFinite(line)) return;
  const map = loadScrollMemory();
  delete map[path]; // 移到键序末尾（LRU touch）
  if (line > 1) map[path] = Math.floor(line);
  const keys = Object.keys(map);
  while (keys.length > MAX_ENTRIES) {
    const oldest = keys.shift()!;
    delete map[oldest];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // 配额满等写入失败：静默降级，不影响预览
  }
}
