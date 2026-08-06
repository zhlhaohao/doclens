import DOMPurify from "dompurify";

/**
 * 统一 HTML 清洗：marked 输出在注入 innerHTML 前必须过此函数（V1 存储 XSS 修复）。
 *
 * marked v18 默认对内联 HTML 原样保留（raw passthrough），既不转义也不过滤，
 * 因此用户投递的 `<img onerror>`、`<a href="javascript:...">` 等载荷会直接生效。
 * DOMPurify 默认即移除 <script>、on* 事件属性、javascript:/vbscript: 等危险 URI；
 * ADD_ATTR 显式保留 marked renderer 用到的 loading（img 懒加载）与 target（链接）。
 * data-* 属性默认保留——md-viewer 的 data-source-line 行定位依赖它。
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["loading", "target"] }) as string;
}
