"""命令解析器 parse_input 全面测试"""

import pytest

from cortex.tui.commands import parse_input, COMMAND_ALIASES, _PASS_THROUGH


# ── 空输入 / 纯空白 ──────────────────────────────────────────


class TestEmptyInput:
    """空输入和纯空白应返回 None"""

    def test_empty_string(self):
        assert parse_input("") is None

    def test_whitespace_only(self):
        assert parse_input("   ") is None

    def test_tab_only(self):
        assert parse_input("\t") is None

    def test_mixed_whitespace(self):
        assert parse_input("  \t  \n  ") is None


# ── 中文顿号 → 斜杠转换 ─────────────────────────────────────


class TestChineseCommaConversion:
    """中文顿号（、）应被转换为斜杠（/）"""

    def test_chinese_comma_search(self):
        result = parse_input("、search keyword")
        assert result == ("search", "keyword")

    def test_chinese_comma_help(self):
        result = parse_input("、h")
        assert result == ("help", "")

    def test_chinese_comma_quit(self):
        result = parse_input("、q")
        assert result == ("quit", "")

    def test_chinese_comma_only(self):
        """仅有顿号，无后续命令"""
        result = parse_input("、")
        assert result is None

    def test_chinese_comma_with_space(self):
        result = parse_input("、 status")
        assert result == ("status", "")


# ── 搜索命令别名 ──────────────────────────────────────────────


class TestSearchAliases:
    """search 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["search", "s"])
    def test_search_aliases(self, alias):
        result = parse_input(f"/{alias} hello world")
        assert result == ("search", "hello world")

    def test_search_no_arg(self):
        assert parse_input("/search") == ("search", "")

    def test_s_no_arg(self):
        assert parse_input("/s") == ("search", "")


# ── 索引命令别名 ──────────────────────────────────────────────


class TestIndexAliases:
    """index 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["index", "i", "reindex"])
    def test_index_aliases(self, alias):
        result = parse_input(f"/{alias}")
        assert result == ("index", "")

    def test_index_with_arg(self):
        result = parse_input("/reindex force")
        assert result == ("index", "force")

    def test_i_with_arg(self):
        result = parse_input("/i /some/path")
        assert result == ("index", "/some/path")


# ── 状态命令别名 ──────────────────────────────────────────────


class TestStatusAliases:
    """status 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["status", "stats", "st", "t"])
    def test_status_aliases(self, alias):
        result = parse_input(f"/{alias}")
        assert result == ("status", "")


# ── 退出命令别名 ──────────────────────────────────────────────


class TestQuitAliases:
    """quit 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["quit", "q", "exit", "e"])
    def test_quit_aliases(self, alias):
        result = parse_input(f"/{alias}")
        assert result == ("quit", "")


# ── 帮助命令别名 ──────────────────────────────────────────────


class TestHelpAliases:
    """help 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["help", "h", "?"])
    def test_help_aliases(self, alias):
        result = parse_input(f"/{alias}")
        assert result == ("help", "")


# ── 设置命令别名 ──────────────────────────────────────────────


class TestSetAliases:
    """set 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["set", "n"])
    def test_set_aliases(self, alias):
        result = parse_input(f"/{alias} key=value")
        assert result == ("set", "key=value")


# ── 清屏命令别名 ──────────────────────────────────────────────


class TestClearAliases:
    """clear 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["clear", "cls", "cl"])
    def test_clear_aliases(self, alias):
        result = parse_input(f"/{alias}")
        assert result == ("clear", "")


# ── AI 命令别名 ──────────────────────────────────────────────


class TestAiAliases:
    """ai 命令的所有别名"""

    @pytest.mark.parametrize("alias", ["ai", "llm", "agent"])
    def test_ai_aliases(self, alias):
        result = parse_input(f"/{alias} tell me a joke")
        assert result == ("ai", "tell me a joke")

    def test_ai_no_arg(self):
        assert parse_input("/ai") == ("ai", "")


# ── compact 命令 ─────────────────────────────────────────────


class TestCompactCommand:
    def test_compact(self):
        assert parse_input("/compact") == ("compact", "")


# ── 透传命令 ──────────────────────────────────────────────────


class TestPassThrough:
    """tasks / team / inbox 不走别名映射，原样返回"""

    @pytest.mark.parametrize("cmd", ["tasks", "team", "inbox"])
    def test_pass_through(self, cmd):
        result = parse_input(f"/{cmd}")
        assert result == (cmd, "")

    def test_pass_through_with_arg(self):
        result = parse_input("/tasks list")
        assert result == ("tasks", "list")


# ── 无斜杠前缀 → AI 对话 ─────────────────────────────────────


class TestBareInput:
    """无斜杠前缀的输入应被当作 AI 对话"""

    def test_simple_text(self):
        assert parse_input("hello world") == ("ai", "hello world")

    def test_single_word(self):
        assert parse_input("搜索") == ("ai", "搜索")

    def test_leading_trailing_spaces(self):
        """前后空格应被 strip"""
        assert parse_input("  what is cortex?  ") == ("ai", "what is cortex?")

    def test_chinese_text(self):
        assert parse_input("帮我搜索 Python") == ("ai", "帮我搜索 Python")

    def test_number_input(self):
        assert parse_input("123") == ("ai", "123")


# ── 未知命令 ──────────────────────────────────────────────────


class TestUnknownCommands:
    """未在 COMMAND_ALIASES 和 _PASS_THROUGH 中的命令应原样返回"""

    def test_unknown_command(self):
        result = parse_input("/foobar")
        assert result == ("foobar", "")

    def test_unknown_command_with_arg(self):
        result = parse_input("/unknown arg1 arg2")
        assert result == ("unknown", "arg1 arg2")

    def test_unknown_command_preserved(self):
        result = parse_input("/xyz")
        assert result == ("xyz", "")


# ── 大小写不敏感 ──────────────────────────────────────────────


class TestCaseInsensitivity:
    """命令部分应忽略大小写"""

    def test_uppercase_search(self):
        assert parse_input("/SEARCH test") == ("search", "test")

    def test_mixed_case_index(self):
        assert parse_input("/Index") == ("index", "")

    def test_uppercase_quit(self):
        assert parse_input("/Q") == ("quit", "")

    def test_uppercase_help(self):
        assert parse_input("/HELP") == ("help", "")

    def test_mixed_case_alias(self):
        assert parse_input("/St") == ("status", "")


# ── 仅斜杠无命令 ──────────────────────────────────────────────


class TestSlashOnly:
    def test_slash_only(self):
        assert parse_input("/") is None

    def test_slash_with_spaces(self):
        assert parse_input("/  ") is None


# ── COMMAND_ALIASES 结构验证 ─────────────────────────────────


class TestCommandAliasesStructure:
    """验证 COMMAND_ALIASES 字典的完整性"""

    def test_is_dict(self):
        assert isinstance(COMMAND_ALIASES, dict)

    def test_all_values_are_strings(self):
        for key, val in COMMAND_ALIASES.items():
            assert isinstance(key, str), f"key {key!r} is not str"
            assert isinstance(val, str), f"value for {key!r} is not str"

    def test_all_values_are_canonical(self):
        """所有值应该是指向已知的规范命令名"""
        canonical_names = {
            "search", "index", "status", "quit",
            "help", "set", "clear", "ai", "compact",
        }
        for alias, canonical in COMMAND_ALIASES.items():
            assert canonical in canonical_names, (
                f"alias {alias!r} maps to unknown canonical {canonical!r}"
            )

    def test_self_mapping_exists(self):
        """每个规范命令应该有自身映射"""
        canonical_names = {
            "search", "index", "status", "quit",
            "help", "set", "clear", "ai", "compact",
        }
        for name in canonical_names:
            assert name in COMMAND_ALIASES, (
                f"canonical {name!r} not in COMMAND_ALIASES"
            )
            assert COMMAND_ALIASES[name] == name, (
                f"canonical {name!r} does not map to itself"
            )

    def test_no_empty_keys(self):
        for key in COMMAND_ALIASES:
            assert key, "empty key found in COMMAND_ALIASES"

    def test_pass_through_is_set(self):
        assert isinstance(_PASS_THROUGH, set)
        assert "tasks" in _PASS_THROUGH
        assert "team" in _PASS_THROUGH
        assert "inbox" in _PASS_THROUGH


# ── 参数保留测试 ──────────────────────────────────────────────


class TestArgumentPreservation:
    """参数部分不应被修改"""

    def test_arg_with_slashes(self):
        result = parse_input("/index /path/to/dir")
        assert result == ("index", "/path/to/dir")

    def test_arg_with_spaces(self):
        result = parse_input("/search foo bar baz")
        assert result == ("search", "foo bar baz")

    def test_arg_with_chinese(self):
        result = parse_input("/search 中文关键词")
        assert result == ("search", "中文关键词")

    def test_arg_with_special_chars(self):
        result = parse_input("/set key=hello&world")
        assert result == ("set", "key=hello&world")
