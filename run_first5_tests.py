"""
执行前5个搜索测试用例 (SEARCH-001 ~ SEARCH-005)
"""
import asyncio
import json
import os
import re
import sys
import threading
import time
import traceback
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.resolve()
os.chdir(PROJECT_ROOT)
sys.path.insert(0, str(PROJECT_ROOT))

TEST_WORK_DIR = PROJECT_ROOT / "test_work_dir"
os.chdir(TEST_WORK_DIR)

from rich.text import Text
from textual.widgets import Input

from cortex.tui.app import CortexApp
from cortex.tui.widgets.content_area import ContentArea

REPORT_FILE = PROJECT_ROOT / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M')}.md"
results = {"pass": 0, "fail": 0, "skip": 0}


def append_report(text: str):
    with open(REPORT_FILE, "a", encoding="utf-8") as f:
        f.write(text + "\n")


def write_report_header():
    header = f"""# Cortex TUI 端到端测试报告

## 测试信息

| 项目 | 值 |
|------|-----|
| 测试日期 | {datetime.now().strftime('%Y-%m-%d %H:%M')} |
| 测试范围 | SEARCH-001 ~ SEARCH-005 (前5个搜索测试) |
| 交互方式 | Textual Pilot (headless) + IndexManager 直接调用 |
| 测试工作目录 | test_work_dir/ |

## 测试摘要

| 分类 | 总数 | 通过 | 失败 | 跳过 |
|------|------|------|------|------|
| 搜索功能 (SEARCH) | 5 | {results['pass']} | {results['fail']} | {results['skip']} |

## 详细测试结果

"""
    REPORT_FILE.write_text(header, encoding="utf-8")


def update_summary():
    content = REPORT_FILE.read_text(encoding="utf-8")
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if "| 搜索功能 (SEARCH) | 5 |" in line:
            lines[i] = f"| 搜索功能 (SEARCH) | 5 | {results['pass']} | {results['fail']} | {results['skip']} |"
            break
    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")


async def do_search(pilot, keyword: str) -> str:
    """直接调用 IndexManager 搜索，返回纯文本"""
    content = pilot.app.query_one(ContentArea)
    content.clear()

    result_holder = [None]

    def sync_search():
        try:
            pilot.app.idx._needs_reload = True
            pilot.app.idx.load_or_build_index()

            nodes, docs = pilot.app.idx.search(
                keyword,
                max_results=pilot.app.max_results
            )

            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=pilot.app.idx.index_path)
            all_docs = fts.load_all_documents()
            fts.close()
            fresh_path_map = {}
            for d in all_docs:
                if d and hasattr(d, 'metadata') and d.metadata:
                    p = d.metadata.get('source_path', '')
                    if p:
                        fresh_path_map[d.doc_id] = p

            doc_best = {}
            for node in nodes:
                doc_id = node.get("doc_id", "")
                if doc_id not in doc_best:
                    doc_best[doc_id] = node

            lines = []
            lines.append(f"关键词: {keyword}  |  找到 {len(doc_best)} 个匹配")
            lines.append("")

            for i, (doc_id, node) in enumerate(doc_best.items(), 1):
                path = fresh_path_map.get(doc_id, doc_id)
                score = node.get("score", 0.0)
                stars = "★" * int(score * 5)
                text_snippet = (node.get("text", "") or "")[:150].replace("\n", " ")
                lines.append(f"[{i}] {path}")
                lines.append(f"    {text_snippet}")
                lines.append(f"    评分: {stars} {score*100:.0f}%")
                lines.append("")

            if not doc_best:
                lines.append(f"未找到与 '{keyword}' 相关的文档")

            result_holder[0] = "\n".join(lines)
        except Exception as e:
            result_holder[0] = f"搜索异常: {e}\n{traceback.format_exc()}"

    t = threading.Thread(target=sync_search, daemon=True)
    t.start()
    t.join(timeout=30)

    output = result_holder[0] or "(超时)"
    content.write(Text(f"> /s {keyword}\n", style="#9ece6a bold"))
    content.write(Text(output + "\n", style="#c0caf5"))
    return output


def write_test_result(case_id, title, priority, status, test_input,
                      expected, actual_output, verification, actual_desc):
    status_icon = {"pass": "PASS", "fail": "FAIL", "skip": "SKIP"}[status]
    text = f"""### {case_id}: {title}

- **状态**: {status_icon}
- **优先级**: {priority}
- **执行时间**: {datetime.now().strftime('%H:%M:%S')}
- **测试输入**: `{test_input}`

**预期结果**:
"""
    for e in expected:
        text += f"- {e}\n"

    text += f"""
**实测输出**:
```
{actual_output[:3000] if actual_output else '(无输出)'}
```

**验证详情**:
"""
    for v in verification:
        text += f"- {v}\n"

    text += f"""
**实测结果**: {actual_desc}

---
"""
    append_report(text)


# ── 测试用例定义 ──────────────────────────────────────────

TEST_CASES = [
    {
        "id": "SEARCH-001",
        "title": "搜索'勒索软件' - 网络安全主题",
        "priority": "P0",
        "keyword": "勒索软件",
        "expected_files": ["2025网络安全趋势报告", "网络安全与AI防御2025威胁态势"],
        "expected_keywords": ["勒索软件"],
        "min_results": 2,
    },
    {
        "id": "SEARCH-002",
        "title": "搜索'固态电池' - 能源主题（多文件命中）",
        "priority": "P0",
        "keyword": "固态电池",
        "expected_files": ["固态电池技术进展与产业化", "中国新能源汽车市场2025", "电动车电池技术对比"],
        "expected_keywords": ["固态电池"],
        "min_results": 3,
    },
    {
        "id": "SEARCH-003",
        "title": "搜索'膳食纤维' - 健康主题",
        "priority": "P0",
        "keyword": "膳食纤维",
        "expected_files": ["肠道健康与益生菌科学指南", "营养素速查手册", "2025年健康生活与科学养生指南"],
        "expected_keywords": ["膳食纤维"],
        "min_results": 3,
    },
    {
        "id": "SEARCH-004",
        "title": "搜索'零信任' - 网络安全架构",
        "priority": "P1",
        "keyword": "零信任",
        "expected_files": ["2025网络安全趋势报告", "网络安全与AI防御2025威胁态势"],
        "expected_keywords": ["零信任"],
        "min_results": 2,
    },
    {
        "id": "SEARCH-005",
        "title": "搜索'量子计算' - 科技主题（广泛命中）",
        "priority": "P0",
        "keyword": "量子计算",
        "expected_files": ["quantum_error_correction", "量子密码学从QKD到后量子密码学", "量子计算与人工智能报告"],
        "expected_keywords": ["量子计算"],
        "min_results": 4,
    },
]


async def run_tests():
    print("=" * 60)
    print("执行前5个搜索测试用例 (SEARCH-001 ~ SEARCH-005)")
    print("=" * 60)

    write_report_header()

    app = CortexApp()
    async with app.run_test() as pilot:
        print("等待索引加载...")
        await asyncio.sleep(8)
        await pilot.pause()
        print("索引加载完成，开始测试\n")

        for case in TEST_CASES:
            case_id = case["id"]
            keyword = case["keyword"]
            print(f"  {case_id}: {case['title']}")
            print(f"    关键词: {keyword}")

            try:
                output = await do_search(pilot, keyword)
                output_lower = output.lower()

                # 提取匹配数
                m = re.search(r"找到\s*(\d+)\s*个匹配", output)
                result_count = int(m.group(1)) if m else 0

                # 验证文件命中
                found_files = []
                missing_files = []
                for fname in case["expected_files"]:
                    if fname.lower() in output_lower:
                        found_files.append(fname)
                    else:
                        missing_files.append(fname)

                # 验证关键词
                found_kw = []
                missing_kw = []
                for kw in case["expected_keywords"]:
                    if kw.lower() in output_lower:
                        found_kw.append(kw)
                    else:
                        missing_kw.append(kw)

                # 通过条件
                min_results = case["min_results"]
                threshold = max(1, len(case["expected_files"]) // 2)
                passed = (result_count >= max(min_results, 1)
                          and len(found_files) >= threshold)

                verification = []
                for f in found_files:
                    verification.append(f"文件 '{f}': PASS 找到")
                for f in missing_files:
                    verification.append(f"文件 '{f}': 未匹配")
                for kw in found_kw:
                    verification.append(f"关键词 '{kw}': PASS 找到")
                for kw in missing_kw:
                    verification.append(f"关键词 '{kw}': 未匹配")
                verification.append(
                    f"结果数 {result_count} >= {max(min_results, 1)}: "
                    f"{'PASS' if result_count >= max(min_results, 1) else 'FAIL'}"
                )
                verification.append(
                    f"命中 {len(found_files)}/{len(case['expected_files'])} 文件 "
                    f"(阈值 {threshold}): "
                    f"{'PASS' if len(found_files) >= threshold else 'FAIL'}"
                )

                status = "pass" if passed else "fail"
                results[status] += 1

                icon = "PASS" if passed else "FAIL"
                print(f"    {icon} (找到 {result_count} 个匹配, "
                      f"命中 {len(found_files)}/{len(case['expected_files'])} 文件)")

                write_test_result(
                    case_id=case_id,
                    title=case["title"],
                    priority=case["priority"],
                    status=status,
                    test_input=f"/s {keyword}",
                    expected=[f"搜索 '{keyword}' 返回相关文档"],
                    actual_output=output[:3000],
                    verification=verification,
                    actual_desc=f"找到 {result_count} 个匹配, "
                               f"命中 {len(found_files)}/{len(case['expected_files'])} 预期文件"
                               + (" - 通过" if passed else " - 失败"),
                )

            except Exception as e:
                print(f"    ERROR: {e}")
                results["fail"] += 1
                write_test_result(
                    case_id=case_id,
                    title=case["title"],
                    priority=case["priority"],
                    status="fail",
                    test_input=f"/s {keyword}",
                    expected=[f"搜索 '{keyword}' 返回相关文档"],
                    actual_output=f"异常: {traceback.format_exc()}",
                    verification=[f"执行异常: {e}"],
                    actual_desc=f"执行异常: {e}",
                )

    update_summary()
    print(f"\n{'=' * 60}")
    print(f"测试完成! PASS={results['pass']} FAIL={results['fail']} SKIP={results['skip']}")
    print(f"报告: {REPORT_FILE}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(run_tests())
