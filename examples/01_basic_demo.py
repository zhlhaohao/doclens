# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Simplest demo — TreeSearch in 5 lines.

Usage:
    python examples/01_basic_demo.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from treesearch import TreeSearch

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "markdowns")

# 1. Create engine with lazy indexing — auto-builds index on first search
ts = TreeSearch(f"{DATA_DIR}/*.md")

# 2. Search (first call triggers index build automatically)
results = ts.search("如何配置语音通话？")
for doc in results["documents"]:
    print(f"\n📄 {doc['doc_name']}")
    for node in doc["nodes"]:
        text = node.get("text", "").strip().replace("\n", " ")
        preview = text[:200] + "..." if len(text) > 200 else text
        print(f"  [{node['score']:.2f}] {node['title']}")
        if preview:
            print(f"         {preview}")
