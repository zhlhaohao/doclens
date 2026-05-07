"""Integration tests for CortexApp TUI using Textual's run_test()"""

from unittest.mock import patch, MagicMock

import pytest

from cortex.tui.app import CortexApp
from cortex.tui.widgets.header_bar import HeaderBar
from cortex.tui.widgets.content_area import ContentArea
from cortex.tui.widgets.input_box import InputBox
from cortex.tui.widgets.status_bar import StatusBar


# ---------------------------------------------------------------------------
# Fixtures: mock CortexConfig and IndexManager at module level so
# CortexApp.__init__ never touches the real file system or .env files.
# ---------------------------------------------------------------------------

def _make_mock_config():
    """Create a mock CortexConfig with sensible defaults."""
    cfg = MagicMock()
    cfg.search_path = "/tmp/test-cortex"
    cfg.index_path = "/tmp/test-cortex/.cortex/index.db"
    cfg.max_results = 20
    cfg.max_nodes_per_doc = 5
    cfg.top_k_docs = 100
    cfg.max_span = 20
    cfg.min_keyword_match = 2
    cfg.min_proximity_score = 1
    cfg.min_keywords_per_line = 2
    cfg.title_width = 55
    cfg.line_width = 78
    cfg.max_context_lines = 5
    cfg.max_anchor_lines = 3
    cfg.context_expand_range = 5
    cfg.max_context_chars_per_result = 800
    cfg.max_total_chars = 10000
    cfg.max_read_chars = 6000
    cfg.rg_context_before = 6
    cfg.rg_context_after = 5
    cfg.watch_enabled = False
    cfg.watch_debounce = 5.0
    cfg.max_index_fail_count = 3
    cfg.cjk_tokenizer = "jieba"
    cfg.weight_keyword_match = 3.0
    cfg.weight_file_name_match = 2.0
    cfg.weight_fts_score = 2.0
    cfg.weight_title_match = 1.5
    cfg.planify_api_key = None
    cfg.planify_model_id = "claude-opus-4-6"
    cfg.planify_base_url = None
    return cfg


def _make_mock_index_manager(config):
    """Create a mock IndexManager."""
    idx = MagicMock()
    idx.search_path = config.search_path
    idx.index_path = config.index_path
    idx.documents = []
    idx.max_results = config.max_results
    idx.max_nodes_per_doc = config.max_nodes_per_doc
    idx.top_k_docs = config.top_k_docs
    idx.max_span = config.max_span
    idx.min_keyword_match = config.min_keyword_match
    idx.min_proximity_score = config.min_proximity_score
    idx.rg_context_before = config.rg_context_before
    idx.rg_context_after = config.rg_context_after
    idx.scoring_weights = {
        "keyword_match_ratio": config.weight_keyword_match,
        "file_name_match": config.weight_file_name_match,
        "fts_score": config.weight_fts_score,
        "title_match": config.weight_title_match,
    }
    idx.path_map = {}
    idx.load_or_build_index = MagicMock()
    idx.reindex = MagicMock()
    idx.search = MagicMock(return_value=([], []))
    return idx


@pytest.fixture(autouse=True)
def _mock_cortex_dependencies():
    """Patch CortexConfig.load and IndexManager for all tests."""
    mock_config = _make_mock_config()
    mock_idx = _make_mock_index_manager(mock_config)

    with (
        patch("cortex.tui.app.CortexConfig.load", return_value=mock_config),
        patch("cortex.tui.app.IndexManager", return_value=mock_idx),
        patch("cortex.tui.app.check_dependencies", return_value=[]),
    ):
        yield {"config": mock_config, "idx": mock_idx}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _type_and_submit(pilot, text: str):
    """Type text into the command input and press Enter."""
    cmd_input = pilot.app.query_one("#cmd-input")
    cmd_input.focus()
    cmd_input.value = text
    await pilot.press("enter")
    await pilot.pause()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_compose_has_all_widgets():
    """After mounting, all 4 top-level widgets should be present."""
    async with CortexApp().run_test() as pilot:
        await pilot.pause()

        assert pilot.app.query_one(HeaderBar) is not None
        assert pilot.app.query_one(ContentArea) is not None
        assert pilot.app.query_one(InputBox) is not None
        assert pilot.app.query_one(StatusBar) is not None


async def test_help_command_outputs_help_text():
    """/help command should write help content to ContentArea."""
    async with CortexApp().run_test() as pilot:
        await pilot.pause()

        content: ContentArea = pilot.app.query_one(ContentArea)
        # Record lines before /help (welcome banner has several lines)
        lines_before = len(content.lines)

        await _type_and_submit(pilot, "/help")
        await pilot.pause()

        lines_after = len(content.lines)
        # /help should have added lines (help text + prompt echo)
        assert lines_after > lines_before, (
            f"Expected more lines after /help, got {lines_after} vs {lines_before}"
        )


async def test_clear_command_clears_content():
    """/clear command should remove all content from ContentArea."""
    async with CortexApp().run_test() as pilot:
        await pilot.pause()

        content: ContentArea = pilot.app.query_one(ContentArea)

        # Add some content first via /help
        await _type_and_submit(pilot, "/help")
        await pilot.pause()

        lines_before = len(content.lines)
        assert lines_before > 0, "Expected /help to produce lines"

        await _type_and_submit(pilot, "/clear")
        await pilot.pause()

        assert len(content.lines) == 0, "ContentArea should be empty after /clear"


async def test_quit_command_exits_app():
    """/quit command should exit the application."""
    async with CortexApp().run_test() as pilot:
        await pilot.pause()

        await _type_and_submit(pilot, "/quit")
        await pilot.pause()

        # The app should have exited; if it didn't, the context manager
        # would still be running and we wouldn't reach this assert.
        # We verify by checking that `app._exit` was triggered.
        assert pilot.app._exit
