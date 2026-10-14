import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  APP_THEME_ORDER,
  APP_THEME_DEFAULT,
  cycleAppTheme,
  onAppThemeChange,
  readAppTheme,
  writeAppTheme,
} from "../src/utils/app-theme";

function setKey(v: string | null) {
  if (v === null) localStorage.removeItem("cortex.theme");
  else localStorage.setItem("cortex.theme", v);
}

describe("app-theme (ADR-0043)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to light with no data-theme attribute", () => {
    expect(readAppTheme()).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("invalid stored value falls back to default", () => {
    setKey("neon");
    expect(readAppTheme()).toBe(APP_THEME_DEFAULT);
  });

  it("writeAppTheme applies attribute + persists + broadcasts", () => {
    const spy = vi.fn();
    const off = onAppThemeChange(spy);
    writeAppTheme("dark");
    expect(localStorage.getItem("cortex.theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(spy).toHaveBeenCalledWith("dark");
    off();
  });

  it("writeAppTheme('light') removes attribute (back to :root baseline)", () => {
    writeAppTheme("dark");
    writeAppTheme("light");
    expect(localStorage.getItem("cortex.theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("writeAppTheme ignores invalid value", () => {
    writeAppTheme("neon" as never);
    expect(localStorage.getItem("cortex.theme")).toBeNull();
  });

  it("cycleAppTheme walks full order and wraps", () => {
    const seen: string[] = [];
    for (let i = 0; i <= APP_THEME_ORDER.length; i++) {
      seen.push(cycleAppTheme());
    }
    // 三主题循环回到起点：第 4 次等于第 1 次
    expect(seen[0]).toBe("dark"); // light → dark
    expect(seen[3]).toBe(seen[0]);
    expect(new Set(seen.slice(0, 3))).toEqual(new Set(APP_THEME_ORDER));
  });

  it("onAppThemeChange unsubscribe stops callbacks", () => {
    const spy = vi.fn();
    const off = onAppThemeChange(spy);
    off();
    writeAppTheme("paper");
    expect(spy).not.toHaveBeenCalled();
  });
});
