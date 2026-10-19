/** PUT /api/preview 客户端。*/

import { request } from "./client";

export interface PreviewSaveResponse {
  path: string;
  content: string;
  bytes_written: number;
  reindex_triggered: boolean;
}

export class PreviewSaveError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "PreviewSaveError";
  }
}

export async function savePreview(path: string, content: string): Promise<PreviewSaveResponse> {
  const res = await fetch(`/api/preview?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewSaveError(
      err.code ?? "UNKNOWN",
      err.detail ?? "保存失败",
      res.status,
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// GET /api/preview/upload-target + POST /api/preview/upload
// ---------------------------------------------------------------------------

export interface PreviewUploadResponse {
  path: string;
  bytes_written: number;
  reindex_triggered: boolean;
}

/** 只读探测：文件名带 hash6（doclens 下载产物）时返回知识库原文件路径。
 *  无匹配 / 命名不符 / hash 冲突均返回 match=false（不抛异常）。 */
export async function probeUploadTarget(
  filename: string,
): Promise<{ match: boolean; path?: string }> {
  try {
    const res = await fetch(
      `/api/preview/upload-target?filename=${encodeURIComponent(filename)}`,
    );
    if (!res.ok) return { match: false };
    return await res.json();
  } catch {
    return { match: false }; // 探测失败按无匹配处理（走目录上传）
  }
}

export class PreviewUploadError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "PreviewUploadError";
  }
}

export async function uploadPreview(file: File): Promise<PreviewUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/preview/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ code: "UNKNOWN", detail: res.statusText }));
    throw new PreviewUploadError(
      err.code ?? "UNKNOWN",
      err.detail ?? "上传失败",
      res.status,
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// POST /api/preview/rotate（ADR-0029 预览期手动旋转）
// ---------------------------------------------------------------------------

export interface PreviewRotateResponse {
  path: string;
  rotated: boolean;
}

/** 顺时针旋转 90° 并落盘（失败抛 ApiError）。 */
export async function rotatePreviewImage(path: string): Promise<PreviewRotateResponse> {
  return request<PreviewRotateResponse>(
    `/api/preview/rotate?path=${encodeURIComponent(path)}`,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// 分页标记（PDF / PPTX / XLSX 预览）
// ---------------------------------------------------------------------------

export interface PageMarker {
  label: string;
  line_start: number;
}

/** PST 派生邮件预览附带的附件项（与后端 PstAttachmentInfo 对齐）。 */
export interface PstAttachmentInfo {
  name: string;
  size: number;
  stored: boolean;
  download_url: string | null;
}

// ---------------------------------------------------------------------------
// GET /api/preview
// ---------------------------------------------------------------------------

/** 这些后缀的预览走 md 渲染且需要全文件内容（与后端 BINARY_PREVIEW_EXTS 对齐）。 */
/** 全文件预览判定（单源化：消费后端 PreviewResponse.synthesized 标志）。
 *
 * 后缀清单已退役——历史上前端 FULL_FILE_PREVIEW_EXTS 与后端
 * BINARY_PREVIEW_EXTS 双份维护、 drifted（pptx/doc/docm/rtf/xls 等 8 个
 * 后缀不在前端清单，范围预览分支错切），现以后端响应的 synthesized
 * （DB 合成 md）为唯一信号：合成预览必须整文件渲染（切片会切断分页
 * 边界、line_map 换算依赖全文行号体系）。
 *
 * 注意：这是响应**之后**的判定（是否需要重新全量取）。请求前想知道
 * 某路径是否合成的场景只有 PST 派生路径（非真实文件，必合成）。 */
export function isSynthesizedPreview(resp: { synthesized?: boolean | null }): boolean {
  return resp.synthesized === true;
}

/** PST 派生邮件路径（"<pst>#<entry_id>"）：非真实文件，预览必为 DB 合成 md。
 * 请求前即可判定（不依赖响应）。 */
export function isPstDerivedPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes("#") && lower.split("#")[0].endsWith(".pst");
}

/** 可被视觉模型解读的图像后缀（与后端 INTERPRETED_IMAGE_EXTS 对齐，仅这 4 种）。
 *  只有这些图像支持「重新解析」——gif/bmp/tiff 不走 vision 索引。 */
const REPARSE_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

export function isImageFile(path: string): boolean {
  const lower = path.toLowerCase();
  return REPARSE_IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

export type PreviewFetchResult =
  | {
      ok: true;
      path: string;
      content: string;
      language: string;
      writable: boolean;
      /** DB 合成 md 预览（docx/xlsx/pptx/epub/图像/PST 等）= true——
       *  整文件渲染信号（后端 BINARY_PREVIEW_EXTS 单源判定）。 */
      synthesized: boolean;
      pages: PageMarker[] | null;
      /** 二进制合成预览（docx/xlsx/csv）的行号映射：
       *  key = node.line_start(原始体系, string)，value = heading 在合成 md 中的实际行号。
       *  null 表示无映射（普通文本预览，r.line 即文件实际行号）。 */
      lineMap: Record<string, number> | null;
      /** 仅 PDF 原生预览（language="pdf"，ADR-0031）：页表（每页起始行号，
       *  与索引提取文本行号同体系），搜索命中行二分得页号跳页；
       *  null = 未索引 / 旧索引无页表（跳页静默降级）。 */
      pageStarts: number[] | null;
      /** 仅 PST 派生邮件预览（<pst>#<entry_id>）非空：附件清单 + 下载 URL。 */
      attachments: PstAttachmentInfo[] | null;
      /** 服务端语法分词（ADR-0032）：逐行 [[kind, text], ...] run 数组，
       *  与 content 的 \n 切分一一对应。null = 后端未下发（非代码文件/
       *  未知后缀/超 1MB）→ 纯文本渲染。 */
      tokens: string[][][] | null;
    }
  | { ok: false; notIndexed: boolean; message: string };

/**
 * 调用 GET /api/preview 获取预览内容。
 *
 * - 成功：返回 { ok: true, ... }
 * - 404 NOT_INDEXED：返回 { ok: false, notIndexed: true }
 * - 其他错误：返回 { ok: false, notIndexed: false, message }
 *
 * 不会抛异常 —— 调用方用判别联合处理。
 */
export async function fetchPreview(path: string): Promise<PreviewFetchResult> {
  const params = new URLSearchParams({ path });
  try {
    const res = await fetch(`/api/preview?${params}`);
    if (res.ok) {
      const body = await res.json();
      return {
        ok: true,
        path: body.path,
        content: body.content,
        language: body.language,
        writable: body.writable ?? false,
        synthesized: body.synthesized ?? false,
        pages: body.pages ?? null,
        lineMap: body.line_map ?? null,
        pageStarts: body.page_starts ?? null,
        attachments: body.attachments ?? null,
        tokens: body.tokens ?? null,
      };
    }
    const err = await res.json().catch(() => ({ code: "UNKNOWN", detail: "" }));
    const notIndexed = err.code === "NOT_INDEXED";
    return {
      ok: false,
      notIndexed,
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