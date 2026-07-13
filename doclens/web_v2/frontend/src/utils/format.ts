/** welcome-pane 状态区格式化工具（纯函数）。 */

/** 字节数 → 人类可读（B/KB/MB/GB），<10 保留 1 位小数。 */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${fmt(b / 1024)} KB`;
  if (b < 1024 * 1024 * 1024) return `${fmt(b / (1024 * 1024))} MB`;
  return `${fmt(b / (1024 * 1024 * 1024))} GB`;
}
function fmt(n: number): string {
  if (n < 10) {
    // 整数不显示小数位，非整数保留1位小数
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
  }
  return String(Math.round(n));
}

/** 秒级 Unix 时间戳 → 相对时间；null → null。 */
export function formatRelative(ts: number | null | undefined): string | null {
  if (ts == null) return null;
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(ts * 1000).toISOString().slice(0, 10).replace(/-/g, "/");
}

/** 路径中段省略：保留最后 keepSegments 段，前缀以 … ；空 → "—"。
 *  同时兼容 / 与 \ 分隔符，输出统一用 / 连接。title 始终为原始路径。 */
export function truncatePathMiddle(
  p: string,
  keepSegments = 2,
): { text: string; title: string } {
  if (!p) return { text: "—", title: p };
  const segs = p.split(/[/\\]+/).filter((s) => s.length > 0);
  if (segs.length <= keepSegments) return { text: segs.join("/"), title: p };
  const tail = segs.slice(-keepSegments).join("/");
  return { text: `…/${tail}`, title: p };
}

/** 文件类型分布 → "前 top 高亮 · +N" 字符串；空 → "—"。 */
export function summarizeFileTypes(ft: Record<string, number>, top = 3): string {
  const entries = Object.entries(ft).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "—";
  const head = entries.slice(0, top).map(([ext, n]) => `${ext} ${n}`).join(" · ");
  const rest = entries.length - top;
  return rest > 0 ? `${head} · +${rest}` : head;
}
