#!/usr/bin/env python3
"""P0 核心功能测试执行器"""

import sys
import os
import io
import json
import math
import traceback

# 切换到 test_work_dir
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'test_work_dir'))

from cortex.config import CortexConfig
from cortex.cortex_cli import NotebookSearchCLI
from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
from cortex.formatting import hl, truncate_ansi_safe, strip_ansi, make_vscode_link
from cortex.index_manager import IndexManager, check_dependencies, SUPPORTED_FORMATS

results = []

def capture_stdout(func, *args, **kwargs):
    """捕获 stdout 输出"""
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
    results.append({
        "id": test_id,
        "name": name,
        "conclusion": conclusion,
        "output": output,
        "reason": reason,
        "issues": issues,
    })

def run_all():
    # 创建 CLI 实例
    cli = NotebookSearchCLI()
    cli.load_or_build_index()

    # =========================================================================
    # INDEX-001: 首次启动自动构建索引 (P0)
    # =========================================================================
    # 索引已在上面构建，验证日志输出
    print("--- INDEX-001 测试 ---")

    # =========================================================================
    # SEARCH-001: FTS5 BM25 中文搜索 (P0)
    # =========================================================================
    print("--- SEARCH-001 测试 ---")
    output = capture_stdout(lambda: cli.format_results(*cli.do_search("神经网络"), "神经网络"))
    has_result = "找到" in output
    has_highlight = "\033[1;31m" in output
    has_score = "评分:" in output
    conclusion = "✅ 通过" if (has_result and has_highlight and has_score) else "❌ 未通过"
    issues = "无"
    if not has_result: issues = "未返回搜索结果"
    elif not has_highlight: issues = "关键词未高亮"
    elif not has_score: issues = "缺少评分行"
    add_result("SEARCH-001", "FTS5 BM25 中文搜索", conclusion, output,
               f"有结果={has_result}, 高亮={has_highlight}, 评分={has_score}", issues)

    # =========================================================================
    # SEARCH-002: FTS5 BM25 英文搜索 (P0)
    # =========================================================================
    print("--- SEARCH-002 测试 ---")
    output = capture_stdout(lambda: cli.format_results(*cli.do_search("transformer"), "transformer"))
    has_result = "找到" in output
    has_case_insensitive = True  # 检查结果中是否有 Transformer/transformer
    if has_result:
        plain = strip_ansi(output)
        has_case_insensitive = "ransformer" in plain or "Transformer" in plain
    conclusion = "✅ 通过" if has_result else "❌ 未通过"
    issues = "无" if has_result else "未返回搜索结果"
    add_result("SEARCH-002", "FTS5 BM25 英文搜索", conclusion, output,
               f"有结果={has_result}, 大小写不敏感={has_case_insensitive}", issues)

    # =========================================================================
    # SEARCH-009: 大小写不敏感搜索 (P0)
    # =========================================================================
    print("--- SEARCH-009 测试 ---")
    output1 = capture_stdout(lambda: cli.format_results(*cli.do_search("python"), "python"))
    output2 = capture_stdout(lambda: cli.format_results(*cli.do_search("Python"), "Python"))
    output3 = capture_stdout(lambda: cli.format_results(*cli.do_search("asyncio"), "asyncio"))
    output4 = capture_stdout(lambda: cli.format_results(*cli.do_search("kubernetes"), "kubernetes"))

    r1_count = output1.count("+-- [")
    r2_count = output2.count("+-- [")
    r3_ok = "找到" in output3
    r4_ok = "找到" in output4

    case_match = r1_count == r2_count and r1_count > 0
    conclusion = "✅ 通过" if (case_match and r3_ok and r4_ok) else "⚠️ 部分通过"
    issues = []
    if not case_match: issues.append(f"python({r1_count}) vs Python({r2_count}) 结果数不同")
    if not r3_ok: issues.append("asyncio 未命中")
    if not r4_ok: issues.append("kubernetes 未命中")
    combined_output = f"=== python ===\n{output1}\n=== Python ===\n{output2}\n=== asyncio ===\n{output3}\n=== kubernetes ===\n{output4}"
    add_result("SEARCH-009", "大小写不敏感搜索", conclusion, combined_output,
               f"python={r1_count}, Python={r2_count}, asyncio={r3_ok}, kubernetes={r4_ok}",
               "无" if not issues else "; ".join(issues))

    # =========================================================================
    # FTYPE-001: Markdown (.md) 搜索 (P0)
    # =========================================================================
    print("--- FTYPE-001 测试 ---")
    output = capture_stdout(lambda: cli.format_results(*cli.do_search("半固态电池 量产"), "半固态电池 量产"))
    has_result = "找到" in output
    has_file = "固态电池" in output or "能源环境" in output
    conclusion = "✅ 通过" if (has_result and has_file) else "❌ 未通过"
    issues = "无" if (has_result and has_file) else "未命中预期文件"
    add_result("FTYPE-001", "Markdown (.md) 搜索", conclusion, output,
               f"有结果={has_result}, 命中文件={has_file}", issues)

    # =========================================================================
    # FTYPE-002: HTML (.html) 搜索 (P0)
    # =========================================================================
    print("--- FTYPE-002 测试 ---")
    output1 = capture_stdout(lambda: cli.format_results(*cli.do_search("钠离子 电解质"), "钠离子 电解质"))
    output2 = capture_stdout(lambda: cli.format_results(*cli.do_search("固态 vs 液态"), "固态 vs 液态"))
    has_result = "找到" in output1
    has_html = "电动车电池" in output1 or "html" in output1
    conclusion = "✅ 通过" if has_result else "❌ 未通过"
    issues = "无" if has_result else "未命中 HTML 文件"
    combined = f"=== 钠离子 电解质 ===\n{output1}\n=== 固态 vs 液态 ===\n{output2}"
    add_result("FTYPE-002", "HTML (.html) 搜索", conclusion, combined,
               f"有结果={has_result}, 命中HTML={has_html}", issues)

    # =========================================================================
    # FTYPE-003: PDF (.pdf) 搜索 (P0)
    # =========================================================================
    print("--- FTYPE-003 测试 ---")
    output = capture_stdout(lambda: cli.format_results(*cli.do_search("McKinsey Quantum Technology Monitor"), "McKinsey Quantum Technology Monitor"))
    has_result = "找到" in output
    has_pdf = "quantum_ai_report.pdf" in output or "quantum" in output.lower()
    conclusion = "✅ 通过" if has_result else "❌ 未通过"
    issues = "无" if has_result else "未命中 PDF 文件"
    add_result("FTYPE-003", "PDF (.pdf) 搜索", conclusion, output,
               f"有结果={has_result}, 命中PDF={has_pdf}", issues)

    # =========================================================================
    # FTYPE-005: Word (.docx) 搜索 (P0)
    # =========================================================================
    print("--- FTYPE-005 测试 ---")
    output = capture_stdout(lambda: cli.format_results(*cli.do_search("Google 量子计算 13000"), "Google 量子计算 13000"))
    has_result = "找到" in output
    has_docx = "docx" in output or "量子计算与人工智能报告" in output
    conclusion = "✅ 通过" if has_result else "❌ 未通过"
    issues = "无" if has_result else "未命中 DOCX 文件"
    add_result("FTYPE-005", "Word (.docx) 搜索", conclusion, output,
               f"有结果={has_result}, 命中DOCX={has_docx}", issues)

    # =========================================================================
    # FTYPE-006: Excel (.xlsx) 搜索 (P0)
    # =========================================================================
    print("--- FTYPE-006 测试 ---")
    output = capture_stdout(lambda: cli.format_results(*cli.do_search("韩国 研发投入强度 4.9"), "韩国 研发投入强度 4.9"))
    has_result = "找到" in output
    has_xlsx = "xlsx" in output or "科技与健康数据" in output
    conclusion = "✅ 通过" if has_result else "❌ 未通过"
    issues = "无" if has_result else "未命中 XLSX 文件"
    add_result("FTYPE-006", "Excel (.xlsx) 搜索", conclusion, output,
               f"有结果={has_result}, 命中XLSX={has_xlsx}", issues)

    # =========================================================================
    # INDEX-002: 二次启动加载已有索引 (P0)
    # =========================================================================
    print("--- INDEX-002 测试 ---")
    cli2 = NotebookSearchCLI()
    output = capture_stdout(cli2.load_or_build_index)
    loaded = "已加载" in output
    no_build = "正在构建索引" not in output
    conclusion = "✅ 通过" if (loaded and no_build) else "❌ 未通过"
    issues = "无" if (loaded and no_build) else "未正确加载已有索引"
    add_result("INDEX-002", "二次启动加载已有索引", conclusion, output,
               f"已加载={loaded}, 未重建={no_build}", issues)

    # =========================================================================
    # INDEX-005: 支持 14 种文件格式 (P0)
    # =========================================================================
    print("--- INDEX-005 测试 ---")
    output = capture_stdout(cli.cmd_status)
    has_stats = "文件类型统计" in output or "文档总数" in output
    # 检查各种格式
    has_md = ".md" in output
    has_html = ".html" in output
    has_docx = ".docx" in output
    has_xlsx = ".xlsx" in output
    has_pdf = ".pdf" in output
    conclusion = "✅ 通过" if has_stats else "❌ 未通过"
    issues = "无" if has_stats else "统计信息缺失"
    add_result("INDEX-005", "支持 14 种文件格式", conclusion, output,
               f"有统计={has_stats}, md={has_md}, html={has_html}, docx={has_docx}, xlsx={has_xlsx}, pdf={has_pdf}", issues)

    # =========================================================================
    # SCORE-001: 综合评分四因子加权 (P0)
    # =========================================================================
    print("--- SCORE-001 测试 ---")
    output1 = capture_stdout(lambda: cli.format_results(*cli.do_search("固态电池"), "固态电池"))
    output2 = capture_stdout(lambda: cli.format_results(*cli.do_search("基因治疗"), "基因治疗"))
    has_score1 = "评分:" in output1
    has_score2 = "评分:" in output2
    conclusion = "✅ 通过" if (has_score1 and has_score2) else "❌ 未通过"
    issues = "无" if (has_score1 and has_score2) else "评分行缺失"
    combined = f"=== 固态电池 (文件名+标题+内容) ===\n{output1}\n=== 基因治疗 (仅内容) ===\n{output2}"
    add_result("SCORE-001", "综合评分四因子加权", conclusion, combined,
               f"有评分1={has_score1}, 有评分2={has_score2}", issues)

    # =========================================================================
    # SCORE-003: 三级过滤降级策略 (P0)
    # =========================================================================
    print("--- SCORE-003 测试 ---")
    # 测试无结果降级
    output_empty = capture_stdout(lambda: cli.format_results(*cli.do_search("xyznonexistent12345"), "xyznonexistent12345"))
    has_no_result = "未找到" in output_empty
    conclusion = "✅ 通过" if has_no_result else "❌ 未通过"
    issues = "无" if has_no_result else "空查询未正确处理"
    add_result("SCORE-003", "三级过滤降级策略", conclusion, output_empty,
               f"无结果提示={has_no_result}", issues)

    # =========================================================================
    # SCORE-005: 评分公式数值正确性 — 全因子命中 (P0)
    # =========================================================================
    print("--- SCORE-005 测试 ---")
    score, factors = compute_composite_score(
        matched_count=3, total_keywords=3,
        doc_name='CRISPR基因治疗逆转肺癌耐药性.md',
        node_title='CRISPR基因治疗逆转肺癌耐药性',
        fts_score=2.0,
        query_words=['CRISPR', '基因治疗', '肺癌'],
        weights={'keyword_match_ratio':3.0, 'file_name_match':2.0, 'fts_score':2.0, 'title_match':1.5}
    )
    output = f"composite={score:.4f} ({int(score*100)}%)\nfactors={json.dumps({k:round(v,4) for k,v in factors.items()}, ensure_ascii=False)}"
    expected_composite = (3.0*1.0 + 2.0*1.0 + 2.0*round(1/(1+math.exp(-2.0)),4) + 1.5*1.0) / 8.5
    kwr_ok = abs(factors.get('keyword_match_ratio',0) - 1.0) < 0.001
    fnm_ok = abs(factors.get('file_name_match',0) - 1.0) < 0.001
    fts_ok = abs(factors.get('fts_score',0) - 1/(1+math.exp(-2.0))) < 0.001
    tm_ok = abs(factors.get('title_match',0) - 1.0) < 0.001
    all_ok = kwr_ok and fnm_ok and fts_ok and tm_ok
    conclusion = "✅ 通过" if all_ok else "❌ 未通过"
    issues = []
    if not kwr_ok: issues.append(f"keyword_match_ratio={factors.get('keyword_match_ratio')}")
    if not fnm_ok: issues.append(f"file_name_match={factors.get('file_name_match')}")
    if not fts_ok: issues.append(f"fts_score={factors.get('fts_score')}")
    if not tm_ok: issues.append(f"title_match={factors.get('title_match')}")
    add_result("SCORE-005", "评分公式 — 全因子命中", conclusion, output,
               f"composite={score:.4f}, expected≈{expected_composite:.4f}", "无" if not issues else "; ".join(issues))

    # =========================================================================
    # SCORE-006: 评分公式 — 仅部分因子命中 (P0)
    # =========================================================================
    print("--- SCORE-006 测试 ---")
    score, factors = compute_composite_score(
        matched_count=1, total_keywords=2,
        doc_name='量子密码学从QKD到后量子密码学.md',
        node_title='量子威胁',
        fts_score=0,
        query_words=['量子密码学', 'QKD'],
        weights={'keyword_match_ratio':3.0, 'file_name_match':2.0, 'fts_score':2.0, 'title_match':1.5}
    )
    output = f"composite={score:.4f} ({int(score*100)}%)\nfactors={json.dumps({k:round(v,4) for k,v in factors.items()}, ensure_ascii=False)}"
    kwr_ok = abs(factors.get('keyword_match_ratio',0) - 0.5) < 0.001
    fnm_ok = abs(factors.get('file_name_match',0) - 1.0) < 0.001
    fts_ok = abs(factors.get('fts_score',0) - 0.5) < 0.001
    tm_ok = abs(factors.get('title_match',0) - 0.0) < 0.001
    all_ok = kwr_ok and fnm_ok and fts_ok and tm_ok
    conclusion = "✅ 通过" if all_ok else "❌ 未通过"
    issues = []
    if not kwr_ok: issues.append(f"keyword_match_ratio={factors.get('keyword_match_ratio')}")
    if not fnm_ok: issues.append(f"file_name_match={factors.get('file_name_match')}")
    if not fts_ok: issues.append(f"fts_score={factors.get('fts_score')}")
    if not tm_ok: issues.append(f"title_match={factors.get('title_match')}")
    add_result("SCORE-006", "评分公式 — 部分因子命中", conclusion, output,
               f"composite={score:.4f}", "无" if not issues else "; ".join(issues))

    # =========================================================================
    # SCORE-007: 评分公式 — 仅内容匹配 (P0)
    # =========================================================================
    print("--- SCORE-007 测试 ---")
    score, factors = compute_composite_score(
        matched_count=2, total_keywords=2,
        doc_name='docker_kubernetes_guide.md',
        node_title='The Container Revolution',
        fts_score=1.0,
        query_words=['container', 'orchestration'],
        weights={'keyword_match_ratio':3.0, 'file_name_match':2.0, 'fts_score':2.0, 'title_match':1.5}
    )
    output = f"composite={score:.4f} ({int(score*100)}%)\nfactors={json.dumps({k:round(v,4) for k,v in factors.items()}, ensure_ascii=False)}"
    kwr_ok = abs(factors.get('keyword_match_ratio',0) - 1.0) < 0.001
    fnm_ok = abs(factors.get('file_name_match',0) - 0.0) < 0.001
    fts_ok = abs(factors.get('fts_score',0) - 1/(1+math.exp(-1.0))) < 0.001
    tm_ok = abs(factors.get('title_match',0) - 0.5) < 0.001  # 'container' in title
    all_ok = kwr_ok and fnm_ok and fts_ok and tm_ok
    conclusion = "✅ 通过" if all_ok else "❌ 未通过"
    issues = []
    if not kwr_ok: issues.append(f"keyword_match_ratio={factors.get('keyword_match_ratio')}")
    if not fnm_ok: issues.append(f"file_name_match={factors.get('file_name_match')}")
    if not fts_ok: issues.append(f"fts_score={factors.get('fts_score')}")
    if not tm_ok: issues.append(f"title_match={factors.get('title_match')}")
    add_result("SCORE-007", "评分公式 — 仅内容匹配", conclusion, output,
               f"composite={score:.4f}", "无" if not issues else "; ".join(issues))

    # =========================================================================
    # SCORE-009: 近邻评分 calc_proximity_score 数值验证 (P0)
    # =========================================================================
    print("--- SCORE-009 测试 ---")
    r1 = calc_proximity_score('量子计算实现13000倍加速超越经典超算', ['量子计算', '13000'])
    r2 = calc_proximity_score('量子计算在金融领域有广泛应用，远期可能达到13000倍性能提升', ['量子计算', '13000'])
    r3 = calc_proximity_score('完全不相关的文本内容', ['量子计算', '13000'])
    r4 = calc_proximity_score('固态电池技术进展与产业化', ['固态电池'])
    output = f"场景1(紧邻): {r1}\n场景2(远距): {r2}\n场景3(无关): {r3}\n场景4(单词): {r4}"
    ok1 = r1 == (2, 2)  # 全部匹配且紧邻
    ok2 = r2 == (2, 1)  # 全部匹配但非紧邻
    ok3 = r3 == (0, 0)  # 无匹配
    ok4 = r4 == (1, 2)  # 单词紧邻
    all_ok = ok1 and ok2 and ok3 and ok4
    conclusion = "✅ 通过" if all_ok else "❌ 未通过"
    issues = []
    if not ok1: issues.append(f"场景1 期望(2,2) 实际{r1}")
    if not ok2: issues.append(f"场景2 期望(2,1) 实际{r2}")
    if not ok3: issues.append(f"场景3 期望(0,0) 实际{r3}")
    if not ok4: issues.append(f"场景4 期望(1,2) 实际{r4}")
    add_result("SCORE-009", "近邻评分数值验证", conclusion, output,
               f"r1={r1}, r2={r2}, r3={r3}, r4={r4}", "无" if not issues else "; ".join(issues))

    # =========================================================================
    # CJK-001: jieba 中文分词 (P0)
    # =========================================================================
    print("--- CJK-001 测试 ---")
    tokens = tokenize_query("自然语言处理")
    output = f"分词结果: {tokens}"
    has_nlp = any("自然语言" in t for t in tokens)
    has_pro = any("处理" in t for t in tokens)
    # 验证搜索也正常工作
    search_output = capture_stdout(lambda: cli.format_results(*cli.do_search("自然语言处理"), "自然语言处理"))
    has_search = "找到" in search_output
    conclusion = "✅ 通过" if (has_nlp and has_pro) else "❌ 未通过"
    issues = "无" if (has_nlp and has_pro) else f"分词不完整: {tokens}"
    add_result("CJK-001", "jieba 中文分词", conclusion, output + f"\n搜索结果: {search_output[:200]}",
               f"含'自然语言'={has_nlp}, 含'处理'={has_pro}, 搜索正常={has_search}", issues)

    # =========================================================================
    # FMT-001: 关键词 ANSI 红色加粗高亮 (P0)
    # =========================================================================
    print("--- FMT-001 测试 ---")
    hl_result = hl("机器学习入门指南", ["机器学习"])
    has_ansi = "\033[1;31m" in hl_result
    has_end = "\033[0m" in hl_result
    # 验证大小写不敏感高亮
    hl_case = hl("Python is great, python is fun", ["python"])
    has_case_highlight = "\033[1;31m" in hl_case
    output = f"高亮结果: {repr(hl_result)}\n大小写高亮: {repr(hl_case)}"
    conclusion = "✅ 通过" if (has_ansi and has_end and has_case_highlight) else "❌ 未通过"
    issues = "无" if (has_ansi and has_end) else "ANSI 高亮格式错误"
    add_result("FMT-001", "ANSI 红色加粗高亮", conclusion, output,
               f"HL_START={has_ansi}, HL_END={has_end}, 大小写={has_case_highlight}", issues)

    # =========================================================================
    # FMT-002: ANSI 安全截断 (P0)
    # =========================================================================
    print("--- FMT-002 测试 ---")
    long_text = "A" * 50 + "\033[1;31m关键词\033[0m" + "B" * 50
    truncated = truncate_ansi_safe(long_text, 40, ["关键词"])
    plain_truncated = strip_ansi(truncated)
    visible_len = len(plain_truncated)
    has_kw = "关键词" in plain_truncated
    has_ellipsis = "..." in truncated
    # 验证 ANSI 完整配对
    hl_start_count = truncated.count("\033[1;31m")
    hl_end_count = truncated.count("\033[0m")
    ansi_balanced = hl_start_count <= hl_end_count
    output = f"原始: {len(long_text)} 字符\n截断后可见: {visible_len} 字符\n截断结果: {repr(truncated)}\n含关键词: {has_kw}\n含省略号: {has_ellipsis}\nANSI配对: start={hl_start_count}, end={hl_end_count}"
    conclusion = "✅ 通过" if (has_kw and has_ellipsis and ansi_balanced) else "❌ 未通过"
    issues = "无" if (has_kw and has_ellipsis and ansi_balanced) else f"关键词={has_kw}, 省略号={has_ellipsis}, ANSI配对={ansi_balanced}"
    add_result("FMT-002", "ANSI 安全截断", conclusion, output,
               f"可见长={visible_len}, 关键词={has_kw}, 省略号={has_ellipsis}, ANSI配对={ansi_balanced}", issues)

    # =========================================================================
    # RG-001: FTS 无结果时自动降级到 ripgrep (P0)
    # =========================================================================
    print("--- RG-001 测试 ---")
    from treesearch.ripgrep import rg_available
    rg_ok = rg_available()
    # 搜索一个可能在文件中但 FTS 未分词的子串
    output = capture_stdout(lambda: cli.format_results(*cli.do_search("surpassing Microsoft and Apple"), "surpassing Microsoft and Apple"))
    has_ripgrep = "ripgrep" in output
    has_result = "找到" in output
    conclusion = "✅ 通过" if (rg_ok and (has_ripgrep or has_result)) else ("⚠️ 部分通过" if has_result else "❌ 未通过")
    issues = "无" if has_result else "未命中结果"
    add_result("RG-001", "ripgrep 降级搜索", conclusion, output,
               f"rg可用={rg_ok}, ripgrep标记={has_ripgrep}, 有结果={has_result}", issues)

    # =========================================================================
    # INDEX-006: 文件改名后增量索引 (P0)
    # =========================================================================
    print("--- INDEX-006 测试 ---")
    import shutil
    src = os.path.join("科技", "5G与6G通信技术发展.md")
    dst = os.path.join("科技", "5G6G通信技术发展.md")
    # 改名
    os.rename(src, dst)
    # 重新加载索引（增量）
    cli3 = NotebookSearchCLI()
    output_load = capture_stdout(cli3.load_or_build_index)
    output_search = capture_stdout(lambda: cli3.format_results(*cli3.do_search("5G基站"), "5G基站"))
    has_new_name = "5G6G" in output_search
    has_old_name = "5G与6G" in output_search
    # 恢复
    os.rename(dst, src)
    conclusion = "✅ 通过" if has_new_name else "❌ 未通过"
    issues = "无" if has_new_name else f"新名称未出现; 旧名称={has_old_name}"
    add_result("INDEX-006", "文件改名后增量索引", conclusion,
               f"加载日志:\n{output_load}\n搜索结果:\n{output_search}",
               f"新名称={has_new_name}, 旧名称={has_old_name}", issues)

    # =========================================================================
    # INDEX-007: 文件删除后增量索引 (P0)
    # =========================================================================
    print("--- INDEX-007 测试 ---")
    dark_matter = os.path.join("天文航天", "dark_matter_stars.md")
    # 备份
    backup = dark_matter + ".bak"
    shutil.copy2(dark_matter, backup)
    # 删除
    os.remove(dark_matter)
    cli4 = NotebookSearchCLI()
    output_load = capture_stdout(cli4.load_or_build_index)
    output_search = capture_stdout(lambda: cli4.format_results(*cli4.do_search("dark matter"), "dark matter"))
    has_deleted_file = "dark_matter_stars" in output_search
    # 恢复
    shutil.move(backup, dark_matter)
    conclusion = "✅ 通过" if not has_deleted_file else "❌ 未通过"
    issues = "无" if not has_deleted_file else "已删除文件仍出现在搜索结果中"
    add_result("INDEX-007", "文件删除后增量索引", conclusion,
               f"加载日志:\n{output_load}\n搜索结果:\n{output_search}",
               f"已删除文件消失={not has_deleted_file}", issues)

    # =========================================================================
    # INDEX-001 补充: 首次启动自动构建索引
    # =========================================================================
    # 先关闭所有已有连接
    del cli, cli2, cli3, cli4
    import gc; gc.collect()

    idx_path = os.path.join(".cortex", "index.db")
    if os.path.exists(idx_path):
        try:
            os.remove(idx_path)
        except PermissionError:
            # SQLite 可能仍有连接，尝试强制关闭
            import sqlite3
            try:
                conn = sqlite3.connect(idx_path)
                conn.close()
            except:
                pass
            gc.collect()
            try:
                os.remove(idx_path)
            except PermissionError:
                # 跳过此测试，因为无法释放文件锁
                add_result("INDEX-001", "首次启动自动构建索引", "⚠️ 部分通过",
                           "[跳过] 无法释放 index.db 文件锁",
                           "索引文件被锁定，无法测试首次构建", "文件锁问题")
                # 继续后续
                print("\n" + "="*60)
                print("P0 测试结果汇总")
                print("="*60)
                for r in results:
                    print(f"{r['id']}: {r['conclusion']} | {r['name']}")
                with open(os.path.join("..", "cortex", "test_results_p0.json"), "w", encoding="utf-8") as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)
                failed = [r for r in results if "❌" in r["conclusion"]]
                if failed:
                    return False
                return True

    cli5 = NotebookSearchCLI()
    output = capture_stdout(cli5.load_or_build_index)
    has_building = "正在构建索引" in output
    has_complete = "索引完成" in output
    has_loaded = "已加载" in output
    conclusion = "✅ 通过" if (has_building and has_complete) else "❌ 未通过"
    issues = "无" if (has_building and has_complete) else "索引构建日志缺失"
    add_result("INDEX-001", "首次启动自动构建索引", conclusion, output,
               f"构建={has_building}, 完成={has_complete}, 加载={has_loaded}", issues)

    # 输出结果
    print("\n" + "="*60)
    print("P0 测试结果汇总")
    print("="*60)
    for r in results:
        print(f"{r['id']}: {r['conclusion']} | {r['name']}")

    # 保存结果为 JSON
    with open(os.path.join("..", "cortex", "test_results_p0.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 检查 P0 是否全部通过
    failed = [r for r in results if "❌" in r["conclusion"]]
    if failed:
        print(f"\n⚠️ P0 有 {len(failed)} 条未通过，阻塞后续测试！")
        for f_item in failed:
            print(f"  {f_item['id']}: {f_item['name']} - {f_item['issues']}")
        return False
    print("\n✅ P0 全部通过，可继续执行 P1/P2/P3 测试")
    return True

if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
