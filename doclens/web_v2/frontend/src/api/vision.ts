/** /api/vision/* 客户端：默认提示词预填 + 图像重新解析。 */
import { ApiError, request } from "./client";

export interface PromptResponse {
  prompt: string;
}

export interface ReparseResponse {
  path: string;
  markdown: string;
}

export class ReparseError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ReparseError";
  }
}

/** 拉取默认 VISION_PROMPT，供对话框预填（单一真相源在后端）。 */
export async function getVisionPrompt(): Promise<string> {
  const r = await request<PromptResponse>("/api/vision/prompt");
  return r.prompt;
}

/** 用自定义提示词重新解析一张图像，返回新 markdown。 */
export async function reparseImage(
  path: string,
  prompt: string,
): Promise<ReparseResponse> {
  try {
    return await request<ReparseResponse>("/api/vision/reparse", {
      method: "POST",
      json: { path, prompt },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      throw new ReparseError(e.code, e.message, e.status);
    }
    throw e;
  }
}

/** 手动备注：用户 markdown 直接覆盖 AI 解读（不调视觉模型，持久保留）。 */
export async function saveManualNote(
  path: string,
  markdown: string,
): Promise<ReparseResponse> {
  try {
    return await request<ReparseResponse>("/api/vision/note", {
      method: "POST",
      json: { path, markdown },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      throw new ReparseError(e.code, e.message, e.status);
    }
    throw e;
  }
}
