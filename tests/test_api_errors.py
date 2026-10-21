# -*- coding: utf-8 -*-
"""未捕获异常的响应与日志契约（AP-35）。

原实现既不打日志（traceback 丢失，线上 500 无法定位）又把 ``str(exc)``
直接回传客户端（内部路径/SQL 片段泄露给 LAN 用户）。
"""
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from doclens.web_v2.api.errors import (
    INTERNAL_ERROR_DETAIL,
    CortexAPIError,
    register_error_handlers,
)


def _app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    async def boom():
        raise ValueError("secret-internal-path C:/work/db.sqlite3")

    @app.get("/biz")
    async def biz():
        raise CortexAPIError(409, "SESSION_BUSY", "会话正在生成中")

    return app


def _client() -> TestClient:
    return TestClient(_app(), raise_server_exceptions=False)


def test_unexpected_error_does_not_leak_detail():
    r = _client().get("/boom")
    assert r.status_code == 500
    body = r.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert "secret-internal-path" not in r.text
    assert body["detail"] == INTERNAL_ERROR_DETAIL


def test_unexpected_error_returns_traceback_id():
    r = _client().get("/boom")
    tid = r.json().get("traceback_id")
    assert isinstance(tid, str) and len(tid) == 8
    assert all(c in "0123456789abcdef" for c in tid)


def test_unexpected_error_logs_traceback_with_id(caplog):
    with caplog.at_level(logging.ERROR, logger="doclens.web_v2.api.errors"):
        r = _client().get("/boom")
    tid = r.json()["traceback_id"]
    records = [rec for rec in caplog.records if tid in rec.getMessage()]
    assert records, "日志里必须能用 traceback_id 找到这次异常"
    rec = records[0]
    assert rec.exc_info is not None, "必须带 traceback（logger.exception）"
    assert "secret-internal-path" in caplog.text, "完整异常文本只进日志"
    assert "GET /boom" in rec.getMessage()


def test_business_error_still_passes_detail():
    """CortexAPIError 是给用户看的业务错误——detail 原样透出，不走泛化文案。"""
    r = _client().get("/biz")
    assert r.status_code == 409
    assert r.json() == {"code": "SESSION_BUSY", "detail": "会话正在生成中"}


def test_each_failure_gets_distinct_id():
    c = _client()
    ids = {c.get("/boom").json()["traceback_id"] for _ in range(5)}
    assert len(ids) == 5
