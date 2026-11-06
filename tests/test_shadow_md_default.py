# -*- coding: utf-8 -*-
"""影子 Markdown（shadow md）默认关闭的契约测试。

背景（2026-11-06）：treesearch 引擎的 ``enable_shadow_md`` 默认 True，而宿主
doclens 默认 False——任何绕过宿主配置、直接调 ``build_index`` 的脚本都会在
知识库里凭空生成 ``._*.pdf.md`` 副本（实测 5 个，连备份目录一起被污染）。
该机制已被「索引库内解析文本 + SQLite REGEXP 子集扫描」取代，故把引擎默认
也改为 False：默认不生成是引擎级约定，需要时显式开启。
"""
import os

import pytest


class TestShadowMdDefaults:
    def test_engine_default_off(self):
        """引擎默认不生成影子文件（与宿主 doclens 默认一致）。"""
        from treesearch.config import TreeSearchConfig

        assert TreeSearchConfig().enable_shadow_md is False

    def test_host_default_off(self, monkeypatch):
        monkeypatch.delenv("TREESEARCH_ENABLE_SHADOW_MD", raising=False)
        from doclens.config import CortexConfig

        assert CortexConfig().treesearch_enable_shadow_md is False

    @pytest.mark.parametrize("raw", ["1", "true", "yes", "TRUE", "Yes"])
    def test_env_opt_in(self, monkeypatch, raw):
        """需要旧行为时可显式开启（opt-in 通道保留）。"""
        from treesearch.config import TreeSearchConfig

        monkeypatch.setenv("TREESEARCH_ENABLE_SHADOW_MD", raw)
        assert TreeSearchConfig.from_env().enable_shadow_md is True

    @pytest.mark.parametrize("raw", ["0", "false", "no", ""])
    def test_env_opt_out(self, monkeypatch, raw):
        from treesearch.config import TreeSearchConfig

        monkeypatch.setenv("TREESEARCH_ENABLE_SHADOW_MD", raw)
        assert TreeSearchConfig.from_env().enable_shadow_md is False

    def test_default_build_never_calls_shadow_generator(self, tmp_path, monkeypatch):
        """按默认配置建索引时，绝不能调用影子 MD 生成器（引擎级约定）。

        用 spy 而非断言磁盘文件：``_generate_shadow_md`` 依赖 markitdown 的
        per-format 可选依赖，环境缺失时它会静默失败（异常被吞），磁盘断言
        会在「本该生成」时也通过，失去守护力。
        """
        docx = pytest.importorskip("docx", reason="python-docx not installed")
        import asyncio

        from treesearch.indexer import build_index

        calls: list[str] = []
        monkeypatch.setattr(
            "treesearch.indexer._generate_shadow_md",
            lambda p: calls.append(p),
        )

        src = tmp_path / "docs"
        src.mkdir()
        doc = docx.Document()
        doc.add_heading("章节", level=1)
        doc.add_paragraph("正文内容")
        doc.save(str(src / "a.docx"))

        db = tmp_path / "index.db"
        asyncio.run(build_index([str(src)], db_path=str(db), return_documents=False))

        assert calls == [], f"默认配置不应生成影子文件，实际调用：{calls}"
        shadows = [
            f for _, _, files in os.walk(src) for f in files
            if f.startswith("._") and f.endswith(".md")
        ]
        assert shadows == [], f"磁盘不应出现影子文件：{shadows}"

    def test_shadow_generator_called_when_enabled(self, tmp_path, monkeypatch):
        """显式开启后确实会走生成路径（守护 opt-in 通道没被改坏）。"""
        docx = pytest.importorskip("docx", reason="python-docx not installed")
        import asyncio

        from treesearch import config as ts_config
        from treesearch.indexer import build_index

        calls: list[str] = []
        monkeypatch.setattr(
            "treesearch.indexer._generate_shadow_md",
            lambda p: calls.append(p),
        )

        src = tmp_path / "docs"
        src.mkdir()
        doc = docx.Document()
        doc.add_heading("章节", level=1)
        doc.add_paragraph("正文内容")
        doc.save(str(src / "a.docx"))

        old = ts_config.get_config()
        try:
            cfg = ts_config.TreeSearchConfig.from_env()
            cfg.enable_shadow_md = True
            ts_config.set_config(cfg)
            asyncio.run(
                build_index([str(src)], db_path=str(tmp_path / "index.db"),
                            return_documents=False)
            )
        finally:
            ts_config.set_config(old)

        assert len(calls) == 1, f"开启后应调用一次，实际 {calls}"
