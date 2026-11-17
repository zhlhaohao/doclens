/** styles/form-styles 公共块测试（AP-6：表单控件形态单一真相源）。
 *
 *  守卫：
 *  ① 公共块含控件族形态契约（边框/圆角/字号/焦点环/过渡）+ checkbox
 *     主题色 + textarea 变体；
 *  ② 全仓组件不再自带 `.input, .select` / `.textarea` 形态定义（防复制）；
 *  ③ 可访问性：所有 checkbox 有 label 包裹或显式 aria-label（此前
 *     file-row 行内勾选与 file-list 全选两处无任何标签）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { formStyles } from "../src/styles/form-styles";

const SRC_ROOTS = ["src/components", "src/views"];

function readCode(path: string): string {
  return readFileSync(path, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("form-styles", () => {
  it("公共块含控件族形态契约与 checkbox 主题色", () => {
    const css = formStyles.cssText;
    expect(css).toContain(".input");
    expect(css).toContain(".select");
    expect(css).toContain(".textarea");
    expect(css).toContain("var(--cortex-radius-md)");
    expect(css).toContain("var(--cortex-focus-ring)");
    expect(css).toContain("accent-color: var(--cortex-primary)");
    expect(css).toContain("resize: vertical");
  });

  it("全仓组件无第二处 .input/.select/.textarea 形态定义", () => {
    const offenders: string[] = [];
    for (const root of SRC_ROOTS) {
      const dir = resolve(process.cwd(), root);
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".ts")) continue;
        const code = readCode(join(dir, f));
        // 形态定义 = 声明 .input/.select/.textarea 的规则块里自带
        // border/background（纯尺寸/字体变体不算）
        const re = /^\s*\.(input|select|textarea)(?![\w-])[^{]*\{([^}]*)\}/gm;
        let m: RegExpExecArray | null;
        while ((m = re.exec(code)) !== null) {
          if (/(border|background)\s*:/.test(m[2])) {
            offenders.push(`${f}: ${m[0].trim().split("\n")[0]}`);
            break;
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("所有 checkbox 有 label 包裹或显式 aria-label（可访问性）", () => {
    const offenders: string[] = [];
    for (const root of SRC_ROOTS) {
      const dir = resolve(process.cwd(), root);
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".ts")) continue;
        const code = readCode(join(dir, f));
        if (!code.includes('type="checkbox"')) continue;
        // 每个 checkbox 出现处，其所在 12 行内须有 <label 或 aria-label
        const lines = code.split("\n");
        lines.forEach((line, i) => {
          if (!line.includes('type="checkbox"')) return;
          const ctx = lines.slice(i, i + 12).join("\n");
          const before = lines.slice(Math.max(0, i - 6), i + 1).join("\n");
          if (!ctx.includes("aria-label") && !before.includes("<label")) {
            offenders.push(`${f}:${i + 1}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
