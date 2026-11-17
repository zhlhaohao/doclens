/** styles/empty-state-styles 公共块测试（AP-2：空态样式单一真相源）。
 *
 *  守卫：
 *  ① 公共块含基线（subtle/fs-sm/居中/space-6）+ loading 呼吸 + fill 填充变体；
 *  ② loading 呼吸带 reduced-motion 降级（AP-1 同款纪律）；
 *  ③ 全仓组件不再自带 `.empty {` 定义（防第 18 份复制）；
 *  ④ 无 32px 硬编码留白（DESIGN.md「只用 tokens」红线，diary 实证）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { emptyStateStyles } from "../src/styles/empty-state-styles";

describe("empty-state-styles", () => {
  it("公共块含基线与变体", () => {
    const css = emptyStateStyles.cssText;
    expect(css).toContain(".empty");
    expect(css).toContain("var(--cortex-text-subtle)");
    expect(css).toContain("var(--cortex-fs-sm)");
    expect(css).toContain("text-align: center");
    expect(css).toContain(".empty.loading");
    expect(css).toContain("empty-pulse");
    expect(css).toContain(".empty.fill");
    expect(css).toContain("justify-content: center");
  });

  it("loading 呼吸带 reduced-motion 降级", () => {
    expect(emptyStateStyles.cssText).toContain("prefers-reduced-motion: reduce");
  });

  it("全仓组件无第二处 .empty 定义（单一真相源）", () => {
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
        if (/^\s*\.empty\s*\{/m.test(code)) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("公共块无硬编码留白（只用 tokens）", () => {
    expect(emptyStateStyles.cssText).not.toMatch(/\b\d+px\b/);
  });
});
