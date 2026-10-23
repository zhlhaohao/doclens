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
def calc_proximity_score(text, keywords, max_span=20):
    """计算关键词紧密度分数

    Args:
        text: 要检查的文本
        keywords: 关键词列表
        max_span: 关键词最大跨度（**当量词数**：非 CJK 词计 1，CJK 字计
            0.5——1 英文词 ≈ 2 汉字，中英文同预算下信息量对齐。历史：
            字符口径（旧）对英文 6 词 query 无区分度；纯词口径（过渡版）
            对中文窗口偏小）。
    Returns:
        (matched_count, proximity_score) - 匹配词数和紧邻分数
            proximity_score: 0=无匹配, 1=部分匹配, 2=全部关键词紧邻
    """
    matched_kws = _matched_keywords(text, keywords)
    spans = []  # (首字符位置, 末字符位置)

    for kw in matched_kws:
        idx = text.lower().find(kw.lower())
        if idx >= 0:
            spans.append((idx, idx + len(kw) - 1))

    if not spans:
        return 0, 0

    matched = len(spans)
    if matched > 1:
        span = _word_distance(text, min(s for s, _ in spans), max(e for _, e in spans))
    else:
        span = 0

    # 全部关键词都匹配且紧邻 = 最高分
    if matched == len(keywords) and span <= max_span:
        return matched, 2
    # 部分关键词匹配 = 中等分数（按匹配比例）
    return matched, 1


def _word_distance(text: str, start_char: int, end_char: int) -> float:
    """两个字符位置之间的当量词距（含端点）。

    当量词口径（word_window.CJK_WORD_WEIGHT）：非 CJK 词计 1，CJK 字
    计 0.5——中英文同一 max_span 预算下信息量对齐（1 英文词 ≈ 2 汉字）。
    """
    from doclens.word_window import count_equivalence_words

    segment = text[start_char:end_char + 1]
    return max(count_equivalence_words(segment) - 1, 0)


def matched_keywords(text, keywords):
    """返回在 text 中实际命中的关键词列表（大小写不敏感，保持原词形）。

    供输出层展示"哪几个查询词打中了本节点"，避免 LLM 在正文中自行猜
    （判断缺词是否为同义词未覆盖时尤其有用）。与 calc_proximity_score
    同口径（子串包含，不做分词对齐）。
    """
    if not text or not keywords:
        return []
    text_lower = text.lower()
    return [kw for kw in keywords if kw and kw.lower() in text_lower]


# 兼容别名（历史私有名，模块内消费方已迁移公共名）
_matched_keywords = matched_keywords


def compute_composite_score(matched_count, total_keywords, doc_name, node_title, fts_score, query_words, weights, proximity=0):
    """计算综合评分

    Args:
        matched_count: 匹配的关键词数
        total_keywords: 总关键词数
        doc_name: 文档名（文件名）
        node_title: 节点标题
        fts_score: FTS5 BM25 原始分数
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

    # fts_score: 归一化 BM25 分数 (用 sigmoid 映射到 0~1)
    w = weights.get("fts_score", 0)
    if w > 0:
        import math
        val = 1.0 / (1.0 + math.exp(-fts_score)) if fts_score != 0 else 0.5
        factors["fts_score"] = val
        weighted_sum += w * val
        total_weight += w

    # title_match: 标题中匹配的关键词数 / 总关键词数
    w = weights.get("title_match", 0)
    if w > 0:
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
