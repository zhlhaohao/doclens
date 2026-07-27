import { describe, it, expect, vi, afterEach } from "vitest";
import { isCoarsePointer } from "../src/utils/device";

function stubMatchMedia(matches: boolean | undefined) {
  if (matches === undefined) {
    // 模拟老浏览器：matchMedia 不存在
    vi.stubGlobal("matchMedia", undefined);
    Object.defineProperty(window, "matchMedia", { value: undefined, writable: true, configurable: true });
    return;
  }
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isCoarsePointer", () => {
  it("returns true when pointer: coarse matches (触屏设备)", () => {
    stubMatchMedia(true);
    expect(isCoarsePointer()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith("(pointer: coarse)");
  });

  it("returns false when pointer: coarse does not match (桌面)", () => {
    stubMatchMedia(false);
    expect(isCoarsePointer()).toBe(false);
  });

  it("falls back to false when matchMedia is unavailable", () => {
    stubMatchMedia(undefined);
    expect(isCoarsePointer()).toBe(false);
  });
});
