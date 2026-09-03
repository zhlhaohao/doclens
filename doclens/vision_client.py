"""视觉模型客户端 —— OpenAI-compat / Anthropic 双协议统一入口。

vision_worker（文档转写）与 diary_worker（照片描述）共用，避免两处各写一份
协议分流。两个协议分支统一经 planify 的 create_provider（OpenAI 分支的
image block 由 tool_translator 译为 image_url，不再手写 urllib）。
配置（vision_api_key / vision_model / vision_protocol / vision_base_url）
由 doclens.config 提供；treesearch 不感知 AI——图像异步解析的引擎机制在
treesearch，解读执行在本层（宿主）。
"""
from __future__ import annotations

import base64
import logging
import os
import re
from pathlib import Path

from treesearch.parsers.image_store import EXT_TO_MEDIA

logger = logging.getLogger(__name__)

# 推理模型经 OpenAI-compat 网关时，常把 <think>…</think> 内联进正文
_THINK_RE = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>", re.S | re.I)
_THINK_OPEN_RE = re.compile(r"<think(?:ing)?>", re.I)


def strip_thinking(text: str) -> str:
    """剥除推理模型泄漏进正文的思考段（闭合的 <think>…</think> 与未闭合的尾部 <think>…）。"""
    text = _THINK_RE.sub("", text)
    m = _THINK_OPEN_RE.search(text)
    if m:
        # 响应被 max_tokens 截断导致思考段未闭合：思考在前正文在后，
        # 未闭合即正文没写出来，只能整体丢弃（上层按空响应重试）
        text = text[: m.start()]
    return text.strip()


def encode_image(path: str | Path) -> tuple[str, str]:
    """读图像文件 → ``(base64, media_type)``。"""
    ext = os.path.splitext(str(path))[1].lower().lstrip(".")
    media = EXT_TO_MEDIA.get(ext, "application/octet-stream")
    raw = Path(path).read_bytes()
    return base64.b64encode(raw).decode("ascii"), media


def _call_planify_provider(
    protocol: str, b64: str, media: str, prompt: str, config, max_tokens: int,
) -> str:
    """经 planify provider 发一次带图消息（两个协议分支的公共实现）。

    消息用 Anthropic 风格 image source block：anthropic 后端原生支持，
    openai_compat 后端由 tool_translator 译为 image_url（data URL）——
    协议细节与对话模型同源一份，无手写 urllib。
    """
    from planify.core.llm import create_provider

    provider = create_provider({
        "protocol": protocol,
        "api_key": config.vision_api_key,
        "model_id": config.vision_model,
        "base_url": config.vision_base_url,
    })
    resp = provider.chat(
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                {"type": "text", "text": prompt},
            ],
        }],
        system="",
        tools=[],
        max_tokens=max_tokens,
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text"))
    return strip_thinking(text)


def _vision_openai(b64: str, media: str, prompt: str, config, *, max_tokens: int = 512) -> str:
    """OpenAI-compat 分支（/chat/completions + image_url，如 DashScope qwen-vl）。"""
    return _call_planify_provider("openai_compat", b64, media, prompt, config, max_tokens)


def _vision_anthropic(b64: str, media: str, prompt: str, config, *, max_tokens: int = 1024) -> str:
    """Anthropic 分支（/v1/messages + image source block，如 minimax /anthropic + M3）。"""
    return _call_planify_provider("", b64, media, prompt, config, max_tokens)


def call_vision(b64: str, media: str, prompt: str, config, *, max_tokens: int | None = None) -> str:
    """按 vision_protocol 分流调视觉模型，返回剥除思考段后的文本。

    max_tokens 省略时用各协议默认（openai-compat 512 / anthropic 1024）。
    """
    kw = {"max_tokens": max_tokens} if max_tokens is not None else {}
    if getattr(config, "vision_protocol", None) == "anthropic":
        return _vision_anthropic(b64, media, prompt, config, **kw)
    return _vision_openai(b64, media, prompt, config, **kw)
