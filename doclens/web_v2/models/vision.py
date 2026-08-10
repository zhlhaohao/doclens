"""Pydantic 模型：/api/vision/* 端点的请求/响应。"""
from pydantic import BaseModel


class PromptResponse(BaseModel):
    """GET /api/vision/prompt 响应：返回默认 VISION_PROMPT 供前端对话框预填。"""
    prompt: str


class ReparseRequest(BaseModel):
    """POST /api/vision/reparse 请求体。

    ``path`` 相对 workdir 的图像路径；``prompt`` 用户编辑后的自定义提示词
    （覆盖默认 VISION_PROMPT 仅对本次解析生效）。
    """
    path: str
    prompt: str


class ReparseResponse(BaseModel):
    """POST /api/vision/reparse 响应。"""
    path: str
    markdown: str


class NoteRequest(BaseModel):
    """POST /api/vision/note 请求体：用户手写备注直接覆盖 AI 解读（不调视觉模型）。"""
    path: str
    markdown: str
