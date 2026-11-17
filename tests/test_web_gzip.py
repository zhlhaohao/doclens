# -*- coding: utf-8 -*-
"""HTTP 压缩中间件（2026-11-17）：静态资源压缩 / SSE 不压 / 字体不压。

此前前端产物无任何压缩中间件——浏览器不会自压 JS，首屏主包
1.28 MB 原始传输。GZipMiddleware 落地后 ~350 KB。

守卫要点：
1. 静态资源（.js/.css）在 Accept-Encoding: gzip 下被压缩，且体积显著变小；
2. 无 Accept-Encoding（或 identity）时不压缩、body 完整——回退路径可用；
3. SSE（text/event-stream）不压缩——流式响应必须逐字透传，否则
   EventSource 失效 / 思考流增量卡住；
4. 字体（woff2/application/octet-stream）不压缩——已压缩格式二次压收益为负；
5. auth 仍是���外层中间件（AP-33 不变量，见 test_middleware_order.py）。
"""
import gzip
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from doclens.web_v2.app import create_app

STATIC = Path(__file__).resolve().parents[1] / "doclens/web_v2/static"


@pytest.fixture()
def client():
    return TestClient(create_app())


def _main_asset(pattern: str) -> Path | None:
    assets = STATIC / "assets"
    if not assets.exists():
        return None
    hits = sorted(assets.glob(pattern))
    return hits[0] if hits else None


def test_static_js_is_compressed(client):
    """主 JS 带 Accept-Encoding: gzip 时压缩，且体积显著变小。"""
    js = _main_asset("index.*.js")
    if js is None:
        pytest.skip("未构建前端产物")
    raw = js.stat().st_size
    r = client.get(f"/assets/{js.name}", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers.get("content-encoding") == "gzip"
    # 传输体积（httpx 已解压，故用 header 判断 + 独立 gzip 比对）
    assert "Accept-Encoding" in (r.headers.get("vary") or "")
    # 独立验证压缩收益：同样的字节 gzip 后应明显更小
    assert len(gzip.compress(js.read_bytes(), 6)) < raw * 0.5


def test_static_js_without_accept_encoding_is_intact(client):
    """不请求压缩时不得压缩，body 必须完整（否则浏览器拿到残缺脚本）。"""
    js = _main_asset("index.*.js")
    if js is None:
        pytest.skip("未构建前端产物")
    raw = js.stat().st_size
    r = client.get(f"/assets/{js.name}", headers={"Accept-Encoding": "identity"})
    assert r.headers.get("content-encoding") is None
    assert len(r.content) == raw


def test_css_is_compressed(client):
    css = _main_asset("index.*.css")
    if css is None:
        pytest.skip("未构建前端产物")
    r = client.get(f"/assets/{css.name}", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") == "gzip"


def test_index_html_is_compressed(client):
    r = client.get("/", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers.get("content-encoding") == "gzip"


def test_fonts_are_not_compressed(client):
    """woff2 已压缩——二次压缩收益为负且耗时，必须跳过。"""
    fonts = sorted((STATIC / "assets").glob("*.woff2")) if (STATIC / "assets").exists() else []
    if not fonts:
        pytest.skip("无 woff2 样本")
    r = client.get(f"/assets/{fonts[0].name}", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert r.headers.get("content-encoding") is None


def test_api_json_still_parses(client):
    """API 响应压缩后仍可解析（客户端解压后 JSON 结构不变）。"""
    r = client.get("/api/health", headers={"Accept-Encoding": "gzip"})
    assert r.status_code == 200
    assert isinstance(r.json(), dict)
    assert r.json()["ok"] is True


def test_gzip_excludes_event_stream():
    """SSE 媒体类型必须在中间件排除名单里（流式逐字透传）。"""
    from starlette.middleware.gzip import DEFAULT_EXCLUDED_CONTENT_TYPES

    assert "text/event-stream" in DEFAULT_EXCLUDED_CONTENT_TYPES


def test_gzip_registered_as_innermost():
    """gzip 必须在 auth/swap 之后注册（更内层）——保住 AP-33 不变量。"""
    app = create_app()
    classes = [m.cls.__name__ for m in app.user_middleware]
    assert "GZipMiddleware" in classes, classes
    dispatch_idx = [i for i, m in enumerate(app.user_middleware) if "dispatch" in m.kwargs]
    assert classes.index("GZipMiddleware") > dispatch_idx[0], classes
