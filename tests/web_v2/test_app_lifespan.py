"""create_app() lifespan 注入测试。"""
import pytest
from fastapi import FastAPI

from doclens.web_v2.app import create_app


def test_create_app_returns_fastapi_with_lifespan():
    app = create_app()
    assert isinstance(app, FastAPI)
    # FastAPI 把 lifespan 存到 router.lifespan_context
    assert app.router.lifespan_context is not None


def test_create_app_does_not_use_deprecated_on_event():
    """确保用新 lifespan API 而非 deprecated on_event。"""
    import inspect
    from doclens.web_v2 import app as app_module
    src = inspect.getsource(app_module)
    assert "on_event" not in src
    assert "lifespan" in src
