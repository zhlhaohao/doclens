import { describe, expect, it } from "vitest";

import {
  argPreview,
  buildFullText,
  isRedundantOutput,
  isShellOutputCollapsed,
  lineDiff,
  orderedArgEntries,
  skillResultSummary,
} from "./chat-tool-trace";
import type { ToolStep } from "../state/types";

function step(overrides: Partial<ToolStep>): ToolStep {
  return {
    tool_use_id: "t1",
    name: "load_skill",
    input: { name: "knowledge-base" },
    output: '<skill name="knowledge-base">\nBase directory for this skill: C:/skills/kb\n\n检索策略……\n</skill>',
    status: "done",
    ...overrides,
  };
}

describe("skillResultSummary", () => {
  it("summarizes load_skill result by skill name, hiding the body", () => {
    const s = step({});
    expect(skillResultSummary(s)).toBe('已加载技能 "knowledge-base"（5 行）');
  });

  it("falls back to parsing <skill name> from output when input.name is missing", () => {
    const s = step({ input: {} });
    expect(skillResultSummary(s)).toBe('已加载技能 "knowledge-base"（5 行）');
  });

  it("returns null for error output so errors stay visible", () => {
    const s = step({ output: "Error: Unknown skill 'nope'. Available: a, b" });
    expect(skillResultSummary(s)).toBeNull();
  });

  it("returns null for other tools, empty output, and running steps", () => {
    expect(skillResultSummary(step({ name: "search_kb" }))).toBeNull();
    expect(skillResultSummary(step({ output: "" }))).toBeNull();
    expect(skillResultSummary(step({ status: "running", output: undefined }))).toBeNull();
  });

  it("keeps the full skill body in buildFullText (copy-all contract)", () => {
    const text = buildFullText([step({})]);
    expect(text).toContain("检索策略");
    expect(text).not.toContain("已加载技能");
  });
});

describe("lineDiff", () => {
  it("pairs shared lines as ctx and marks changed lines del/add", () => {
    const rows = lineDiff(
      "aaa\n    expect(text).toContain('已加载技能').toBe(false);\nccc",
      "aaa\n    expect(text).not.toContain(\"已加载技能\");\nccc",
    );
    expect(rows).toEqual([
      { type: "ctx", line: "aaa" },
      { type: "del", line: "    expect(text).toContain('已加载技能').toBe(false);" },
      { type: "add", line: '    expect(text).not.toContain("已加载技能");' },
      { type: "ctx", line: "ccc" },
    ]);
  });

  it("handles pure insertion and pure deletion", () => {
    expect(lineDiff("aaa", "aaa\nbbb")).toEqual([
      { type: "ctx", line: "aaa" },
      { type: "add", line: "bbb" },
    ]);
    expect(lineDiff("aaa\nbbb", "aaa")).toEqual([
      { type: "ctx", line: "aaa" },
      { type: "del", line: "bbb" },
    ]);
  });

  it("returns all ctx rows when texts are identical", () => {
    expect(lineDiff("x\ny", "x\ny")).toEqual([
      { type: "ctx", line: "x" },
      { type: "ctx", line: "y" },
    ]);
  });

  it("degrades to del-all + add-all for oversized inputs (no DP pairing)", () => {
    const oldText = Array.from({ length: 1500 }, (_, i) => `old-${i}`).join("\n");
    const newText = Array.from({ length: 1500 }, (_, i) => `new-${i}`).join("\n");
    const rows = lineDiff(oldText, newText);
    expect(rows).toHaveLength(3000);
    expect(rows.filter((r) => r.type === "del")).toHaveLength(1500);
    expect(rows.filter((r) => r.type === "add")).toHaveLength(1500);
  });
});

describe("argPreview", () => {
  it("truncates values over 5 lines to the first 5 (write_file content etc.)", () => {
    const text = Array.from({ length: 40 }, (_, i) => `line-${i}`).join("\n");
    const { visible, totalLines } = argPreview(text);
    expect(totalLines).toBe(40);
    expect(visible).toBe("line-0\nline-1\nline-2\nline-3\nline-4");
  });

  it("keeps short and exactly-5-line values intact", () => {
    expect(argPreview("one\ntwo").visible).toBe("one\ntwo");
    expect(argPreview("1\n2\n3\n4\n5").visible).toBe("1\n2\n3\n4\n5");
    expect(argPreview("1\n2\n3\n4\n5").totalLines).toBe(5);
  });

  it("reports 1 line for empty strings", () => {
    expect(argPreview("")).toEqual({ visible: "", totalLines: 1 });
  });
});

describe("orderedArgEntries", () => {
  it("puts path first regardless of the model's parameter order", () => {
    const input = { content: "package com.example", path: "app/src/GridAdapter.kt" };
    expect(orderedArgEntries(input)).toEqual([
      ["path", "app/src/GridAdapter.kt"],
      ["content", "package com.example"],
    ]);
  });

  it("keeps original order when no path-like key exists, and file_path also floats up", () => {
    expect(orderedArgEntries({ offset: 0, limit: 100 })).toEqual([
      ["offset", 0],
      ["limit", 100],
    ]);
    expect(orderedArgEntries({ file_path: "a.ts", old_string: "x", new_string: "y" }).map(([k]) => k)).toEqual([
      "file_path",
      "old_string",
      "new_string",
    ]);
  });
});

describe("isRedundantOutput", () => {
  it("hides write_file success output but keeps errors and other tools visible", () => {
    expect(isRedundantOutput(step({ name: "write_file", output: "Wrote 976 bytes to docs/adr/x.md" }))).toBe(true);
    expect(isRedundantOutput(step({ name: "write_file", output: "Error: Text not found in a.ts" }))).toBe(false);
    expect(isRedundantOutput(step({ name: "write_file", output: "" }))).toBe(false);
    expect(isRedundantOutput(step({ name: "edit_file", output: "Edited a.ts" }))).toBe(false);
  });
});

describe("isShellOutputCollapsed", () => {
  it("collapses bash/powershell success output until expanded, errors stay open", () => {
    expect(isShellOutputCollapsed(step({ name: "bash", output: "ok\nok" }), false)).toBe(true);
    expect(isShellOutputCollapsed(step({ name: "powershell", output: "ok" }), false)).toBe(true);
    expect(isShellOutputCollapsed(step({ name: "bash", output: "ok" }), true)).toBe(false);
    expect(
      isShellOutputCollapsed(
        step({ name: "bash", output: "Error: command failed", status: "error", is_error: true }),
        false,
      ),
    ).toBe(false);
    expect(isShellOutputCollapsed(step({ name: "read_file", output: "content" }), false)).toBe(false);
  });
});
