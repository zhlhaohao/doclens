"""GET /api/status -- 系统状态。"""
import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends

from doclens.diary import diary_dir
from doclens.file_watcher import FileWatcher
from doclens.index_manager import IndexManager
from doclens.web_v2 import deps
from doclens.web_v2.deps import get_config, get_index_manager, get_watcher, sync_snapshot

router = APIRouter()


@router.get("/status")
async def status(idx: IndexManager = Depends(get_index_manager)):
    # DB 轻量查询 + 进程内缓存（ADR-0018）：50 万语料全量 stat 要 90s+，
    # 缓存键 = DB 文档计数，索引变化才重算。
    indexed_docs = idx.indexed_doc_count()
    registered_docs = idx.registered_doc_count()
    # 缓存未命中时 file_stats 对全部索引文档做磁盘 stat（28.5 万条实测
    # ~24s）——同步跑在 async handler 里会冻结事件循环，期间所有请求
    # （含 /files/list，前端表现「加载中」不消失）全部挂起。丢线程池
    # （与 /files/list 的 to_thread 同律）。
    total_size, type_counts = await asyncio.to_thread(idx.file_stats)
    watcher_obj = get_watcher()
    cfg = get_config()
    return {
        "indexed_docs": indexed_docs,
        "registered_docs": registered_docs,  # 仅登记（ghost 行，ADR-0034）
        "index_failed_count": idx.last_failed_count,
        # 首次建库后台化（ADR-0043）：True 时前端显示「索引构建中」
        "index_building": idx.building,
        "index_path": str(idx.index_path),
        "workdir": str(idx.search_path),
        "total_size_bytes": total_size,
        "file_types": type_counts,
        # 日记启用事实源（ADR-0030）：目录存在即启用（空目录也算——
        # 入口先于内容）；启动判定一次，前端据此显隐日记 tab
        "diary_enabled": diary_dir(Path(idx.search_path)).is_dir(),
        # 当前 AI 模型 id（用于前端展示「{model} 思考中」），可能为空
        # （用户未设置 PLANIFY_MODEL_ID 时不展示模型名前缀）
        "model_name": cfg.planify_model_id or "",
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
        "vision": idx.vision_status(),
        # 工作目录热切换状态（ADR-0043）：前端遮罩据此显隐
        "swap": deps.swap_status(),
    }
