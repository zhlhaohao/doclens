# -*- coding: utf-8 -*-
"""MHTML (MIME HTML) parser for TreeSearch.

MHTML (.mhtml/.mht) is a MIME multipart archive that packages a web page
together with its embedded resources (images, css...). The main payload is
the ``text/html`` part, usually quoted-printable or base64 encoded.

Strategy: unpack with the standard-library ``email`` module, pick the main
``text/html`` part, decode it, then reuse the HTML tree builder
(BeautifulSoup based, fidelity-first) from ``html_parser``.

No optional dependencies beyond beautifulsoup4 (same as html_parser).
"""
import logging
import os
from email import policy
from email.parser import BytesParser
from typing import Optional

from .html_parser import html_content_to_tree

logger = logging.getLogger(__name__)


def _extract_main_html(mhtml_bytes: bytes) -> Optional[str]:
    """Unpack an MHTML archive and return the decoded main HTML part.

    Returns None if no usable text/html part is found.
    """
    msg = BytesParser(policy=policy.default).parsebytes(mhtml_bytes)

    candidates = []
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                candidates.append(part)
    elif msg.get_content_type() == "text/html":
        candidates.append(msg)

    if not candidates:
        return None

    # Prefer the part explicitly marked as the start/root of the archive,
    # otherwise take the first text/html part.
    start = msg.get("start", "").strip("<>")
    main = None
    if start:
        for part in candidates:
            if part.get("Content-ID", "").strip("<>") == start:
                main = part
                break
    if main is None:
        main = candidates[0]

    payload = main.get_payload(decode=True)
    if payload is None:
        try:
            return main.get_content()
        except Exception:
            return None
    charset = main.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except (LookupError, ValueError):
        logger.debug("Unknown charset %r in MHTML part, fallback to utf-8", charset)
        return payload.decode("utf-8", errors="replace")


async def mhtml_to_tree(
    mhtml_path: str,
    *,
    model: Optional[str] = None,
    if_add_node_summary: bool = True,
    summary_chars_threshold: int = 600,
    if_add_doc_description: bool = False,
    if_add_node_text: bool = False,
    if_add_node_id: bool = True,
    **kwargs,
) -> dict:
    """Build a tree index from an MHTML web archive.

    Returns:
        {'doc_name': str, 'structure': list, 'source_path': str}
    """
    doc_name = os.path.splitext(os.path.basename(mhtml_path))[0]
    logger.debug("Parsing MHTML: %s", mhtml_path)

    with open(mhtml_path, "rb") as f:
        mhtml_bytes = f.read()

    html_content = _extract_main_html(mhtml_bytes)
    if not html_content or not html_content.strip():
        logger.warning("No text/html part found in MHTML: %s", mhtml_path)
        html_content = ""

    return await html_content_to_tree(
        html_content,
        doc_name=doc_name,
        source_path=os.path.abspath(mhtml_path),
        source_type="html",
        model=model,
        if_add_node_summary=if_add_node_summary,
        summary_chars_threshold=summary_chars_threshold,
        if_add_doc_description=if_add_doc_description,
        if_add_node_text=if_add_node_text,
        if_add_node_id=if_add_node_id,
        **kwargs,
    )
