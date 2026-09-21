"""word_window 词单位窗口换算测试（统一窗口模型的 word 口径）。

词定义与 planify split_words_with_seps 一致：CJK 每字一词，非 CJK 连续段
按空白切分；窗口边界落词边界，超长无空白段触发字符保险丝。
"""


class TestStartBeforeWords:
    def test_word_boundary_not_mid_word(self):
        from doclens.word_window import start_before_words

        text = "alpha beta gamma delta epsilon"
        anchor = text.find("delta")
        # 锚点前 2 词 = beta + gamma（紧邻锚点倒数），窗口起点在其中更靠前者
        start = start_before_words(text, anchor, 2)
        assert text[start:] == "beta gamma delta epsilon"
        assert start_before_words(text, anchor, 1) == text.find("gamma")

    def test_insufficient_words_returns_zero(self):
        from doclens.word_window import start_before_words

        text = "alpha beta"
        assert start_before_words(text, len(text), 5) == 0  # 短前缀（物理宽内）全取

    def test_zero_words_returns_anchor(self):
        from doclens.word_window import start_before_words

        assert start_before_words("abc def", 4, 0) == 4

    def test_cjk_each_char_one_word(self):
        from doclens.word_window import start_before_words

        text = "一二三四五NEEDLE"
        anchor = text.find("NEEDLE")
        assert start_before_words(text, anchor, 2) == 3  # 前两词 = 「四」「五」

    def test_runaway_word_fuse(self):
        from doclens.word_window import start_before_words

        text = "A" * 30000 + "NEEDLE"
        anchor = text.find("NEEDLE")
        start = start_before_words(text, anchor, 10)
        # A*30000 是一个词；保险丝：窗口宽 ≤ 10*8
        assert anchor - start <= 10 * 8


class TestEndAfterWords:
    def test_word_boundary_no_trailing_space(self):
        from doclens.word_window import end_after_words

        text = "NEEDLE alpha beta gamma"
        end = end_after_words(text, len("NEEDLE"), 2)
        assert text[:end] == "NEEDLE alpha beta"  # 词尾不含尾随空白

    def test_insufficient_words_returns_tail_with_fuse(self):
        from doclens.word_window import end_after_words

        text = "NEEDLE alpha"
        assert end_after_words(text, len("NEEDLE"), 10) == len(text)

    def test_zero_words_returns_from_pos(self):
        from doclens.word_window import end_after_words

        assert end_after_words("abc def", 3, 0) == 3

    def test_cjk_each_char_one_word(self):
        from doclens.word_window import end_after_words

        text = "NEEDLE一二三四五"
        assert end_after_words(text, len("NEEDLE"), 3) == len("NEEDLE") + 3

    def test_runaway_word_fuse(self):
        from doclens.word_window import end_after_words

        text = "NEEDLE" + "A" * 30000
        end = end_after_words(text, len("NEEDLE"), 10)
        assert end <= len("NEEDLE") + 10 * 8
