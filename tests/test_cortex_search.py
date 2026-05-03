"""
Cortex CLI 搜索功能全面测试
打印原始查询和完整搜索结果
"""

import os
import sys
import io
import re
import time
from contextlib import redirect_stdout

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEST_DIR = r"e:\test"
INDEX_DB = os.path.join(TEST_DIR, ".cortex", "index.db")

ANSI_RE = re.compile(r'\033\[[0-9;]*m|\033\]8;;[^\007]*\007')

report_lines = []


def clean_ansi(text):
    return ANSI_RE.sub('', text)


def log(msg=""):
    print(msg)
    report_lines.append(msg)


def make_cli():
    os.environ["CORTEX_SEARCH_PATH"] = TEST_DIR
    os.environ["CORTEX_INDEX_PATH"] = INDEX_DB
    from cortex.cortex_cli import NotebookSearchCLI
    return NotebookSearchCLI()


def capture(func, *args, **kwargs):
    buf = io.StringIO()
    with redirect_stdout(buf):
        try:
            ret = func(*args, **kwargs)
        except Exception as e:
            buf.write(f"[EXCEPTION] {type(e).__name__}: {e}")
            ret = None
    return buf.getvalue(), ret


# ============================================================
# 搜索测试用例定义
# ============================================================

SEARCH_TESTS = [
    # --- 中文关键词 ---
    {
        "id": "S-01",
        "query": "机器学习",
        "category": "中文单关键词",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-02",
        "query": "深度学习",
        "category": "中文单关键词",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-03",
        "query": "监督学习",
        "category": "中文复合词",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-04",
        "query": "神经网络",
        "category": "中文单关键词",
        "expect_files": ["sample.md", "sample.txt"],
    },
    {
        "id": "S-05",
        "query": "自然语言处理",
        "category": "中文长词",
        "expect_files": ["sample.md", "sample.txt"],
    },
    {
        "id": "S-06",
        "query": "强化学习",
        "category": "中文单关键词",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-07",
        "query": "梯度",
        "category": "中文单关键词",
        "expect_files": [],  # 样本文件中只有英文 "gradient"，无中文"梯度"
    },
    # --- 多关键词 ---
    {
        "id": "S-08",
        "query": "监督 学习 算法",
        "category": "多关键词",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-09",
        "query": "CNN 图像",
        "category": "中英混合多关键词",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-10",
        "query": "搜索 索引",
        "category": "多关键词",
        "expect_files": ["sample.html", "sample.md"],
    },
    # --- 英文关键词 ---
    {
        "id": "S-11",
        "query": "function",
        "category": "英文关键词",
        "expect_files": [],  # sample.py 用 def, sample.js 用方法语法，均无 function 关键字
    },
    {
        "id": "S-12",
        "query": "import",
        "category": "英文关键词",
        "expect_files": ["sample.py"],
    },
    {
        "id": "S-13",
        "query": "class",
        "category": "英文关键词",
        "expect_files": ["sample.py", "sample.js"],
    },
    {
        "id": "S-14",
        "query": "search",
        "category": "英文关键词",
        "expect_files": ["sample.py", "sample.js", "sample.html"],
    },
    {
        "id": "S-15",
        "query": "async",
        "category": "英文关键词",
        "expect_files": ["sample.js"],
    },
    # --- JSON/YAML/TOML 内容搜索 ---
    {
        "id": "S-16",
        "query": "FTS5",
        "category": "配置文件搜索",
        "expect_files": ["sample.yaml", "sample.toml"],
    },
    {
        "id": "S-17",
        "query": "jieba",
        "category": "配置文件搜索",
        "expect_files": ["sample.yaml", "sample.toml", "sample.json"],
    },
    {
        "id": "S-18",
        "query": "max_results",
        "category": "配置文件搜索",
        "expect_files": ["sample.yaml", "sample.toml", "sample.json"],
    },
    # --- PDF 搜索 ---
    {
        "id": "S-19",
        "query": "研发项目",
        "category": "PDF搜索",
        "expect_files": ["sample.pdf"],
    },
    {
        "id": "S-20",
        "query": "广东联通",
        "category": "PDF搜索",
        "expect_files": ["sample.pdf"],
    },
    # --- DOCX 搜索 ---
    {
        "id": "S-21",
        "query": "知识库",
        "category": "DOCX搜索",
        "expect_files": ["sample.docx"],
    },
    # --- 新闻 Markdown 搜索 ---
    {
        "id": "S-22",
        "query": "孙杨",
        "category": "新闻Markdown",
        "expect_files": ["sample_sunyang.md"],
    },
    {
        "id": "S-23",
        "query": "歼-35",
        "category": "新闻Markdown(BUG:无标题MD未索引)",
        "expect_files": ["sample_jian35.md"],  # BUG: 无标题结构的MD文件不会被FTS5索引
    },
    {
        "id": "S-24",
        "query": "高铁 哈尔滨",
        "category": "新闻Markdown(BUG:无标题MD未索引)",
        "expect_files": ["sample_gaotie.md"],  # BUG: 无标题结构的MD文件不会被FTS5索引
    },
    # --- HTML 内容搜索 ---
    {
        "id": "S-25",
        "query": "BM25",
        "category": "HTML搜索",
        "expect_files": ["sample.html"],
    },
    {
        "id": "S-26",
        "query": "增量索引",
        "category": "HTML搜索",
        "expect_files": ["sample.html"],
    },
    # --- Python 代码搜索 ---
    {
        "id": "S-27",
        "query": "def tokenize",
        "category": "代码搜索",
        "expect_files": ["sample.py"],
    },
    {
        "id": "S-28",
        "query": "TreeSearch",
        "category": "代码搜索",
        "expect_files": ["sample.py", "sample.js"],
    },
    # --- 边界搜索 ---
    {
        "id": "S-29",
        "query": "xyznonexistent12345",
        "category": "无结果搜索",
        "expect_files": [],
    },
    {
        "id": "S-29a",
        "query": "from typing",
        "category": "ripgrep降级搜索",
        "expect_files": ["sample.py"],
    },
    {
        "id": "S-30",
        "query": "推荐系统",
        "category": "中文单关键词",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-31",
        "query": "module.exports",
        "category": "代码搜索",
        "expect_files": ["sample.js"],
    },
    {
        "id": "S-32",
        "query": "量子计算",
        "category": "中文单关键词(增量新增内容)",
        "expect_files": ["sample.md"],
    },
    {
        "id": "S-33",
        "query": "自动驾驶",
        "category": "中文单关键词",
        "expect_files": ["sample.md"],
    },
]


def run_search_test(cli, test_case):
    """执行单个搜索测试，返回结果详情"""
    tc_id = test_case["id"]
    query = test_case["query"]
    category = test_case["category"]
    expect_files = test_case["expect_files"]

    log(f"\n{'─' * 70}")
    log(f"  {tc_id} | 分类: {category}")
    log(f"  查询: \"{query}\"")

    start = time.time()
    try:
        nodes, docs = cli.do_search(query)
        output, _ = capture(cli.format_results, nodes, docs, query)
        error = None
    except Exception as e:
        nodes, docs = [], []
        output = f"[EXCEPTION] {type(e).__name__}: {e}"
        error = str(e)
    elapsed = time.time() - start

    clean_output = clean_ansi(output)

    # 提取命中的文件
    hit_files = set()
    for doc in docs:
        if hasattr(doc, 'doc_name'):
            hit_files.add(doc.doc_name)
    if not hit_files:
        # 从输出中提取文件名线索
        for ef in expect_files:
            base = ef.rsplit('.', 1)[0]
            if base in clean_output:
                hit_files.add(ef)

    # 判断是否命中预期文件
    if expect_files:
        expected_bases = {f.rsplit('.', 1)[0] for f in expect_files}
        hit_bases = {f.rsplit('.', 1)[0] for f in hit_files} if hit_files else set()
        # 检查至少命中一个预期文件
        found = bool(expected_bases & hit_bases)
    else:
        found = len(docs) == 0 and len(nodes) == 0  # 预期无结果

    status = "PASS" if found else "FAIL"
    mark = "✓" if found else "✗"

    log(f"  结果: {status} | nodes={len(nodes)}, docs={len(docs)} | 耗时={elapsed:.3f}s")
    log(f"  预期文件: {expect_files}")
    log(f"  命中文件: {list(hit_files) if hit_files else '(无)'}")

    if error:
        log(f"  错误: {error}")

    # 打印搜索结果
    if clean_output.strip():
        log(f"  --- 搜索输出 ---")
        for line in clean_output.strip().split('\n'):
            log(f"  {line}")
        log(f"  --- 输出结束 ---")
    else:
        log(f"  (无输出)")

    return {
        "id": tc_id,
        "query": query,
        "category": category,
        "status": status,
        "found": found,
        "nodes": len(nodes),
        "docs": len(docs),
        "elapsed": elapsed,
        "expect_files": expect_files,
        "hit_files": list(hit_files),
        "error": error,
        "output": clean_output,
    }


def main():
    log("=" * 70)
    log("  Cortex CLI 搜索功能全面测试")
    log("=" * 70)

    # 初始化
    log(f"\n  工作目录: {TEST_DIR}")
    log(f"  索引路径: {INDEX_DB}")

    cli = make_cli()
    output, _ = capture(cli.load_or_build_index)
    doc_count = len(cli.ts.documents) if cli.ts else 0
    log(f"  加载文档数: {doc_count}")

    # 列出所有文档
    if cli.ts:
        log(f"\n  已索引文档列表:")
        for d in cli.ts.documents:
            sp = d.metadata.get('source_path', '') if d.metadata else ''
            log(f"    {d.doc_name} ({d.doc_id}) → {sp}")

    # 执行所有搜索测试
    all_results = []
    categories = {}
    for tc in SEARCH_TESTS:
        r = run_search_test(cli, tc)
        all_results.append(r)
        cat = r["category"]
        if cat not in categories:
            categories[cat] = {"pass": 0, "fail": 0, "tests": []}
        if r["found"]:
            categories[cat]["pass"] += 1
        else:
            categories[cat]["fail"] += 1
        categories[cat]["tests"].append(r["id"])

    # 汇总
    total = len(all_results)
    passed = sum(1 for r in all_results if r["found"])
    failed = total - passed

    log(f"\n{'=' * 70}")
    log(f"  测试结果汇总")
    log(f"{'=' * 70}")
    log(f"  总计: {total}  通过: {passed}  失败: {failed}  通过率: {passed/total*100:.1f}%")

    # 按分类统计
    log(f"\n  按分类统计:")
    log(f"  {'分类':<20s} {'通过':>4s} {'失败':>4s} {'通过率':>6s}")
    log(f"  {'─' * 40}")
    for cat, data in sorted(categories.items()):
        total_cat = data["pass"] + data["fail"]
        rate = data["pass"] / total_cat * 100 if total_cat else 0
        log(f"  {cat:<20s} {data['pass']:>4d} {data['fail']:>4d} {rate:>5.0f}%")

    # 失败列表
    failures = [r for r in all_results if not r["found"]]
    if failures:
        log(f"\n  失败用例详情:")
        for r in failures:
            log(f"    {r['id']}: \"{r['query']}\" ({r['category']})")
            log(f"      nodes={r['nodes']}, docs={r['docs']}, 预期={r['expect_files']}, 实际={r['hit_files']}")
            if r['error']:
                log(f"      错误: {r['error']}")

    # 保存报告
    report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cortex_search_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Cortex CLI 搜索功能测试报告\n\n")
        f.write(f"**测试日期**: 2026-05-03\n")
        f.write(f"**文档数**: {doc_count}\n")
        f.write(f"**总用例**: {total} | **通过**: {passed} | **失败**: {failed} | **通过率**: {passed/total*100:.1f}%\n\n")
        f.write("---\n\n")

        # 每个测试用例
        for r in all_results:
            mark = "✓" if r["found"] else "✗"
            f.write(f"## {mark} {r['id']}: `{r['query']}` ({r['category']}) [{r['status']}]\n\n")
            f.write(f"- **查询**: `{r['query']}`\n")
            f.write(f"- **预期文件**: {r['expect_files']}\n")
            f.write(f"- **命中文件**: {r['hit_files']}\n")
            f.write(f"- **结果**: nodes={r['nodes']}, docs={r['docs']}, 耗时={r['elapsed']:.3f}s\n")
            if r['error']:
                f.write(f"- **错误**: {r['error']}\n")
            f.write(f"\n**搜索输出:**\n\n```\n{r['output']}\n```\n\n---\n\n")

    log(f"\n  报告已保存: {report_path}")
    log("=" * 70)

    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
