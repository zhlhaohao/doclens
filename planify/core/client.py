#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Anthropic 客户端初始化工具函数。"""

import os
from typing import Any, Optional

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


def init_zhipu_client(
    api_key: Optional[str],
    model_id: str = "glm-4",
    base_url: Optional[str] = None,
) -> tuple[Optional[Any], str]:
    """
    初始化 ZhipuAI 客户端。

    Args:
        api_key: ZhipuAI API 密钥
        model_id: ZhipuAI 模型 ID
        base_url: ZhipuAI API 端点（可选）

    Returns:
        (zhipu_client, model_id) 元组
    """
    if not api_key:
        print("未配置 ZHIPUAI_API_KEY，web_search/weather 工具将不可用")
        return None, model_id

    try:
        import httpx
        from zhipuai import ZhipuAI
        masked = api_key[:8] + "..." + api_key[-4:]
        print(f"初始化 ZhipuAI 客户端: api_key={masked}, model_id={model_id}, base_url={base_url}")
        # 禁用 SSL 验证（适配自签名证书环境）
        http_client = httpx.Client(verify=False)
        client = ZhipuAI(api_key=api_key, base_url=base_url, http_client=http_client)
        return client, model_id
    except Exception as e:
        print(f"警告: 无法初始化 ZhipuAI 客户端: {e}")
        print("web_search/weather 工具将不可用")
        return None, model_id
