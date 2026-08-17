"""Ask API 模型 —— ask_user_question 结构化问答的响应回传。"""
from typing import List, Optional

from pydantic import BaseModel, Field


class AskAnswer(BaseModel):
    """单个问题的答案。"""

    question: str = Field(min_length=1)
    selected: List[str] = Field(default_factory=list)
    other: Optional[str] = None


class AskRespondRequest(BaseModel):
    """POST /api/ask/respond —— 回传用户对悬置问题的答案。"""

    request_id: str = Field(min_length=1)
    answers: List[AskAnswer] = Field(min_length=0)
    session_id: Optional[str] = None
