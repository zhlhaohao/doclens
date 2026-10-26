import { describe, it, expect } from "vitest";
import {
  DRIVES_SENTINEL,
  isAbsoluteBrowsePath,
  isDrivesLayer,
  isOutsideWorkdir,
  joinBrowsePath,
  parentBrowsePath,
  parentOfBrowseRoot,
  breadcrumbSegments,
} from "../src/utils/browse-path";

describe("isAbsoluteBrowsePath（ADR-0049 双形态判定）", () => {
  it("盘符正斜杠/反斜杠与 UNC 是绝对路径", () => {
    expect(isAbsoluteBrowsePath("D:/资料")).toBe(true);
    expect(isAbsoluteBrowsePath("C:\\Users")).toBe(true);
    expect(isAbsoluteBrowsePath("//server/share")).toBe(true);
  });
  it("相对 POSIX、空串、哨兵不是绝对路径", () => {
    expect(isAbsoluteBrowsePath("a/b")).toBe(false);
    expect(isAbsoluteBrowsePath("")).toBe(false);
    expect(isAbsoluteBrowsePath(DRIVES_SENTINEL)).toBe(false);
  });
});

describe("isOutsideWorkdir / isDrivesLayer", () => {
  it("绝对路径与此电脑层都是外部态", () => {
    expect(isOutsideWorkdir("D:/x")).toBe(true);
    expect(isOutsideWorkdir(DRIVES_SENTINEL)).toBe(true);
    expect(isDrivesLayer(DRIVES_SENTINEL)).toBe(true);
  });
  it("workdir 内相对路径不是外部态", () => {
    expect(isOutsideWorkdir("")).toBe(false);
    expect(isOutsideWorkdir("a/b")).toBe(false);
  });
});

describe("joinBrowsePath", () => {
  it("空 dir = name；相对/绝对统一拼接", () => {
    expect(joinBrowsePath("", "x.md")).toBe("x.md");
    expect(joinBrowsePath("a", "b")).toBe("a/b");
    expect(joinBrowsePath("D:/", "x")).toBe("D:/x");
    expect(joinBrowsePath("D:/a", "x")).toBe("D:/a/x");
  });
});

describe("parentBrowsePath（上溯链）", () => {
  it("相对链：a/b → a → 根", () => {
    expect(parentBrowsePath("a/b")).toBe("a");
    expect(parentBrowsePath("a")).toBe("");
    expect(parentBrowsePath("")).toBe(null);
  });
  it("绝对链：盘符根之上是此电脑", () => {
    expect(parentBrowsePath("D:/a/b")).toBe("D:/a");
    expect(parentBrowsePath("D:/a")).toBe("D:/");
    expect(parentBrowsePath("D:/")).toBe(DRIVES_SENTINEL);
    expect(parentBrowsePath(DRIVES_SENTINEL)).toBe(null);
  });
});

describe("parentOfBrowseRoot（走出 workdir 的唯一跳板）", () => {
  it("workdir 根 → 父目录绝对路径", () => {
    expect(parentOfBrowseRoot("D:\\知识库")).toBe("D:/");
    expect(parentOfBrowseRoot("D:/a/b")).toBe("D:/a/");
  });
  it("盘符根本身/未知 workdir → null", () => {
    expect(parentOfBrowseRoot("D:/")).toBe(null);
    expect(parentOfBrowseRoot(null)).toBe(null);
    expect(parentOfBrowseRoot(undefined)).toBe(null);
  });
});

describe("breadcrumbSegments（面包屑分段）", () => {
  it("根目录 → 单段", () => {
    expect(breadcrumbSegments("")).toEqual([{ label: "根目录", path: "" }]);
  });
  it("相对链带根目录头", () => {
    expect(breadcrumbSegments("a/b")).toEqual([
      { label: "根目录", path: "" },
      { label: "a", path: "a" },
      { label: "b", path: "a/b" },
    ]);
  });
  it("绝对链以「此电脑」开头，盘符段保留尾斜杠", () => {
    expect(breadcrumbSegments("D:/x/y")).toEqual([
      { label: "此电脑", path: DRIVES_SENTINEL },
      { label: "D:", path: "D:/" },
      { label: "x", path: "D:/x" },
      { label: "y", path: "D:/x/y" },
    ]);
  });
  it("此电脑层 → 单段", () => {
    expect(breadcrumbSegments(DRIVES_SENTINEL)).toEqual([
      { label: "此电脑", path: DRIVES_SENTINEL },
    ]);
  });
  it("单字符目录名不被误过滤（回归）", () => {
    const segs = breadcrumbSegments("D:/a/b");
    expect(segs.map(s => s.label)).toEqual(["此电脑", "D:", "a", "b"]);
  });
});
