"""PUT /api/preview + GET writable 字段测试。"""
from cortex.web_v2.models.preview import (
    PreviewResponse,
    PreviewSaveRequest,
    PreviewSaveResponse,
)


def test_preview_response_has_writable_field():
    resp = PreviewResponse(path="x.md", content="hi", writable=True)
    assert resp.writable is True


def test_preview_response_writable_defaults_false():
    resp = PreviewResponse(path="x.md", content="hi")
    assert resp.writable is False


def test_save_request_serializes_content():
    req = PreviewSaveRequest(content="hello\nworld")
    assert req.content == "hello\nworld"


def test_save_response_has_required_fields():
    resp = PreviewSaveResponse(
        path="x.md",
        content="abc",
        bytes_written=3,
        reindex_triggered=True,
    )
    assert resp.path == "x.md"
    assert resp.content == "abc"
    assert resp.bytes_written == 3
    assert resp.reindex_triggered is True
