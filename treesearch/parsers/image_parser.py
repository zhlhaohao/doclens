# -*- coding: utf-8 -*-
"""独立图像文件 parser —— 占位节点，真正的视觉解析由后台 Vision Worker 完成。

架构（见 docs/adr/0001-vision-image-indexing.md）：
视觉识别耗时长，不能拖慢主索引。本 parser 不调任何视觉 API，只产出
「占位节点」树（标题=文件名，保证文件名立即可搜索），并通过
``result["vision_pending"]`` 标记通知 indexer 把文件写入 vision_queue 表；
宿主侧的 VisionWorker（如 doclens）后台串行消费队列，拿到视觉模型输出的
Markdown 后复用 ``md_to_tree`` 建树，原位替换占位节点。
"""
import logging
import os

from ..indexer import md_to_tree

logger = logging.getLogger(__name__)

# 独立图像文件扩展名 —— 仅这四种走 vision 解读 + 元数据写回（ADR-0009 / 工单 07）。
# gif/bmp/tiff/tif 不再作为图像处理（不 image_to_tree、不占位、不入 vision 队列）；
# svg 是文本走 code/xml，不在此列。
IMAGE_EXTENSIONS: frozenset[str] = frozenset({
    ".png", ".jpg", ".jpeg", ".webp",
})

# 占位节点正文（解析完成后被视觉模型输出的 Markdown 原位替换）
PLACEHOLDER_TEXT = "（图像文件已登记，等待后台视觉解析；当前仅文件名可搜索）"


async def image_to_tree(image_path: str, **kwargs) -> dict:
    """为图像文件构建树：已有解读就读回、否则占位入队。

    - **已有 vision 解读元数据**（``read_back`` 命中）：用解读 Markdown 走 ``md_to_tree``
      建树，**不设** ``vision_pending``（indexer 据此跳过入队）——这是 force 重建不重花
      API 的闭环（ADR-0009 / 工单 04）。
    - **无解读**：单个 ``# <文件名>`` 根节点 + 占位正文，设 ``vision_pending`` 入队
      让 Vision Worker 后台解析。

    走 ``md_to_tree`` 以获得与其他类型一致的 node_id / summary 后处理。
    """
    from .image_metadata import read_back

    abs_path = os.path.abspath(image_path)
    doc_name = os.path.splitext(os.path.basename(image_path))[0]

    payload = read_back(abs_path)
    markdown = payload["markdown"] if payload and payload.get("markdown") else None
    pending = markdown is None
    if pending:
        markdown = f"# {doc_name}\n\n{PLACEHOLDER_TEXT}\n"

    result = await md_to_tree(md_content=markdown, **kwargs)
    # md_to_tree(md_content=...) 的 doc_name 是 "untitled"，且没有 source_path，
    # 这里补上真实值，保证增量索引 / preview 反查正常工作。
    result["doc_name"] = doc_name
    result["source_path"] = abs_path
    if pending:
        # 通知 indexer._index_one 写入 vision_queue（worker 据此后台解析）
        result["vision_pending"] = True
    return result
