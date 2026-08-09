"""Pydantic models for /api/presets（ADR-0009 模型预设体系）。

模型预设 = 命名后可一键切换的完整模型连接档案。LLM 与视觉共用一套，
以 ``kind`` 区分。预设含明文 API Key，GET 时脱敏、更新时 ``***`` 占位
表示"未改动"（与 ``config_store`` 的密钥处理模式一致）。
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

PresetKind = Literal["llm", "vision"]
PresetProtocol = Literal["anthropic", "openai_compat"]

# 密钥脱敏占位（与 config_store.SECRET_MASK 同义，独立声明避免循环依赖）
PRESET_SECRET_MASK = "***"


class PresetCreate(BaseModel):
    """创建预设请求体。"""

    name: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="预设名称（同 kind 内唯一，大小写不敏感）",
    )
    kind: PresetKind
    protocol: PresetProtocol
    base_url: str = Field(..., description="API 端点 URL")
    model_id: str = Field(..., description="模型 ID")
    api_key: str = Field(default="", description="API Key（明文存储，GET 时脱敏）")
    context_window: Optional[int] = Field(
        default=None,
        ge=1,
        description="LLM 上下文窗口（仅 kind=llm 有意义；留空则沿用运行时默认）",
    )


class PresetUpdate(BaseModel):
    """更新预设请求体：所有字段可选，仅提供要改的字段。

    ``api_key`` 传 ``***`` 表示未改动（跳过），传空串=清空，其余=更新。
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    protocol: Optional[PresetProtocol] = None
    base_url: Optional[str] = None
    model_id: Optional[str] = None
    api_key: Optional[str] = None
    context_window: Optional[int] = Field(default=None, ge=1)


class Preset(BaseModel):
    """完整预设（含 id）；``api_key`` 由 store 脱敏后再交给前端。"""

    id: str
    name: str
    kind: PresetKind
    protocol: PresetProtocol
    base_url: str
    model_id: str
    api_key: str
    context_window: Optional[int] = None


class PresetListResponse(BaseModel):
    presets: list[Preset]


class ActivateResult(BaseModel):
    """切换预设结果。``note`` 携带副作用提示（如视觉切换需重新解析）。"""

    ok: bool = True
    preset: Preset
    note: Optional[str] = None
