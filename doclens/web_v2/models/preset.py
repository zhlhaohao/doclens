"""Pydantic models for /api/presets（ADR-0009/0010 预设体系）。

预设 = 命名后可一键切换的参数档案，以 ``kind`` 区分三类：
- ``llm`` / ``vision``：模型连接档案（protocol+base_url+model_id+api_key，
  LLM 另含 context_window），含明文 API Key（GET 脱敏、更新占位）。
- ``search``：搜索调优档案（3 过滤 + 5 评分权重），无密钥。
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

PresetKind = Literal["llm", "vision", "search", "translate"]
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
    vision: Optional[bool] = Field(
        default=None,
        description="对话模型支持视觉（仅 kind=llm；ADR-0034 视觉路由能力位，"
        "默认 false=不支持 → 带图消息拦截引导切换模型）",
    )
    max_tokens: Optional[int] = Field(
        default=None,
        ge=1,
        description="LLM 单次输出最大 tokens（仅 kind=llm；可用探测接口二分实测）",
    )
    # 搜索调优字段（kind=search）
    max_results: Optional[int] = Field(default=None, ge=1, le=500)
    min_score_threshold: Optional[float] = Field(default=None, ge=0, le=1)
    max_span: Optional[int] = Field(default=None, ge=1)
    search_context_before: Optional[int] = Field(
        default=None, ge=0, le=2000,
        description="搜索结果片段：锚点前词数（CJK 每字一词，其余按空白切分；grep 与 search 统一窗口）",
    )
    search_context_after: Optional[int] = Field(
        default=None, ge=0, le=4000,
        description="搜索结果片段：锚点后词数（CJK 每字一词，其余按空白切分；grep 与 search 统一窗口）",
    )
    weight_keyword_match: Optional[float] = None
    weight_file_name_match: Optional[float] = None
    weight_fts_score: Optional[float] = None
    weight_title_match: Optional[float] = None
    weight_proximity_match: Optional[float] = None
    # 翻译字段（kind=translate，ADR-0039）
    translate_service: Optional[str] = Field(
        default=None, max_length=40,
        description="翻译服务名（仅 kind=translate；vendor 引擎服务类 name，如 openai/openailiked/google）",
    )
    translate_envs: Optional[dict] = Field(
        default=None,
        description="翻译服务环境变量/密钥（仅 kind=translate；GET 时脱敏）",
    )
    lang_default_out: Optional[str] = Field(
        default=None, max_length=16,
        description="翻译弹框默认目标语言（仅 kind=translate，如 zh/en）",
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
    vision: Optional[bool] = None
    max_tokens: Optional[int] = Field(default=None, ge=1)
    # 搜索调优字段
    max_results: Optional[int] = Field(default=None, ge=1, le=500)
    min_score_threshold: Optional[float] = Field(default=None, ge=0, le=1)
    max_span: Optional[int] = Field(default=None, ge=1)
    search_context_before: Optional[int] = Field(default=None, ge=0, le=2000)
    search_context_after: Optional[int] = Field(default=None, ge=0, le=4000)
    weight_keyword_match: Optional[float] = None
    weight_file_name_match: Optional[float] = None
    weight_fts_score: Optional[float] = None
    weight_title_match: Optional[float] = None
    weight_proximity_match: Optional[float] = None
    # 翻译字段（kind=translate，ADR-0039）
    translate_service: Optional[str] = Field(
        default=None, max_length=40,
        description="翻译服务名（仅 kind=translate；vendor 引擎服务类 name，如 openai/openailiked/google）",
    )
    translate_envs: Optional[dict] = Field(
        default=None,
        description="翻译服务环境变量/密钥（仅 kind=translate；GET 时脱敏）",
    )
    lang_default_out: Optional[str] = Field(
        default=None, max_length=16,
        description="翻译弹框默认目标语言（仅 kind=translate，如 zh/en）",
    )


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
    vision: Optional[bool] = None
    max_tokens: Optional[int] = None
    # 搜索调优字段（search 有值；llm|vision 为 None）
    max_results: Optional[int] = None
    min_score_threshold: Optional[float] = None
    max_span: Optional[int] = None
    search_context_before: Optional[int] = None
    search_context_after: Optional[int] = None
    weight_keyword_match: Optional[float] = None
    weight_file_name_match: Optional[float] = None
    weight_fts_score: Optional[float] = None
    weight_title_match: Optional[float] = None
    weight_proximity_match: Optional[float] = None
    # 翻译字段（kind=translate，ADR-0039）
    translate_service: Optional[str] = Field(
        default=None, max_length=40,
        description="翻译服务名（仅 kind=translate；vendor 引擎服务类 name，如 openai/openailiked/google）",
    )
    translate_envs: Optional[dict] = Field(
        default=None,
        description="翻译服务环境变量/密钥（仅 kind=translate；GET 时脱敏）",
    )
    lang_default_out: Optional[str] = Field(
        default=None, max_length=16,
        description="翻译弹框默认目标语言（仅 kind=translate，如 zh/en）",
    )


class PresetListResponse(BaseModel):
    presets: list[Preset]


class ActivateResult(BaseModel):
    """切换预设结果。``note`` 携带副作用提示（如视觉切换需重新解析）。"""

    ok: bool = True
    preset: Preset
    note: Optional[str] = None


class ProbeMaxTokensRequest(BaseModel):
    """探测 max_tokens 上限请求体（二分法实测服务端允许的最大值）。"""

    protocol: PresetProtocol = "openai_compat"
    base_url: str = ""
    model_id: str = Field(..., min_length=1)
    api_key: str = Field(
        default="",
        description="留空或 *** 时须传 preset_id，使用预设已存储的密钥",
    )
    preset_id: Optional[str] = None


class ProbeMaxTokensResult(BaseModel):
    max_tokens: int
    attempts: int


class ProbeVisionResult(BaseModel):
    """POST /api/presets/probe-vision 响应（ADR-0034 增补视觉探测）。

    supported = True：模型读出图中随机密码串（真支持视觉）；
    False：API 拒图或静默吞图（答不出密码串）——不支持。
    连接/鉴权失败走 502 PROBE_FAILED（探测中止，不判定）。
    """

    supported: bool


class ProbeTranslateRequest(BaseModel):
    """POST /api/presets/probe-translate 请求体（ADR-0039 翻译服务探测）。

    用当前表单的服务 + envs 翻一句固定文本，验证连通与密钥有效性；
    编辑既有预设时 envs 可传脱敏占位（后端回退已存密钥）。
    """

    translate_service: str = Field(..., min_length=1, max_length=40)
    envs: dict = Field(default_factory=dict, description="服务环境变量（值 *** 时回退 preset_id 已存值）")
    preset_id: Optional[str] = None


class ProbeTranslateResult(BaseModel):
    """探测结果：成功返回示例译文；失败走 502 PROBE_FAILED。"""

    translation: str
    service: str
