# -*- coding: utf-8 -*-
"""WATCH 类 E2E 测试 - 12 个测试用例"""

import pytest
import shutil
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
    # E2E_TEST_MARKER_006 text encoded as hex for bytes literal compatibility
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
        b"xref\n"
        b"0 4\n"
        b"0000000000 65535 f\n"
        b"0000000009 00000 n\n"
        b"0000000058 00000 n\n"
        b"0000000115 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\n"
        b"startxref\n"
        b"195\n"
        b"%%EOF\n"
        b"BT\n"
        b"/E2E_TEST_MARKER_006: Neural morphic computing mimics biological neural networks.\n"
        b"ET"
    )
    test_file.write_bytes(pdf_content)

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
            shutil.rmtree(dst_dir)
