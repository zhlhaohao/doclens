#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TreeSearch 测试程序：对 E:/github/notebook 目录进行全文检索

用法:
    python test_notebook_search.py              # 运行所有测试
    python test_notebook_search.py --index      # 仅构建索引
    python test_notebook_search.py --query "关键词"  # 执行搜索
    python test_notebook_search.py -i           # 交互式搜索模式
"""

import argparse
import sys
import os
import re
import io
from pathlib import Path

# 强制 UTF-8 输出，解决 Windows GBK 编码问题
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from treesearch import TreeSearch

# 全局 TreeSearch 实例，避免重复索引
_ts_instance = None
_notebook_path = "E:/github/notebook"
_index_db_path = "./notebook_index.db"

# 高亮标记
HIGHLIGHT_START = "\033[1;31m"  # 红色高亮
HIGHLIGHT_END = "\033[0m"


def highlight_text(text: str, query: str) -> str:
    """在文本中高亮显示关键词"""
    if not query or not text:
        return text

    # 构建正则表达式，忽略大小写
    pattern = re.compile(re.escape(query), re.IGNORECASE)

    # 只高亮显示找到的匹配部分
    def replacer(match):
        return f"{HIGHLIGHT_START}{match.group()}{HIGHLIGHT_END}"

    return pattern.sub(replacer, text)


def get_ts_instance():
    """获取或创建 TreeSearch 单例实例"""
    global _ts_instance

    if _ts_instance is None:
        _ts_instance = TreeSearch()

        # 如果索引文件存在，先尝试加载
        index_abs_path = os.path.abspath(_index_db_path)
        if os.path.exists(index_abs_path):
            try:
                docs = _ts_instance.load_index(index_abs_path)
                if docs:
                    _ts_instance.documents = docs
                    print(f"已加载索引: {index_abs_path} ({len(docs)} 个文档)")
                    return _ts_instance
            except Exception as e:
                print(f"加载索引失败 ({e})，将重新索引")

        # 需要创建索引
        print(f"正在索引目录: {_notebook_path} ...")
        docs = _ts_instance.index(_notebook_path)
        print(f"已索引 {len(docs)} 个文档")

        # 保存索引
        _ts_instance.save_index()
        print(f"索引已保存到: {os.path.abspath(_index_db_path)}")

    return _ts_instance


def get_doc_path_map(ts: TreeSearch) -> dict:
    """构建 doc_id 到 source_path 的映射"""
    path_map = {}
    for doc in ts.documents:
        if hasattr(doc, 'metadata') and doc.metadata:
            source_path = doc.metadata.get('source_path', '')
            if source_path:
                path_map[doc.doc_id] = source_path
    return path_map


def get_node_line_content(doc, node_id: str) -> dict:
    """从文档节点获取行内容信息"""
    for node in doc.get('nodes', []):
        if node.get('node_id') == node_id:
            return {
                'line_start': node.get('line_start'),
                'line_end': node.get('line_end'),
                'text': node.get('text', ''),
                'title': node.get('title', '')
            }
    return {}


def search_notebook(query: str, max_results: int = 15):
    """搜索 notebook 目录"""
    print(f"搜索关键词: {query}")
    print(f"搜索路径: {_notebook_path}")
    print("-" * 50)

    # 获取 TreeSearch 实例
    ts = get_ts_instance()

    # 构建 doc_id 到路径的映射
    path_map = get_doc_path_map(ts)

    # 执行搜索，max_nodes_per_doc=1 确保只返回包含关键词的节点
    # top_k_docs=50 扩大搜索范围
    result = ts.search(
        query=query,
        max_results=max_results,
        max_nodes_per_doc=1,
        top_k_docs=50,
    )

    # 显示结果
    documents = result.get("documents", [])
    flat_nodes = result.get("flat_nodes", [])

    print(f"\n{'='*60}")
    print(f"关键词: {query}  |  找到 {len(flat_nodes)} 个匹配")
    print(f"{'='*60}\n")

    for i, node in enumerate(flat_nodes[:max_results], 1):
        if isinstance(node, dict):
            doc_id = node.get("doc_id", "")
            node_id = node.get("node_id", "")
            path = path_map.get(doc_id, "N/A")
            score = node.get("score", 0)

            # 尝试获取更详细的节点信息
            node_info = None
            for doc in documents:
                if doc.get('doc_id') == doc_id:
                    node_info = get_node_line_content(doc, node_id)
                    break

            title = node_info.get('title', '') if node_info else node.get("title", "")
            text = node_info.get('text', '') if node_info else node.get("text", "")

            # 高亮标题和内容中的关键词
            highlighted_title = highlight_text(title, query) if title else ""

            # 缩短路径显示（取相对于 notebook 的部分）
            short_path = path.replace("E:\\github\\notebook\\", "").replace("E:/github/notebook/", "")

            # 标题最多显示50字符
            display_title = highlighted_title if highlighted_title else short_path
            if len(display_title) > 50:
                display_title = display_title[:47] + "..."

            print(f"+-- [{i}] {display_title}")
            print(f"|    路径: {short_path}")
            print(f"|    -------------------------------------------")

            if text:
                # 显示关键词所在段落的上下文（上下3行）以及上一级标题
                lines = text.split('\n')
                query_lower = query.lower()

                # 找出包含关键词的所有行索引
                keyword_indices = []
                for j, line in enumerate(lines):
                    if query_lower in line.lower():
                        keyword_indices.append(j)

                # 收集所有需要显示的行（包括上下文）
                lines_to_show = set()
                for idx in keyword_indices:
                    # 添加关键词所在行
                    lines_to_show.add(idx)
                    # 添加上下3行
                    for offset in range(-3, 4):
                        context_idx = idx + offset
                        if 0 <= context_idx < len(lines):
                            lines_to_show.add(context_idx)

                # 找出上一级标题（从后往前找以 # 开头的行）
                ancestor_titles = []
                if keyword_indices:
                    first_keyword_idx = min(keyword_indices)
                    for j in range(first_keyword_idx - 1, -1, -1):
                        line = lines[j].strip()
                        if line.startswith('#'):
                            ancestor_titles.append((j, line))
                        elif line and not line.startswith('|') and not line.startswith('```'):
                            # 遇到非标题内容停止
                            if not ancestor_titles:  # 只有还没找到标题时才停止
                                break

                # 按行号排序
                lines_to_show = sorted(lines_to_show)

                # 显示上一级标题（如果有）
                if ancestor_titles:
                    # 显示最近的标题（上一级）
                    title_line = ancestor_titles[0][1]
                    highlighted_title = highlight_text(title_line, query)
                    print(f"|    ^ 标题: {highlighted_title}")

                # 显示上下文内容
                for j in lines_to_show:
                    line = lines[j]
                    if line.strip():
                        # 高亮关键词
                        highlighted_line = highlight_text(line.strip(), query)
                        # 限制每行宽度
                        if len(highlighted_line) > 75:
                            highlighted_line = highlighted_line[:72] + "..."

                        # 标记是否是关键词行
                        marker = ">>>" if j in keyword_indices else "   "
                        print(f"|  {marker} {highlighted_line}")

                if len(lines) > max(lines_to_show) + 3:
                    print(f"|    ... 还有 {len(lines) - max(lines_to_show) - 1} 行")

            print(f"|")
            print(f"+-- 评分: {score:.4f}")
            print()
        else:
            print(f"  {node}")
            print()

    return True


def interactive_mode():
    """交互式搜索模式"""
    ts = get_ts_instance()
    path_map = get_doc_path_map(ts)

    print("\n" + "=" * 50)
    print("TreeSearch 交互式搜索 - E:/github/notebook")
    print("输入 'quit' 或 'exit' 退出")
    print("=" * 50)

    while True:
        try:
            query = input("\n搜索> ").strip()
            if query.lower() in ("quit", "exit", "q"):
                print("退出程序")
                break
            if not query:
                continue

            result = ts.search(
                query=query,
                max_results=20,
                max_nodes_per_doc=1,
                top_k_docs=50,
            )

            flat_nodes = result.get("flat_nodes", [])
            documents = result.get("documents", [])

            print(f"\n{'='*50}")
            print(f"关键词: {query}  |  找到 {len(flat_nodes)} 个匹配")
            print(f"{'='*50}")

            for i, node in enumerate(flat_nodes[:8], 1):
                if isinstance(node, dict):
                    doc_id = node.get("doc_id", "")
                    node_id = node.get("node_id", "")
                    path = path_map.get(doc_id, "N/A")
                    score = node.get("score", 0)

                    # 尝试获取更详细的节点信息
                    node_info = None
                    for doc in documents:
                        if doc.get('doc_id') == doc_id:
                            node_info = get_node_line_content(doc, node_id)
                            break

                    title = node_info.get('title', '') if node_info else node.get("title", "")
                    text = node_info.get('text', '') if node_info else ""

                    # 高亮标题
                    highlighted_title = highlight_text(title, query) if title else ""

                    # 缩短路径
                    short_path = path.replace("E:\\github\\notebook\\", "").replace("E:/github/notebook/", "")

                    # 标题最多显示40字符
                    display_title = highlighted_title if highlighted_title else short_path
                    if len(display_title) > 40:
                        display_title = display_title[:37] + "..."

                    print(f"\n+-- [{i}] {display_title}")
                    print(f"|    {short_path}")

                    # 如果有文本内容，显示第一行并高亮
                    if text:
                        first_line = text.split('\n')[0].strip()
                        if len(first_line) > 70:
                            first_line = first_line[:67] + "..."
                        highlighted_line = highlight_text(first_line, query)
                        print(f"|    {highlighted_line}")

                    print(f"|    Score: {score:.4f}")

            if len(flat_nodes) > 8:
                print(f"\n  ... 还有 {len(flat_nodes) - 8} 个结果")

        except KeyboardInterrupt:
            print("\n退出程序")
            break


def index_only():
    """仅构建索引"""
    global _ts_instance
    _ts_instance = None  # 重置实例，强制重新索引

    ts = get_ts_instance()
    print(f"索引完成! 共 {len(ts.documents)} 个文档")
    print(f"索引文件: {os.path.abspath(_index_db_path)}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="TreeSearch 测试程序 - 搜索 E:/github/notebook"
    )
    parser.add_argument(
        "--index",
        action="store_true",
        help="仅构建索引，不搜索"
    )
    parser.add_argument(
        "--query",
        type=str,
        help="搜索关键词"
    )
    parser.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="交互式搜索模式"
    )
    parser.add_argument(
        "--max-results", "-n",
        type=int,
        default=15,
        help="最大结果数 (默认: 15)"
    )
    parser.add_argument(
        "--reset-index",
        action="store_true",
        help="重置索引，重新索引所有文件"
    )

    args = parser.parse_args()

    # 如果需要重置索引
    if args.reset_index:
        global _ts_instance
        if os.path.exists(_index_db_path):
            os.remove(_index_db_path)
            print(f"已删除旧索引: {_index_db_path}")
        _ts_instance = None

    if args.interactive:
        interactive_mode()
    elif args.index:
        index_only()
    elif args.query:
        search_notebook(args.query, args.max_results)
    else:
        # 默认：执行几个测试搜索
        print("TreeSearch 测试程序")
        print("=" * 50)

        # 执行测试搜索
        print("\n执行测试搜索")
        print("=" * 50)

        test_queries = [
            "认证",
            "Python",
            "配置",
        ]

        for q in test_queries:
            print(f"\n>>> 搜索: {q}")
            search_notebook(q, max_results=5)
            print("-" * 50)


if __name__ == "__main__":
    main()
