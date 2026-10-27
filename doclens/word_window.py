"""词单位窗口换算——统一窗口模型（grep/search 片段）的 word 口径。

词定义与 planify.tools.basic.split_words_with_seps 一致（read_document /
max_read_words 同源）：CJK 每字一词，非 CJK 连续段按空白切分。

**当量词（equivalence word）**：预算类参数的统一计量单位——非 CJK 词
计 1；CJK 字计 ``CJK_WORD_WEIGHT``（0.5，即 1 英文词 ≈ 2 汉字）。
信息量对齐依据：英文词均 ~6.9 字符/词（含空白，slack 语料实测），
中文 1 字 ≈ 1-2 token 与英文词同量级信息，行业折算比中位 2:1。
纯英文/纯中文文本的窗口宽度不受影响语义（同词量同信息量）；中英
混排时预算按权重累加。
"""
from __future__ import annotations

from planify.tools.basic import split_words_with_seps

# 词→字符的粗估上限（保险丝用途）：英文平均词长 4-5 + 空白，超长词
# （URL/复合词）按 8 估；中文 1 词 = 1 字符远小于此。仅用于 snippet 的
# 字符兜底预算，不参与词计数。
WORD_CHAR_CEILING = 8

# 当量词权重：1 个 CJK 字 = 0.5 当量词（1 英文词 ≈ 2 汉字，2026-10-23
# 定版；2.5:1 信息量对齐更准但窗口放大 2.5 倍挤压条数，取 2:1 折中）
CJK_WORD_WEIGHT = 0.5


def word_weight(w: str) -> float:
    """单个词的当量词权重：CJK 字符数 × 0.5 + 非 CJK 计 1。"""
    cjk = sum(1 for ch in w if '\u4e00' <= ch <= '\u9fff' or '\u3040' <= ch <= '\u30ff' or '\uac00' <= ch <= '\ud7af')
    if cjk == 0:
        return 1.0
    if cjk == len(w):
        return cjk * CJK_WORD_WEIGHT
    # 混合词（CJK + 拉丁/数字）：两部分各计各的
    return cjk * CJK_WORD_WEIGHT + (len(w) - cjk)


def count_equivalence_words(text: str) -> float:
    """文本的当量词总数（预算类参数的计量口径）。

    read_document 的 start_word/end_word 是离散词序号 API（对外语义，
    冻结不变），与当量词计数（预算用途）明确分离。

    快速路径（2026-10-27）：纯 ASCII 文本（企业语料绝大多数）跳过
    通用切词器——非 CJK 词全计 1，当量词数 = 空白切分词数，str.split
    即等价且 O(n) 单次扫描；含 CJK 走原通用路径。语义一致：split 按
    空白切词与 split_words_with_seps 的非 CJK 分支同口径。
    """
    if not text:
        return 0.0
    if text.isascii():
        return float(len(text.split()))
    return sum(word_weight(w) for w, _sep in split_words_with_seps(text) if w)


def start_before_words(text: str, anchor: int, n_words: int) -> int:
    """锚点 *anchor*（字符位置）前 *n_words* 当量词的窗口起点（字符位置）。

    起点落在词边界（不切词中）；锚点前不足 n 当量词时取 0；n_words <= 0
    返回 anchor 本身（零前窗，语义与旧字符口径一致）。锚点落在词中间
    时，该被截断的半词计为第 1 词（窗口边界近似）。

    保险丝：窗口字符宽度不超过 ``n_words * WORD_CHAR_CEILING``——CJK
    不受影响（1 字权重 0.5，n 当量词最多 2n 字符），但无空白的超长
    连续段（URL / minified 代码 / 超长表格行按切词规则是**一个词**）
    会被硬截，防止词数窗口被异常长词炸穿。
    """
    if n_words <= 0:
        return max(0, min(anchor, len(text)))
    hard_floor = max(0, anchor - n_words * WORD_CHAR_CEILING)
    prefix = text[:anchor]
    starts: list[float] = []  # 各词起点累积的当量词
    weights: list[float] = []
    pos = 0
    for w, sep in split_words_with_seps(prefix):
        if w:
            starts.append(pos)
            weights.append(word_weight(w))
        pos += len(w) + len(sep)
    total = sum(weights)
    if total <= n_words:
        # 前缀当量词不足：短前缀（物理宽 ≤ 保险丝）全取到 0；超长无空白
        # 段（一个词撑爆物理宽）仍受保险丝约束
        return hard_floor
    # 从尾往前累计当量词，凑满预算的第一词（含整词，与离散词口径的
    # starts[-n] 对齐）即窗口起点。边界用 >= 而非 >：恰好凑满 n 当量词时
    # 该词就是窗口首词，> 会多吞一词（end_after_words 同口径）。
    acc = 0.0
    for i in range(len(weights) - 1, -1, -1):
        acc += weights[i]
        if acc >= n_words:
            return max(hard_floor, starts[i])
    return max(hard_floor, starts[0])


def end_after_words(text: str, from_pos: int, n_words: int) -> int:
    """位置 *from_pos* 后 *n_words* 当量词的窗口终点（字符位置）。

    终点落在词尾（不含尾随空白，片段自然干净）；后续不足 n 当量词时
    取 len(text)；n_words <= 0 返回 from_pos 本身。from_pos 落在词中间
    时，该词的剩余部分计为第 1 词。

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
    acc = 0.0
    for w, sep in split_words_with_seps(suffix):
        if w:
            acc += word_weight(w)
            if acc >= n_words:
                return min(hard_ceil, pos + len(w))
        pos += len(w) + len(sep)
    return hard_ceil
