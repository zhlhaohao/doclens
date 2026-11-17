/** utils/clipboard 单元测试（AP-5：剪贴板写入单一入口）。
 *
 *  守卫：
 *  ① copyText 主路径走 navigator.clipboard，失败时降级 execCommand；
 *  ② createCopiedFlash 的复位/重置计时/卸载清理（dispose 幂等）；
 *  ③ COPY_FEEDBACK_MS 全仓唯一口径（不得再出现 1500/2000 手抄分裂）；
 *  ④ 全仓无 navigator.clipboard.writeText 绕过单一入口的直调。
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  copyText,
  createCopiedFlash,
  COPY_FEEDBACK_MS,
} from "../src/utils/clipboard";

describe("copyText", () => {
  const savedDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  afterEach(() => {
    if (savedDescriptor) {
      Object.defineProperty(navigator, "clipboard", savedDescriptor);
    } else {
      // jsdom 里 clipboard 可能不存在——删掉测试注入的
      (navigator as any).clipboard = undefined;
    }
    vi.restoreAllMocks();
  });

  function setClipboard(writeText: unknown) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  }

  it("主路径：clipboard API 成功 → true，不再走 execCommand", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);
    setClipboard(writeSpy);
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeSpy).toHaveBeenCalledWith("hello");
    expect(execSpy).not.toHaveBeenCalled();
  });

  it("降级：clipboard 拒绝 → 隐藏 textarea + execCommand 成功 → true", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    const execSpy = vi.spyOn(document, "execCommand").mockReturnValue(true);
    await expect(copyText("fallback")).resolves.toBe(true);
    expect(execSpy).toHaveBeenCalledWith("copy");
  });

  it("降级失败：execCommand 返回 false（jsdom no-op 行为）→ false", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    vi.spyOn(document, "execCommand").mockReturnValue(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(copyText("noop")).resolves.toBe(false);
  });

  it("全失败：clipboard 拒绝且 execCommand 抛错 → false（不再静默吞）", async () => {    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    vi.spyOn(document, "execCommand").mockImplementation(() => {
      throw new Error("unavailable");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(copyText("doomed")).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});

describe("createCopiedFlash", () => {
  it("flash 安排复位；连续 flash 重置计时（只复位一次）", () => {
    vi.useFakeTimers();
    const reset = vi.fn();
    const ctrl = createCopiedFlash(reset);
    ctrl.flash();
    vi.advanceTimersByTime(COPY_FEEDBACK_MS - 1);
    expect(reset).not.toHaveBeenCalled();
    ctrl.flash(); // 重置计时
    vi.advanceTimersByTime(COPY_FEEDBACK_MS - 1);
    expect(reset).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reset).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("dispose 清掉未触发的复位（卸载清理）；多次 dispose 幂等", () => {
    vi.useFakeTimers();
    const reset = vi.fn();
    const ctrl = createCopiedFlash(reset);
    ctrl.flash();
    ctrl.dispose();
    ctrl.dispose(); // 幂等
    vi.advanceTimersByTime(COPY_FEEDBACK_MS * 2);
    expect(reset).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("全仓契约守卫", () => {
  it("COPY_FEEDBACK_MS = 1500（唯一口径）", () => {
    expect(COPY_FEEDBACK_MS).toBe(1500);
  });

  it("组件/视图不绕过单一入口直调 navigator.clipboard.writeText", () => {
    const roots = ["src/components", "src/views"].map((r) =>
      resolve(process.cwd(), r),
    );
    const offenders: string[] = [];
    for (const root of roots) {
      for (const f of readdirSync(root)) {
        if (!f.endsWith(".ts")) continue;
        const code = readFileSync(join(root, f), "utf-8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "");
        if (code.includes("navigator.clipboard.writeText")) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});
