# -*- coding: utf-8 -*-
"""Cortex TUI E2E 测试共享 fixtures"""

import asyncio
import os
import re
import time
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# 确保导入路径正确
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from cortex.tui.app import CortexApp
from cortex.tui.widgets.content_area import ContentArea
from cortex.tui.widgets.status_bar import StatusBar
from cortex.index_manager import IndexManager
from cortex.config import CortexConfig


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


@pytest.fixture
async def cortex_app(test_data_dir, tmp_path):
    """
    创建 CortexApp 实例用于测试。

    不预构建索引，让 app 自己启动时构建。
    禁用文件监控以确保测试可重复。
    """
    # 创建临时 .cortex 目录用于索引
    cortex_dir = tmp_path / ".cortex"
    cortex_dir.mkdir(exist_ok=True)

    # 确保 search_path 存在
    assert test_data_dir.exists(), f"test_work_dir not found: {test_data_dir}"

    index_path = str(cortex_dir / "index.db")

    # 创建真实配置
    config = CortexConfig(
        search_path=str(test_data_dir),
        index_path=index_path,
        watch_enabled=False,  # E2E tests disable file watching
        watch_debounce=5.0,
    )

    # Patch Config 和 check_dependencies，但不 Patch IndexManager
    with patch("cortex.tui.app.CortexConfig.load", return_value=config), \
         patch("cortex.tui.app.check_dependencies", return_value=[]):

        app = CortexApp()

        async with app.run_test() as pilot:
            # 等待索引构建完成
            status_bar = pilot.app.query_one(StatusBar)
            start = time.time()
            timeout = 120  # 最多等2分钟让索引构建

            print(f"\n[E2E] Waiting for index to build...")

            # 等待索引构建：检查 status-bar 组件的显示内容
            while time.time() - start < timeout:
                await pilot.pause(1)

                # 获取实际显示的文本（从 Static 组件）
                try:
                    status_widget = status_bar.query_one("#status-right")
                    display_text = status_widget.renderable if hasattr(status_widget, 'renderable') else str(status_widget)
                    # Rich Text object has .plain attribute
                    if hasattr(display_text, 'plain'):
                        display_text = display_text.plain
                except Exception:
                    display_text = ""

                # 检查是否包含索引完成标记
                if "索引:" in display_text and "索引中" not in display_text:
                    print(f"[E2E] Index ready: {display_text}")
                    break
                if display_text == "就绪" and time.time() - start > 10:
                    # 等了超过10秒还是就绪，可能索引为空
                    print(f"[E2E] Status still '就绪' after {time.time() - start:.1f}s, continuing...")
                    break

            yield pilot


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def get_content_text(content: ContentArea) -> str:
    """从 ContentArea 提取所有纯文本"""
    lines = []
    try:
        # 尝试从 RichLog 的内部结构提取文本
        for node in content.walk():
            if hasattr(node, 'plain') and callable(node.plain):
                try:
                    text = node.plain
                    if text:
                        lines.append(text)
                except Exception:
                    pass
    except Exception:
        pass

    # Fallback: 尝试通过 render 方法获取文本
    if not lines:
        try:
            from io import StringIO
            from rich.console import Console
            buf = StringIO()
            console = Console(file=buf, force_terminal=False, width=200, markup=False)
            console.print(content)
            return buf.getvalue()
        except Exception:
            pass

    return "\n".join(lines)


async def wait_for_index_ready(pilot, timeout=120):
    """等待 StatusBar 显示 '索引: N 文档' (表示索引已加载)"""
    status_bar = pilot.app.query_one(StatusBar)
    start = time.time()
    while time.time() - start < timeout:
        try:
            status_widget = status_bar.query_one("#status-right")
            display_text = status_widget.renderable if hasattr(status_widget, 'renderable') else str(status_widget)
            if hasattr(display_text, 'plain'):
                display_text = display_text.plain
        except Exception:
            display_text = ""

        if "索引:" in display_text and "索引中" not in display_text:
            return True
        await pilot.pause(1)
    return False


async def run_search(pilot, query: str) -> dict:
    """执行 /s {query}，返回 {"files": [...], "content": str}"""
    cmd_input = pilot.app.query_one("#cmd-input")
    cmd_input.focus()
    cmd_input.value = f"/s {query}"
    await pilot.press("enter")
    await pilot.pause(5)  # 等待搜索完成

    content = pilot.app.query_one(ContentArea)
    text = get_content_text(content)
    print(f"[DEBUG] Search content for '{query}': {text[:200] if text else '(empty)'}")
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
        try:
            status_widget = status_bar.query_one("#status-right")
            display_text = status_widget.renderable if hasattr(status_widget, 'renderable') else str(status_widget)
            if hasattr(display_text, 'plain'):
                display_text = display_text.plain
        except Exception:
            display_text = ""

        if "Agent: 思考中" not in display_text:
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
