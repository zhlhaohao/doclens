import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatBytes, formatRelative, truncatePathMiddle, summarizeFileTypes,
} from "../src/utils/format";

describe("formatBytes", () => {
  it("formats B / KB / MB / GB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });
});

describe("formatRelative", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(100000 * 1000)); });
  afterEach(() => { vi.useRealTimers(); });

  it("formats intervals from seconds (ts is seconds)", () => {
    expect(formatRelative(100000)).toBe("刚刚");              // 0 diff
    expect(formatRelative(100000 - 30)).toBe("刚刚");         // 30s
    expect(formatRelative(100000 - 120)).toBe("2 分钟前");    // 2min
    expect(formatRelative(100000 - 3600)).toBe("1 小时前");   // 1h
    expect(formatRelative(100000 - 86400)).toBe("1 天前");    // 1d
  });

  it("returns null for null ts", () => {
    expect(formatRelative(null)).toBeNull();
  });
});

describe("truncatePathMiddle", () => {
  it("keeps last 2 segments with … prefix when long", () => {
    const r = truncatePathMiddle("C:/a/b/c/test_work_dir");
    expect(r.text).toBe("…/c/test_work_dir");
    expect(r.title).toBe("C:/a/b/c/test_work_dir");
  });

  it("returns as-is when <= 2 segments", () => {
    expect(truncatePathMiddle("test_work_dir").text).toBe("test_work_dir");
    expect(truncatePathMiddle("cortex/test_work_dir").text).toBe("cortex/test_work_dir");
  });

  it("handles backslash separators", () => {
    const r = truncatePathMiddle("C:\\a\\b\\c\\dir");
    expect(r.text).toBe("…/c/dir");
  });

  it("returns — for empty", () => {
    expect(truncatePathMiddle("").text).toBe("—");
  });
});

describe("summarizeFileTypes", () => {
  it("top 3 desc + +N", () => {
    expect(summarizeFileTypes({ ".md": 30, ".pdf": 12, ".docx": 8, ".py": 3, ".txt": 1 }))
      .toBe(".md 30 · .pdf 12 · .docx 8 · +2");
  });

  it("no remainder when <= top", () => {
    expect(summarizeFileTypes({ ".md": 5, ".pdf": 2 })).toBe(".md 5 · .pdf 2");
  });

  it("empty → —", () => {
    expect(summarizeFileTypes({})).toBe("—");
  });
});
