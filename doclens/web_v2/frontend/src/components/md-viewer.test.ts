import { describe, expect, it } from "vitest";

import { buildMatchLines } from "./md-viewer";

describe("buildMatchLines（匹配导航源文本索引，2026-09-28 决议）", () => {
  it("空关键词 / 空内容返回空索引", () => {
    expect(buildMatchLines("# 标题\n正文", "")).toEqual([]);
    expect(buildMatchLines("", "词")).toEqual([]);
  });

  it("逐行匹配：每项 = 匹配起始所在源行号（1-indexed 升序）", () => {
    const md = ["第一行", "第二行 词", "第三行", "第四行 词", "第五行 词 词"].join("\n");
    expect(buildMatchLines(md, "词")).toEqual([2, 4, 5, 5]);
  });

  it("空格分词多关键词 = 任意词命中都计（与 _highlightKeyword 同口径）", () => {
    const md = "alpha\nbeta gamma\nnone";
    expect(buildMatchLines(md, "alpha gamma")).toEqual([1, 2]);
  });

  it("大小写不敏感", () => {
    expect(buildMatchLines("Foo\nbar FOO", "foo")).toEqual([1, 2]);
  });

  it("正则元字符按字面量处理（与 _highlightKeyword 同 escape 口径）", () => {
    expect(buildMatchLines("a.c\naxc", "a.c")).toEqual([1]);
  });

  it("全无命中返回空（徽标 0/0、按钮置灰的判定源）", () => {
    expect(buildMatchLines("完全没有目标", "词")).toEqual([]);
  });
});
