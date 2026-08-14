import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { marked } from "marked";

/**
 * 真实文件全量验证：2512.13927.md 经 md-viewer 完整管线后
 * 不应残留任何 $$ 字面量。复用组件模块以触发同一 marked 全局配置。
 */
import "../src/components/md-viewer";

// 真实 arxiv 样例在知识库（独立仓库），不在本仓库；缺失时跳过
const SAMPLE = "C:/Users/lianghao/github/cortex/test_work_dir/arxiv/2512.13927.md";

describe.skipIf(!existsSync(SAMPLE))("2512.13927.md 真实文件公式覆盖", () => {
  it("renders all math, no literal $$ left", async () => {
    const src = readFileSync(SAMPLE, "utf-8");
    // 触发 ensureMdConfigured（模块级 marked 全局配置在组件 render 时执行）
    const el = document.createElement("md-viewer") as any;
    el.content = "x";
    document.body.appendChild(el);
    await el.updateComplete;

    const out = marked.parse(src, { async: false }) as string;
    const katexCount = (out.match(/class="katex"/g) || []).length;
    const displayCount = (out.match(/katex-display/g) || []).length;
    const leftover = (out.match(/\$\$/g) || []).length;
    expect(katexCount).toBeGreaterThan(300); // 行内公式数百处
    expect(displayCount).toBeGreaterThan(50); // 107 个单行 $$ 块
    expect(leftover).toBe(0);
    el.remove();
  });
});
