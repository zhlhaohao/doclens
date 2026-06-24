"""Cortex Web v2 — FastAPI 应用入口。

`create_app()` 构造 FastAPI 实例；`launch_app()` 用 uvicorn 启动并同时
服务前端 SPA 静态文件（详见 Task 29）。
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse

from doclens import __version__ as CORTEX_VERSION
from doclens.web_v2.api.errors import register_error_handlers

STATIC_DIR = Path(__file__).parent / "static"


def create_app() -> FastAPI:
    """构造 FastAPI 应用（注册路由、错误处理器、静态文件）。"""
    app = FastAPI(title="Cortex", version=CORTEX_VERSION)

    # 错误处理
    register_error_handlers(app)

    # API 路由（后续任务逐步挂载）
    from doclens.web_v2.api import search
    app.include_router(search.router, prefix="/api")
    from doclens.web_v2.api import preview
    app.include_router(preview.router, prefix="/api")
    from doclens.web_v2.api import sessions
    app.include_router(sessions.router, prefix="/api")
    from doclens.web_v2.api import status
    app.include_router(status.router, prefix="/api")
    from doclens.web_v2.api import chat
    app.include_router(chat.router, prefix="/api")
    from doclens.web_v2.api import config
    app.include_router(config.router, prefix="/api")
    from doclens.web_v2.api import files
    app.include_router(files.router, prefix="/api")

    @app.get("/api/health")
    async def health():
        return {"ok": True, "version": CORTEX_VERSION}

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
    """
    if share:
        import warnings
        warnings.warn("`--share` 在 v2 中不再支持；请用 `--host 0.0.0.0` 暴露局域网。")

    import threading
    import webbrowser

    import uvicorn

    # 尝试清理占用端口的进程
    _kill_port_process(port)

    app = create_app()
    url = f"http://localhost:{port}" if host in ("127.0.0.1", "0.0.0.0") else f"http://{host}:{port}"
    # 延迟 1 秒打开浏览器，等 uvicorn 就绪
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=port)
