import { describe, it, expect, beforeEach } from "vitest";
import { readCodeTheme, writeCodeTheme } from "../src/utils/code-theme";

describe("code-theme 三态（ADR-0043）", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("无记录 = auto（跟随应用主题）", () => {
    expect(readCodeTheme()).toBe("auto");
  });

  it("非法值回落 auto", () => {
    localStorage.setItem("cortex.preview.codeTheme", "neon");
    expect(readCodeTheme()).toBe("auto");
  });

  it("历史两态值（light/dark）照常读出——显式固定态", () => {
    localStorage.setItem("cortex.preview.codeTheme", "dark");
    expect(readCodeTheme()).toBe("dark");
    localStorage.setItem("cortex.preview.codeTheme", "light");
    expect(readCodeTheme()).toBe("light");
  });

  it("写 auto = 清除记录（未显式设置语义）", () => {
    localStorage.setItem("cortex.preview.codeTheme", "dark");
    writeCodeTheme("auto");
    expect(localStorage.getItem("cortex.preview.codeTheme")).toBeNull();
    expect(readCodeTheme()).toBe("auto");
  });

  it("写 light/dark 落盘", () => {
    writeCodeTheme("dark");
    expect(localStorage.getItem("cortex.preview.codeTheme")).toBe("dark");
    writeCodeTheme("light");
    expect(localStorage.getItem("cortex.preview.codeTheme")).toBe("light");
  });

  it("非法写入静默忽略", () => {
    writeCodeTheme("neon" as never);
    expect(localStorage.getItem("cortex.preview.codeTheme")).toBeNull();
  });
});
