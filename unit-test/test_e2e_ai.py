# -*- coding: utf-8 -*-
"""AI 类 E2E 测试 - 10 个测试用例"""

import pytest
from conftest import wait_for_index_ready, run_ai_query

pytestmark = pytest.mark.asyncio


async def test_ai_001_ransomware_damage(cortex_app):
    """AI-001: 勒索软件2025年年损失金额"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "2025年勒索软件攻击造成的年损失金额大约是多少？",
        timeout=120
    )
    assert "300亿" in result["text"] or "300亿美元" in result["text"]
    assert "勒索软件" in result["text"].lower()


async def test_ai_002_nist_pqc_standards(cortex_app):
    """AI-002: NIST后量子密码学标准"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "NIST发布的后量子密码学标准有哪些？请列举名称和编号。",
        timeout=120
    )
    assert "ML-KEM" in result["text"] or "FIPS 203" in result["text"]
    assert "ML-DSA" in result["text"] or "FIPS 204" in result["text"]
    assert "SLH-DSA" in result["text"] or "FIPS 205" in result["text"]


async def test_ai_003_perovskite_efficiency(cortex_app):
    """AI-003: 钙钛矿叠层电池效率世界纪录"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "目前钙钛矿-硅叠层电池的效率世界纪录是多少？是哪个团队创造的？",
        timeout=120
    )
    assert "33.9%" in result["text"]
    assert "隆基" in result["text"]


async def test_ai_004_nio_et7_range(cortex_app):
    """AI-004: NIO ET7半固态电池续航里程"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "蔚来ET7搭载150kWh半固态电池版本的续航里程是多少？",
        timeout=120
    )
    assert "1100km" in result["text"] or "1100" in result["text"]
    assert "360" in result["text"] or "能量密度" in result["text"]


async def test_ai_005_gen_z_anxiety_rate(cortex_app):
    """AI-005: Z世代焦虑检出率"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "Z世代的焦虑检出率是多少？这个数据来源是什么？",
        timeout=120
    )
    assert "31.2%" in result["text"] or "31%" in result["text"]
    assert "抑郁" in result["text"] or "24.8%" in result["text"]


async def test_ai_006_battery_energy_density(cortex_app):
    """AI-006: 固态电池与液态锂电池能量密度对比"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "固态电池和液态锂电池的能量密度分别是多少？请做对比。",
        timeout=120
    )
    # 液态：250-300 Wh/kg，固态：500-700 Wh/kg
    text = result["text"]
    assert ("300" in text or "250" in text) and ("700" in text or "500" in text)


async def test_ai_007_renewable_milestone(cortex_app):
    """AI-007: 中国可再生能源装机里程碑"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "中国可再生能源装机容量在什么时候首次超过了火电？装机容量是多少？",
        timeout=120
    )
    assert "18.4亿" in result["text"] or "18.4" in result["text"]


async def test_ai_008_478_breathing(cortex_app):
    """AI-008: 4-7-8呼吸法"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "什么是4-7-8呼吸法？具体怎么操作？",
        timeout=120
    )
    text = result["text"]
    assert "4" in text and "7" in text and "8" in text


async def test_ai_009_catl_shixing_charging(cortex_app):
    """AI-009: 宁德时代神行超充性能参数"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "宁德时代神行超充电池最快几分钟可以充多少公里？峰值功率是多少？",
        timeout=120
    )
    text = result["text"]
    assert "5分钟" in text or "400" in text or "600kW" in text


async def test_ai_010_change6_sample(cortex_app):
    """AI-010: 嫦娥六号月球背面采样量"""
    await wait_for_index_ready(cortex_app)
    result = await run_ai_query(cortex_app,
        "嫦娥六号从月球背面采集了多少样品？采样地点在哪里？",
        timeout=120
    )
    text = result["text"]
    assert "1935" in text or "1935.3" in text
    assert "SPA" in text or "南极-艾特肯" in text or "盆地" in text
