#!/usr/bin/env python3
"""
网络搜索 CLI - 使用智谱 GLM-5 的服务端自动搜索功能
"""

import os
import sys
import argparse
from typing import Optional

# Windows 控制台 UTF-8 输出
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    import anthropic
except ImportError:
    print("错误: 需要安装 anthropic 库")
    print("请运行: pip install anthropic")
    sys.exit(1)


def web_search(
    query: str,
    api_key: Optional[str] = None,
    model: str = "glm-5",
    max_tokens: int = 4096,
    thinking: bool = True,
    base_url: str = "https://z.ai"
) -> str:
    """
    使用智谱 GLM-5 的服务端网络搜索功能

    Args:
        query: 搜索查询
        api_key: 智谱 API 密钥（如不提供则从环境变量读取）
        model: 模型名称（glm-5 或 glm-5-turbo）
        max_tokens: 最大返回 token 数
        thinking: 是否启用 Thinking 模式
        base_url: API 端点地址

    Returns:
        搜索结果
    """
    # 从环境变量获取 API Key
    if api_key is None:
        api_key = os.environ.get("ZAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        raise ValueError(
            "未找到 API Key。请设置环境变量 ZAI_API_KEY 或 ANTHROPIC_API_KEY"
        )

    # 初始化客户端
    client = anthropic.Anthropic(api_key=api_key, base_url=base_url)

    # 定义原生 web_search 工具
    tools = [
        {
            "name": "web_search",
            "type": "web_search_20250305",
            "web_search": {
                "enable": True,
                "search_query": "auto"
            }
        }
    ]

    # 构建请求参数
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "tools": tools,
        "messages": [{"role": "user", "content": query}]
    }

    # 启用 Thinking 模式
    if thinking:
        kwargs["extra_body"] = {"thinking": {"type": "enabled"}}

    # 发起请求
    response = client.messages.create(**kwargs)

    # 返回结果 - 提取所有文本内容
    texts = [block.text for block in response.content if hasattr(block, 'text') and block.text is not None]
    return '\n'.join(texts)


def main():
    parser = argparse.ArgumentParser(
        description="网络搜索 CLI - 使用智谱 GLM-5 的服务端自动搜索功能",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本搜索
  python web_search.py "今天最新的科技新闻"

  ZAI_API_KEY="your_key" .venv/Scripts/python.exe web_search.py - "今天热点新闻"
  

  # 设置环境变量后使用
  export ZAI_API_KEY="your_key"
  python web_search.py "搜索内容"

环境变量:
  ZAI_API_KEY         智谱 API 密钥（优先）
  ANTHROPIC_API_KEY   备用 API 密钥
        """
    )

    parser.add_argument(
        "query",
        help="搜索查询内容"
    )

    parser.add_argument(
        "-k", "--api-key",
        help="智谱 API 密钥（如不提供则从环境变量读取）"
    )

    parser.add_argument(
        "-m", "--model",
        default="glm-5.1",
        choices=["MiniMax-M2.7-highspeed", "glm-5", "glm-5.1"],
        help="使用的模型（默认: glm-5）"
    )

    parser.add_argument(
        "-t", "--max-tokens",
        type=int,
        default=4096,
        help="最大返回 token 数（默认: 4096）"
    )

    parser.add_argument(
        "--no-thinking",
        action="store_true",
        help="禁用 Thinking 模式"
    )

    parser.add_argument(
        "-u", "--base-url",
        default="https://api.minimaxi.com/anthropic",
        help="API 端点地址（默认: https://z.ai）"
    )

    parser.add_argument(
        "-o", "--output",
        help="输出文件路径（UTF-8 编码）"
    )

    args = parser.parse_args()

    try:
        result = web_search(
            query=args.query,
            api_key=args.api_key,
            model=args.model,
            max_tokens=args.max_tokens,
            thinking=not args.no_thinking,
            base_url=args.base_url
        )

        if args.output:
            # 保存到文件（UTF-8 编码）
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(result)
            print(f"结果已保存到 {args.output}")
        else:
            print(result)
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
