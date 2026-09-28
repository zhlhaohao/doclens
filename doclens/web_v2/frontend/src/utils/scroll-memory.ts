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

// ---------------------------------------------------------------------------
// PDF 滚动锚点（ADR-0031）：编码为单一正整数存进同一 map（值域与 md 行号
// 共存，零 schema 变化）。编码 = page × 10000 + ratio × 9999（page ≤ 9999、
// 偏移比例精度 1/9999）；页 1 且近顶（ratio < 0.02）编码为 1，落入
// writeScrollLine 的「回顶部 = 清除记忆」语义。
// ---------------------------------------------------------------------------

/** PDF 锚点编码：{页号, 页内偏移比例} → 正整数。 */
export function encodePdfScrollAnchor(page: number, ratio: number): number {
  const p = Math.min(9999, Math.max(1, Math.floor(page)));
  const r = Math.min(1, Math.max(0, ratio));
  if (p === 1 && r < 0.02) return 1;
  return p * 10000 + Math.round(r * 9999);
}

/** PDF 锚点解码：正整数 → {页号, 页内偏移比例}。 */
export function decodePdfScrollAnchor(value: number): { page: number; ratio: number } {
  const v = Math.max(1, Math.floor(value));
  return { page: Math.floor(v / 10000), ratio: (v % 10000) / 9999 };
}
