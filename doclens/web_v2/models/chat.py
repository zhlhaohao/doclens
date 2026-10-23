"""Chat API 模型。"""
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

# 对话图片白名单（ADR-0034；bmp/tiff 浏览器 paste 支持稀碎，拒收）
ALLOWED_IMAGE_MEDIA = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
}
MAX_IMAGES_PER_MESSAGE = 4


class ChatImage(BaseModel):
    """单张对话图片（ADR-0034）：前端已压缩（最长边 1600px/q80）的 base64。"""

    data: str = Field(min_length=1, description="base64 图像数据（不含 data: 前缀）")
    media_type: str = Field(default="image/png")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    session_id: Optional[str] = None
    images: Optional[List[ChatImage]] = Field(
        default=None,
        description="对话图片（≤4 张，白名单 png/jpeg/webp/gif；ADR-0034）",
    )

    @field_validator("images")
    @classmethod
    def _validate_images(cls, v: Optional[List[ChatImage]]) -> Optional[List[ChatImage]]:
        if v is None:
            return v
        if len(v) > MAX_IMAGES_PER_MESSAGE:
            raise ValueError(f"单条消息最多 {MAX_IMAGES_PER_MESSAGE} 张图片")
        for img in v:
            if img.media_type not in ALLOWED_IMAGE_MEDIA:
                raise ValueError(f"不支持的图片格式: {img.media_type}")
        return v


class ChatStopRequest(BaseModel):
    """POST /api/chat/stop —— 中断指定 session 的 AI 生成。"""
    session_id: str = Field(min_length=1)


class ChatInterjectRequest(BaseModel):
    """POST /api/chat/interject —— 生成中途插话（ADR-0048）。

    会话级单槽位：写入待处理插话，agent 主循环在下一个检查点消费
    （注入 → suppress_tools 汇报 → 循环继续，回合不结束）。
    """
    session_id: str = Field(min_length=1)
    text: str = Field(min_length=1, max_length=2000)
