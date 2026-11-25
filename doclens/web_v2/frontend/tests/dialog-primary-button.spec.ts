/** 对话框主按钮口径守卫（2026-11-25）。
 *
 *  口径（用户决议 2026-11-25）：
 *  - **信息型 / 确认型对话框**：每个按钮排（.actions / .buttons）里恰有
 *    一个主按钮（primary；危险操作用 danger），取消一律挂 plain 变体
 *    （公共块 buttonBaseStyles 的三变体之一）；
 *  - **选择型对话框**（点列表项即确认，无天然确认按钮）：city-dialog /
 *    skill-toolbox-dialog —— 底部只有 plain 取消，**豁免**主按钮要求。
 *
 *  守卫方式（静态扫描「对话框内容件」清单，不扫全仓——聊天气泡的
 *  .actions、列表分页也叫 .actions，不属对话框口径）：
 *  ① 每个按钮排块内恰有一个 primary / danger 按钮（多态对话框的多个
 *    状态分支各算一块）；
 *  ② 文案含「取消 / 暂不设置」的按钮必须挂 plain 类。
 *
 *  基类 confirm-dialog-base 的主按钮类是动态表达式（`${this.danger ?
 *  "danger" : "primary"}`），静态扫不到——列入豁免（其子类继承同一外壳）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

/** 对话框内容件清单（直接渲染在 <c-dialog> 内的组件）。 */
const DIALOG_COMPONENTS = [
  "about-dialog.ts",
  "backup-dialog.ts",
  "compact-confirm-dialog.ts",
  "confirm-dialog-base.ts",
  "control-panel-dialog.ts",
  "delete-dialog.ts",
  "fallback-reminder-dialog.ts",
  "fork-confirm-dialog.ts",
  "import-confirm-dialog.ts",
  "input-dialog-base.ts",
  "interject-dialog.ts",
  "move-dialog.ts",
  "new-file-dialog.ts",
  "mkdir-dialog.ts",
  "rename-dialog.ts",
  "reindex-dialog.ts",
  "reparse-dialog.ts",
  "rewind-dialog.ts",
  "session-info-dialog.ts",
  "session-rename-dialog.ts",
  "skill-run-dialog.ts",
  "translate-dialog.ts",
  "turn-delete-dialog.ts",
  "vision-gate-dialog.ts",
  "watch-changes-dialog.ts",
  "workdir-switch-dialog.ts",
];

/** 选择型对话框（点选即确认，无确认按钮）——豁免主按钮要求。 */
const EXEMPT_PRIMARY = new Set(["city-dialog.ts", "skill-toolbox-dialog.ts"]);

/** 主按钮类名是动态表达式——静态扫不到，豁免①。 */
const EXEMPT_DYNAMIC_PRIMARY = new Set(["confirm-dialog-base.ts"]);

function readCode(path: string): string {
  return readFileSync(path, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/** 取出按钮排块（`.actions` / `.buttons`）的内容——多态对话框的多个
 *  状态分支各成一块。 */
function actionRowBlocks(code: string): string[] {
  const out: string[] = [];
  const re = /<div class="(?:actions|buttons)">([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) out.push(m[1]);
  return out;
}

describe("对话框主按钮口径", () => {
  const dir = resolve(process.cwd(), "src/components");

  it("每个按钮排（除选择型）恰有一个 primary / danger 主按钮", () => {
    const offenders: string[] = [];
    for (const f of DIALOG_COMPONENTS) {
      if (EXEMPT_PRIMARY.has(f) || EXEMPT_DYNAMIC_PRIMARY.has(f)) continue;
      const code = readCode(join(dir, f));
      const blocks = actionRowBlocks(code);
      if (blocks.length === 0) continue;
      for (const block of blocks) {
        const primaries = (block.match(/class="[^"]*\b(primary|danger)\b[^"]*"/g) ?? []).length;
        if (primaries !== 1) offenders.push(`${f}(${primaries})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("取消类按钮挂 plain 变体（公共块 buttonBaseStyles 的三变体之一）", () => {
    const offenders: string[] = [];
    for (const f of [...DIALOG_COMPONENTS, "city-dialog.ts", "skill-toolbox-dialog.ts"]) {
      const code = readCode(join(dir, f));
      for (const m of code.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)) {
        const label = m[2].trim();
        if (!/取消|暂不设置/.test(label)) continue;
        if (!/\bplain\b/.test(m[1])) offenders.push(`${f}: ${label}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
