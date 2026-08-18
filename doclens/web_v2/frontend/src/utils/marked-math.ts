/** 带 KaTeX 数学公式支持的 marked 实例工厂。
 *
 *  背景：md-viewer 的公式支持挂在**全局** marked 上（ensureMdConfigured），
 *  只在打开过文档预览后才注册——纯聊天场景（AI 气泡）拿不到公式渲染。
 *  这里用独立的 `new Marked()` 实例，与全局 marked 互不影响。
 *
 *  用法（组件模块级创建一次即可）：
 *    const md = createMathMarked();
 *    const html = md.parse(content, { async: false });
 *
 *  注意：组件还需把 `katex/dist/katex.min.css?inline` 注入 shadow styles，
 *  否则 .katex 只有结构没有样式。
 */
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import katex from "katex";

/** 单行 `$$...$$` 块级公式扩展（marked-katex-extension 只认定界符独占一行）。
 *
 *  与 md-viewer 同款逻辑（arxiv 转换的 md 常写成单行 `$$ $A$ ( $B$ ) $$`，
 *  且内部嵌套 `$...$`），只是不带 data-source-line 行号（聊天消息无此需求）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const singleLineDisplayMath: any = {
  name: "singleLineDisplayMath",
  level: "block",
  start(src: string) {
    return src.indexOf("$$");
  },
  tokenizer(src: string) {
    const m = /^\$\$([^\n]+?)\$\$\s*(?:\n|$)/.exec(src);
    if (!m) return undefined;
    return { type: "singleLineDisplayMath", raw: m[0], text: m[1].trim() };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer(token: any) {
    const body = katex.renderToString(token.text.replace(/\$/g, ""), {
      displayMode: true,
      throwOnError: false,
    });
    return `<div>${body}</div>\n`;
  },
};

/** CJK 语境行内公式扩展（marked-katex-extension 标准规则的补充）。
 *
 *  标准规则 inlineRule 有两个限制，在中文论文/笔记里大面积失效：
 *  1. start() 要求开 $ 前必须是空格（或行首）——`type-$l$`、`，$W^{lk}$`、
 *     `：$\alpha$`、`→$(...)` 这些紧贴中文/符号的写法直接被跳过；
 *  2. 闭 $ 的 lookahead 只认 `[\s?!\.,:？！。，：]`——`$...$（`、`$...$）`、
 *     `$...$；` 无法闭合。
 *  跳过/无法闭合后，$...$ 落入 marked 默认规则，反斜杠转义与 `_` emphasis
 *  会把公式啃烂（`\|`→`|`、`\alpha`→α 文本、`_j(...)k_`→<em>）。
 *
 *  本规则（参照 Pandoc 约定）：
 *  - 开 $ 后不跟空格/$（防 `$$` 块级与空内容）；
 *  - 闭 $ 前必须是非空白字符、后不跟数字（防 `$100 和 $200` 货币误判——
 *    闭合 $ 前是空格则不匹配）；
 *  - 内容不跨行、不含 $，支持 `\x` 转义单元。
 *
 *  注册顺序注意：marked 对同级扩展 tokenizer 用 unshift，后注册者先尝试。
 *  本扩展须在 markedKatex 之后注册，标准写法先命中本规则（渲染结果相同），
 *  CJK 写法由本规则兜底。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CJK_INLINE_RULE = /^\$(?![\s$])((?:\\.|[^\\\n$])+?)(?<=\S)\$(?![\d$])/;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cjkInlineMath: any = {
  name: "cjkInlineMath",
  level: "inline",
  start(src: string) {
    // 返回首个能匹配规则公式的 $ 位置（相对传入 src）；跳过货币等伪 $。
    let offset = 0;
    let s = src;
    for (;;) {
      const i = s.indexOf("$");
      if (i === -1) return;
      if (CJK_INLINE_RULE.test(s.slice(i))) return offset + i;
      offset += i + 1;
      s = s.slice(i + 1);
    }
  },
  tokenizer(src: string) {
    const m = CJK_INLINE_RULE.exec(src);
    if (!m) return undefined;
    return { type: "cjkInlineMath", raw: m[0], text: m[1].trim() };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer(token: any) {
    return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
  },
};

/** 创建配置好 KaTeX 的 marked 实例：$...$ 行内（含 CJK 兜底）/ $$...$$ 块级 +
 *  单行 $$...$$ 兜底；throwOnError:false 非法公式渲染为红色源码而非抛错。 */
export function createMathMarked(): Marked {
  const md = new Marked();
  md.use(markedKatex({ throwOnError: false }));
  md.use({ extensions: [cjkInlineMath, singleLineDisplayMath] });
  return md;
}
