# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Async-first LLM client with singleton connection pool, retry, token counting, and JSON extraction.

All configuration (api_key, base_url, model) is read from config.py.
Do NOT use os.getenv() here.
"""
import asyncio
import json
import logging
from typing import Optional, Any

from .config import get_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_RETRIES = 3

# ---------------------------------------------------------------------------
# Singleton async client (connection pool reuse)
# ---------------------------------------------------------------------------
_async_clients: dict = {}


def _get_async_client(api_key: Optional[str] = None):
    """Return a singleton AsyncOpenAI client keyed by (api_key, base_url)."""
    try:
        import openai
    except ImportError:
        raise ImportError(
            "The 'openai' package is required for LLM features. "
            "Install it via: pip install 'pytreesearch[llm]'"
        )
    cfg = get_config()
    key = api_key or cfg.api_key or ""
    base_url = cfg.base_url
    cache_key = f"{key}::{base_url or ''}"
    if cache_key not in _async_clients:
        kw: dict[str, Any] = {"api_key": key}
        if base_url:
            kw["base_url"] = base_url
        _async_clients[cache_key] = openai.AsyncOpenAI(**kw)
    return _async_clients[cache_key]


# ---------------------------------------------------------------------------
# Token counting (with encoder cache)
# ---------------------------------------------------------------------------
_encoder_cache: dict = {}


def count_tokens(text: str, model: Optional[str] = None) -> int:
    """Count tokens using tiktoken with cached encoder.

    Falls back to a character-length heuristic (~3 chars/token) when tiktoken
    is not installed or the model name is not recognised.
    """
    if not text:
        return 0
    try:
        import tiktoken
        if model is None:
            model = get_config().model
        if model not in _encoder_cache:
            try:
                _encoder_cache[model] = tiktoken.encoding_for_model(model)
            except KeyError:
                _encoder_cache[model] = tiktoken.get_encoding("cl100k_base")
        return len(_encoder_cache[model].encode(text))
    except ImportError:
        # tiktoken not installed; heuristic: ~3 chars per token (English/CJK mix)
        return len(text) // 3


# ---------------------------------------------------------------------------
# Core async LLM call (single implementation)
# ---------------------------------------------------------------------------

async def _achat_impl(
    prompt: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0,
    messages: Optional[list[dict]] = None,
):
    """Internal: async chat completion with retry. Returns raw response."""
    cfg = get_config()
    if model is None:
        model = cfg.model
    if messages is not None:
        msgs = list(messages) + [{"role": "user", "content": prompt}]
    else:
        msgs = [{"role": "user", "content": prompt}]

    client = _get_async_client(api_key)
    # Build extra_body: thinking mode from config (disabled/enabled/auto)
    extra_body = {}
    if cfg.thinking_type in ("enabled", "auto"):
        extra_body["thinking"] = {"type": cfg.thinking_type}

    for attempt in range(MAX_RETRIES):
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": msgs,
                "temperature": temperature,
            }
            if extra_body:
                kwargs["extra_body"] = extra_body
            return await client.chat.completions.create(**kwargs)
        except Exception as e:
            logger.warning("LLM retry %d/%d: %s", attempt + 1, MAX_RETRIES, e)
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(min(2 ** attempt, 8))
            else:
                logger.error("LLM max retries reached")
                raise


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------

async def achat(
    prompt: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0,
    messages: Optional[list[dict]] = None,
) -> str:
    """Async chat completion. Returns the assistant message content."""
    resp = await _achat_impl(prompt, model=model, api_key=api_key,
                             temperature=temperature, messages=messages)
    return resp.choices[0].message.content


async def achat_with_finish_reason(
    prompt: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0,
    messages: Optional[list[dict]] = None,
) -> tuple[str, str]:
    """Async chat returning (content, finish_reason). finish_reason is 'finished' or 'max_output_reached'."""
    resp = await _achat_impl(prompt, model=model, api_key=api_key,
                             temperature=temperature, messages=messages)
    content = resp.choices[0].message.content
    reason = "max_output_reached" if resp.choices[0].finish_reason == "length" else "finished"
    return content, reason


# ---------------------------------------------------------------------------
# Sync wrapper
# ---------------------------------------------------------------------------

def chat(
    prompt: str,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0,
    messages: Optional[list[dict]] = None,
) -> str:
    """Sync wrapper around :func:`achat`."""
    return asyncio.run(achat(prompt, model=model, api_key=api_key,
                             temperature=temperature, messages=messages))


# ---------------------------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------------------------

def extract_json(content: str) -> dict | list:
    """
    Extract JSON from LLM response.

    Handles ```json fences, trailing commas, Python None literals.
    """
    if not content:
        return {}
    try:
        # Strip ```json ... ``` fences
        start = content.find("```json")
        if start != -1:
            start += 7
            end = content.rfind("```")
            text = content[start:end].strip()
        else:
            text = content.strip()

        text = text.replace("None", "null")
        text = text.replace("\n", " ").replace("\r", " ")
        text = " ".join(text.split())
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            text = text.replace(",]", "]").replace(",}", "}")
            return json.loads(text)
        except Exception:
            logger.error("Failed to parse JSON from LLM response")
            return {}
    except Exception:
        return {}
