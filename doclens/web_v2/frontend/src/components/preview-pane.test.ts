import { describe, expect, it } from "vitest";

import { normalizeHighlightKeyword } from "./preview-pane";

describe("normalizeHighlightKeyword（高亮输入条 CJK 整词归一化，2026-09-28 决议）", () => {
  it("含 CJK 的输入去空格整串匹配（输入法空格不是语义分隔）", () => {
    expect(normalizeHighlightKeyword("松平 广忠")).toBe("松平广忠");
    expect(normalizeHighlightKeyword("松平　广忠")).toBe("松平广忠"); // 全角空格
    expect(normalizeHighlightKeyword(" 量子 计算 ")).toBe("量子计算");
  });

  it("无空格的 CJK 输入原样（幂等）", () => {
    expect(normalizeHighlightKeyword("松平广忠")).toBe("松平广忠");
  });

  it("假名 / 谚文同属 CJK 整词范畴", () => {
    expect(normalizeHighlightKeyword("徳川 家康")).toBe("徳川家康");
    expect(normalizeHighlightKeyword("도쿠가와 이에야스")).toBe("도쿠가와이에야스");
  });

  it("纯 ASCII 保留空格分词语义（英文多词 OR，与 search 透传同口径）", () => {
    expect(normalizeHighlightKeyword("quantum computing")).toBe("quantum computing");
    expect(normalizeHighlightKeyword("hello")).toBe("hello");
  });

  it("空串 / 纯空白原样返回（不误判为 CJK）", () => {
    expect(normalizeHighlightKeyword("")).toBe("");
    expect(normalizeHighlightKeyword("   ")).toBe("   ");
  });
});
