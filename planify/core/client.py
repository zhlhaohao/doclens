#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Anthropic 客户端初始化工具函数。"""

import os
from typing import Optional

from anthropic import Anthropic


def init_anthropic_client(
    base_url: Optional[str],
    api_key: str,
) -> Anthropic:
    """
    初始化 Anthropic API 客户端。

    Args:
        base_url: 自定义 API 端点 URL（可选）
        api_key: Anthropic API 密钥

    Returns:
        Anthropic 客户端实例
    """
    import httpx

    # 使用自定义 API 端点时，清除 ANTHROPIC_AUTH_TOKEN 以避免认证冲突
    if base_url:
        os.environ.pop("ANTHROPIC_AUTH_TOKEN", None)

    # 直接传递 api_key，避免修改全局 os.environ（多用户并发安全）
    # 禁用 SSL 验证（适配自签名证书环境）
    http_client = httpx.Client(verify=False)
    client_kwargs: dict = {"api_key": api_key, "http_client": http_client}
    if base_url:
        client_kwargs["base_url"] = base_url

    return Anthropic(**client_kwargs)
