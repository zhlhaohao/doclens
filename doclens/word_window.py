"""词单位窗口换算——统一窗口模型（grep/search 片段）的 word 口径。

词定义与 planify.tools.basic.split_words_with_seps 一致（read_document /
max_read_words 同源）：CJK 每字一词，非 CJK 连续段按空白切分。

窗口参数（search_context_before/after）以**词**为单位——中英语料下
token 预算均匀：字符口径下 200 字符对中文是 200 字、对英文仅约 35 词
（约为中文信息量的 1/6）；词口径下两种语言窗口内的词量一致。
"""
from __future__ import annotations

from planify.tools.basic import split_words_with_seps

# 词→字符的粗估上限（保险丝用途）：英文平均词长 4-5 + 空白，超长词
# （URL/复合词）按 8 估；中文 1 词 = 1 字符远小于此。仅用于 snippet 的
# 字符兜底预算，不参与词计数。
WORD_CHAR_CEILING = 8


def start_before_words(text: str, anchor: int, n_words: int) -> int:
    """锚点 *anchor*（字符位置）前 *n_words* 词的窗口起点（字符位置）。

    起点落在词边界（不切词中）；锚点前不足 n 词时取 0；n_words <= 0
    返回 anchor 本身（零前窗，语义与旧字符口径一致）。锚点落在词中间
    时，该被截断的半词计为第 1 词（窗口边界近似）。

    保险丝：窗口字符宽度不超过 ``n_words * WORD_CHAR_CEILING``——CJK
    每字一词不受影响（1 词 = 1 字符），但无空白的超长连续段（URL /
    minified 代码 / 超长表格行按切词规则是**一个词**）会被硬截，防止
    词数窗口被异常长词炸穿。
    """
    if n_words <= 0:
        return max(0, min(anchor, len(text)))
    hard_floor = max(0, anchor - n_words * WORD_CHAR_CEILING)
    prefix = text[:anchor]
    starts: list[int] = []
    pos = 0
    for w, sep in split_words_with_seps(prefix):
        if w:
            starts.append(pos)
        pos += len(w) + len(sep)
    if len(starts) <= n_words:
        # 前缀词数不足：短前缀（物理宽 ≤ 保险丝）全取到 0；超长无空白
        # 段（一个词撑爆物理宽）仍受保险丝约束
        return hard_floor
    return max(hard_floor, starts[-n_words])


def end_after_words(text: str, from_pos: int, n_words: int) -> int:
    """位置 *from_pos* 后 *n_words* 词的窗口终点（字符位置）。

    终点落在词尾（不含尾随空白，片段自然干净）；后续不足 n 词时取
    len(text)；n_words <= 0 返回 from_pos 本身。from_pos 落在词中间时，
    该词的剩余部分计为第 1 词。

    保险丝：窗口字符宽度不超过 ``n_words * WORD_CHAR_CEILING``（同
    start_before_words——超长单词硬截，CJK 不受影响）。
    """
    if n_words <= 0:
        return max(0, min(from_pos, len(text)))
    hard_ceil = min(len(text), from_pos + n_words * WORD_CHAR_CEILING)
    suffix = text[from_pos:]
    # 前导空白被切词丢弃（不归属任何 sep），须补回偏移，否则词位置左移
    lead = len(suffix) - len(suffix.lstrip())
    pos = from_pos + lead
    count = 0
    for w, sep in split_words_with_seps(suffix):
        if w:
            count += 1
            if count >= n_words:
                return min(hard_ceil, pos + len(w))
        pos += len(w) + len(sep)
    return hard_ceil
