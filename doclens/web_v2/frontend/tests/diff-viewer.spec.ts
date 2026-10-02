import { describe, it, expect } from "vitest";
import { parseUnifiedDiff } from "../src/components/diff-viewer";

describe("parseUnifiedDiff", () => {
  it("parses header, hunks, add/del/ctx lines with line numbers", () => {
    const diff = [
      "diff --git a/a.md b/a.md",
      "index 111..222 100644",
      "--- a/a.md",
      "+++ b/a.md",
      "@@ -1,3 +1,4 @@",
      " ctx1",
      "-old2",
      "+new2",
      "+new2b",
      " ctx3",
    ].join("\n");
    const rows = parseUnifiedDiff(diff);
    expect(rows.map((r) => r.type)).toEqual(["hunk", "ctx", "del", "add", "add", "ctx"]);
    expect(rows[1]).toMatchObject({ oldNo: "1", newNo: "1", text: "ctx1" });
    expect(rows[2]).toMatchObject({ oldNo: "2", newNo: "", text: "old2" });
    expect(rows[3]).toMatchObject({ oldNo: "", newNo: "2", text: "new2" });
    expect(rows[4]).toMatchObject({ oldNo: "", newNo: "3", text: "new2b" });
    expect(rows[5]).toMatchObject({ oldNo: "3", newNo: "4", text: "ctx3" });
  });

  it("inserts skip row between non-adjacent hunks", () => {
    const diff = [
      "@@ -1,2 +1,2 @@",
      " a",
      " b",
      "@@ -10,2 +10,2 @@",
      " c",
      " d",
    ].join("\n");
    const rows = parseUnifiedDiff(diff);
    expect(rows[3].type).toBe("skip");
    expect(rows[3].text).toContain("跳过 7 行");
    // 第二 hunk 行号从 10 重新起算
    expect(rows[5]).toMatchObject({ oldNo: "10", newNo: "10" });
  });

  it("adjacent hunks (no gap) produce no skip row", () => {
    const diff = ["@@ -1,2 +1,2 @@", " a", " b", "@@ -3,2 +3,2 @@", " c", " d"].join("\n");
    const rows = parseUnifiedDiff(diff);
    expect(rows.filter((r) => r.type === "skip")).toHaveLength(0);
  });

  it("new-file diff (all adds starting at line 0) numbers from 1", () => {
    const diff = [
      "diff --git a/new.md b/new.md",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new.md",
      "@@ -0,0 +1,2 @@",
      "+hello",
      "+world",
    ].join("\n");
    const rows = parseUnifiedDiff(diff);
    expect(rows[1]).toMatchObject({ type: "add", newNo: "1", oldNo: "" });
    expect(rows[2]).toMatchObject({ type: "add", newNo: "2" });
  });

  it("empty diff yields empty rows", () => {
    expect(parseUnifiedDiff("")).toHaveLength(0);
  });
});
