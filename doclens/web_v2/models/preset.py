"""Pydantic models for /api/presets（ADR-0009/0010 预设体系）。

预设 = 命名后可一键切换的参数档案，以 ``kind`` 区分三类：
- ``llm`` / ``vision``：模型连接档案（protocol+base_url+model_id+api_key，
  LLM 另含 context_window），含明文 API Key（GET 脱敏、更新占位）。
- ``search``：搜索调优档案（3 过滤 + 5 评分权重），无密钥。
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

PresetKind = Literal["llm", "vision", "search"]
PresetProtocol = Literal["anthropic", "openai_compat"]

# 密钥脱敏占位（与 config_store.SECRET_MASK 同义，独立声明避免循环依赖）
PRESET_SECRET_MASK = "***"


class PresetCreate(BaseModel):
    """创建预设请求体。name/kind 必填；其余按 kind 选填（前端按 kind 校验完整性）。"""

    name: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="预设名称（同 kind 内唯一，大小写不敏感）",
    )
    kind: PresetKind
    # 模型连接字段（kind=llm|vision）
    protocol: Optional[PresetProtocol] = None
    base_url: str = ""
    model_id: str = ""
    api_key: str = Field(default="", description="API Key（明文存储，GET 时脱敏；仅 llm|vision）")
    context_window: Optional[int] = Field(
        default=None,
        ge=1,
        description="LLM 上下文窗口（仅 kind=llm）",
    )
    # 搜索调优字段（kind=search）
    max_results: Optional[int] = Field(default=None, ge=1, le=500)
    min_score_threshold: Optional[float] = Field(default=None, ge=0, le=1)
    max_span: Optional[int] = Field(default=None, ge=1)
    weight_keyword_match: Optional[float] = None
    weight_file_name_match: Optional[float] = None
    weight_fts_score: Optional[float] = None
    weight_title_match: Optional[float] = None
    weight_proximity_match: Optional[float] = None


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
    # 搜索调优字段
    max_results: Optional[int] = Field(default=None, ge=1, le=500)
    min_score_threshold: Optional[float] = Field(default=None, ge=0, le=1)
    max_span: Optional[int] = Field(default=None, ge=1)
    weight_keyword_match: Optional[float] = None
    weight_file_name_match: Optional[float] = None
    weight_fts_score: Optional[float] = None
    weight_title_match: Optional[float] = None
    weight_proximity_match: Optional[float] = None


class Preset(BaseModel):
    """完整预设（含 id）；``api_key`` 由 store 脱敏后再交给前端。"""

    id: str
    name: str
    kind: PresetKind
    # 模型连接字段（llm|vision 有值；search 为空/None）
    protocol: Optional[PresetProtocol] = None
    base_url: str = ""
    model_id: str = ""
    api_key: str = ""
    context_window: Optional[int] = None
    # 搜索调优字段（search 有值；llm|vision 为 None）
    max_results: Optional[int] = None
    min_score_threshold: Optional[float] = None
    max_span: Optional[int] = None
    weight_keyword_match: Optional[float] = None
    weight_file_name_match: Optional[float] = None
    weight_fts_score: Optional[float] = None
    weight_title_match: Optional[float] = None
    weight_proximity_match: Optional[float] = None


class PresetListResponse(BaseModel):
    presets: list[Preset]


class ActivateResult(BaseModel):
    """切换预设结果。``note`` 携带副作用提示（如视觉切换需重新解析）。"""

    ok: bool = True
    preset: Preset
    note: Optional[str] = None
