import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { CmEditor } from "../src/components/cm-editor";
import "../src/components/cm-editor";

/**
 * 造一个 <cm-editor> 夹具。
 *
 * CM6 核心是**懒加载**的（动态 import），故需等内核真正挂载完成——
 * 只等 updateComplete 不够（那时内核可能还在下载）。
 */
async function makeFixture(
  original: string,
  props: { path?: string; markdown?: boolean; mobile?: boolean } = {},
): Promise<CmEditor> {
  const el = (await fixture(
    html`<cm-editor
      path=${props.path ?? "x.md"}
      .originalContent=${original}
      ?markdown=${props.markdown ?? false}
      ?mobile=${props.mobile ?? false}
    ></cm-editor>`,
  )) as CmEditor;
  await el.updateComplete;
  // 等懒加载的内核挂载（firstUpdated → 动态 import → 建 EditorView）
  for (let i = 0; i < 50 && !(el as any)._view; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  return el;
}

/** 直接改编辑器内容（等价用户在编辑器里打字）。 */
function type(el: CmEditor, text: string) {
  const view = (el as any)._view;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

/** 当前编辑器内容。 */
function contentOf(el: CmEditor): string {
  return (el as any)._view.state.doc.toString();
}

/** 选中一段（字符偏移）。 */
function select(el: CmEditor, from: number, to: number) {
  const view = (el as any)._view;
  view.dispatch({ selection: { anchor: from, head: to } });
}

/** 按 title 找格式化按钮（比按下标更抗按钮顺序变动）。 */
function fmtBtn(el: CmEditor, title: string): HTMLButtonElement {
  const btns = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".fmt-btn")];
  const found = btns.find((b) => (b.getAttribute("title") ?? "").startsWith(title));
  if (!found) {
    throw new Error(
      `找不到标题以「${title}」开头的格式化按钮；现有：${btns
        .map((b) => b.getAttribute("title"))
        .join(" | ")}`,
    );
  }
  return found;
}

describe("<cm-editor> 内容与挂载", () => {
  // CM6 首次挂载要初始化视口/测量，全量套件并行时可能超过默认 5s
  it("挂载 CM6 编辑器并载入原始内容", async () => {
    const el = await makeFixture("hello\nworld");
    expect(el.shadowRoot!.querySelector(".cm-host")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".cm-editor")).toBeTruthy();
    expect(contentOf(el)).toBe("hello\nworld");
  }, 20000);

  it("提供行号 gutter（CM6 内置行号）", async () => {
    const el = await makeFixture("a\nb\nc");
    expect(el.shadowRoot!.querySelector(".cm-gutters")).toBeTruthy();
  });
});

describe("<cm-editor> 脏状态与事件", () => {
  it("输入后发出 dirty-change(true)", async () => {
    const el = await makeFixture("hello");
    const detail = vi.fn();
    el.addEventListener("dirty-change", (e: any) => detail(e.detail));
    type(el, "changed");
    await el.updateComplete;
    expect(detail).toHaveBeenCalledWith({ dirty: true });
  });

  it("原始内容变化 → 重置内容与脏状态", async () => {
    const el = await makeFixture("hello");
    type(el, "changed");
    await el.updateComplete;
    (el as any).originalContent = "fresh";
    await el.updateComplete;
    expect(contentOf(el)).toBe("fresh");
    expect((el as any)._dirty).toBe(false);
  });
});

describe("<cm-editor> 保存", () => {
  it("点 [保存] 发出 save 事件带当前内容（脏时）", async () => {
    const el = await makeFixture("hello");
    type(el, "world");
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    (el.shadowRoot!.querySelector(".save-btn") as HTMLButtonElement).click();
    expect(saveHandler).toHaveBeenCalledWith({ content: "world" });
  });

  it("[保存] 按钮在非脏时禁用", async () => {
    const el = await makeFixture("hello");
    const btn = el.shadowRoot!.querySelector(".save-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    type(el, "x");
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector(".save-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("Ctrl+S 发出 save 事件（脏时）", async () => {
    const el = await makeFixture("hello");
    type(el, "world");
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const evt = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    el.shadowRoot!.querySelector(".body")!.dispatchEvent(evt);
    expect(saveHandler).toHaveBeenCalledWith({ content: "world" });
  });

  it("非脏时 Ctrl+S 不发 save", async () => {
    const el = await makeFixture("hello");
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const evt = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    el.shadowRoot!.querySelector(".body")!.dispatchEvent(evt);
    expect(saveHandler).not.toHaveBeenCalled();
  });
});

describe("<cm-editor> 取消与丢弃", () => {
  it("点 [取消] 发出 cancel 事件并回滚内容", async () => {
    const el = await makeFixture("original");
    type(el, "changed");
    await el.updateComplete;
    const cancelHandler = vi.fn();
    el.addEventListener("cancel", () => cancelHandler());
    (el.shadowRoot!.querySelector(".cancel-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(cancelHandler).toHaveBeenCalled();
    expect(contentOf(el)).toBe("original");
  });

  it("discard() 回滚内容并发出 cancel", async () => {
    const el = await makeFixture("orig");
    type(el, "x");
    await el.updateComplete;
    const cancelHandler = vi.fn();
    el.addEventListener("cancel", () => cancelHandler());
    el.discard();
    await el.updateComplete;
    expect(contentOf(el)).toBe("orig");
    expect(cancelHandler).toHaveBeenCalled();
  });
});

describe("<cm-editor> 错误提示", () => {
  it("setError() 在工具条显示错误信息", async () => {
    const el = await makeFixture("hi");
    el.setError("网络错误");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".error-msg")!.textContent).toContain("网络错误");
  });
});

describe("<cm-editor> 位置与选区契约", () => {
  it("topLine 返回视口顶部所在源行号", async () => {
    const el = await makeFixture("a\nb\nc\nd\ne");
    expect(el.topLine()).toBe(1);
  });

  it("scrollToLine 把选区移到该行行首", async () => {
    const el = await makeFixture("a\nb\nc\nd\ne");
    el.scrollToLine(3);
    const view = (el as any)._view;
    expect(view.state.selection.main.from).toBe(4); // "a\nb\n" 长度 = 4
    expect(view.state.doc.lineAt(view.state.selection.main.from).number).toBe(3);
  });

  it("scrollToLine 越界时钳制到有效行号", async () => {
    const el = await makeFixture("a\nb\nc");
    el.scrollToLine(99);
    const view = (el as any)._view;
    expect(view.state.doc.lineAt(view.state.selection.main.from).number).toBe(3);
  });

  it("selectOffsets: 精确落地偏移（含区间归一与钳制）", async () => {
    const el = await makeFixture("a\nbb\nccc\ndd");
    el.selectOffsets(2, 8);
    const sel = (el as any)._view.state.selection.main;
    expect(sel.from).toBe(2);
    expect(sel.to).toBe(8);
    // 方向反转自动归一；超界钳制到文本长度（11）
    el.selectOffsets(99, 4);
    const sel2 = (el as any)._view.state.selection.main;
    expect(sel2.from).toBe(4);
    expect(sel2.to).toBe(11);
  });

  it("selectionOffsets: 无选区返回 null", async () => {
    const el = await makeFixture("a\nbb\nccc");
    expect(el.selectionOffsets()).toBeNull();
  });

  it("selectionOffsets: 有选区返回原值偏移", async () => {
    const el = await makeFixture("a\nbb\nccc\ndd");
    select(el, 2, 7);
    expect(el.selectionOffsets()).toEqual({ start: 2, end: 7 });
  });

  it("isAtBottom: 短文档（内容不足一屏）不算贴底（与 md-editor 同语义）", async () => {
    const el = await makeFixture("a");
    // 一屏装得下 → 行号锚点本来就可达，判成贴底会让预览侧改用
    // 「对齐尾部视野」语义，把短文档拉到奇怪的位置
    expect(el.isAtBottom()).toBe(false);
  });

  it("isAtBottom: 长文档滚到底部时为 true", async () => {
    const content = Array.from({ length: 500 }, (_, i) => `L${i + 1}`).join("\n");
    const el = await makeFixture(content);
    const view = (el as any)._view;
    // 视口移到底部
    view.dispatch({
      effects: (await import("@codemirror/view")).EditorView.scrollIntoView(
        view.state.doc.length,
        { y: "end" },
      ),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(el.isAtBottom()).toBe(true);
  });
});

describe("<cm-editor> Markdown 格式化工具条", () => {
  it("markdown=false 时不渲染工具条", async () => {
    const el = await makeFixture("x", { markdown: false });
    expect(el.shadowRoot!.querySelector(".fmt-bar")).toBeNull();
  });

  it("markdown=true 时渲染 12 个格式化按钮", async () => {
    const el = await makeFixture("x", { markdown: true });
    expect(el.shadowRoot!.querySelectorAll(".fmt-btn").length).toBe(12);
  });

  it("粗体：包裹选区", async () => {
    const el = await makeFixture("hello", { markdown: true });
    select(el, 0, 5);
    (fmtBtn(el, "粗体")).click();
    expect(contentOf(el)).toBe("**hello**");
  });

  it("粗体：再次点击解包", async () => {
    const el = await makeFixture("**hello**", { markdown: true });
    select(el, 0, 9);
    (fmtBtn(el, "粗体")).click();
    expect(contentOf(el)).toBe("hello");
  });

  it("斜体：包裹选区", async () => {
    const el = await makeFixture("hello", { markdown: true });
    select(el, 0, 5);
    (fmtBtn(el, "斜体")).click();
    expect(contentOf(el)).toBe("*hello*");
  });

  it("标题：循环升级 H1→H2", async () => {
    const el = await makeFixture("title", { markdown: true });
    select(el, 0, 5);
    const headingBtn = fmtBtn(el, "标题");
    headingBtn.click();
    expect(contentOf(el)).toBe("# title");
    headingBtn.click();
    expect(contentOf(el)).toBe("## title");
  });

  it("标题：H6 之后移除标题前缀", async () => {
    const el = await makeFixture("###### title", { markdown: true });
    select(el, 0, 12);
    const headingBtn = fmtBtn(el, "标题");
    headingBtn.click();
    expect(contentOf(el)).toBe("title");
  });

  it("行内代码：包裹选区", async () => {
    const el = await makeFixture("code", { markdown: true });
    select(el, 0, 4);
    (fmtBtn(el, "行内代码")).click();
    expect(contentOf(el)).toBe("`code`");
  });

  it("代码围栏：插入空围栏块", async () => {
    const el = await makeFixture("", { markdown: true });
    (fmtBtn(el, "代码围栏")).click();
    expect(contentOf(el)).toContain("```");
  });

  it("无序列表：行首加标记", async () => {
    const el = await makeFixture("item", { markdown: true });
    select(el, 0, 4);
    (fmtBtn(el, "无序列表")).click();
    expect(contentOf(el)).toBe("- item\n");
  });

  it("有序列表：行首加序号", async () => {
    const el = await makeFixture("item", { markdown: true });
    select(el, 0, 4);
    (fmtBtn(el, "有序列表")).click();
    expect(contentOf(el)).toBe("1. item\n");
  });

  it("任务清单：行首加 - [ ]", async () => {
    const el = await makeFixture("task", { markdown: true });
    select(el, 0, 4);
    (fmtBtn(el, "任务清单")).click();
    expect(contentOf(el)).toBe("- [ ] task\n");
  });

  it("引用块：行首加 >", async () => {
    const el = await makeFixture("quote", { markdown: true });
    select(el, 0, 5);
    (fmtBtn(el, "引用块")).click();
    expect(contentOf(el)).toBe("> quote");
  });

  it("超链接：包裹为 markdown 链接", async () => {
    const el = await makeFixture("text", { markdown: true });
    select(el, 0, 4);
    (fmtBtn(el, "超链接")).click();
    expect(contentOf(el)).toBe("[text](https://)");
  });

  it("表格：插入表头 + 分隔行", async () => {
    const el = await makeFixture("", { markdown: true });
    (fmtBtn(el, "表格")).click();
    expect(contentOf(el)).toContain("| 列1 | 列2 | 列3 |");
    expect(contentOf(el)).toContain("| --- | --- | --- |");
  });

  it("分割线：插入 ---", async () => {
    const el = await makeFixture("", { markdown: true });
    (fmtBtn(el, "分割线")).click();
    expect(contentOf(el)).toContain("---");
  });
});

describe("<cm-editor> 语言包懒加载", () => {
  it("md 文件加载 markdown 语言包（不抛错）", async () => {
    const el = await makeFixture("# h", { path: "a.md" });
    await new Promise((r) => setTimeout(r, 50));
    expect(contentOf(el)).toBe("# h");
  });

  it("未知后缀不加载语言包（无高亮但可编辑）", async () => {
    const el = await makeFixture("x", { path: "a.unknownext" });
    await new Promise((r) => setTimeout(r, 50));
    expect(contentOf(el)).toBe("x");
  });
});

/** md 编辑态与「代码配色」的隔离（ADR-0043 作用范围：代码主题只管行号视图）。
 *  回归 2026-10-22 用户报告：「md 编辑器永远是暗色，即使系统主题是亮色」——
 *  根因是 cm-editor 无条件消费 codeTheme，行号视图里点过「深色」后 md 编辑
 *  被永久锁深；而 md 预览 header 没有配色按钮，用户无从改回。 */
describe("<cm-editor> md 编辑态跟随应用主题", () => {
  /** 直接驱动内部主题状态（不走 localStorage，避免污染其它用例） */
  function setThemes(el: CmEditor, code: "auto" | "light" | "dark", app: "light" | "dark" | "paper") {
    (el as any)._codeTheme = code;
    (el as any)._appTheme = app;
    (el as any)._applyTheme();
  }

  it("markdown + codeTheme=dark + 应用亮色 → 仍取浅色表面", async () => {
    const el = await makeFixture("# h", { markdown: true });
    setThemes(el, "dark", "light");
    expect((el as any)._codeDark).toBe(false);
    expect((el as any)._view.dom.style.background).toBe("var(--cortex-bg)");
  });

  it("markdown 时应用主题切深夜 → 跟随变深（token 自己变）", async () => {
    const el = await makeFixture("# h", { markdown: true });
    setThemes(el, "light", "dark");
    expect((el as any)._codeDark).toBe(true);
    // 表面仍是 token 版（不是 GitHub dark 硬编码），让应用主题决定实际色值
    expect((el as any)._view.dom.style.background).toBe("var(--cortex-bg)");
  });

  it("非 markdown（行号视图）仍尊重 codeTheme 强制深色", async () => {
    const el = await makeFixture("x = 1", { path: "a.py", markdown: false });
    setThemes(el, "dark", "light");
    expect((el as any)._codeDark).toBe(true);
    // jsdom 会把 hex 归一为 rgb
    expect((el as any)._view.dom.style.background).toBe("rgb(13, 17, 23)");
  });
});
