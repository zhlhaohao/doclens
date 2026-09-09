import { describe, it, expect } from "vitest";
import { SearchResults } from "../src/components/search-results";

describe("<search-results> styles", () => {
  it("shadow 内显式 border-box reset，防止 list-pane 右溢裁掉卡片右边框", () => {
    // 回归：shadow DOM 不受全局 box-sizing reset 影响；content-box 下
    // .list-pane 的 flex-basis(360px) 不含 padding(24px)+border(1px)，
    // 面板实际宽 385px 溢出宿主，卡片右边框被相邻预览区裁掉。
    const cssText = SearchResults.styles.cssText;
    expect(cssText).toContain("box-sizing: border-box");
  });
});
