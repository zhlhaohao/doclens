# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Unified TreeSearch engine class for easy out-of-the-box usage.

This is the ONLY class most users need. It wraps indexing, searching,
saving, and loading into a single, minimal API.
"""
import asyncio
import glob
import logging
import os
from typing import Optional, List

from .tree import Document, load_documents, save_index as _save_index
from .search import search
from .config import get_config

logger = logging.getLogger(__name__)


class TreeSearch:
    """Unified TreeSearch Engine — the only class you need.

    Usage::

        from treesearch import TreeSearch

        # Eager indexing
        ts = TreeSearch(model="gpt-4o")
        ts.index("docs/*.md", "src/*.py")
        results = ts.search("How to configure voice calls?")

        # Lazy indexing — auto-builds index on first search
        ts = TreeSearch("docs/*.md", "src/*.py")
        results = ts.search("How to configure voice calls?")

        # Save / load indexes for later reuse
        ts.save_index("./my_indexes")
        ts.load_index("./my_indexes")
    """

    def __init__(
        self,
        *paths: str,
        index_dir: str = "./indexes",
        model: Optional[str] = None,
        strategy: str = "fts5_only",
        **kwargs
    ):
        """
        Initialize the TreeSearch engine.

        Args:
            *paths: File paths or glob patterns to index lazily on first search.
            index_dir: Default directory to save/load indexes.
            model: LLM model name (for 'best_first' strategy).
            strategy: Default search strategy. Options: 'fts5_only', 'best_first'.
            **kwargs: Additional default arguments for search().
        """
        self._pending_paths: List[str] = list(paths)
        self.index_dir = index_dir
        self.model = model
        self.strategy = strategy
        self.documents: List[Document] = []
        self.config = get_config()
        self.kwargs = kwargs

    # ------------------------------------------------------------------
    # Index
    # ------------------------------------------------------------------

    async def aindex(self, *paths: str, force: bool = False, **kwargs) -> List[Document]:
        """Async: Build tree indexes from files. Supports glob patterns."""
        from .indexer import build_index

        resolved_paths = []
        for p in paths:
            if "*" in p or "?" in p:
                resolved_paths.extend(glob.glob(p, recursive=True))
            else:
                resolved_paths.append(p)

        if not resolved_paths:
            logger.warning("No files found to index.")
            return self.documents

        self.documents = await build_index(
            resolved_paths,
            output_dir=self.index_dir,
            force=force,
            **kwargs
        )
        return self.documents

    def index(self, *paths: str, force: bool = False, **kwargs) -> List[Document]:
        """Sync: Build tree indexes from files. Supports glob patterns like 'docs/*.md'.

        Returns:
            List of indexed Document objects.
        """
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                raise RuntimeError("Event loop is already running. Please use `await aindex()` instead.")
        except RuntimeError as e:
            if "Event loop is already running" in str(e):
                raise
            pass

        return asyncio.run(self.aindex(*paths, force=force, **kwargs))

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def asearch(self, query: str, **kwargs) -> dict:
        """Async: Search across indexed documents. Auto-builds index if pending paths exist."""
        if not self.documents and self._pending_paths:
            await self.aindex(*self._pending_paths)
            self._pending_paths.clear()

        if not self.documents:
            if os.path.exists(self.index_dir):
                self.documents = load_documents(self.index_dir)

        if not self.documents:
            raise ValueError(
                "No documents available. Pass file paths to TreeSearch() or call index() first."
            )

        search_kwargs = {
            "model": self.model,
            "strategy": self.strategy,
            **self.kwargs,
            **kwargs
        }
        return await search(query, self.documents, **search_kwargs)

    def search(self, query: str, **kwargs) -> dict:
        """Sync: Search across indexed documents.

        Returns:
            dict with 'documents' and 'query'.
        """
        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                raise RuntimeError("Event loop is already running. Please use `await asearch()` instead.")
        except RuntimeError as e:
            if "Event loop is already running" in str(e):
                raise
            pass

        return asyncio.run(self.asearch(query, **kwargs))

    # ------------------------------------------------------------------
    # Save / Load indexes
    # ------------------------------------------------------------------

    def save_index(self, output_dir: Optional[str] = None) -> str:
        """Save current indexes to a directory.

        Args:
            output_dir: Target directory. Defaults to self.index_dir.

        Returns:
            Path to the output directory.
        """
        out = output_dir or self.index_dir
        os.makedirs(out, exist_ok=True)

        for doc in self.documents:
            index_data = {
                "doc_name": doc.doc_name,
                "structure": doc.structure,
                "doc_description": doc.doc_description,
                "source_path": doc.metadata.get("source_path", ""),
            }
            filename = f"{doc.doc_name}_structure.json"
            _save_index(index_data, os.path.join(out, filename))

        logger.info("Saved %d indexes to %s", len(self.documents), out)
        return out

    def load_index(self, index_dir: Optional[str] = None) -> List[Document]:
        """Load indexes from a directory.

        Args:
            index_dir: Source directory. Defaults to self.index_dir.

        Returns:
            List of loaded Document objects.
        """
        src = index_dir or self.index_dir
        if not os.path.exists(src):
            raise FileNotFoundError(f"Index directory not found: {src}")

        self.documents = load_documents(src)
        logger.info("Loaded %d documents from %s", len(self.documents), src)
        return self.documents
