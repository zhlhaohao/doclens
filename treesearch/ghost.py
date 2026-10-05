# -*- coding: utf-8 -*-
"""
Ghost registration: metadata-only catalog rows for text files that the
source-type whitelist excludes from full indexing.

A *ghost row* lives in the ``documents`` table with an empty structure
(``node_count = 0``, no ``fts_nodes`` rows) plus a salted ``index_meta``
fingerprint. It makes the file visible to host-side file listings and
filename search while keeping it invisible to full-text search — the
empty tree has no inverted-index rows, so FTS and structure-LIKE queries
structurally never match.

The fingerprint carries a salt (see :data:`GHOST_FINGERPRINT_SALT`) so
that widening the whitelist later changes every ghost fingerprint and the
next incremental run re-registers those files as real indexed documents
instead of skipping them as "unchanged".
"""
import logging
import os

logger = logging.getLogger(__name__)

# Salt folded into ghost fingerprints (same mechanism as the PST parser
# salt). Bump when the ghost row format changes so old ghosts rebuild.
# History:
#   ":ghost1" — initial ghost registration (empty structure, no fts rows).
GHOST_FINGERPRINT_SALT = ":ghost1"

# Files larger than this are not sniffed for the text/binary decision —
# they are treated as binary (not registered). Keeps the sniff cost O(1).
_SNIFF_BYTES = 8192

# NUL byte = the "is binary" verdict, same heuristic git uses.
_NULL = b"\x00"


def ghost_fingerprint(file_hash: str) -> str:
    """Fold the ghost salt into a plain fingerprint.

    ``v{VER}:stat:{mtime}:{size}`` -> ``v{VER}:ghost1:stat:{mtime}:{size}``
    (inserted after the schema version, mirroring the PST salt layout so
    the size portion stays the last field for move detection parsing).
    """
    if not file_hash:
        return file_hash
    ver, sep, rest = file_hash.partition(":")
    if not sep:
        return file_hash
    return f"{ver}{sep}{GHOST_FINGERPRINT_SALT.strip(':')}:{rest}"


def _looks_textual(head: bytes) -> bool:
    """True if the first bytes contain no NUL (git's is-binary heuristic)."""
    return _NULL not in head


def classify_text_file(path: str, known_text_exts: frozenset[str] | set[str]) -> bool:
    """Decide whether *path* should be registered as a ghost row.

    Rules:
    - Known text extensions (any extension mapped by the parser registry,
      plus common text-ish extras): register without reading anything.
    - No/unknown extension: sniff the first 8KB; NUL byte -> binary, skip.
      The sniff only classifies — bytes never enter the index.

    Unreadable files count as binary (fail-closed: no ghost row).
    """
    ext = os.path.splitext(path)[1].lower()
    if ext in known_text_exts:
        return True
    try:
        with open(path, "rb") as f:
            head = f.read(_SNIFF_BYTES)
    except OSError:
        return False
    return _looks_textual(head)


def collect_known_text_extensions() -> frozenset[str]:
    """All extensions known to the parser registry/SOURCE_TYPE_MAP.

    Everything the engine can parse is text-shaped by definition (binary
    formats are registered separately and never reach ghost classification).
    Unknown/no-extension files are the only ones needing a sniff.
    """
    from .pathutil import _get_default_extensions

    extras = {
        ".vue", ".svelte", ".astro", ".ipynb", ".gradle", ".properties",
        ".ini", ".cfg", ".conf", ".env", ".editorconfig", ".gitignore",
        ".gitattributes", ".dockerignore", ".npmrc", ".nvmrc", ".lock",
        ".toml", ".tf", ".tfvars", ".proto", ".graphql", ".prisma",
        ".cmake", ".makefile", ".rakefile", ".gemspec", ".podspec",
        ".bowerman", ".babelrc", ".eslintrc", ".prettierrc",
    }
    return frozenset(e.lower() for e in _get_default_extensions() | extras)


def ghost_document(path: str, doc_id: str, source_type: str = ""):
    """Build a metadata-only Document (empty structure) for *path*.

    Returns a ``Document`` whose structure is ``[]`` — indexing it writes
    the documents row (with ``node_count = 0``) and no fts_nodes rows.
    """
    from .tree import Document

    name = os.path.splitext(os.path.basename(path))[0]
    return Document(
        doc_id=doc_id,
        doc_name=name,
        structure=[],
        doc_description="",
        metadata={"source_path": os.path.abspath(path), "ghost": True},
        source_type=source_type or "ghost",
    )
