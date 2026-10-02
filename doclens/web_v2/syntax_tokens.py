# -*- coding: utf-8 -*-
"""服务端语法分词（ADR-0032）：Pygments token 流 → 逐行 [kind, text] run 数组。

预览高亮的分工形态——语法 token 化在后端完成，前端只按 kind 着色、
不携带语法知识（零高亮库 bundle）。与前端高亮库方案（highlight.js 类）
相对。

契约（与前端 preview-pane 共同锁定）：
- 返回 ``list[list[list[str, 2]]]``：外层 = 行（与 content 的 ``\\n`` 切分
  一一对应），内层 = run 的 ``[kind, text]``；
- kind 为 8 类归一化单字符：``c``注释 ``k``关键字 ``s``字符串 ``n``数字
  ``f``函数·方法名 ``t``类型·类名 ``o``操作符 ``p``标点；**未归类 run 用
  空串**（前端渲染正文色、不挂 class）；
- 纯文本（TextLexer 命中）、markdown、html、超上限（1MB）、未知后缀、
  分词异常 → 返回 None，前端回退纯文本渲染；
- 范围切片（start_line/end_line）由调用方对**返回后的行数组**切片——
  分词始终整文件进行（保证多行字符串/注释跨行词法正确），切片行号与
  content 的 line_range 同口径。
"""
import logging
import os

from pygments.token import Token
from pygments.util import ClassNotFound

logger = logging.getLogger(__name__)

# tokens 不下发上限（content 字节数口径；超限纯文本兜底，防 payload 爆炸）
_MAX_TOKENIZE_BYTES = 1024 * 1024

# 前端有专属视图、不走 token 高亮的语言（Pygments lexer name 小写口径）
_SKIPPED_LEXER_NAMES = frozenset({"markdown", "html", "htmldjango", "text"})

# Pygments token 类型 → 归一化 kind（8 类）。匹配用 token 子类型归属
# （``tok in Token.Comment`` 对 Comment.Single/Comment.Multiline 均真），
# 规则顺序即优先级：Name.Function 先于兜底大类 Name（后者不设规则 → 正文色）。
_TOKEN_KIND_RULES: tuple[tuple[type, str], ...] = (
    (Token.Comment, "c"),
    (Token.Keyword, "k"),
    (Token.Literal.String, "s"),
    (Token.Literal.Number, "n"),
    (Token.Operator.Word, "k"),
    (Token.Operator, "o"),
    (Token.Name.Function, "f"),
    (Token.Name.Class, "t"),
    (Token.Name.Namespace, "t"),
    (Token.Name.Builtin, "t"),
    (Token.Name.Decorator, "t"),
    (Token.Name.Attribute, "f"),
    (Token.Name.Tag, "t"),
    (Token.Punctuation, "p"),
)


def _token_kind(tok) -> str:
    """Pygments token → 归一化 kind；未归类返回空串（正文色）。"""
    for rule_tok, kind in _TOKEN_KIND_RULES:
        if tok in rule_tok:
            return kind
    return ""


def _merge_append(line_runs: list, kind: str, text: str) -> None:
    """把 run 追加到当前行，与前一同 kind 的相邻 run 合并（省 payload）。"""
    if line_runs and line_runs[-1][0] == kind:
        line_runs[-1][1] += text
    else:
        line_runs.append([kind, text])


def tokenize_code(content: str, filename: str) -> list[list[list[str]]] | None:
    """整文件语法分词 → 逐行 [kind, text] run 数组；不适用/超限返回 None。

    Args:
        content: 文件全文（与预览 content 同源、同解码）。
        filename: 文件名（含扩展名；按名解析 lexer，不做内容嗅探）。

    Returns:
        行数组；TextLexer/markdown/html/未知后缀/超 1MB/解析异常 → None。
    """
    if not content:
        return None
    if len(content.encode("utf-8", errors="replace")) > _MAX_TOKENIZE_BYTES:
        return None
    from pygments.lexers import TextLexer, get_lexer_for_filename

    try:
        lexer = get_lexer_for_filename(
            os.path.basename(filename),
            stripnl=False,   # 保留原换行结构，行号与 content 一一对应
            ensurenl=False,  # 不补尾换行，末行对齐
        )
    except ClassNotFound:
        return None
    if isinstance(lexer, TextLexer):  # 纯文本（name="Text only"，逐词判不可靠）
        return None
    if lexer.name.lower() in _SKIPPED_LEXER_NAMES:
        return None

    lines: list[list[list[str]]] = [[]]
    try:
        for tok, text in lexer.get_tokens(content):
            if not text:
                continue
            kind = _token_kind(tok)
            # 单 token 可含 \n（块注释/多行字符串），拆到对应行
            segs = text.split("\n")
            for i, seg in enumerate(segs):
                if seg:
                    _merge_append(lines[-1], kind, seg)
                if i < len(segs) - 1:  # run 内还有换行 → 开新行
                    lines.append([])
    except Exception:
        logger.warning("tokenize failed for %s, falling back to plain text",
                       filename, exc_info=True)
        return None
    # 行口径对齐 content 的 text.split('\\n')：文本以 \\n 结尾时 split 产出
    # 末尾空行，token 循环同样会开出一个空 run 行——两者天然同长；文本不
    # 以 \\n 结尾时循环不会多开行。无需 pop，任何修剪都会破坏行号对齐。
    return lines
