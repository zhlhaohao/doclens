"""Cortex Web v2 — FastAPI 应用入口。

`create_app()` 构造 FastAPI 实例；`launch_app()` 用 uvicorn 启动并同时
服务前端 SPA 静态文件（详见 Task 29）。
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse

from doclens import __version__ as CORTEX_VERSION
from doclens.web_v2.api.errors import register_error_handlers

# 后端进程启动时刻（模块导入时）：/api/health 返回给关于弹窗——
# 测试者据此确认后端重启过（version 相同时仍有新旧进程之别）。
from datetime import datetime, timezone

_STARTED_AT = datetime.now(timezone.utc).isoformat(timespec="seconds")

STATIC_DIR = Path(__file__).parent / "static"

# 后端源码目录（editable/源码运行 = 仓库源码；pip 安装 = site-packages 副本）
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SOURCE_DIRS = [
    _REPO_ROOT / "doclens",
    _REPO_ROOT / "treesearch",
    _REPO_ROOT / "planify",
]
# 开发模式 = 源码树运行（仓库根有 pyproject.toml）。pip 安装的
# site-packages 副本无 pyproject → 发行版。关于页据此只显示版本号、
# 裁剪调试信息（前端构建 / bundle / 代码状态）。
_DEV_MODE = (_REPO_ROOT / "pyproject.toml").exists()


def _code_mtime() -> str:
    """后端 .py 源码的最后修改时间（doclens/treesearch/planify 全量扫描）。

    与启动时间对比即可回答「后端跑的是不是最新代码」：
    启动晚于修改 = 已加载；启动早于修改 = 改了代码没重启（editable
    install 改源码立即生效的前提是重启进程）。每次 health 请求实时
    扫描（~百个文件的 stat，ms 级），能反映打开关于页那一刻的状态。
    发行版（site-packages）mtime = 安装时刻，恒早于启动 → 恒为已加载。
    """
    latest = 0.0
    try:
        for d in _SOURCE_DIRS:
            for py in d.rglob("*.py"):
                m = py.stat().st_mtime
                if m > latest:
                    latest = m
    except OSError:
        pass
    if latest <= 0:
        return "?"
    return datetime.fromtimestamp(latest, tz=timezone.utc).isoformat(timespec="seconds")


def _enable_treesearch_console_logging() -> None:
    """gui 启动时让 treesearch 的 INFO+ 日志额外输出到 stderr（命令行可见）。

    setup_logging 默认 console_output=False，索引进度只写日志文件；这里为
    treesearch 单独挂一个控制台 handler，PST 解析等细粒度进度（如
    ``pst-extract progress ... N emails``、``Building indexes for N file(s)``）
    在命令行实时可见，不波及其他模块（uvicorn / 第三方库仍只进文件）。
    """
    import logging
    import sys

    ts_logger = logging.getLogger("treesearch")
    if any(getattr(h, "_cortex_ts_console", False) for h in ts_logger.handlers):
        return  # 幂等：launch_app 重复调用（如 Stop hook 自动重启）不重复挂 handler
    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(logging.INFO)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    )
    handler._cortex_ts_console = True  # 标记防重复
    ts_logger.addHandler(handler)
    ts_logger.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动文件监控 + 视觉解析 worker + Git 同步 + MCP server，退出时停止。

    组件启动放后台线程、lifespan 立即 yield——bind 后立刻能 accept 请求。
    （旧版在事件循环上同步调 get_index_manager 等 20s+ 启动审计，百万语料
    下 socket 已监听但 accept 循环被堵死，浏览器无限转圈。）
    """
    import asyncio
    import threading
    from doclens.web_v2 import deps
    from doclens.web_v2.watch_broker import get_watch_broker
    # 先绑定事件循环，保证 start_watcher 的回调触发时 broadcast 可用
    get_watch_broker().bind(asyncio.get_running_loop())

    def _start_components() -> None:
        from pathlib import Path
        from doclens.web_v2.tmp_workspace import cleanup_all_tmp
        # 启动时清空 AI 会话临时工作区（.cortex/tmp/）——上轮运行残留的脚本/中间产物
        cleanup_all_tmp(Path(deps.get_index_manager().search_path))
        deps.start_watcher()
        deps.start_vision_worker()
        deps.start_diary_worker()
        deps.start_git_sync()
        try:
            import asyncio as _aio
            _aio.run(deps.start_mcp_server())
        except Exception as e:  # noqa: BLE001
            from doclens.web_v2.app import logger
            logger.warning("start_mcp_server failed: %s", e)
        deps.start_mcp_client()

    threading.Thread(target=_start_components, daemon=True).start()
    try:
        yield
    finally:
        deps.stop_mcp_client()
        deps.stop_mcp_server()
        deps.stop_git_sync()
        deps.stop_diary_worker()
        deps.stop_vision_worker()
        deps.stop_watcher()


def create_app() -> FastAPI:
    """构造 FastAPI 应用（注册路由、错误处理器、静态文件）。

    登录闸门按**请求来源 IP** 判定（见 ``auth_gate``），与绑定地址无关；
    监听地址由 ``launch_app`` 的 ``uvicorn.run(host=...)`` 负责。
    """
    app = FastAPI(title="Cortex", version=CORTEX_VERSION, lifespan=lifespan)

    # 错误处理
    register_error_handlers(app)

    # 登录闸门（须在 router 注册前；只拦 /api/*，豁免 /api/health 与 /api/auth/*）
    from doclens.web_v2.auth_middleware import register_auth_middleware
    register_auth_middleware(app)

    # API 路由（后续任务逐步挂载）
    from doclens.web_v2.api import auth
    app.include_router(auth.router, prefix="/api")
    from doclens.web_v2.api import search
    app.include_router(search.router, prefix="/api")
    from doclens.web_v2.api import preview
    app.include_router(preview.router, prefix="/api")
    from doclens.web_v2.api import pst
    app.include_router(pst.router, prefix="/api")
    from doclens.web_v2.api import sessions
    app.include_router(sessions.router, prefix="/api")
    from doclens.web_v2.api import status
    app.include_router(status.router, prefix="/api")
    from doclens.web_v2.api import chat
    app.include_router(chat.router, prefix="/api")
    from doclens.web_v2.api import ask
    app.include_router(ask.router, prefix="/api")
    from doclens.web_v2.api import config
    app.include_router(config.router, prefix="/api")
    from doclens.web_v2.api import presets
    app.include_router(presets.router, prefix="/api")
    from doclens.web_v2.api import files
    app.include_router(files.router, prefix="/api")
    from doclens.web_v2.api import grep
    app.include_router(grep.router, prefix="/api")
    from doclens.web_v2.api import watch
    app.include_router(watch.router, prefix="/api")
    from doclens.web_v2.api import reindex
    app.include_router(reindex.router, prefix="/api")
    from doclens.web_v2.api import diary
    app.include_router(diary.router, prefix="/api")
    from doclens.web_v2.api import vision
    app.include_router(vision.router, prefix="/api")
    from doclens.web_v2.api import skills
    app.include_router(skills.router, prefix="/api")
    from doclens.web_v2.api import mcp
    app.include_router(mcp.router, prefix="/api")

    @app.get("/api/health")
    async def health():
        return {
            "ok": True,
            "version": CORTEX_VERSION,
            "dev": _DEV_MODE,
            # 调试字段仅开发模式返回（发行版 mtime=安装时刻，无意义）
            **({"started_at": _STARTED_AT, "code_mtime": _code_mtime()} if _DEV_MODE else {}),
        }

    # 前端 SPA 静态文件（仅当 static/ 存在时挂载；详见 Task 29）
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        from fastapi.staticfiles import StaticFiles
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/manifest.webmanifest")
    async def _manifest():
        m = STATIC_DIR / "manifest.webmanifest"
        if m.exists():
            return FileResponse(m, media_type="application/manifest+json")
        return JSONResponse(status_code=404, content={"code": "MANIFEST_MISSING"})

    @app.get("/sw.js")
    async def _sw():
        p = STATIC_DIR / "sw.js"
        if p.exists():
            return FileResponse(p, media_type="application/javascript")
        return JSONResponse(status_code=404, content={"code": "SW_MISSING"})

    @app.get("/jsbridge.js")
    async def _jsbridge():
        """NexBox JSBridge 封装（public/ 拷入 static/ 根的全局脚本）。

        必须显式路由：否则落进 SPA fallback 返回 index.html（text/html），
        浏览器当 JS 解析静默失败，window.jsbridge 永不出现。
        """
        p = STATIC_DIR / "jsbridge.js"
        if p.exists():
            return FileResponse(p, media_type="application/javascript")
        return JSONResponse(status_code=404, content={"code": "JSBRIDGE_MISSING"})

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        """SPA fallback：所有非 /api 路径都返回 index.html（若存在）。"""
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse(
            status_code=404,
            content={"code": "FRONTEND_NOT_BUILT", "detail": "前端未构建，请先 vite build"},
        )

    return app


def _kill_port_process(port: int) -> bool:
    """尝试杀死占用指定端口的进程（Windows/macOS/Linux）。

    返回 True 表示成功清理了端口，False 表示端口未被占用或清理失败。
    """
    import subprocess
    import sys

    try:
        # Windows: 使用 PowerShell 查找并杀死进程
        if sys.platform == "win32":
            import os
            ps_path = os.path.expandvars(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")
            # 查找占用端口的进程 PID
            result = subprocess.run(
                [ps_path, "-Command",
                 f"(Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue).OwningProcess"],
                capture_output=True, text=True
            )
            if not result.stdout.strip():
                return False

            # 去重 PID
            pids = set(line.strip() for line in result.stdout.strip().split("\n") if line.strip().isdigit())
            for pid in pids:
                subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
            return True

        # macOS: 使用 lsof 查找并杀死进程
        elif sys.platform == "darwin":
            result = subprocess.run(
                ["lsof", "-t", "-i", f":{port}"],
                capture_output=True, text=True
            )
            if not result.stdout.strip():
                return False

            for pid in result.stdout.strip().split("\n"):
                if pid.isdigit():
                    subprocess.run(["kill", "-9", pid], capture_output=True)
            return True

        # Linux: 使用 lsof 或 ss 查找并杀死进程
        else:
            result = subprocess.run(
                ["lsof", "-t", "-i", f":{port}"],
                capture_output=True, text=True
            )
            if not result.stdout.strip():
                # 尝试用 ss (部分 Linux 发行版没有 lsof)
                result = subprocess.run(
                    ["ss", "-tlnp", f"sport = :{port}"],
                    capture_output=True, text=True
                )
                if not result.stdout.strip():
                    return False
                # 解析 ss 输出获取 PID
                for line in result.stdout.strip().split("\n"):
                    if f":{port}" in line and "pid=" in line:
                        pid = line.split("pid=")[1].split(",")[0]
                        subprocess.run(["kill", "-9", pid], capture_output=True)
                return True

            for pid in result.stdout.strip().split("\n"):
                if pid.isdigit():
                    subprocess.run(["kill", "-9", pid], capture_output=True)
            return True

    except Exception:
        return False


def launch_app(port: int = 7860, host: str = "127.0.0.1", share: bool = False) -> None:
    """启动 FastAPI + uvicorn，并自动打开浏览器。

    `share` 参数保留向后兼容，但 v2 不再支持公网分享。
    如果端口被占用，自动尝试杀死占用进程后启动。

    先索引后开浏览器（ADR-0018）：启动即后台线程跑索引（终端进度 +
    tqdm ETA），完成后才打开浏览器；索引失败仍开浏览器（应用可用、
    可看 status 排查）+ 终端警告。期间进来的 HTTP 请求在
    get_index_manager 的 join 上挂起等待。
    """
    if share:
        import warnings
        warnings.warn("`--share` 在 v2 中不再支持；请用 `--host 0.0.0.0` 暴露局域网。")

    # treesearch 进度日志（含 PST 邮件级细粒度进度）输出到命令行 stderr
    _enable_treesearch_console_logging()

    import os
    import threading
    import webbrowser

    import uvicorn

    # 尝试清理占用端口的进程
    _kill_port_process(port)

    # 启动前：确保 Claude Code kb-ask skill 已安装到 ~/.claude/skills
    try:
        from doclens.claude_code_skill import ensure_claude_code_skill
        ensure_claude_code_skill()
    except Exception as e:  # noqa: BLE001
        print(f"[Claude Code skill 同步跳过: {e}]")

    app = create_app()
    url = f"http://localhost:{port}" if host in ("127.0.0.1", "0.0.0.0") else f"http://{host}:{port}"

    # CORTEX_NO_BROWSER=1 时不弹浏览器（供 Stop hook 自动重启使用，避免反复弹窗）
    open_browser = not os.environ.get("CORTEX_NO_BROWSER")

    def _verify_gui_ready() -> bool:
        """实测用户链路：SPA 根页 + files 列表 + status 均 200 才算真可用。

        横幅/开浏览器以此为准——不是「我认为好了」，是探针真打通过
        （浏览器打开后加载的就是这三个东西：页面本身、文件列表、状态栏）。
        标准库 http.client（不引依赖），每个探针最多 5 次 × 10s 超时。
        """
        import http.client
        probe_host = "127.0.0.1" if host in ("127.0.0.1", "0.0.0.0", "") else host
        probes = ("/", "/api/files/list?path=&limit=1", "/api/status")
        for path in probes:
            for _attempt in range(5):
                try:
                    conn = http.client.HTTPConnection(probe_host, port, timeout=10)
                    conn.request("GET", path)
                    status = conn.getresponse().status
                    conn.close()
                    if status == 200:
                        break
                except OSError:
                    pass
                import time as _time
                _time.sleep(1)
            else:
                print(f"[就绪探针失败: GET {path} 未在重试内返回 200]", flush=True)
                return False
        return True

    def _startup_index_then_open_browser() -> None:
        """后台线程：先建索引（增量/全量），实测就绪后开浏览器（ADR-0018）。

        就绪 = 审计 + 预热 + 探针实测（files/status 均 200）。
        """
        from doclens.web_v2 import deps
        try:
            # get_index_manager 内部完成 load_or_build_index 并发布单例；
            # 期间进来的 HTTP 请求在同函数的锁 + join 上挂起等待
            mgr = deps.get_index_manager()
            # 预热 /api/status 的文件统计缓存（50 万语料首次全量 stat ~20s，
            # 不预热则用户打开页面的首个 status 请求承担这次耗时）
            try:
                mgr.file_stats()
            except Exception:  # noqa: BLE001
                pass
        except Exception as e:  # noqa: BLE001
            print(f"\n[警告] 启动索引失败: {e}（请查看日志排查）\n", flush=True)
            return
        # 实测验证后才宣布就绪——横幅即承诺：文件列表/搜索/对话此刻全部可用
        if _verify_gui_ready():
            print(f"\n[GUI 就绪: {url} — 已实测验证可用，浏览器即将打开]\n", flush=True)
            if open_browser:
                threading.Timer(1.0, lambda: webbrowser.open(url)).start()
        else:
            print(f"\n[警告: GUI 未能在预期时间内就绪（{url}），浏览器暂不打开——请查看日志排查]\n", flush=True)

    threading.Thread(target=_startup_index_then_open_browser, daemon=True).start()
    # INFO 日志带时间戳（uvicorn 默认无时间戳，百万语料启动窗口里无法对时序）
    uvicorn.run(app, host=host, port=port, log_config={
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s | %(levelname)s | %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "access": {
                "format": "%(asctime)s | %(levelname)s | %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "default": {"class": "logging.StreamHandler", "formatter": "default", "stream": "ext://sys.stderr"},
            "access": {"class": "logging.StreamHandler", "formatter": "access", "stream": "ext://sys.stdout"},
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
        },
    })
