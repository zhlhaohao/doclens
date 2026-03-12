# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Shared utility functions for TreeSearch.

count_tokens: lightweight token estimation (no external dependencies).
"""
import re

# CJK Unicode ranges
_RE_CJK_CHAR = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]")
_RE_HAS_CJK = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")


def count_tokens(text: str) -> int:
    """Estimate token count using a character-based heuristic.

    Rules:
      - CJK characters: 1 token each
      - Other characters: ~4 characters per token (English average)

    This avoids a dependency on tiktoken while giving a reasonable estimate
    for mixed CJK / Latin text.
    """
    if not text:
        return 0
    cjk_count = len(_RE_CJK_CHAR.findall(text))
    non_cjk_count = len(text) - cjk_count
    return cjk_count + max(non_cjk_count // 4, 1 if non_cjk_count else 0)
