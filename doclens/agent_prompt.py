"""doclens 宿主侧 system prompt 注入段。

planify 的 build_system_prompt 保持通用；doclens 的知识库策略经
StreamingAgent/Agent 的 system_prompt_extra 参数注入（宿主扩展点）。
历史：这些内容曾硬编码在 planify/prompts.py 的 base prompt 中（边界入侵，
见 web_v2/docs/ARCHITECTURE-planify-boundary.md），2026-09-02 迁回 doclens。
"""

KB_SYSTEM_PROMPT_EXTRA = """\
# Knowledge base first

IMPORTANT: 本应用是知识库问答工具，本地知识库（search_kb 可检索）是回答事实性/资料性问题的**第一信息源**。用户提出事实性提问（机构、产品、技术、数据、名单、规范等）时：

1. **必须先查知识库**：load_skill("knowledge-base") → search_kb（按技能指引多组关键词重试）。
2. 知识库**确实无结果**（已换关键词/同义词重试）后，才可用 web_search 补充，并在回答中说明「知识库未收录，以下来自网络」。
3. 禁止跳过知识库直接用 web_search 或凭模型记忆回答资料性问题。

调用任何知识库工具（search_kb / read_document / manage_kb / grep）之前，**必须先调用 load_skill(name="knowledge-base")**，按返回的技能内容执行检索与引文。

当前工作目录同时也是**知识库根目录**——所有已索引/可检索的文档都在该目录或其子目录内。用户询问已索引内容时，使用知识库工具（search_kb / read_document）检索。\
"""

# 工具轮次兜底注入（宿主措辞；planify 侧 StreamingConfig 保持中性）
KB_TOOL_ROUND_LIMIT_REMINDER = (
    "你已进行了多轮检索仍未找到答案。请立即停止调用工具，基于已获得的信息如实作答；"
    "若知识库中确实没有相关内容，明确告知用户「未找到」，不要编造，也不要再尝试新的检索。"
)


def tool_round_limit_kwargs(config) -> dict:
    """从 doclens Config 派生 StreamingConfig 的工具轮次兜底参数。

    软阈值 = planify_max_tool_rounds（默认 15），硬阈值 = 软 + 10；0 = 不限。
    """
    soft = getattr(config, "planify_max_tool_rounds", 15) or 0
    return {
        "max_tool_rounds": soft or None,
        "force_answer_rounds": (soft + 10) if soft else None,
        "tool_round_limit_reminder": KB_TOOL_ROUND_LIMIT_REMINDER,
    }
