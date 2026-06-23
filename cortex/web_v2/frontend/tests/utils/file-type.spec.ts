import { describe, it, expect } from "vitest";
import type { FileEntry } from "../../src/api/files";
import {
  getExtension,
  getFileTypeBadge,
  getTypeLabel,
} from "../../src/utils/file-type";

describe("getExtension", () => {
  it("returns the lowercase extension for a normal filename", () => {
    expect(getExtension("report.xlsx")).toBe("xlsx");
  });
  it("lowercases the extension", () => {
    expect(getExtension("photo.JPG")).toBe("jpg");
  });
  it("returns the last segment for multi-dot names", () => {
    expect(getExtension("data.TAR.GZ")).toBe("gz");
  });
  it("returns empty for names with no dot", () => {
    expect(getExtension("README")).toBe("");
  });
  it("returns empty for dotfiles (leading dot)", () => {
    expect(getExtension(".gitignore")).toBe("");
  });
  it("returns empty for trailing-dot names", () => {
    expect(getExtension("archive.")).toBe("");
  });
  it("returns empty for empty input", () => {
    expect(getExtension("")).toBe("");
  });
});

describe("getFileTypeBadge", () => {
  it("returns red P badge for pdf", () => {
    expect(getFileTypeBadge("report.pdf", false)).toEqual({
      letter: "P", bg: "#DC2626", fg: "#FFFFFF",
    });
  });
  it("returns blue D badge for docx", () => {
    expect(getFileTypeBadge("notes.docx", false)).toEqual({
      letter: "D", bg: "#2563EB", fg: "#FFFFFF",
    });
  });
  it("returns blue D badge for doc", () => {
    expect(getFileTypeBadge("legacy.doc", false)).toEqual({
      letter: "D", bg: "#2563EB", fg: "#FFFFFF",
    });
  });
  it("returns green X badge for xlsx", () => {
    expect(getFileTypeBadge("sales.xlsx", false)).toEqual({
      letter: "X", bg: "#16A34A", fg: "#FFFFFF",
    });
  });
  it("returns green X badge for xls", () => {
    expect(getFileTypeBadge("old.xls", false)).toEqual({
      letter: "X", bg: "#16A34A", fg: "#FFFFFF",
    });
  });
  it("returns green C badge for csv", () => {
    expect(getFileTypeBadge("data.csv", false)).toEqual({
      letter: "C", bg: "#16A34A", fg: "#FFFFFF",
    });
  });
  it("returns orange P badge for pptx", () => {
    expect(getFileTypeBadge("slides.pptx", false)).toEqual({
      letter: "P", bg: "#EA580C", fg: "#FFFFFF",
    });
  });
  it("returns orange P badge for ppt", () => {
    expect(getFileTypeBadge("deck.ppt", false)).toEqual({
      letter: "P", bg: "#EA580C", fg: "#FFFFFF",
    });
  });
  it("returns indigo M badge for md", () => {
    expect(getFileTypeBadge("readme.md", false)).toEqual({
      letter: "M", bg: "#6366F1", fg: "#FFFFFF",
    });
  });
  it("returns gray T badge for txt", () => {
    expect(getFileTypeBadge("notes.txt", false)).toEqual({
      letter: "T", bg: "#6B7280", fg: "#FFFFFF",
    });
  });
  it("returns null for archive.zip (unknown type)", () => {
    expect(getFileTypeBadge("archive.zip", false)).toBeNull();
  });
  it("returns null for script.py (unknown type)", () => {
    expect(getFileTypeBadge("script.py", false)).toBeNull();
  });
  it("returns null for photo.jpg (unknown type)", () => {
    expect(getFileTypeBadge("photo.jpg", false)).toBeNull();
  });
  it("returns null for README (no extension)", () => {
    expect(getFileTypeBadge("README", false)).toBeNull();
  });
  it("returns null for any directory", () => {
    expect(getFileTypeBadge("any", true)).toBeNull();
  });
  it("matches case-insensitively (uppercase extension)", () => {
    expect(getFileTypeBadge("REPORT.PDF", false)).toEqual({
      letter: "P", bg: "#DC2626", fg: "#FFFFFF",
    });
  });
});

describe("getTypeLabel", () => {
  const base: Omit<FileEntry, "is_dir" | "name"> = {
    path: "", size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: false,
  };

  it("returns 文件夹 for directories", () => {
    expect(getTypeLabel({ ...base, name: "docs", is_dir: true })).toBe("文件夹");
  });
  it("returns lowercase extension for files with extension", () => {
    expect(getTypeLabel({ ...base, name: "sales.xlsx", is_dir: false })).toBe("xlsx");
  });
  it("returns empty for files without extension", () => {
    expect(getTypeLabel({ ...base, name: "README", is_dir: false })).toBe("");
  });
  it("returns empty for dotfiles", () => {
    expect(getTypeLabel({ ...base, name: ".gitignore", is_dir: false })).toBe("");
  });
});
