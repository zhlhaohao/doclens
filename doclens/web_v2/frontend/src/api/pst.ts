/** GET /api/pst/emails 客户端 + PST 路径判定工具。 */

export interface PstEmailItem {
  entry_id: string;
  subject: string;
  sender: string;
  date: string;
  folder: string;
}

export type PstEmailListResult =
  | {
      ok: true;
      path: string;
      total: number;
      offset: number;
      limit: number;
      emails: PstEmailItem[];
    }
  | { ok: false; notIndexed: boolean; message: string };

/**
 * 调用 GET /api/pst/emails 获取邮件分页列表（日期倒序）。
 * 与 fetchPreview 同一约定：不抛异常，调用方用判别联合处理。
 */
export async function fetchPstEmails(
  path: string,
  offset = 0,
  limit = 50,
): Promise<PstEmailListResult> {
  const params = new URLSearchParams({
    path,
    offset: String(offset),
    limit: String(limit),
  });
  try {
    const res = await fetch(`/api/pst/emails?${params}`);
    if (res.ok) {
      const body = await res.json();
      return {
        ok: true,
        path: body.path,
        total: body.total,
        offset: body.offset,
        limit: body.limit,
        emails: body.emails ?? [],
      };
    }
    const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: "" }));
    return {
      ok: false,
      notIndexed: err.code === "NOT_INDEXED",
      message: err.detail || err.code || `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      notIndexed: false,
      message: (e as Error).message || "网络错误",
    };
  }
}

/** PST 物理文件路径（xxx.pst，非派生邮件路径）：预览 = 分页邮件列表。 */
export function isPstFilePath(path: string): boolean {
  return path.toLowerCase().endsWith(".pst") && !path.includes("#");
}

/** PST 派生邮件路径（<pst>#<entry_id>）：预览 = 合成 md + 附件清单。 */
export function isPstEmailPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes("#") && lower.split("#")[0].endsWith(".pst");
}
