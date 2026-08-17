"""POST /api/ask/respond —— ask_user_question 答案回传。

SSE 是单向流：ask_user_question 工具在 chat 线程内经 waiter 悬置等待，
前端作答后通过本端点把答案 submit 回 waiter，阻塞的 tool handler 被唤醒，
答案以 tool_result 形式回流给模型，对话继续。

设计：
1. request_id 由 handler 生成（uuid 截断）且一次性——不存在即已超时/已答
2. session_id 仅作日志关联，不做强校验（waiter 为全局单例，全局唯一 id
   本身就是能力凭证，追加会话校验无安全增益）
3. 答案内容不过滤：selected 中的未知 label / other 文本原样回传，
   模型需要完整信息（静默过滤会丢用户真实意图）
"""
import logging
from typing import Optional

from fastapi import APIRouter

from doclens.web_v2.models.ask import AskRespondRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/ask/respond")
async def ask_respond(req: AskRespondRequest) -> dict:
    """提交悬置问题的答案到全局等待器。

    命中返回 ``{ok: true, submitted: true}``；request_id 不存在
    （已超时清理/已提交）返回 ``{ok: false, submitted: false}``，
    前端据此把卡片标记为已失效。
    """
    from planify.streaming.waiter import get_global_waiter

    waiter = get_global_waiter()
    payload = {
        "answers": [
            {
                "question": a.question,
                "selected": list(a.selected),
                "other": a.other,
            }
            for a in req.answers
        ]
    }
    submitted = waiter.submit_response(req.request_id, payload)
    if not submitted:
        logger.info(
            "[ask/respond] 请求不存在或已消费: %s (session=%s)",
            req.request_id, req.session_id,
        )
        return {"ok": False, "submitted": False}
    logger.info(
        "[ask/respond] 答案已提交: %s, %d 项 (session=%s)",
        req.request_id, len(req.answers), req.session_id,
    )
    return {"ok": True, "submitted": True}
