# -*- coding: utf-8 -*-
"""邮件 HTML 正文 → Markdown 转写（ADR-0003 决策 3）。

body_html 存在时优先转写为 Markdown 作为邮件文档正文（保持标题/列表/表格
结构），搜索语料与预览同源。转换复用项目已有依赖 markitdown。

图片一律剥除（留 alt 占位文字）：
- ``cid:`` 内嵌图——本期不做 cid→附件映射重写（ADR-0003 决策 4）
- ``data:`` base64 图——避免 MB 级 base64 混进索引文本
- 远程图——预览时加载外联图会向发件方泄漏已读回执（tracking pixel）
"""
import io
import logging
import re

logger = logging.getLogger(__name__)

_CONVERTER = None  # MarkItDown 懒加载单例（初始化有开销，逐邮件新建太慢）


def _get_converter():
    global _CONVERTER
    if _CONVERTER is None:
        from markitdown import MarkItDown

        _CONVERTER = MarkItDown()
    return _CONVERTER


# markdown 图片语法：![alt](url)
_RE_MD_IMAGE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")

# 转换后残留的 HTML img 标签（markitdown 对复杂嵌套偶有泄漏）
_RE_HTML_IMAGE = re.compile(r"<img\b[^>]*>", re.IGNORECASE)

_RE_BLANK_LINES = re.compile(r"\n{3,}")


def email_html_to_md(html: str) -> str:
    """把邮件 body_html 转写为 Markdown 文本。

    Returns:
        转写后的 Markdown；输入为空或转换失败时返回 ""（调用方退回纯文本正文）。
    """
    if not html or not html.strip():
        return ""
    try:
        result = _get_converter().convert_stream(
            io.BytesIO(html.encode("utf-8", errors="replace")),
            file_extension=".html",
        )
        md = result.text_content or ""
    except Exception as e:
        logger.debug("email html->md conversion failed: %s", e)
        return ""

    # 剥图片：md 语法留 alt 占位文字；残留 HTML img 标签整段移除
    md = _RE_MD_IMAGE.sub(lambda m: m.group(1) or "", md)
    md = _RE_HTML_IMAGE.sub("", md)
    return _RE_BLANK_LINES.sub("\n\n", md).strip()
