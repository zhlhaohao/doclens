/** styles/badge-styles 公共块测试（AP-7：徽标形状单一真相源）。
 *
 *  守卫：
 *  ① 公共块含形状基线（pill 圆角 / fs-xs / nowrap / inline-block）与
 *     语义变体（neutral / primary / success / plain / outline）；
 *  ② 全仓组件不再自带 `.badge {` 定义（防第 9 份复制）；
 *  ③ 无死样式残留——file-row / model-presets-section 原 `.badge` 无匹配
 *     模板（AP-24 同型），已清除；本断言守卫「徽标类名只在有模板处出现」。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { badgeStyles } from "../src/styles/badge-styles";

describe("badge-styles", () => {
  it("公共块含形状基线与语义变体", () => {
    const css = badgeStyles.cssText;
    expect(css).toContain(".badge");
    expect(css).toContain("var(--cortex-radius-pill)");
    expect(css).toContain("var(--cortex-fs-xs)");
    expect(css).toContain("white-space: nowrap");
    for (const v of ["neutral", "primary", "success", "plain", "outline"]) {
      expect(css).toContain(`.badge.${v}`);
    }
  });

  it("全仓组件无第二处 .badge 定义（单一真相源）", () => {
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
        if (/^\s*\.badge\s*\{/m.test(code)) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("徽标类名只出现在有模板处（无死样式）", () => {
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
        const usesBadgeClass = /class="[^"]*\bbadge\b/.test(code);
        const definesBadge = /^\s*\.badge[\s.{:]/m.test(code);
        if (definesBadge && !usesBadgeClass) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});
