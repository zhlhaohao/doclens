"""resolve_paths 的 source_type overlay 旁路测试。

apply_source_type_filter=False：全局 config 的 allowed_source_types 不再
收缩扩展名白名单——供纯文本兜底搜索（如宿主 grep 的 rg 降级）等需要完整
白名单的调用方使用；默认 True 保持索引链路的既有行为不变。
"""
from pathlib import Path

import pytest

from treesearch import TreeSearchConfig, set_config
from treesearch.config import get_config


@pytest.fixture()
def restore_config():
    """set_config 全局状态恢复（避免跨测试污染）。"""
    original = get_config()
    yield
    set_config(original)


def test_source_type_overlay_default_and_bypass(tmp_path: Path, restore_config):
    from treesearch.pathutil import resolve_paths

    (tmp_path / "a.kt").write_text("x", encoding="utf-8")
    (tmp_path / "b.md").write_text("y", encoding="utf-8")

    set_config(TreeSearchConfig(allowed_source_types=["markdown"]))

    # 默认（True）：source_type 收缩生效——与索引器视角一致
    files = resolve_paths(
        [str(tmp_path)], allowed_extensions={".kt", ".md"},
    )
    assert [f.rsplit(".", 1)[-1] for f in files] == ["md"]

    # False：白名单完整透传，不叠全局 source_type 过滤
    files_full = resolve_paths(
        [str(tmp_path)], allowed_extensions={".kt", ".md"},
        apply_source_type_filter=False,
    )
    exts = sorted(f.rsplit(".", 1)[-1] for f in files_full)
    assert exts == ["kt", "md"]
