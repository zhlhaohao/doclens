# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.utils module.
"""
import pytest
from treesearch.utils import count_tokens


class TestCountTokens:
    def test_empty_string(self):
        assert count_tokens("") == 0

    def test_simple_english(self):
        count = count_tokens("Hello, world!")
        assert count > 0
        assert isinstance(count, int)

    def test_longer_text_has_more_tokens(self):
        short = count_tokens("Hello")
        long = count_tokens("Hello, this is a much longer sentence with many words.")
        assert long > short

    def test_chinese_text(self):
        # Each CJK character = 1 token
        count = count_tokens("你好世界")
        assert count == 4

    def test_mixed_text(self):
        # "Hello" (5 non-CJK chars -> ~1 token) + 4 CJK chars -> ~5 tokens
        count = count_tokens("Hello你好世界")
        assert count >= 5
