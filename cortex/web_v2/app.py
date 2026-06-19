"""Cortex Web v2 — FastAPI 应用入口。

`create_app()` 构造 FastAPI 实例；`launch_app()` 用 uvicorn 启动并同时
服务前端 SPA 静态文件（详见 Task 29）。
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse

from cortex import __version__ as CORTEX_VERSION
from cortex.web_v2.api.errors import register_error_handlers

STATIC_DIR = Path(__file__).parent / "static"


def create_app() -> FastAPI:
    """构造 FastAPI 应用（注册路由、错误处理器、静态文件）。"""
    app = FastAPI(title="Cortex", version=CORTEX_VERSION)

    # 错误处理
    register_error_handlers(app)

    # API 路由（后续任务逐步挂载）
    from cortex.web_v2.api import search
    app.include_router(search.router, prefix="/api")
    from cortex.web_v2.api import preview
    app.include_router(preview.router, prefix="/api")
    from cortex.web_v2.api import sessions
    app.include_router(sessions.router, prefix="/api")
    from cortex.web_v2.api import status
    app.include_router(status.router, prefix="/api")
    from cortex.web_v2.api import chat
    app.include_router(chat.router, prefix="/api")
    from cortex.web_v2.api import config
    app.include_router(config.router, prefix="/api")

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


def launch_app(port: int = 7860, host: str = "127.0.0.1", share: bool = False) -> None:
    """启动 FastAPI + uvicorn，并自动打开浏览器。

    `share` 参数保留向后兼容，但 v2 不再支持公网分享。
    """
    if share:
        import warnings
        warnings.warn("`--share` 在 v2 中不再支持；请用 `--host 0.0.0.0` 暴露局域网。")

    import threading
    import webbrowser

    import uvicorn

    app = create_app()
    url = f"http://localhost:{port}" if host in ("127.0.0.1", "0.0.0.0") else f"http://{host}:{port}"
    # 延迟 1 秒打开浏览器，等 uvicorn 就绪
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=port)
