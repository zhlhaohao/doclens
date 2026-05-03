"""纯计算模块 - 查询分词、近邻评分、综合评分"""


def tokenize_query(query):
    """使用 jieba 对查询进行分词，过滤掉单字词"""
    from treesearch.tokenizer import tokenize
    tokens = tokenize(query)
    # 过滤掉单字符词
    return [t for t in tokens if len(t) > 1]


def calc_proximity_score(text, keywords, max_span=20):
    """计算关键词紧密度分数

    Args:
        text: 要检查的文本
        keywords: 关键词列表
        max_span: 关键词最大跨度（字符数），超过则不算紧邻
    Returns:
        (matched_count, proximity_score) - 匹配词数和紧邻分数
            proximity_score: 0=无匹配, 1=部分匹配, 2=全部关键词紧邻
    """
    if not text or not keywords:
        return 0, 0

    text_lower = text.lower()
    positions = []

    for kw in keywords:
        kw_lower = kw.lower()
        idx = text_lower.find(kw_lower)
        if idx >= 0:
            positions.append(idx)

    if not positions:
        return 0, 0

    matched = len(positions)
    span = max(positions) - min(positions) if len(positions) > 1 else 0

    # 全部关键词都匹配且紧邻 = 最高分
    if matched == len(keywords) and span <= max_span:
        return matched, 2
    # 部分关键词匹配 = 中等分数（按匹配比例）
    return matched, 1


def compute_composite_score(matched_count, total_keywords, doc_name, node_title, fts_score, query_words, weights):
    """计算综合评分

    Args:
        matched_count: 匹配的关键词数
        total_keywords: 总关键词数
        doc_name: 文档名（文件名）
        node_title: 节点标题
        fts_score: FTS5 BM25 原始分数
        query_words: 查询分词列表
        weights: 各因子权重字典

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

    composite = weighted_sum / total_weight if total_weight > 0 else 0.0
    return composite, factors
