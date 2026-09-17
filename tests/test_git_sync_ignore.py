"""GitSync 自动 gitignore 测试（.cortex 与 .planify 双条目，2026-09-17 扩展）。

只测 _ensure_gitignore 的纯文件行为（不碰 git 命令）：
新库两行全补、旧库已有 .cortex 只补 .planify、幂等不重复写。
"""

from doclens.git_sync import GitSync


def _make(tmp_path):
    return GitSync(search_path=str(tmp_path), data_dir=".cortex")


def test_fresh_repo_writes_both_entries(tmp_path):
    _make(tmp_path)._ensure_gitignore()
    text = (tmp_path / ".gitignore").read_text(encoding="utf-8")
    assert ".cortex/" in text
    assert ".planify/" in text


def test_existing_cortex_only_appends_planify(tmp_path):
    # 旧版只写 .cortex/ 的库：幂等跳过已覆盖条目，仅补 .planify/
    (tmp_path / ".gitignore").write_text(
        "# doclens 本地状态（索引/会话/密钥），不随知识库同步\n.cortex/\n",
        encoding="utf-8",
    )
    _make(tmp_path)._ensure_gitignore()
    text = (tmp_path / ".gitignore").read_text(encoding="utf-8")
    assert text.count(".cortex/") == 1
    assert ".planify/" in text


def test_idempotent_no_duplicates(tmp_path):
    sync = _make(tmp_path)
    sync._ensure_gitignore()
    sync._ensure_gitignore()
    text = (tmp_path / ".gitignore").read_text(encoding="utf-8")
    assert text.count(".cortex/") == 1
    assert text.count(".planify/") == 1
