# Cortex TUI E2E 测试实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Cortex TUI 编写 47 个端到端测试用例，使用 Textual Pilot 框架

**Architecture:**
- 测试数据目录: `test_work_dir/` (只读，包含多主题文档)
- 测试代码目录: `unit-test/`
- 使用 pytest + pytest-asyncio + Textual run_test() 模式
- 每个测试独立运行，使用 mock 隔离配置

**Tech Stack:** pytest, pytest-asyncio, textual, Rich

---

## 文件结构

```
unit-test/
├── test_case.json           # 测试用例定义（从根目录移入）
├── conftest.py              # 共享 fixtures 和辅助函数
├── test_e2e_search.py      # 25 个 SEARCH 测试
├── test_e2e_ai.py         # 10 个 AI 测试
└── test_e2e_watch.py      # 12 个 WATCH 测试
```

---

## Task 1: 创建 unit-test 目录并移动 test_case.json

- 创建: `unit-test/` 目录
- 移动: `test_case.json` 到 `unit-test/test_case.json`

- [ ] **Step 1: 创建目录并移动文件**

```bash
mkdir -p unit-test
mv test_case.json unit-test/test_case.json
git add unit-test/test_case.json
git commit -m "feat: move test_case.json to unit-test/"
```

---

## Task 2: 创建 conftest.py - 共享 fixtures

- 创建: `unit-test/conftest.py`

### 依赖分析
- `ContentArea` 来自 `cortex.tui.widgets.content_area`，有 `write()` 方法和 `_last_output` 属性
- `StatusBar` 来自 `cortex.tui.widgets.status_bar`，有 `set_index_stats()` 和 `_right_text` 属性
- `CortexApp` 来自 `cortex.tui.app`
- `IndexManager` 来自 `cortex.index_manager`
- `CortexConfig` 来自 `cortex.config`

### 核心辅助函数设计

```python
# 获取 ContentArea 纯文本内容
def get_content_text(content: ContentArea) -> str:
    """从 ContentArea 提取所有纯文本"""
    # 使用 _last_output 列表或解析 RichLog 的内容
    lines = []
    for child in content.children:
        if hasattr(child, 'renderable') and hasattr(child.renderable, 'plain'):
            lines.append(child.renderable.plain)
    return "\n".join(lines)

# 等待索引加载完成
async def wait_for_index_ready(pilot, timeout=60):
    """等待 StatusBar 显示 '就绪' 或 '索引: N 文档'"""
    status_bar = pilot.app.query_one(StatusBar)
    start = time.time()
    while time.time() - start < timeout:
        text = status_bar._right_text
        if "就绪" in text or "索引:" in text:
            return True
        await pilot.pause(0.5)
    return False

# 执行搜索命令
async def run_search(pilot, query: str) -> dict:
    """执行 /s {query}，返回 {"files": [...], "content": str}"""
    cmd_input = pilot.app.query_one("#cmd-input")
    cmd_input.focus()
    cmd_input.value = f"/s {query}"
    await pilot.press("enter")
    await pilot.pause(2)  # 等待搜索完成

    content = pilot.app.query_one(ContentArea)
    text = get_content_text(content)
    # 提取文件名（简化：查找 .md .html 等）
    import re
    files = re.findall(r'[\w\-\u4e00-\u9fff]+\.(?:md|html|pdf|docx|pptx)', text)
    return {"files": list(set(files)), "content": text}

# 执行 AI 查询
async def run_ai_query(pilot, question: str, timeout=120) -> dict:
    """执行 AI 查询，返回 {"text": str, "cancelled": bool}"""
    cmd_input = pilot.app.query_one("#cmd-input")
    cmd_input.focus()
    cmd_input.value = question
    await pilot.press("enter")

    # 等待 AI 完成或超时
    start = time.time()
    while time.time() - start < timeout:
        await pilot.pause(1)
        # 检查是否还在思考中
        status_bar = pilot.app.query_one(StatusBar)
        if "Agent: 思考中" not in status_bar._right_text:
            break

    content = pilot.app.query_one(ContentArea)
    text = get_content_text(content)
    return {"text": text, "cancelled": False}

# 轮询等待文件被索引
async def wait_for_file_indexed(pilot, marker: str, timeout=30) -> bool:
    """WATCH 测试用：轮询搜索直到找到 marker 或超时"""
    start = time.time()
    while time.time() - start < timeout:
        result = await run_search(pilot, marker)
        if marker in result["content"]:
            return True
        await pilot.pause(5)
    return False
```

- [ ] **Step 1: 创建 unit-test/conftest.py**

```python
# -*- coding: utf-8 -*-
"""Cortex TUI E2E 测试共享 fixtures"""

import asyncio
import re
import time
from pathlib import Path

import pytest

# 确保导入路径正确
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from cortex.tui.app import CortexApp
from cortex.tui.widgets.content_area import ContentArea
from cortex.tui.widgets.status_bar import StatusBar


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def test_data_dir():
    """test_work_dir 目录路径"""
    return Path(__file__).parent.parent / "test_work_dir"


@pytest.fixture
def unit_test_dir():
    """unit-test 目录路径"""
    return Path(__file__).parent


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def get_content_text(content: ContentArea) -> str:
    """从 ContentArea 提取所有纯文本"""
    lines = []
    for child in content.children:
        try:
            if hasattr(child, 'renderable') and child.renderable:
                if hasattr(child.renderable, 'plain'):
                    lines.append(child.renderable.plain)
                elif hasattr(child.renderable, 'plain_text'):
                    lines.append(child.renderable.plain_text)
        except Exception:
            pass
    return "\n".join(lines)


async def wait_for_index_ready(pilot, timeout=60):
    """等待 StatusBar 显示 '就绪' 或 '索引: N 文档'"""
    status_bar = pilot.app.query_one(StatusBar)
    start = time.time()
    while time.time() - start < timeout:
        text = getattr(status_bar, '_right_text', '')
        if "就绪" in text or "索引:" in text:
            return True
        await pilot.pause(0.5)
    return False


async def run_search(pilot, query: str) -> dict:
    """执行 /s {query}，返回 {"files": [...], "content": str}"""
    cmd_input = pilot.app.query_one("#cmd-input")
    cmd_input.focus()
    cmd_input.value = f"/s {query}"
    await pilot.press("enter")
    await pilot.pause(2)  # 等待搜索完成

    content = pilot.app.query_one(ContentArea)
    text = get_content_text(content)
    # 提取文件名
    files = re.findall(r'[\w\-\u4e00-\u9fff]+\.(?:md|html|pdf|docx|pptx)', text)
    return {"files": list(set(files)), "content": text}


async def run_ai_query(pilot, question: str, timeout=120) -> dict:
    """执行 AI 查询，返回 {"text": str, "cancelled": bool}"""
    cmd_input = pilot.app.query_one("#cmd-input")
    cmd_input.focus()
    cmd_input.value = question
    await pilot.press("enter")

    # 等待 AI 完成或超时
    start = time.time()
    while time.time() - start < timeout:
        await pilot.pause(1)
        status_bar = pilot.app.query_one(StatusBar)
        if "Agent: 思考中" not in getattr(status_bar, '_right_text', ''):
            break

    content = pilot.app.query_one(ContentArea)
    text = get_content_text(content)
    return {"text": text, "cancelled": False}


async def wait_for_file_indexed(pilot, marker: str, timeout=30) -> bool:
    """轮询搜索直到找到 marker 或超时"""
    start = time.time()
    while time.time() - start < timeout:
        result = await run_search(pilot, marker)
        if marker in result["content"]:
            return True
        await pilot.pause(5)
    return False
```

- [ ] **Step 2: 验证 conftest.py 语法**

```bash
cd /c/Users/lianghao/github/cortex && python -m py_compile unit-test/conftest.py
```

- [ ] **Step 3: 提交**

```bash
git add unit-test/conftest.py
git commit -m "feat: add shared fixtures for E2E tests"
```

---

## Task 3: 创建 test_e2e_search.py - SEARCH 测试

- 创建: `unit-test/test_e2e_search.py`

### 测试用例清单 (25 个)

| 编号 | 查询词 | 预期文件 | 优先级 |
|------|--------|----------|--------|
| SEARCH-001 | 勒索软件 | 2025网络安全趋势报告.html, 网络安全与AI防御2025威胁态势.md | P0 |
| SEARCH-002 | 固态电池 | 固态电池技术进展与产业化.md, solid_state_ev_2026.md, 中国新能源汽车市场2025.md, 电动车电池技术对比.html | P0 |
| SEARCH-003 | 膳食纤维 | 肠道健康与益生菌科学指南.md, 营养素速查手册.html, 2025年健康生活与科学养生指南.html | P0 |
| SEARCH-004 | 零信任 | 2025网络安全趋势报告.html, 网络安全与AI防御2025威胁态势.md | P1 |
| SEARCH-005 | 量子计算 | quantum_error_correction.md, 量子密码学从QKD到后量子密码学.md, 量子计算与人工智能报告2025-2026.docx, quantum_ai_report.pdf | P0 |
| SEARCH-006 | CRISPR | CRISPR基因治疗逆转肺癌耐药性.md, crispr_lung_cancer.md | P0 |
| SEARCH-007 | Surface Code | quantum_error_correction.md | P1 |
| SEARCH-008 | 量子 密码 | 量子密码学从QKD到后量子密码学.md | P0 |
| SEARCH-009 | AI 教育 | AI辅助教育重塑学习方式.md | P1 |
| SEARCH-010 | 褪黑素 睡眠 | 睡眠科学如何获得高质量睡眠.md, Z世代心理健康与保健品消费.md | P1 |
| SEARCH-011 | NIO ET7 | solid_state_ev_2026.md, 中国新能源汽车市场2025.md | P1 |
| SEARCH-012 | 140万亿 | 中国AI词元调用量爆发式增长.md + docx + pdf | P0 |
| SEARCH-013 | 潘建伟 | 量子计算与人工智能报告2025-2026.docx, 量子计算与人工智能演示.pptx, quantum_ai_report.pdf | P0 |
| SEARCH-014 | 360 Wh | solid_state_ev_2026.md, 固态电池技术进展与产业化.md, 电动车电池技术对比.html | P1 |
| SEARCH-015 | MFA 覆盖率 | 2025网络安全趋势报告.html, 网络安全与AI防御2025威胁态势.md | P1 |
| SEARCH-016 | 吃动平衡 | 2025年健康生活与科学养生指南.html, 体重管理年科学减重指南.md | P1 |
| SEARCH-017 | 朋克养生 | Z世代心理健康与保健品消费.md | P1 |
| SEARCH-018 | 钙钛矿 叠层 | 中国可再生能源突破性进展.md, renewable_energy_record.md, 太阳能与风能技术详解.html | P0 |
| SEARCH-019 | 等保2.0 | 2025网络安全趋势报告.html | P2 |
| SEARCH-020 | 5G基站 380万 | 5G与6G通信技术发展.md | P1 |
| SEARCH-021 | Apple Vision Pro | 元宇宙与VR_AR技术发展.md | P1 |
| SEARCH-022 | 足三里 | 中医理疗养生传统智慧的现代应用.md | P2 |
| SEARCH-023 | DeepSeek | 中国AI词元调用量爆发式增长.md | P1 |
| SEARCH-024 | 宁德时代 神行 | 固态电池技术进展与产业化.md, solid_state_ev_2026.md | P1 |
| SEARCH-025 | xyz_nonexistent_12345_量子纠缠猫 | 空结果/无匹配 | P0 |

### 测试模式

```python
# -*- coding: utf-8 -*-
"""SEARCH 类 E2E 测试 - 25 个测试用例"""

import pytest

pytestmark = pytest.mark.asyncio


async def test_search_001_ransomware(pilot):
    """SEARCH-001: 搜索'勒索软件' - 网络安全主题"""
    await wait_for_index_ready(pilot)
    result = await run_search(pilot, "勒索软件")
    assert "2025网络安全趋势报告.html" in result["content"]
    assert "网络安全与AI防御2025威胁态势.md" in result["content"]
    assert len(result["files"]) >= 2
```

- [ ] **Step 1: 创建 unit-test/test_e2e_search.py**

完整文件内容：

```python
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
```

- [ ] **Step 2: 运行语法检查**

```bash
python -m py_compile unit-test/test_e2e_search.py
```

- [ ] **Step 3: 提交**

```bash
git add unit-test/test_e2e_search.py
git commit -m "feat: add 25 SEARCH E2E tests"
```

---

## Task 4: 创建 test_e2e_ai.py - AI 测试

- 创建: `unit-test/test_e2e_ai.py`

### 测试用例清单 (10 个)

| 编号 | 问题摘要 | 预期关键词 | 优先级 |
|------|----------|------------|--------|
| AI-001 | 勒索软件2025年损失 | 300亿美元 | P0 |
| AI-002 | NIST后量子密码学标准 | ML-KEM, ML-DSA, SLH-DSA | P0 |
| AI-003 | 钙钛矿叠层电池效率 | 33.9%, 隆基绿能 | P0 |
| AI-004 | NIO ET7续航 | 1100km, 360 Wh/kg | P0 |
| AI-005 | Z世代焦虑检出率 | 31.2%, 24.8% | P1 |
| AI-006 | 固态vs液态电池能量密度 | 250-300 Wh/kg, 500-700 Wh/kg | P0 |
| AI-007 | 中国可再生能源里程碑 | 18.4亿千瓦 | P0 |
| AI-008 | 4-7-8呼吸法 | 4秒, 7秒, 8秒 | P1 |
| AI-009 | 宁德时代神行超充 | 5分钟充400公里, 600kW | P1 |
| AI-010 | 嫦娥六号采样 | 1935.3克, SPA盆地 | P1 |

### 测试模式

```python
# -*- coding: utf-8 -*-
"""AI 类 E2E 测试 - 10 个测试用例"""

import pytest

pytestmark = pytest.mark.asyncio


async def test_ai_001_ransomware_damage(pilot):
    """AI-001: 勒索软件2025年年损失金额"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "2025年勒索软件攻击造成的年损失金额大约是多少？",
        timeout=120
    )
    assert "300亿" in result["text"] or "300亿美元" in result["text"]
    assert "勒索软件" in result["text"].lower()
```

- [ ] **Step 1: 创建 unit-test/test_e2e_ai.py**

完整文件内容：

```python
# -*- coding: utf-8 -*-
"""AI 类 E2E 测试 - 10 个测试用例"""

import pytest
from conftest import wait_for_index_ready, run_ai_query

pytestmark = pytest.mark.asyncio


async def test_ai_001_ransomware_damage(pilot):
    """AI-001: 勒索软件2025年年损失金额"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "2025年勒索软件攻击造成的年损失金额大约是多少？",
        timeout=120
    )
    assert "300亿" in result["text"] or "300亿美元" in result["text"]
    assert "勒索软件" in result["text"].lower()


async def test_ai_002_nist_pqc_standards(pilot):
    """AI-002: NIST后量子密码学标准"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "NIST发布的后量子密码学标准有哪些？请列举名称和编号。",
        timeout=120
    )
    assert "ML-KEM" in result["text"] or "FIPS 203" in result["text"]
    assert "ML-DSA" in result["text"] or "FIPS 204" in result["text"]
    assert "SLH-DSA" in result["text"] or "FIPS 205" in result["text"]


async def test_ai_003_perovskite_efficiency(pilot):
    """AI-003: 钙钛矿叠层电池效率世界纪录"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "目前钙钛矿-硅叠层电池的效率世界纪录是多少？是哪个团队创造的？",
        timeout=120
    )
    assert "33.9%" in result["text"]
    assert "隆基" in result["text"]


async def test_ai_004_nio_et7_range(pilot):
    """AI-004: NIO ET7半固态电池续航里程"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "蔚来ET7搭载150kWh半固态电池版本的续航里程是多少？",
        timeout=120
    )
    assert "1100km" in result["text"] or "1100" in result["text"]
    assert "360" in result["text"] or "能量密度" in result["text"]


async def test_ai_005_gen_z_anxiety_rate(pilot):
    """AI-005: Z世代焦虑检出率"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "Z世代的焦虑检出率是多少？这个数据来源是什么？",
        timeout=120
    )
    assert "31.2%" in result["text"] or "31%" in result["text"]
    assert "抑郁" in result["text"] or "24.8%" in result["text"]


async def test_ai_006_battery_energy_density(pilot):
    """AI-006: 固态电池与液态锂电池能量密度对比"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "固态电池和液态锂电池的能量密度分别是多少？请做对比。",
        timeout=120
    )
    # 液态：250-300 Wh/kg，固态：500-700 Wh/kg
    text = result["text"]
    assert ("300" in text or "250" in text) and ("700" in text or "500" in text)


async def test_ai_007_renewable_milestone(pilot):
    """AI-007: 中国可再生能源装机里程碑"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "中国可再生能源装机容量在什么时候首次超过了火电？装机容量是多少？",
        timeout=120
    )
    assert "18.4亿" in result["text"] or "18.4" in result["text"]


async def test_ai_008_478_breathing(pilot):
    """AI-008: 4-7-8呼吸法"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "什么是4-7-8呼吸法？具体怎么操作？",
        timeout=120
    )
    text = result["text"]
    assert "4" in text and "7" in text and "8" in text


async def test_ai_009_catl_shixing_charging(pilot):
    """AI-009: 宁德时代神行超充性能参数"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "宁德时代神行超充电池最快几分钟可以充多少公里？峰值功率是多少？",
        timeout=120
    )
    text = result["text"]
    assert "5分钟" in text or "400" in text or "600kW" in text


async def test_ai_010_change6_sample(pilot):
    """AI-010: 嫦娥六号月球背面采样量"""
    await wait_for_index_ready(pilot)
    result = await run_ai_query(pilot,
        "嫦娥六号从月球背面采集了多少样品？采样地点在哪里？",
        timeout=120
    )
    text = result["text"]
    assert "1935" in text or "1935.3" in text
    assert "SPA" in text or "南极-艾特肯" in text or "盆地" in text
```

- [ ] **Step 2: 运行语法检查**

```bash
python -m py_compile unit-test/test_e2e_ai.py
```

- [ ] **Step 3: 提交**

```bash
git add unit-test/test_e2e_ai.py
git commit -m "feat: add 10 AI E2E tests"
```

---

## Task 5: 创建 test_e2e_watch.py - WATCH 测试

- 创建: `unit-test/test_e2e_watch.py`

### 测试用例清单 (12 个)

| 编号 | 场景 | 操作 | 预期 |
|------|------|------|------|
| WATCH-001 | 新增 .md 文件 | 创建带 marker 的 .md | 文件被索引 |
| WATCH-002 | 编辑文件 | 追加内容到已有文件 | 新内容可搜索 |
| WATCH-003 | 删除文件 | 删除测试文件 | 内容不再可搜索 |
| WATCH-004 | 移动文件 | 移动到子目录 | 新路径可搜索 |
| WATCH-005 | 新增 .html 文件 | 创建 .html | HTML 被索引 |
| WATCH-006 | 新增 .pdf 文件 | 创建 .pdf | PDF 被索引 |
| WATCH-007 | 重命名文件 | 重命名 .md | 新文件名可搜索 |
| WATCH-008 | 批量变更 | 同时创建3个文件 | 全部被索引 |
| WATCH-009 | 编辑后即时查询 | 编辑后立即搜索 | 新内容可搜索 |
| WATCH-010 | 删除后重建 | 删除再创建同名 | 新内容可搜索 |
| WATCH-011 | 新子目录 | 在新目录创建文件 | 新路径可搜索 |
| WATCH-012 | 移动到新目录 | 移动到新建目录 | 新路径可搜索 |

### 测试模式

```python
# -*- coding: utf-8 -*-
"""WATCH 类 E2E 测试 - 12 个测试用例"""

import pytest

pytestmark = pytest.mark.asyncio


async def test_watch_001_new_file(pilot, test_data_dir):
    """WATCH-001: 新增 .md 文件后 watchdog 自动重建索引"""
    await wait_for_index_ready(pilot)

    # 创建测试文件
    test_file = test_data_dir / "e2e_test_new_001.md"
    test_file.write_text(
        "E2E_TEST_MARKER_001: 量子纠缠态在量子通信中的应用前景广阔。"
    )

    try:
        found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_001", timeout=30)
        assert found, "文件未被索引"
        result = await run_search(pilot, "E2E_TEST_MARKER_001")
        assert "e2e_test_new_001.md" in result["content"]
    finally:
        # 清理
        if test_file.exists():
            test_file.unlink()
```

- [ ] **Step 1: 创建 unit-test/test_e2e_watch.py**

完整文件内容：

```python
# -*- coding: utf-8 -*-
"""WATCH 类 E2E 测试 - 12 个测试用例"""

import pytest
from conftest import wait_for_index_ready, run_search, wait_for_file_indexed

pytestmark = pytest.mark.asyncio


async def test_watch_001_new_file(pilot, test_data_dir):
    """WATCH-001: 新增 .md 文件后 watchdog 自动重建索引"""
    await wait_for_index_ready(pilot)

    test_file = test_data_dir / "e2e_test_new_001.md"
    test_file.write_text(
        "E2E_TEST_MARKER_001: 量子纠缠态在量子通信中的应用前景广阔。"
    )

    try:
        found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_001", timeout=30)
        assert found, "文件未被索引"
        result = await run_search(pilot, "E2E_TEST_MARKER_001")
        assert "e2e_test_new_001.md" in result["content"]
    finally:
        if test_file.exists():
            test_file.unlink()


async def test_watch_002_edit_file(pilot, test_data_dir):
    """WATCH-002: 编辑已有 .md 文件后索引自动更新"""
    await wait_for_index_ready(pilot)

    test_file = test_data_dir / "科技" / "5G与6G通信技术发展.md"
    original_content = test_file.read_text()

    try:
        # 追加内容
        test_file.write_text(
            original_content + "\n<!-- E2E_TEST_MARKER_002: 太赫兹通信在6G时代将实现0.1ms超低时延 -->"
        )

        found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_002", timeout=30)
        assert found, "编辑后文件未被索引"
        result = await run_search(pilot, "E2E_TEST_MARKER_002")
        assert "5G与6G通信技术发展.md" in result["content"]
        assert "太赫兹通信" in result["content"]
    finally:
        # 恢复原内容
        test_file.write_text(original_content)


async def test_watch_003_delete_file(pilot, test_data_dir):
    """WATCH-003: 删除 .md 文件后索引自动更新"""
    await wait_for_index_ready(pilot)

    test_file = test_data_dir / "e2e_test_delete_me.md"
    test_file.write_text(
        "E2E_TEST_MARKER_003: 光子晶体光纤在传感和通信领域有重要应用价值。"
    )

    # 等待索引
    await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_003", timeout=30)

    # 确认可以搜索到
    result_before = await run_search(pilot, "光子晶体光纤")
    assert "e2e_test_delete_me.md" in result_before["content"]

    # 删除文件
    test_file.unlink()

    # 等待 reindex
    await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_003", timeout=30)

    # 确认搜索不到
    result_after = await run_search(pilot, "光子晶体光纤")
    assert "e2e_test_delete_me.md" not in result_after["content"]


async def test_watch_004_move_file(pilot, test_data_dir):
    """WATCH-004: 移动 .md 文件到其他目录后索引自动更新"""
    await wait_for_index_ready(pilot)

    src_file = test_data_dir / "e2e_test_move.md"
    dst_file = test_data_dir / "科技" / "e2e_test_move.md"

    src_file.write_text(
        "E2E_TEST_MARKER_004: 超导量子比特的退相干时间是量子计算性能的关键指标。"
    )

    try:
        await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_004", timeout=30)

        # 移动文件
        dst_file.parent.mkdir(exist_ok=True)
        src_file.rename(dst_file)

        # 等待 reindex
        await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_004", timeout=30)

        result = await run_search(pilot, "E2E_TEST_MARKER_004")
        assert "e2e_test_move.md" in result["content"]
    finally:
        if dst_file.exists():
            dst_file.unlink()


async def test_watch_005_new_html_file(pilot, test_data_dir):
    """WATCH-005: 新增 .html 文件后 watchdog 自动重建索引"""
    await wait_for_index_ready(pilot)

    test_file = test_data_dir / "科技" / "e2e_test_new_005.html"
    test_file.write_text("""
    <html><body>
    <h1>E2E测试HTML文档</h1>
    <p>E2E_TEST_MARKER_005: 拓扑绝缘体是一类具有绝缘体内部但导电表面的特殊材料。</p>
    </body></html>
    """)

    try:
        found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_005", timeout=30)
        assert found, "HTML文件未被索引"
        result = await run_search(pilot, "E2E_TEST_MARKER_005")
        assert "e2e_test_new_005.html" in result["content"]
        assert "拓扑绝缘体" in result["content"]
    finally:
        if test_file.exists():
            test_file.unlink()


async def test_watch_006_new_pdf_file(pilot, test_data_dir):
    """WATCH-006: 新增 .pdf 文件后 watchdog 自动重建索引"""
    await wait_for_index_ready(pilot)

    test_file = test_data_dir / "科技" / "e2e_test_new_006.pdf"
    # 写入简单的 PDF 内容（实际 PDF 格式）
    test_file.write_bytes(b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
195
%%EOF
BT
/E2E_TEST_MARKER_006: 神经形态计算模仿生物神经网络。
ET""")

    try:
        found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_006", timeout=30)
        assert found, "PDF文件未被索引"
        result = await run_search(pilot, "E2E_TEST_MARKER_006")
        assert "e2e_test_new_006.pdf" in result["content"]
    finally:
        if test_file.exists():
            test_file.unlink()


async def test_watch_007_rename_file(pilot, test_data_dir):
    """WATCH-007: 重命名 .md 文件后索引自动更新"""
    await wait_for_index_ready(pilot)

    src_file = test_data_dir / "e2e_test_rename_original.md"
    dst_file = test_data_dir / "e2e_test_rename_new.md"

    src_file.write_text(
        "E2E_TEST_MARKER_007: 光量子计算利用光子作为量子比特。"
    )

    try:
        await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_007", timeout=30)

        # 重命名文件
        src_file.rename(dst_file)

        # 等待 reindex
        await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_007", timeout=30)

        result = await run_search(pilot, "E2E_TEST_MARKER_007")
        assert "e2e_test_rename_new.md" in result["content"]
        assert "e2e_test_rename_original.md" not in result["content"]
    finally:
        if dst_file.exists():
            dst_file.unlink()


async def test_watch_008_batch_changes(pilot, test_data_dir):
    """WATCH-008: 同时修改多个文件后 watchdog 合并处理"""
    await wait_for_index_ready(pilot)

    files = [
        test_data_dir / "e2e_batch_001.md",
        test_data_dir / "e2e_batch_002.md",
        test_data_dir / "e2e_batch_003.md",
    ]

    contents = [
        "E2E_BATCH_MARKER: 石墨烯热导率高达5300 W/mK",
        "E2E_BATCH_MARKER: 碳纳米管抗拉强度是钢的100倍",
        "E2E_BATCH_MARKER: 二维材料过渡金属硫族化合物具有可调带隙",
    ]

    try:
        for f, c in zip(files, contents):
            f.write_text(c)

        await wait_for_file_indexed(pilot, "E2E_BATCH_MARKER", timeout=45)

        result = await run_search(pilot, "E2E_BATCH_MARKER")
        assert "e2e_batch_001.md" in result["content"]
        assert "e2e_batch_002.md" in result["content"]
        assert "e2e_batch_003.md" in result["content"]
        assert "石墨烯" in result["content"]
        assert "碳纳米管" in result["content"]
        assert "二维材料" in result["content"]
    finally:
        for f in files:
            if f.exists():
                f.unlink()


async def test_watch_009_immediate_query(pilot, test_data_dir):
    """WATCH-009: 编辑文件后立即搜索验证索引更新的即时性"""
    await wait_for_index_ready(pilot)

    test_file = test_data_dir / "e2e_test_immediate.md"
    test_file.write_text("E2E_TEST_MARKER_009_INITIAL: 初始内容标记")

    try:
        await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_009_INITIAL", timeout=30)

        # 确认初始内容可搜索
        result_initial = await run_search(pilot, "E2E_TEST_MARKER_009_INITIAL")
        assert "e2e_test_immediate.md" in result_initial["content"]

        # 编辑文件，追加新内容
        test_file.write_text(
            "E2E_TEST_MARKER_009_INITIAL: 初始内容标记\n"
            "E2E_TEST_MARKER_009_UPDATED: 更新内容标记 - 超导约瑟夫森结可用于量子比特实现"
        )

        # 立即搜索（不等 reindex）
        found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_009_UPDATED", timeout=60)
        assert found, "更新内容未被索引"

        result_updated = await run_search(pilot, "E2E_TEST_MARKER_009_UPDATED")
        assert "e2e_test_immediate.md" in result_updated["content"]
        assert "超导约瑟夫森结" in result_updated["content"]
    finally:
        if test_file.exists():
            test_file.unlink()


async def test_watch_010_delete_and_recreate(pilot, test_data_dir):
    """WATCH-010: 删除文件后再添加同名文件验证索引正确处理"""
    await wait_for_index_ready(pilot)

    test_file = test_data_dir / "e2e_test_cycle.md"

    # V1
    test_file.write_text("E2E_CYCLE_V1: 第一版内容 - 拓扑量子比特基于马约拉纳零能态")
    await wait_for_file_indexed(pilot, "E2E_CYCLE_V1", timeout=30)

    result_v1 = await run_search(pilot, "E2E_CYCLE_V1")
    assert "e2e_test_cycle.md" in result_v1["content"]

    # 删除
    test_file.unlink()
    await wait_for_file_indexed(pilot, "E2E_CYCLE_V1", timeout=30)

    result_v1_deleted = await run_search(pilot, "E2E_CYCLE_V1")
    assert "e2e_test_cycle.md" not in result_v1_deleted["content"]

    # V2
    test_file.write_text("E2E_CYCLE_V2: 第二版内容 - 离子阱量子计算使用电磁场囚禁离子")
    await wait_for_file_indexed(pilot, "E2E_CYCLE_V2", timeout=30)

    result_v2 = await run_search(pilot, "E2E_CYCLE_V2")
    assert "e2e_test_cycle.md" in result_v2["content"]
    assert "离子阱量子计算" in result_v2["content"]


async def test_watch_011_new_subdirectory(pilot, test_data_dir):
    """WATCH-011: 在新创建的子目录中添加 .md 文件后监控生效"""
    await wait_for_index_ready(pilot)

    new_dir = test_data_dir / "e2e_new_category"
    new_dir.mkdir(exist_ok=True)

    test_file = new_dir / "test.md"
    test_file.write_text(
        "E2E_TEST_MARKER_011: 量子退火是一种利用量子涨落寻找最优解的启发式方法。"
    )

    try:
        found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_011", timeout=30)
        assert found, "新子目录中的文件未被索引"
        result = await run_search(pilot, "E2E_TEST_MARKER_011")
        assert "e2e_new_category" in result["content"] or "test.md" in result["content"]
        assert "量子退火" in result["content"]
    finally:
        if test_file.exists():
            test_file.unlink()
        if new_dir.exists():
            import shutil
            shutil.rmtree(new_dir)


async def test_watch_012_move_to_new_directory(pilot, test_data_dir):
    """WATCH-012: 移动文件到新创建的目录后索引正确更新"""
    await wait_for_index_ready(pilot)

    src_file = test_data_dir / "e2e_test_moveto_new.md"
    dst_dir = test_data_dir / "e2e_archive"
    dst_dir.mkdir(exist_ok=True)
    dst_file = dst_dir / "e2e_test_moveto_new.md"

    src_file.write_text(
        "E2E_TEST_MARKER_012: 光学频率梳在精密测量和光钟技术中发挥关键作用。"
    )

    try:
        await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_012", timeout=30)

        # 移动到新目录
        src_file.rename(dst_file)

        # 等待 reindex
        await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_012", timeout=30)

        result = await run_search(pilot, "E2E_TEST_MARKER_012")
        assert "e2e_archive" in result["content"] or "e2e_test_moveto_new.md" in result["content"]
        assert "光学频率梳" in result["content"]
    finally:
        if dst_file.exists():
            dst_file.unlink()
        if dst_dir.exists():
            import shutil
            shutil.rmtree(dst_dir)
```

- [ ] **Step 2: 运行语法检查**

```bash
python -m py_compile unit-test/test_e2e_watch.py
```

- [ ] **Step 3: 提交**

```bash
git add unit-test/test_e2e_watch.py
git commit -m "feat: add 12 WATCH E2E tests"
```

---

## Task 6: 验证测试可运行

- [ ] **Step 1: 运行 SEARCH 测试 (示例)**

```bash
cd /c/Users/lianghao/github/cortex
pytest unit-test/test_e2e_search.py::test_search_001_ransomware -v --timeout=120 2>&1 | head -50
```

- [ ] **Step 2: 检查导入错误**

```bash
pytest unit-test/ --collect-only 2>&1 | head -100
```

- [ ] **Step 3: 如有错误，根据错误信息修复**

---

## Task 7: 最终提交和整合

- [ ] **Step 1: 确保所有文件在 git 中**

```bash
git status
```

- [ ] **Step 2: 推送所有 commits**

```bash
git push origin main
```

---

## 实施顺序

1. Task 1: 创建目录和移动文件 (独立)
2. Task 2: conftest.py (为后续测试提供 fixtures)
3. Task 3: test_e2e_search.py (核心功能测试)
4. Task 4: test_e2e_ai.py (AI 功能测试)
5. Task 5: test_e2e_watch.py (文件监控测试)
6. Task 6: 验证测试可运行
7. Task 7: 最终提交

---
