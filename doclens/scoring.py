"""纯计算模块 - 查询分词、近邻评分、综合评分"""


def tokenize_query(query):
    """使用 jieba 对查询进行分词，过滤掉单字词"""
    from treesearch.tokenizer import tokenize
    tokens = tokenize(query)
    # 过滤掉单字符词
    return [t for t in tokens if len(t) > 1]


# 注意：proximity_score 只是一个粗粒度分数 (0/1/2)，
# 经过 compute_composite_score 综合后，3 词 query 命中 2 词的
# 综合分通常约 0.5 左右——所以 CORTEX_MIN_SCORE_THRESHOLD 设成 0.5
# 会把多关键词 query 的大多数有效结果砍掉，慎用。
import re
from functools import lru_cache

from doclens.word_window import count_equivalence_words


@lru_cache(maxsize=256)
def _compile_kw_pattern(kws_key: tuple):
    """按关键词元组缓存编译后的正则（同一 query 的 1669 个候选节点
    复用同一 pattern，编译只发生一次）。"""
    return re.compile("|".join(re.escape(kw) for kw in kws_key))


def _scan_keyword_hits(text: str, keywords: list):
    """单次扫描返回每个关键词的首次命中区间（大小写不敏感）。

    2026-10-27 性能改造：旧实现对每关键词各做一次 text.lower()
    （O(n·k)，长文本 × 9 词 query 是 scoring 热点的主体——1669 候选
    节点 × (k+2) 次全文 lower 实测 5-16s）。现改为 lower 一次 + 编译
    正则一次 finditer，O(n + k)；命中区间语义与逐词 find 完全一致
    （每个关键词取首个出现位置）。

    Returns:
        {kw_lower: (start, end)}，未命中的关键词不在结果里。
    """
    if not text or not keywords:
        return {}
    text_lower = text.lower()
    kw_lowers = tuple(kw.lower() for kw in keywords if kw)
    if not kw_lowers:
        return {}
    pattern = _compile_kw_pattern(kw_lowers)
    hits = {}
    for m in pattern.finditer(text_lower):
        seg = m.group(0)
        if seg not in hits:
            hits[seg] = (m.start(), m.start() + len(seg) - 1)
    return hits


def calc_proximity_score(text, keywords, max_span=20, return_hits=False):
    """计算关键词紧密度分数

    Args:
        text: 要检查的文本
        keywords: 关键词列表
        max_span: 关键词最大跨度（**当量词数**：非 CJK 词计 1，CJK 字计
            0.5——1 英文词 ≈ 2 汉字，中英文同预算下信息量对齐。历史：
            字符口径（旧）对英文 6 词 query 无区分度；纯词口径（过渡版）
            对中文窗口偏小）。
        return_hits: True 时附带返回命中关键词（小写形态，与 keywords
            对齐去重），调用方免二次扫描。

    Returns:
        (matched_count, proximity_score[, hit_kws])
            proximity_score: 0=无匹配, 1=部分匹配, 2=全部关键词紧邻
    """
    hits = _scan_keyword_hits(text, keywords)
    spans = list(hits.values())
    if not spans:
        return (0, 0, []) if return_hits else (0, 0)

    matched = len(spans)
    if matched > 1:
        span = _word_distance(text, min(s for s, _ in spans), max(e for _, e in spans))
    else:
        span = 0

    # 全部关键词都匹配且紧邻 = 最高分
    if matched == len(keywords) and span <= max_span:
        result = (matched, 2)
    # 部分关键词匹配 = 中等分数（按匹配比例）
    else:
        result = (matched, 1)
    if return_hits:
        return (*result, list(hits.keys()))
    return result


def _word_distance(text: str, start_char: int, end_char: int) -> float:
    """两个字符位置之间的当量词距（含端点）。

    当量词口径（word_window.CJK_WORD_WEIGHT）：非 CJK 词计 1，CJK 字
    计 0.5——中英文同一 max_span 预算下信息量对齐（1 英文词 ≈ 2 汉字）。
    2026-10-27：函数内延迟 import 改模块级——热路径每次调用都走
    importlib（sys.modules 查询 + 字节码定位）是 scoring 的最大单点
    开销（profile 实测占 _word_distance 累计耗时 >50%）。word_window
    是纯计算模块、无重依赖，模块级导入无循环风险。
    """
    segment = text[start_char:end_char + 1]
    return max(count_equivalence_words(segment) - 1, 0)


def matched_keywords(text, keywords):
    """返回在 text 中实际命中的关键词列表（大小写不敏感，保持原词形）。

    供输出层展示"哪几个查询词打中了本节点"，避免 LLM 在正文中自行猜
    （判断缺词是否为同义词未覆盖时尤其有用）。与 calc_proximity_score
    同口径（子串包含，不做分词对齐）；保持原词形返回。
    """
    if not text or not keywords:
        return []
    hits = _scan_keyword_hits(text, keywords)
    hit_set = set(hits.keys())
    return [kw for kw in keywords if kw and kw.lower() in hit_set]


# 兼容别名（历史私有名，模块内消费方已迁移公共名）
_matched_keywords = matched_keywords


def compute_composite_score(matched_count, total_keywords, doc_name, node_title, fts_score, query_words, weights, proximity=0):
    """计算综合评分

    Args:
        matched_count: 匹配的关键词数
        total_keywords: 总关键词数
        doc_name: 文档名（文件名）
        node_title: 节点标题
        fts_score: 引擎节点分（propagate_scores 全局 max 归一后的 [0,1]；
            直传使用——2026-10-23 前曾 sigmoid 二次压缩，区间 [0.46,1]
            被压到 0.61-0.73，composite 摆动仅 ~1%，区分度损失殆尽）
        query_words: 查询分词列表
        weights: 各因子权重字典
        proximity: 邻近度分数 (0=无匹配, 1=部分匹配, 2=全部关键词紧邻)

    Returns:
        (composite_score, factors_dict) - 综合评分(0~1)和各因子明细
    """
    factors = {}
    total_weight = 0.0
    weighted_sum = 0.0

    if total_keywords <= 0:
        return 0.0, factors

    name_lower = (doc_name or "").lower()
    title_lower = (node_title or "").lower()

    # keyword_match_ratio: 匹配关键词数 / 总关键词数
    w = weights.get("keyword_match_ratio", 0)
    if w > 0:
        val = matched_count / total_keywords
        factors["keyword_match_ratio"] = val
        weighted_sum += w * val
        total_weight += w

    # file_name_match: 文件名中匹配的关键词数 / 总关键词数
    w = weights.get("file_name_match", 0)
    if w > 0:
        name_hits = sum(1 for kw in query_words if kw.lower() in name_lower)
        val = name_hits / total_keywords
        factors["file_name_match"] = val
        weighted_sum += w * val
        total_weight += w

    # fts_score: 引擎节点分直传（全局 max 归一后已是 [0,1]，且唯一带
    # IDF 感知的因子——BM25 天然编码查询词稀有度，kw/fname 均无）
    w = weights.get("fts_score", 0)
    if w > 0:
        val = fts_score
        factors["fts_score"] = val
        weighted_sum += w * val
        total_weight += w

    # title_match: 标题中匹配的关键词数 / 总关键词数。
    # 派生标题跳过：平文本语料（slack/单节点文档）的节点 title 由文件名
    # 派生（title ⊆ 文件名），fname 已计过同一信号——再计 title 等效把
    # 文件名权重翻倍到 4.0。标题是文件名子串时不重复计入；结构化文档
    # （真章节标题，非文件名子串）不受影响。
    w = weights.get("title_match", 0)
    if w > 0 and title_lower and not (title_lower in name_lower):
        title_hits = sum(1 for kw in query_words if kw.lower() in title_lower)
        val = title_hits / total_keywords
        factors["title_match"] = val
        weighted_sum += w * val
        total_weight += w

    # proximity: 邻近度分数归一化 (0→0.0, 1→0.5, 2→1.0)
    w = weights.get("proximity_match", 0)
    if w > 0 and proximity > 0:
        val = proximity / 2.0
        factors["proximity_match"] = val
        weighted_sum += w * val
        total_weight += w

    composite = weighted_sum / total_weight if total_weight > 0 else 0.0
    return composite, factors
