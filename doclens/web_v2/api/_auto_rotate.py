"""上传图片后台判向旋转的公共接线（ADR-0017）。

两条上传入口（files.py / diary.py）共用：落盘后把判向旋转挂到
Starlette BackgroundTasks（同步函数自动进 threadpool，不阻塞响应）。

旋转成功后的收尾：
- 删除 vision_queue 中该图的残留行——上传落盘触发的增量索引可能已把
  歪图入队，旋转后文件指纹变化会被 watcher 重新入队，残留行不删会让
  VisionWorker 在歪图上白转写一次；
- 经 WatchBroker 广播 image_rotated 事件 → SSE → 前端 toast。
"""
from __future__ import annotations

import logging
from pathlib import Path

from doclens.image_orienter import ORIENTABLE_IMAGE_EXTS, auto_rotate_image

logger = logging.getLogger(__name__)


def auto_rotate_enabled(config) -> bool:
    """判向旋转是否可用：开关打开 + 已配置视觉 API。"""
    return bool(
        getattr(config, "vision_auto_rotate", False)
        and getattr(config, "vision_api_key", None)
    )


def schedule_auto_rotate(background_tasks, abs_path: Path, rel_path: str,
                         index_path, config) -> bool:
    """满足条件则把判向旋转挂到 BackgroundTasks，返回是否已挂（未挂=不处理）。"""
    if not auto_rotate_enabled(config):
        return False
    if abs_path.suffix.lower() not in ORIENTABLE_IMAGE_EXTS:
        return False
    background_tasks.add_task(run_auto_rotate, abs_path, rel_path, index_path)
    return True


def run_auto_rotate(abs_path: Path, rel_path: str, index_path) -> None:
    """后台执行体（threadpool）：判向 → 旋转 → 清队列残留 + 广播事件。"""
    from doclens.web_v2.deps import get_config

    try:
        rotated = auto_rotate_image(abs_path, get_config())
    except Exception as e:  # noqa: BLE001 — 后台任务兜底，任何意外都不上抛
        logger.info("auto-rotate failed for %s: %s", rel_path, e)
        return
    if not rotated:
        return
    drop_vision_queue_row(abs_path, index_path)
    broadcast_rotated(rel_path)


def drop_vision_queue_row(abs_path: Path, index_path) -> None:
    """删 vision_queue 残留行（防歪图白转写）；失败降级（重建会兜底）。"""
    try:
        from treesearch.fts import FTS5Index

        fts = FTS5Index(db_path=index_path)
        try:
            fts.vision_remove(str(abs_path))
            fts.commit()
        finally:
            fts.close()
    except Exception as e:  # noqa: BLE001
        logger.debug("drop vision queue row failed for %s: %s", abs_path, e)


def broadcast_rotated(rel_path: str) -> None:
    """经 WatchBroker 广播 image_rotated（线程安全；无 SSE 客户端时为空操作）。"""
    try:
        from doclens.web_v2.watch_broker import get_watch_broker

        get_watch_broker().broadcast("image_rotated", {"path": rel_path})
    except Exception as e:  # noqa: BLE001
        logger.debug("broadcast image_rotated failed: %s", e)
