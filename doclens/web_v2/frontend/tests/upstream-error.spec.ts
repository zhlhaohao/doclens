import { describe, it, expect } from "vitest";
import {
  FRIENDLY_UPSTREAM_ERROR,
  isRawUpstreamError,
  sanitizeUpstreamError,
} from "../src/utils/upstream-error";

/**
 * 上游 LLM 错误脱敏（2026-11-18）。
 *
 * 事故形态（debug_20261118.log 13:05:29）：MiniMax `/anthropic` 端点在 SSE
 * 流中下发 error 事件，原文 `unknown error, 715 (1000)` 直接进了转录气泡
 * ——用户看到的是「英文占位符 + 网关码 + 业务码」三层裸码，完全无法理解。
 *
 * 契约：主文案换成可读句子，原始码降级为可展开的「技术详情」。
 */

describe("isRawUpstreamError", () => {
  it("识别事故原文", () => {
    expect(isRawUpstreamError("unknown error, 715 (1000)")).toBe(true);
  });

  it("识别 api_error 报文", () => {
    expect(
      isRawUpstreamError(
        "{'type': 'error', 'error': {'type': 'api_error', 'message': 'unknown error, 715 (1000)'}}",
      ),
    ).toBe(true);
  });

  it("普通中文错误不误判", () => {
    expect(isRawUpstreamError("对话失败：网络连接中断")).toBe(false);
    expect(isRawUpstreamError("模型服务暂时不可用，请稍后重试。")).toBe(false);
  });

  it("普通消息里的括号数字不误判", () => {
    expect(isRawUpstreamError("共处理 3 个文件 (1234)")).toBe(false);
  });

  it("空串不误判", () => {
    expect(isRawUpstreamError("")).toBe(false);
  });
});

describe("sanitizeUpstreamError", () => {
  it("事故原文 → 友好文案 + 技术详情", () => {
    const raw = "unknown error, 715 (1000)";
    const out = sanitizeUpstreamError(raw);
    expect(out.message).toBe(FRIENDLY_UPSTREAM_ERROR);
    expect(out.message).not.toContain("unknown error");
    expect(out.message).not.toContain("715");
    expect(out.message).not.toContain("1000");
    expect(out.technicalDetail).toBe(raw);
  });

  it("普通错误原样透传且无技术详情", () => {
    const out = sanitizeUpstreamError("对话失败：网络连接中断");
    expect(out.message).toBe("对话失败：网络连接中断");
    expect(out.technicalDetail).toBeNull();
  });

  it("空串给兜底文案", () => {
    const out = sanitizeUpstreamError("");
    expect(out.message).toBe("对话失败。");
    expect(out.technicalDetail).toBeNull();
  });
});
