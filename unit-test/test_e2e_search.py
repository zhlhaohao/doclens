# -*- coding: utf-8 -*-
"""SEARCH 类 E2E 测试 - 25 个测试用例"""

import pytest
from conftest import wait_for_index_ready, run_search

pytestmark = pytest.mark.asyncio


async def test_search_001_ransomware(pilot):
    """SEARCH-001: 搜索'勒索软件' - 网络安全主题"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "勒索软件")
    assert "2025网络安全趋势报告.html" in result["content"]
    assert "网络安全与AI防御2025威胁态势.md" in result["content"]
    assert len(result["files"]) >= 2


async def test_search_002_solid_state_battery(pilot):
    """SEARCH-002: 搜索'固态电池' - 能源主题"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "固态电池")
    assert "固态电池技术进展与产业化.md" in result["content"]
    assert "solid_state_ev_2026.md" in result["content"]
    assert "中国新能源汽车市场2025.md" in result["content"]
    assert "电动车电池技术对比.html" in result["content"]
    assert len(result["files"]) >= 3


async def test_search_003_dietary_fiber(pilot):
    """SEARCH-003: 搜索'膳食纤维' - 健康主题"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "膳食纤维")
    assert "肠道健康与益生菌科学指南.md" in result["content"]
    assert "营养素速查手册.html" in result["content"]
    assert "2025年健康生活与科学养生指南.html" in result["content"]
    assert len(result["files"]) >= 3


async def test_search_004_zero_trust(pilot):
    """SEARCH-004: 搜索'零信任' - 网络安全架构"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "零信任")
    assert "2025网络安全趋势报告.html" in result["content"]
    assert "网络安全与AI防御2025威胁态势.md" in result["content"]
    assert len(result["files"]) >= 2


async def test_search_005_quantum_computing(pilot):
    """SEARCH-005: 搜索'量子计算' - 科技主题"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "量子计算")
    assert "quantum_error_correction.md" in result["content"]
    assert "量子密码学从QKD到后量子密码学.md" in result["content"]
    assert "量子计算与人工智能报告2025-2026.docx" in result["content"]
    assert "quantum_ai_report.pdf" in result["content"]
    assert len(result["files"]) >= 4


async def test_search_006_crispr(pilot):
    """SEARCH-006: 搜索'CRISPR' - 生命科学主题"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "CRISPR")
    assert "CRISPR基因治疗逆转肺癌耐药性.md" in result["content"]
    assert "crispr_lung_cancer.md" in result["content"]
    assert len(result["files"]) >= 1


async def test_search_007_surface_code(pilot):
    """SEARCH-007: 搜索'Surface Code' - 量子纠错英文术语"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "Surface Code")
    assert "quantum_error_correction.md" in result["content"]
    assert len(result["files"]) >= 1


async def test_search_008_quantum_cryptography(pilot):
    """SEARCH-008: 搜索'量子 密码' - 量子密码学交叉"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "量子 密码")
    assert "量子密码学从QKD到后量子密码学.md" in result["content"]
    assert "BB84" in result["content"] or "ML-KEM" in result["content"]


async def test_search_009_ai_education(pilot):
    """SEARCH-009: 搜索'AI 教育' - 教育科技交叉"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "AI 教育")
    assert "AI辅助教育重塑学习方式.md" in result["content"]
    assert "松鼠AI" in result["content"] or "自适应学习" in result["content"]


async def test_search_010_melatonin_sleep(pilot):
    """SEARCH-010: 搜索'褪黑素 睡眠' - 健康交叉"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "褪黑素 睡眠")
    assert "睡眠科学如何获得高质量睡眠.md" in result["content"]
    assert "Z世代心理健康与保健品消费.md" in result["content"]


async def test_search_011_nio_et7(pilot):
    """SEARCH-011: 搜索'NIO ET7' - 新能源汽车产品"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "NIO ET7")
    assert "solid_state_ev_2026.md" in result["content"]
    assert "中国新能源汽车市场2025.md" in result["content"]
    assert "1100km" in result["content"]


async def test_search_012_140_trillion(pilot):
    """SEARCH-012: 搜索'140万亿' - 跨格式数据一致性"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "140万亿")
    assert "中国AI词元调用量爆发式增长.md" in result["content"]
    # 检查跨格式：docx 或 pdf
    formats = ["docx", "pdf", "pptx"]
    assert any(fmt in result["content"] for fmt in formats)


async def test_search_013_pan_jianwei(pilot):
    """SEARCH-013: 搜索'潘建伟' - 跨格式人名检索"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "潘建伟")
    assert "量子计算与人工智能报告2025-2026.docx" in result["content"]
    assert "量子计算与人工智能演示.pptx" in result["content"]
    assert "quantum_ai_report.pdf" in result["content"]


async def test_search_014_360_wh(pilot):
    """SEARCH-014: 搜索'360 Wh' - 能源技术参数"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "360 Wh")
    assert "solid_state_ev_2026.md" in result["content"]
    assert "固态电池技术进展与产业化.md" in result["content"]
    assert "电动车电池技术对比.html" in result["content"]


async def test_search_015_mfa_coverage(pilot):
    """SEARCH-015: 搜索'MFA 覆盖率' - 网络安全指标"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "MFA 覆盖率")
    assert "2025网络安全趋势报告.html" in result["content"]
    assert "网络安全与AI防御2025威胁态势.md" in result["content"]
    assert "78%" in result["content"]


async def test_search_016_eat_move_balance(pilot):
    """SEARCH-016: 搜索'吃动平衡' - 健康主题短语"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "吃动平衡")
    assert "2025年健康生活与科学养生指南.html" in result["content"]
    assert "体重管理年科学减重指南.md" in result["content"]


async def test_search_017_punk_health(pilot):
    """SEARCH-017: 搜索'朋克养生' - Z世代特有词汇"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "朋克养生")
    assert "Z世代心理健康与保健品消费.md" in result["content"]


async def test_search_018_perovskite(pilot):
    """SEARCH-018: 搜索'钙钛矿 叠层' - 太阳能技术"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "钙钛矿 叠层")
    assert "中国可再生能源突破性进展.md" in result["content"]
    assert "renewable_energy_record.md" in result["content"]
    assert "太阳能与风能技术详解.html" in result["content"]
    assert "33.9%" in result["content"]


async def test_search_019_equivalence_protection(pilot):
    """SEARCH-019: 搜索'等保2.0' - 网络安全法规"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "等保2.0")
    assert "2025网络安全趋势报告.html" in result["content"]


async def test_search_020_5g_base_station(pilot):
    """SEARCH-020: 搜索'5G基站 380万' - 通信数据"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "5G基站 380万")
    assert "5G与6G通信技术发展.md" in result["content"]
    assert "380万" in result["content"]


async def test_search_021_apple_vision_pro(pilot):
    """SEARCH-021: 搜索'Apple Vision Pro' - 元宇宙产品"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "Apple Vision Pro")
    assert "元宇宙与VR_AR技术发展.md" in result["content"]
    assert "3499美元" in result["content"] or "2300万" in result["content"]


async def test_search_022_zusanli(pilot):
    """SEARCH-022: 搜索'足三里' - 中医穴位"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "足三里")
    assert "中医理疗养生传统智慧的现代应用.md" in result["content"]


async def test_search_023_deepseek(pilot):
    """SEARCH-023: 搜索'DeepSeek' - AI品牌"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "DeepSeek")
    assert "中国AI词元调用量爆发式增长.md" in result["content"]
    assert "开源模型" in result["content"] or "代码" in result["content"]


async def test_search_024_catl_shixing(pilot):
    """SEARCH-024: 搜索'宁德时代 神行' - 电池产品"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "宁德时代 神行")
    assert "固态电池技术进展与产业化.md" in result["content"]
    assert "solid_state_ev_2026.md" in result["content"]
    assert "5分钟" in result["content"] or "600kW" in result["content"]


async def test_search_025_no_results(pilot):
    """SEARCH-025: 搜索不存在的关键词 - 验证空结果处理"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "xyz_nonexistent_12345_量子纠缠猫")
    # 验证不崩溃，且无匹配结果
    assert len(result["files"]) == 0 or "无匹配" in result["content"] or "无结果" in result["content"]
