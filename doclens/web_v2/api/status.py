"""GET /api/status -- 系统状态。"""
from pathlib import Path

from fastapi import APIRouter, Depends

from doclens.diary import diary_dir
from doclens.file_watcher import FileWatcher
from doclens.index_manager import IndexManager
from doclens.web_v2 import deps
from doclens.web_v2.deps import (
    get_config,
    get_watcher,
    sync_snapshot,
)

router = APIRouter()


def _status_payload(idx: IndexManager | None) -> dict:
    """组装 status 字段；idx 为 None（启动审计/建库窗口）时降级。

    降级字段全部从 config / deps 单例派生，不触碰索引 DB——workdir /
    model_name / diary_enabled 等轻字段在审计完成前即可返回（前端
    welcome-pane 的 workdir 胶囊不必陪启动审计等 20s+）。计数类字段
    给 0 占位，与索引未建时的语义一致（前端无渲染消费）。
    """
    cfg = get_config()
    if idx is None:
        workdir = cfg.search_path
        index_path = str(deps._index_path_placeholder(cfg))
        indexed_docs, registered_docs = 0, 0
        total_size, type_counts = 0, {}
        last_failed, building = 0, False
        vision_status: dict = {}
    else:
        workdir = str(idx.search_path)
        index_path = str(idx.index_path)
        # DB 轻量查询 + 进程内缓存（ADR-0018）：50 万语料全量 stat 要 90s+，
        # 缓存键 = DB 文档计数，索引变化才重算。两种计数单次 get_stats
        # 往返取回（分开调各自 ~1s）。file_stats 非阻塞取（冷缓存返回占位
        # 0/{} + 后台预热——total_size/file_types 前端无渲染消费，不值得
        # 让 workdir 等轻字段陪全量 stat 一起等）。
        indexed_docs, registered_docs = idx.index_counts()
        warmed = idx.file_stats_nonblocking()
        total_size, type_counts = warmed if warmed is not None else (0, {})
        last_failed = idx.last_failed_count
        building = idx.building
        vision_status = idx.vision_status()
    watcher_obj = get_watcher()
    return {
        "indexed_docs": indexed_docs,
        "registered_docs": registered_docs,  # 仅登记（ghost 行，ADR-0034）
        "index_failed_count": last_failed,
        # 首次建库后台化（ADR-0043）：True 时前端显示「索引构建中」
        "index_building": building,
        "index_path": index_path,
        "workdir": workdir,
        "total_size_bytes": total_size,
        "file_types": type_counts,
        # 日记启用事实源（ADR-0030）：目录存在即启用（空目录也算——
        # 入口先于内容）；启动判定一次，前端据此显隐日记 tab
        "diary_enabled": diary_dir(Path(workdir)).is_dir(),
        # 展示名（前端「{model} 思考中」等）：优先激活 LLM 预设名（可读），
        # 未激活预设时回退裸 model id。两者都空时不展示模型名前缀。
        "model_name": cfg.active_llm_preset or cfg.planify_model_id or "",
        # 对话 LLM 视觉能力位（ADR-0034 视觉路由）：false 时前端拦截带图
        # 消息并引导切换模型
        "llm_vision": bool(getattr(cfg, "llm_vision", False)),
        "watcher": {
            "enabled": cfg.watch_enabled,
            # watcher 未启动时回退到 FileWatcher.DEFAULT_STATUS——单一真源，
            # 不在此处手抄字面量（避免 status() 加字段时此兜底静默漂移）
            **(watcher_obj.status() if watcher_obj is not None else dict(FileWatcher.DEFAULT_STATUS)),
        },
        # Git 同步快照（ADR-0006）；None = 同步循环未注册（配置关闭）
        "sync": sync_snapshot(),
        # vision 处理状态（工单 09）：队列计数 + write_back 失败计数
        "vision": vision_status,
        # 工作目录热切换状态（ADR-0043）：前端遮罩据此显隐
        "swap": deps.swap_status(),
    }


@router.get("/status")
async def status(idx: IndexManager | None = Depends(deps.try_get_index_manager)):
    return _status_payload(idx)
