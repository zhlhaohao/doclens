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