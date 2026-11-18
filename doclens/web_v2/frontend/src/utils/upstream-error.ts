/**
 * 上游 LLM 错误文案的脱敏（2026-11-18）。
 *
 * 事故形态（debug_20261118.log 13:05:29）：MiniMax `/anthropic` 端点在
 * SSE 流中下发 error 事件，body 为
 * `{'type':'error','error':{'type':'api_error','message':'unknown error, 715 (1000)'}}`。
 * 原文直接进转录气泡后，用户看到的是「英文占位符 + 网关码 + 业务码」三
 * 层裸码，完全无法理解（MiniMax 官方客户端 issue #420 同款问题）。
 *
 * 后端已在 `planify/core/llm/upstream_errors.py` 做过一次脱敏（权威口径）；
 * 本模块是前端侧的第二道防线——旧会话（落库的原文）、旧版后端、以及
 * 任何绕过 emit_error 的路径都从这里兜住。
 *
 * 原始细节不丢：进 `technicalDetail`（可展开的「技术详情」），日志里另有
 * 完整堆栈。
 */

/** 用户可见文案（与后端 `FRIENDLY_UPSTREAM_ERROR` 保持一致）。 */
export const FRIENDLY_UPSTREAM_ERROR = "模型服务暂时不可用，请稍后重试。";

/**
 * 命中即判定为「上游原始错误」的形态：
 * - `unknown error`（MiniMax 业务码错误的固定英文占位符，形如
 *   `unknown error, 715 (1000)`——网关码 + 业务码三层裸码）；
 * - `api_error`（SSE error 事件的 error.type）。
 *
 * 刻意不匹配「结尾带括号数字」——普通中文消息里的 `(1234)` 会被误伤；
 * MiniMax 的业务码写法必带 `unknown error` 前缀，已被上一条覆盖。
 */
const RAW_UPSTREAM_PATTERNS: RegExp[] = [
  /\bunknown error\b/i,
  /"type"\s*:\s*"api_error"/i,
  /\bapi_error\b/i,
];

/** 是否是「上游原始错误报文」（需要脱敏）。 */
export function isRawUpstreamError(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return RAW_UPSTREAM_PATTERNS.some((re) => re.test(t));
}

/**
 * 脱敏 + 拆分：
 * - `message`：用户可见文案（命中即换成友好文案）；
 * - `technicalDetail`：原始文本（未命中时为 null——不制造噪音）。
 */
export function sanitizeUpstreamError(text: string): {
  message: string;
  technicalDetail: string | null;
} {
  const t = (text ?? "").trim();
  if (!t) {
    return { message: "对话失败。", technicalDetail: null };
  }
  if (isRawUpstreamError(t)) {
    return { message: FRIENDLY_UPSTREAM_ERROR, technicalDetail: t };
  }
  return { message: t, technicalDetail: null };
}
