#!/usr/bin/env python3
"""
网络搜索 CLI - 与 ApiSearchAdapter (TypeScript) 一致的实现方案
使用流式调用 + web_search_20250305 server tool
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


def make_tool_schema(
    allowed_domains: Optional[list[str]] = None,
    blocked_domains: Optional[list[str]] = None,
) -> dict:
    """
    构建 web_search_20250305 工具 schema，与 ApiSearchAdapter 一致
    """
    schema = {
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 8,
    }
    if allowed_domains:
        schema["allowed_domains"] = allowed_domains
    if blocked_domains:
        schema["blocked_domains"] = blocked_domains
    return schema


def extract_search_results(content_blocks: list) -> list[dict]:
    """
    从 API 返回的 content blocks 中提取搜索结果
    与 ApiSearchAdapter.extractSearchResults() 一致
    """
    results = []
    for block in content_blocks:
        # web_search_tool_result block 包含搜索结果数组
        if hasattr(block, 'type') and block.type == 'web_search_tool_result':
            if hasattr(block, 'content') and isinstance(block.content, list):
                for r in block.content:
                    if hasattr(r, 'title') and hasattr(r, 'url'):
                        results.append({
                            "title": r.title,
                            "url": r.url,
                            # 可选字段
                            **({"page_age": r.page_age} if hasattr(r, 'page_age') and r.page_age else {}),
                        })
        # 文本块直接返回
        elif hasattr(block, 'type') and block.type == 'text':
            results.append({"type": "text", "text": block.text})
    return results


def web_search(
    query: str,
    api_key: Optional[str] = None,
    model: str = "glm-5",
    max_tokens: int = 4096,
    thinking_budget: int = 10000,
    base_url: str = "https://z.ai",
    allowed_domains: Optional[list[str]] = None,
    blocked_domains: Optional[list[str]] = None,
    stream: bool = True,
) -> str:
    """
    使用智谱 GLM-5 的服务端网络搜索功能
    与 ApiSearchAdapter (TypeScript) 实现一致：
    - 流式调用 queryModelWithStreaming
    - thinkingConfig: { type: 'enabled', budgetTokens: N }
    - web_search_20250305 工具 schema (allowed_domains/blocked_domains)
    - 从 web_search_tool_result content blocks 提取结果

    Args:
        query: 搜索查询
        api_key: 智谱 API 密钥（如不提供则从环境变量读取）
        model: 模型名称
        max_tokens: 最大返回 token 数
        thinking_budget: Thinking 预算 token 数（与 ApiSearchAdapter 一致，默认 10000）
        base_url: API 端点地址
        allowed_domains: 只搜索这些域名
        blocked_domains: 排除这些域名
        stream: 是否流式输出（默认 True，与 ApiSearchAdapter 一致）

    Returns:
        格式化后的搜索结果
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

    # 构建工具 schema，与 ApiSearchAdapter.makeToolSchema() 一致
    tool_schema = make_tool_schema(allowed_domains, blocked_domains)

    # 构建请求参数，与 ApiSearchAdapter.queryModelWithStreaming() 参数一致
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "tools": [tool_schema],
        "messages": [{"role": "user", "content": f"Perform a web search for: {query}"}],
        "thinking": {"type": "enabled", "budget_tokens": thinking_budget},
    }

    if stream:
        # 流式调用，与 queryModelWithStreaming() 一致
        with client.messages.stream(**kwargs) as stream:
            response = stream.get_final_message()

            # 提取搜索结果，与 ApiSearchAdapter.extractSearchResults() 一致
            results = extract_search_results(response.content)

            if not results:
                return "No search results found."

            # 格式化输出
            output_parts = []
            for r in results:
                if r.get("type") == "text":
                    output_parts.append(r["text"])
                else:
                    title = r.get("title", "Untitled")
                    url = r.get("url", "")
                    page_age = r.get("page_age", "")
                    output_parts.append(f"- [{title}]({url}){f' ({page_age})' if page_age else ''}")

            return "\n".join(output_parts)
    else:
        # 非流式（保持兼容）
        response = client.messages.create(**kwargs)
        results = extract_search_results(response.content)

        if not results:
            return "No search results found."

        output_parts = []
        for r in results:
            if r.get("type") == "text":
                output_parts.append(r["text"])
            else:
                title = r.get("title", "Untitled")
                url = r.get("url", "")
                output_parts.append(f"- [{title}]({url})")

        return "\n".join(output_parts)


def main():
    parser = argparse.ArgumentParser(
        description="网络搜索 CLI - 与 ApiSearchAdapter (TypeScript) 一致的实现",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本搜索（流式）
  python web_search.py "今天最新的科技新闻"

  # 指定域名过滤
  python web_search.py "AI 新闻" --allowed-domains "github.com,reddit.com"

  # 排除域名
  python web_search.py "Python 教程" --blocked-domains "stackoverflow.com"

  # 调整 Thinking 预算
  python web_search.py "最新科技" --thinking-budget 15000

  # 非流式输出
  python web_search.py "搜索内容" --no-stream

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
        help="API 密钥（如不提供则从环境变量读取）"
    )

    parser.add_argument(
        "-m", "--model",
        default="glm-5",
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
        "--thinking-budget",
        type=int,
        default=10000,
        help="Thinking 预算 token 数（默认: 10000，与 ApiSearchAdapter 一致）"
    )

    parser.add_argument(
        "--no-stream",
        action="store_true",
        help="禁用流式输出（默认启用流式）"
    )

    parser.add_argument(
        "-u", "--base-url",
        default="https://z.ai",
        help="API 端点地址（默认: https://z.ai）"
    )

    parser.add_argument(
        "--allowed-domains",
        type=lambda s: [d.strip() for d in s.split(",")],
        default=None,
        help="只搜索这些域名（逗号分隔）"
    )

    parser.add_argument(
        "--blocked-domains",
        type=lambda s: [d.strip() for d in s.split(",")],
        default=None,
        help="排除这些域名（逗号分隔）"
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
            thinking_budget=args.thinking_budget,
            base_url=args.base_url,
            allowed_domains=args.allowed_domains,
            blocked_domains=args.blocked_domains,
            stream=not args.no_stream,
        )

        if args.output:
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
