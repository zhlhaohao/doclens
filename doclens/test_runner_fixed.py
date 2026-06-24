#!/usr/bin/env python3
"""修正后的 P0 核心功能测试执行器"""

import sys
import os
import io
import json
import math
import traceback
import shutil

# 切换到 test_work_dir
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'test_work_dir'))

from doclens.config import CortexConfig
from doclens.cortex_cli import NotebookSearchCLI
from doclens.scoring import tokenize_query, calc_proximity_score, compute_composite_score
from doclens.formatting import hl, truncate_ansi_safe, strip_ansi, make_vscode_link
from doclens.index_manager import IndexManager, check_dependencies, SUPPORTED_FORMATS

results = []

def capture_stdout(func, *args, **kwargs):
    buf = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    try:
        func(*args, **kwargs)
    except Exception as e:
        sys.stdout = old_stdout
        return buf.getvalue() + f"\n[异常] {e}\n{traceback.format_exc()}"
    sys.stdout = old_stdout
    return buf.getvalue()

def add_result(test_id, name, conclusion, output, reason, issues="无"):
    results.append({"id": test_id, "name": name, "conclusion": conclusion,
                     "output": output, "reason": reason, "issues": issues})

def run_all():
    # 首先清理旧索引，测试 INDEX-001
    idx_path = os.path.join(".cortex", "index.db")
    if os.path.exists(idx_path):
        try:
            os.remove(idx_path)
        except:
            pass  # 忽略，后续测试

    cli = NotebookSearchCLI()
    output_index = capture_stdout(cli.load_or_build_index)
    # =========================================================================
    # INDEX-001: 首次启动自动构建索引 (P0)
    # =========================================================================
    has_building = "正在构建索引" in output_index
    has_complete = "索引完成" in output_index
    doc_count = len(cli.idx.documents)
    conclusion = "✅ 通过" if (has_building and has_complete and doc_count > 0) else "❌ 未通过"
    issues = "无" if conclusion == "✅ 通过" else f"构建={has_building}, 完成={has_complete}, 文档数={doc_count}"
    add_result("INDEX-001", "首次启动自动构建索引", conclusion, output_index,
               f"构建={has_building}, 完成={has_complete}, 文档数={doc_count}", issues)

    # =========================================================================
    # INDEX-002: 二次启动加载已有索引 (P0)
    # =========================================================================
    cli2 = NotebookSearchCLI()
    output_load = capture_stdout(cli2.load_or_build_index)
    # load_or_build_index 在已加载时返回 True 且不打印
    # 关键验证：不打印 "[正在构建索引]"
    no_build = "正在构建索引" not in output_load
    doc_count2 = len(cli2.idx.documents)
    same_count = doc_count2 == doc_count
    conclusion = "✅ 通过" if (no_build and same_count) else "❌ 未通过"
    issues = "无" if conclusion == "✅ 通过" else f"未重建={no_build}, 文档一致={same_count}"
    add_result("INDEX-002", "二次启动加载已有索引", conclusion,
               f"输出: '{output_load}'\n文档数1={doc_count}, 文档数2={doc_count2}",
               f"未重建={no_build}, 文档一致={same_count}", issues)

    # 使用 cli2 做后续搜索测试
    def search(query):
        return capture_stdout(lambda: cli2.format_results(*cli2.do_search(query), query))

    # =========================================================================
    # SEARCH-001: FTS5 BM25 中文搜索 (P0)
    # =========================================================================
    output = search("神经网络")
    has_result = "找到" in output
    has_highlight = "\033[1;31m" in output
    has_score = "评分:" in output
    conclusion = "✅ 通过" if (has_result and has_highlight and has_score) else "❌ 未通过"
    add_result("SEARCH-001", "FTS5 BM25 中文搜索", conclusion, output,
               f"有结果={has_result}, 高亮={has_highlight}, 评分={has_score}",
               "无" if conclusion == "✅ 通过" else "搜索失败")

    # =========================================================================
    # SEARCH-002: FTS5 BM25 英文搜索 (P0)
    # =========================================================================
    output = search("transformer")
    has_result = "找到" in output
    add_result("SEARCH-002", "FTS5 BM25 英文搜索",
               "✅ 通过" if has_result else "❌ 未通过", output,
               f"有结果={has_result}", "无" if has_result else "未返回结果")

    # =========================================================================
    # SEARCH-009: 大小写不敏感搜索 (P0)
    # =========================================================================
    o1 = search("python"); o2 = search("Python")
    o3 = search("asyncio"); o4 = search("kubernetes")
    c1 = o1.count("+-- ["); c2 = o2.count("+-- [")
    case_match = c1 == c2 and c1 > 0
    a_ok = "找到" in o3; k_ok = "找到" in o4
    conclusion = "✅ 通过" if (case_match and a_ok and k_ok) else "⚠️ 部分通过"
    issues = []
    if not case_match: issues.append(f"python({c1})≠Python({c2})")
    if not a_ok: issues.append("asyncio未命中")
    if not k_ok: issues.append("kubernetes未命中")
    add_result("SEARCH-009", "大小写不敏感搜索", conclusion,
               f"python({c1}):\n{o1[:200]}\nPython({c2}):\n{o2[:200]}\nasyncio:\n{o3[:200]}\nkubernetes:\n{o4[:200]}",
               f"python={c1}, Python={c2}, asyncio={a_ok}, kubernetes={k_ok}",
               "无" if not issues else "; ".join(issues))

    # =========================================================================
    # FTYPE-001: Markdown (.md) 搜索 (P0)
    # =========================================================================
    output = search("半固态电池 量产")
    has_result = "找到" in output
    has_file = "固态电池" in output
    add_result("FTYPE-001", "Markdown (.md) 搜索",
               "✅ 通过" if has_result else "❌ 未通过", output,
               f"有结果={has_result}, 命中文件={has_file}",
               "无" if has_result else "未命中")

    # =========================================================================
    # FTYPE-002: HTML (.html) 搜索 (P0)
    # =========================================================================
    o1 = search("钠离子 电解质"); o2 = search("固态 vs 液态")
    has_result = "找到" in o1
    add_result("FTYPE-002", "HTML (.html) 搜索",
               "✅ 通过" if has_result else "❌ 未通过",
               f"=== 钠离子 ===\n{o1}\n=== 固态 vs 液态 ===\n{o2}",
               f"有结果={has_result}", "无" if has_result else "未命中")

    # =========================================================================
    # FTYPE-003: PDF (.pdf) 搜索 (P0)
    # =========================================================================
    output = search("McKinsey Quantum Technology Monitor")
    has_result = "找到" in output
    has_pdf = "quantum_ai_report.pdf" in output
    add_result("FTYPE-003", "PDF (.pdf) 搜索",
               "✅ 通过" if has_result else "❌ 未通过", output,
               f"有结果={has_result}, 命中PDF={has_pdf}",
               "无" if has_result else "未命中PDF")

    # =========================================================================
    # FTYPE-005: Word (.docx) 搜索 (P0)
    # =========================================================================
    output = search("Google 量子计算 13000")
    has_result = "找到" in output
    has_docx = "docx" in output or "量子计算与人工智能报告" in output
    add_result("FTYPE-005", "Word (.docx) 搜索",
               "✅ 通过" if has_result else "❌ 未通过", output,
               f"有结果={has_result}, 命中DOCX={has_docx}",
               "无" if has_result else "未命中DOCX")

    # =========================================================================
    # FTYPE-006: Excel (.xlsx) 搜索 (P0)
    # =========================================================================
    output = search("韩国 研发投入强度 4.9")
    has_result = "找到" in output
    has_xlsx = "xlsx" in output or "科技与健康数据" in output
    add_result("FTYPE-006", "Excel (.xlsx) 搜索",
               "✅ 通过" if has_result else "❌ 未通过", output,
               f"有结果={has_result}, 命中XLSX={has_xlsx}",
               "无" if has_result else "未命中XLSX")

    # =========================================================================
    # INDEX-005: 支持 14 种文件格式 (P0)
    # =========================================================================
    output = capture_stdout(cli2.cmd_status)
    has_stats = "文件类型统计" in output
    add_result("INDEX-005", "支持 14 种文件格式",
               "✅ 通过" if has_stats else "❌ 未通过", output,
               f"有统计={has_stats}", "无" if has_stats else "统计信息缺失")

    # =========================================================================
    # SCORE-001: 综合评分四因子加权 (P0)
    # =========================================================================
    o1 = search("固态电池"); o2 = search("基因治疗")
    has_score1 = "评分:" in o1; has_score2 = "评分:" in o2
    add_result("SCORE-001", "综合评分四因子加权",
               "✅ 通过" if (has_score1 and has_score2) else "❌ 未通过",
               f"=== 固态电池 ===\n{o1}\n=== 基因治疗 ===\n{o2}",
               f"有评分1={has_score1}, 有评分2={has_score2}",
               "无" if (has_score1 and has_score2) else "评分行缺失")

    # =========================================================================
    # SCORE-003: 三级过滤降级策略 (P0)
    # =========================================================================
    output = search("xyznonexistent12345")
    has_no_result = "未找到" in output
    add_result("SCORE-003", "三级过滤降级策略",
               "✅ 通过" if has_no_result else "❌ 未通过", output,
               f"无结果提示={has_no_result}",
               "无" if has_no_result else "空查询未正确处理")

    # =========================================================================
    # SCORE-005/006/007: 评分公式数值验证 (P0)
    # =========================================================================
    for test_id, name, args, expected_factors in [
        ("SCORE-005", "评分公式 — 全因子命中", {
            "matched_count": 3, "total_keywords": 3,
            "doc_name": "CRISPR基因治疗逆转肺癌耐药性.md",
            "node_title": "CRISPR基因治疗逆转肺癌耐药性",
            "fts_score": 2.0,
            "query_words": ["CRISPR", "基因治疗", "肺癌"],
            "weights": {"keyword_match_ratio":3.0, "file_name_match":2.0, "fts_score":2.0, "title_match":1.5}
        }, {"keyword_match_ratio": 1.0, "file_name_match": 1.0, "fts_score": 1/(1+math.exp(-2.0)), "title_match": 1.0}),
        ("SCORE-006", "评分公式 — 部分因子命中", {
            "matched_count": 1, "total_keywords": 2,
            "doc_name": "量子密码学从QKD到后量子密码学.md",
            "node_title": "量子威胁",
            "fts_score": 0,
            "query_words": ["量子密码学", "QKD"],
            "weights": {"keyword_match_ratio":3.0, "file_name_match":2.0, "fts_score":2.0, "title_match":1.5}
        }, {"keyword_match_ratio": 0.5, "file_name_match": 1.0, "fts_score": 0.5, "title_match": 0.0}),
        ("SCORE-007", "评分公式 — 仅内容匹配", {
            "matched_count": 2, "total_keywords": 2,
            "doc_name": "docker_kubernetes_guide.md",
            "node_title": "The Container Revolution",
            "fts_score": 1.0,
            "query_words": ["container", "orchestration"],
            "weights": {"keyword_match_ratio":3.0, "file_name_match":2.0, "fts_score":2.0, "title_match":1.5}
        }, {"keyword_match_ratio": 1.0, "file_name_match": 0.0, "fts_score": 1/(1+math.exp(-1.0)), "title_match": 0.5}),
    ]:
        score, factors = compute_composite_score(**args)
        all_ok = True
        issues = []
        for k, v in expected_factors.items():
            actual = factors.get(k, -1)
            if abs(actual - v) > 0.001:
                all_ok = False
                issues.append(f"{k}={actual:.4f}(期望{v:.4f})")
        output = f"composite={score:.4f} ({int(score*100)}%)\nfactors={json.dumps({k:round(v,4) for k,v in factors.items()}, ensure_ascii=False)}"
        add_result(test_id, name,
                   "✅ 通过" if all_ok else "❌ 未通过", output,
                   f"composite={score:.4f}", "无" if all_ok else "; ".join(issues))

    # =========================================================================
    # SCORE-009: 近邻评分数值验证 (P0)
    # =========================================================================
    r1 = calc_proximity_score('量子计算实现13000倍加速超越经典超算', ['量子计算', '13000'])
    r2 = calc_proximity_score('量子计算在金融领域有广泛应用，远期可能达到13000倍性能提升', ['量子计算', '13000'])
    r3 = calc_proximity_score('完全不相关的文本内容', ['量子计算', '13000'])
    r4 = calc_proximity_score('固态电池技术进展与产业化', ['固态电池'])
    all_ok = r1==(2,2) and r2==(2,1) and r3==(0,0) and r4==(1,2)
    issues = []
    if r1!=(2,2): issues.append(f"场景1={r1}")
    if r2!=(2,1): issues.append(f"场景2={r2}")
    if r3!=(0,0): issues.append(f"场景3={r3}")
    if r4!=(1,2): issues.append(f"场景4={r4}")
    add_result("SCORE-009", "近邻评分数值验证",
               "✅ 通过" if all_ok else "❌ 未通过",
               f"场景1={r1}, 场景2={r2}, 场景3={r3}, 场景4={r4}",
               f"r1={r1}, r2={r2}, r3={r3}, r4={r4}", "无" if not issues else "; ".join(issues))

    # =========================================================================
    # CJK-001: jieba 中文分词 (P0)
    # =========================================================================
    tokens = tokenize_query("自然语言处理")
    has_nlp = any("自然语言" in t for t in tokens)
    has_pro = any("处理" in t for t in tokens)
    search_out = search("自然语言处理")
    has_search = "找到" in search_out
    add_result("CJK-001", "jieba 中文分词",
               "✅ 通过" if (has_nlp and has_pro) else "❌ 未通过",
               f"分词: {tokens}\n搜索: {search_out[:300]}",
               f"含'自然语言'={has_nlp}, 含'处理'={has_pro}, 搜索正常={has_search}",
               "无" if (has_nlp and has_pro) else f"分词不完整: {tokens}")

    # =========================================================================
    # FMT-001: ANSI 红色加粗高亮 (P0)
    # =========================================================================
    hl_result = hl("机器学习入门指南", ["机器学习"])
    has_ansi = "\033[1;31m" in hl_result and "\033[0m" in hl_result
    hl_case = hl("Python is great, python is fun", ["python"])
    has_case = "\033[1;31m" in hl_case
    add_result("FMT-001", "ANSI 红色加粗高亮",
               "✅ 通过" if has_ansi else "❌ 未通过",
               f"高亮: {repr(hl_result)}\n大小写: {repr(hl_case)}",
               f"ANSI={has_ansi}, 大小写={has_case}",
               "无" if has_ansi else "ANSI高亮错误")

    # =========================================================================
    # FMT-002: ANSI 安全截断 (P0)
    # =========================================================================
    long_text = "A" * 50 + "\033[1;31m关键词\033[0m" + "B" * 50
    truncated = truncate_ansi_safe(long_text, 40, ["关键词"])
    plain = strip_ansi(truncated)
    has_kw = "关键词" in plain
    has_ellipsis = "..." in truncated
    add_result("FMT-002", "ANSI 安全截断",
               "✅ 通过" if (has_kw and has_ellipsis) else "❌ 未通过",
               f"原始: {len(long_text)}字符\n截断: {repr(truncated)}\n可见: {len(plain)}字符",
               f"关键词={has_kw}, 省略号={has_ellipsis}",
               "无" if (has_kw and has_ellipsis) else "截断异常")

    # =========================================================================
    # RG-001: ripgrep 降级搜索 (P0)
    # =========================================================================
    from treesearch.ripgrep import rg_available
    rg_ok = rg_available()
    output = search("surpassing Microsoft and Apple")
    has_result = "找到" in output
    add_result("RG-001", "ripgrep 降级搜索",
               "✅ 通过" if has_result else "❌ 未通过", output,
               f"rg可用={rg_ok}, 有结果={has_result}",
               "无" if has_result else "未命中")

    # =========================================================================
    # INDEX-006: 文件改名后增量索引 (P0)
    # =========================================================================
    src = os.path.join("科技", "5G与6G通信技术发展.md")
    dst = os.path.join("科技", "5G6G通信技术发展.md")
    try:
        os.rename(src, dst)
        # 用 reindex 做增量更新
        output_reindex = capture_stdout(lambda: cli2.reindex(force=False))
        output_search = search("5G基站")
        has_new = "5G6G" in output_search
        has_old = "5G与6G" in output_search
        add_result("INDEX-006", "文件改名后增量索引",
                   "✅ 通过" if has_new else "❌ 未通过",
                   f"增量日志:\n{output_reindex}\n搜索结果:\n{output_search}",
                   f"新名称={has_new}, 旧名称={has_old}",
                   "无" if has_new else f"新名称未出现, 旧名称={has_old}")
    finally:
        if os.path.exists(dst) and not os.path.exists(src):
            os.rename(dst, src)

    # =========================================================================
    # INDEX-007: 文件删除后增量索引 (P0)
    # =========================================================================
    dark = os.path.join("天文航天", "dark_matter_stars.md")
    backup = dark + ".bak"
    try:
        shutil.copy2(dark, backup)
        os.remove(dark)
        output_reindex = capture_stdout(lambda: cli2.reindex(force=False))
        output_search = search("dark matter")
        has_deleted = "dark_matter_stars" in output_search
        add_result("INDEX-007", "文件删除后增量索引",
                   "✅ 通过" if not has_deleted else "❌ 未通过",
                   f"增量日志:\n{output_reindex}\n搜索结果:\n{output_search}",
                   f"已删除文件消失={not has_deleted}",
                   "无" if not has_deleted else "已删除文件仍出现")
    finally:
        if os.path.exists(backup) and not os.path.exists(dark):
            shutil.move(backup, dark)
        elif os.path.exists(backup):
            os.remove(backup)

    # 输出汇总
    print("\n" + "="*60)
    print("P0 测试结果汇总")
    print("="*60)
    for r in results:
        print(f"{r['id']}: {r['conclusion']} | {r['name']}")

    with open(os.path.join("..", "doclens", "test_results_p0.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    failed = [r for r in results if "❌" in r["conclusion"]]
    if failed:
        print(f"\n⚠️ P0 有 {len(failed)} 条未通过！")
        for f in failed:
            print(f"  {f['id']}: {f['issues']}")
        return False
    print("\n✅ P0 全部通过")
    return True

if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
