"""Pydantic models for /api/employees（ADR-0062/0063 数字员工）。

数字员工 = 用户自建的自驱工作单元：名字 + 专属提示词 + 工具授权 + 技能白名单
+ 工作/评审模型（预设引用）+ 产物路径/模板 + 评审标准与阈值。
员工库为机器级本地资产（``~/.doclens/digital_employees.json``），不含密钥
（模型只存预设引用），不参与知识库 Git 同步。
"""
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

ThinkingDepth = Literal["auto", "off", "low", "medium", "high"]

_NAME_PATTERN = r"^[^\s/\\]+$"


def _clean_name(v: Optional[str]) -> Optional[str]:
    """员工名：去首尾空白后再校验（唯一性键；大小写不敏感查重在 store 层）。"""
    if v is None:
        return v
    v = v.strip()
    if not re.match(_NAME_PATTERN, v):
        raise ValueError("员工名不能含空白或路径分隔符")
    return v

# 新建员工的工具白名单预填值（「安全默认」）：读写/搜索/知识库工具；
# shell 与 MCP 工具不在默认内，须用户显式勾选。
DEFAULT_TOOL_ALLOWLIST: tuple[str, ...] = (
    "read_file", "grep", "glob", "write_file", "edit_file",
    "search_kb", "read_document", "file_info", "kb_grep",
)

DEFAULT_SCORE_THRESHOLD = 90
DEFAULT_MAX_ITERATIONS = 5


class EmployeeBase(BaseModel):
    """员工配置的公共字段（创建与更新共用）。"""

    description: str = Field(default="", max_length=200, description="一句话描述（选择对话框展示）")
    prompt: str = Field(
        ...,
        min_length=1,
        max_length=20000,
        description="专属提示词：员工是谁、怎么干活（追加在精简基础提示词之后）",
    )
    tools_allow: list[str] = Field(
        default_factory=list,
        description="工具白名单（空 = 全部，再减黑名单与禁用工具）",
    )
    tools_deny: list[str] = Field(
        default_factory=list,
        description="工具黑名单（永远不许；优先于白名单）",
    )
    skills_allow: list[str] = Field(
        default_factory=list,
        description="技能白名单（派活开始时预加载注入系统提示词；空 = 无技能）",
    )
    model_preset_id: str = Field(..., min_length=1, description="工作模型预设 id（kind=llm）")
    review_model_preset_id: Optional[str] = Field(
        default=None,
        description="评审模型预设 id；空 = 由工作模型自评",
    )
    thinking_depth: ThinkingDepth = Field(
        default="auto",
        description="思考深度（工作回合与评审均按此执行）",
    )
    artifact_root: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="产物路径（相对知识库工作目录的目录前缀；每次派活在其下新建子目录）",
    )
    template_path: Optional[str] = Field(
        default=None,
        max_length=500,
        description="产物模板（相对工作目录的文件或目录；派活时整体拷入产物目录）",
    )
    review_criteria: str = Field(
        ...,
        min_length=1,
        max_length=20000,
        description="评审标准：什么是好产物（不含输出格式；骨架由系统提供）",
    )
    score_threshold: int = Field(default=DEFAULT_SCORE_THRESHOLD, ge=0, le=100)
    max_iterations: int = Field(default=DEFAULT_MAX_ITERATIONS, ge=1, le=50)


class EmployeeCreate(EmployeeBase):
    name: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="员工名（唯一键；用于会话标题与目录命名，不含空白与路径分隔符）",
    )

    _v_name = field_validator("name")(_clean_name)


class EmployeeUpdate(BaseModel):
    """更新员工：所有字段可选，仅提供要改的字段。"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    description: Optional[str] = Field(default=None, max_length=200)

    _v_name = field_validator("name")(_clean_name)
    prompt: Optional[str] = Field(default=None, min_length=1, max_length=20000)
    tools_allow: Optional[list[str]] = None
    tools_deny: Optional[list[str]] = None
    skills_allow: Optional[list[str]] = None
    model_preset_id: Optional[str] = Field(default=None, min_length=1)
    review_model_preset_id: Optional[str] = None
    thinking_depth: Optional[ThinkingDepth] = None
    artifact_root: Optional[str] = Field(default=None, min_length=1, max_length=500)
    template_path: Optional[str] = Field(default=None, max_length=500)
    review_criteria: Optional[str] = Field(default=None, min_length=1, max_length=20000)
    score_threshold: Optional[int] = Field(default=None, ge=0, le=100)
    max_iterations: Optional[int] = Field(default=None, ge=1, le=50)


class Employee(EmployeeBase):
    """完整员工（含 id 与派生状态）。"""

    id: str
    name: str
    created_at: str
    updated_at: str
    # 派生状态（非存储字段，由 store 根据 LLM 预设存在性计算）
    model_missing: bool = Field(default=False, description="工作模型预设已不存在")
    review_model_missing: bool = Field(default=False, description="评审模型预设已不存在")


class EmployeeListResponse(BaseModel):
    employees: list[Employee]


class EmployeeDispatchRequest(BaseModel):
    """派活：一句话任务。"""

    task: str = Field(..., min_length=1, max_length=4000, description="一句话任务（可点名白名单内的技能）")


class EmployeeDispatchResponse(BaseModel):
    """派活已受理：返回新建的派活会话。"""

    session_id: str
    employee_id: str
    artifact_dir: str


class EmployeeRunInfo(BaseModel):
    """某员工当前进行中的派活（用于「同员工串行」提示与前端跳转）。"""

    session_id: str
    started_at: str
    iteration: int


class EmployeeStopResponse(BaseModel):
    stopped: bool
    session_id: Optional[str] = None


class ToolCatalogItem(BaseModel):
    """工具目录项（设置页表单勾选用）。"""

    name: str
    group: str  # builtin | kb | mcp
    server: Optional[str] = None  # mcp：所属 server 名
    writable: bool = False  # 有写入能力（shell / 写文件 / MCP 写入）
    forbidden: bool = False  # 禁用工具（对员工不可用）


class ToolCatalogResponse(BaseModel):
    tools: list[ToolCatalogItem]


class SkillCatalogItem(BaseModel):
    name: str
    description: str = ""


class SkillCatalogResponse(BaseModel):
    skills: list[SkillCatalogItem]


class DeletionBlockedResponse(BaseModel):
    """删除被拒：员工有进行中的派活。"""

    detail: str
    run: Optional[EmployeeRunInfo] = None
