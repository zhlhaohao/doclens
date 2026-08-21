import { describe, it, expect } from "vitest";
import { extractHeadings, activeTocIndex } from "../src/utils/toc";

describe("extractHeadings", () => {
  it("returns empty for empty content", () => {
    expect(extractHeadings("")).toEqual([]);
  });

  it("returns empty for content without headings", () => {
    expect(extractHeadings("plain text\nmore text")).toEqual([]);
  });

  it("extracts ATX headings with depth and 1-indexed line", () => {
    const md = "# Title\n\nintro\n\n## Section A\ntext\n### Sub A1\n";
    expect(extractHeadings(md)).toEqual([
      { depth: 1, text: "Title", line: 1 },
      { depth: 2, text: "Section A", line: 5 },
      { depth: 3, text: "Sub A1", line: 7 },
    ]);
  });

  it("recognizes setext headings (=== / ---)", () => {
    const md = "Title\n=====\n\nSub\n---\n";
    const items = extractHeadings(md);
    expect(items).toEqual([
      { depth: 1, text: "Title", line: 1 },
      { depth: 2, text: "Sub", line: 4 },
    ]);
  });

  it("ignores # inside fenced code blocks", () => {
    const md = "# Real\n\n```\n# not a heading\n```\n\n## Also real\n";
    const items = extractHeadings(md);
    expect(items.map((i) => i.text)).toEqual(["Real", "Also real"]);
    expect(items[1].line).toBe(7);
  });

  it("strips inline formatting (bold/code/link) to plain text", () => {
    const md = "## **Bold** and `code` and [link](https://x.y)\n";
    expect(extractHeadings(md)).toEqual([
      { depth: 2, text: "Bold and code and link", line: 1 },
    ]);
  });

  it("skips headings that render to empty text", () => {
    const md = "##   \n\n# Kept\n";
    expect(extractHeadings(md)).toEqual([
      { depth: 1, text: "Kept", line: 3 },
    ]);
  });

  it("computes correct lines for duplicate heading texts", () => {
    const md = "# Dup\na\n# Dup\nb\n# Dup\n";
    expect(extractHeadings(md).map((i) => i.line)).toEqual([1, 3, 5]);
  });
});

describe("activeTocIndex", () => {
  const items = extractHeadings("# A\nx\n## B\ny\n## C\n");
  // A@1, B@3, C@5

  it("returns -1 before the first heading", () => {
    expect(activeTocIndex(items, 0)).toBe(-1);
  });

  it("returns the item exactly at its line", () => {
    expect(activeTocIndex(items, 1)).toBe(0);
    expect(activeTocIndex(items, 3)).toBe(1);
  });

  it("returns the last item at or before currentLine", () => {
    expect(activeTocIndex(items, 4)).toBe(1);
    expect(activeTocIndex(items, 99)).toBe(2);
  });

  it("returns -1 for empty items", () => {
    expect(activeTocIndex([], 10)).toBe(-1);
  });
});
