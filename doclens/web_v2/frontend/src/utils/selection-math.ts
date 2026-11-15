/** DOM 选区 ↔ 源文本偏移换算（AP-6 拆分件）：md-viewer 内嵌的纯几何
 *  计算（~170 行）——块源行闭包、行首偏移、块渲染文本长度/定位、
 *  双向比例映射——此前全部内联在 md-viewer（God Object 的「选区换算」
 *  职责域，2026-11-15 迁出为纯函数模块；组件层只剩 Selection/Range 的
 *  获取与落地壳）。 */

/** 组件渲染树内的 Selection（Chromium 提供 ShadowRoot.getSelection，
 *  标准 TS DOM lib 未收录——运行时探测）；回退 window 级（open shadow
 *  的选区节点同样暴露在 document selection 中）。 */
export function shadowSelection(root: ShadowRoot): Selection | null {
  const shadowSel = (root as unknown as {
    getSelection?: () => Selection | null;
  })?.getSelection?.();
  return shadowSel ?? window.getSelection();
}

/** 块内渲染文本总长（TreeWalker 累计文本节点；含 copy-btn 文本，
 *  与捕获方向的 Range.toString 对称）。 */
export function domTextLength(el: HTMLElement): number {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let len = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) len += (n as Text).length;
  return len;
}

/** 块渲染文本第 k 字符的 DOM 位置（(node, offset)；超界钳块尾文本节点）。 */
export function domLocate(el: HTMLElement, k: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remain = Math.max(0, k);
  let last: Text | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if (remain <= t.length) return { node: t, offset: remain };
    remain -= t.length;
    last = t;
  }
  return last ? { node: last, offset: last.length } : null;
}

/** 源上下文：content + 锚块集合（组件侧提供）。 */
export interface SourceContext {
  content: string;
  /** 带 data-source-line 属性的锚块（文档序）。 */
  anchorBlocks: HTMLElement[];
}

/** 块覆盖的源行闭区间（from = 锚行，to = 下一锚块起始行-1 / 文档末行）。 */
export function blockSourceLines(ctx: SourceContext, el: HTMLElement): { from: number; to: number } {
  const from = Number(el.getAttribute("data-source-line")) || 1;
  const idx = ctx.anchorBlocks.indexOf(el);
  const next =
    idx >= 0 && idx + 1 < ctx.anchorBlocks.length
      ? Number(ctx.anchorBlocks[idx + 1].getAttribute("data-source-line")) || from
      : ctx.content.split("\n").length + 1;
  return { from, to: Math.max(from, next - 1) };
}

/** 行号（1-indexed）行首在 content 中的绝对字符偏移。 */
export function lineStartOffset(content: string, n: number): number {
  const lines = content.split("\n");
  let off = 0;
  for (let i = 0; i < Math.min(n - 1, lines.length); i++) off += lines[i].length + 1;
  return off;
}

/** 块内源文本（覆盖行 join）；同时返回块首绝对偏移。 */
export function blockSourceText(ctx: SourceContext, el: HTMLElement): { abs: number; text: string } {
  const { from, to } = blockSourceLines(ctx, el);
  return {
    abs: lineStartOffset(ctx.content, from),
    text: ctx.content.split("\n").slice(from - 1, to).join("\n"),
  };
}
