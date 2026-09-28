import { describe, expect, it } from "vitest";
import { lineToPage } from "./pdf-viewer";
import { encodePdfScrollAnchor, decodePdfScrollAnchor } from "../utils/scroll-memory";

/** PDF 滚动锚点编码（ADR-0031）：页号+页内偏移 → 单一正整数，
 *  与 md 行号共存同一 scroll-memory map。 */
describe("pdf scroll anchor 编解码", () => {
  it("roundtrip 保持页号与偏移比例", () => {
    // [1,0] 是哨兵值（回顶部清除语义），不参与 roundtrip——由专门用例覆盖
    for (const [page, ratio] of [[1, 0.5], [2, 0.5], [7, 0.83], [9999, 1]] as const) {
      const d = decodePdfScrollAnchor(encodePdfScrollAnchor(page, ratio));
      expect(d.page).toBe(page);
      expect(Math.abs(d.ratio - ratio)).toBeLessThan(0.001);
    }
  });

  it("页 1 近顶编码为 1（回顶部 = 清除记忆语义）", () => {
    expect(encodePdfScrollAnchor(1, 0)).toBe(1);
    expect(encodePdfScrollAnchor(1, 0.01)).toBe(1);
    expect(encodePdfScrollAnchor(2, 0)).not.toBe(1);
  });

  it("越界输入钳制", () => {
    expect(encodePdfScrollAnchor(0, -1)).toBe(1);
    expect(decodePdfScrollAnchor(0).page).toBe(0);
    const d = decodePdfScrollAnchor(encodePdfScrollAnchor(20000, 2));
    expect(d.page).toBe(9999);
    expect(d.ratio).toBeLessThanOrEqual(1);
  });
});

/** 页表二分换算（ADR-0031 搜索命中跳页）——与后端 _compute_page_starts
 *  的数组语义对齐：索引 k = 物理页 k+1 起始行，首元素恒为 1。 */
describe("lineToPage", () => {
  it("无页表返回 null（静默降级）", () => {
    expect(lineToPage(100, null)).toBeNull();
    expect(lineToPage(100, [])).toBeNull();
  });

  it("单页文档恒为第 1 页", () => {
    expect(lineToPage(1, [1])).toBe(1);
    expect(lineToPage(999, [1])).toBe(1);
  });

  it("多页文档按区间二分", () => {
    const starts = [1, 40, 88];
    expect(lineToPage(1, starts)).toBe(1);
    expect(lineToPage(39, starts)).toBe(1);
    expect(lineToPage(40, starts)).toBe(2); // 页边界行属于新页
    expect(lineToPage(87, starts)).toBe(2);
    expect(lineToPage(88, starts)).toBe(3);
    expect(lineToPage(500, starts)).toBe(3);
  });

  it("断号页与其后页共享起始行（无内容行归前页）", () => {
    // 页 2 无内容（纯图页），槽位 = 页 3 起始行 → 行 2 落页 1，行 3 落页 3
    const starts = [1, 3, 3];
    expect(lineToPage(2, starts)).toBe(1);
    expect(lineToPage(3, starts)).toBe(3);
  });
});
