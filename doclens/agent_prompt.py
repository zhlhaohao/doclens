"""doclens 宿主侧 system prompt 注入段。

planify 的 build_system_prompt 保持通用；doclens 的知识库策略经
StreamingAgent/Agent 的 system_prompt_extra 参数注入（宿主扩展点）。
历史：这些内容曾硬编码在 planify/prompts.py 的 base prompt 中（边界入侵，
见 web_v2/docs/ARCHITECTURE-planify-boundary.md），2026-09-02 迁回 doclens。
"""
from pathlib import Path

# 知识库根的用户指导文件（按序第一个命中即注入；CLAUDE.md 是 Claude Code
# 惯例——用户在知识库根为编码工具写的指导对本应用同样有效）
GUIDE_FILENAMES = ("CLAUDE.md", "AGENTS.md")
# 防御性上限：防误放大文件灌爆 system prompt（8KB 常见，32KB 已很宽裕）
GUIDE_MAX_CHARS = 32_000

KB_SYSTEM_PROMPT_EXTRA = """\
# Knowledge base first

IMPORTANT: 本应用是知识库问答工具，本地知识库（search_kb 可检索）是回答事实性/资料性问题的**第一信息源**。用户提出事实性提问（机构、产品、技术、数据、名单、规范等）时：

1. **必须先查知识库**：load_skill("knowledge-base") → search_kb（按技能指引多组关键词重试）。
2. 知识库**确实无结果**（已换关键词/同义词重试）后，才可用 web_search 补充，并在回答中说明「知识库未收录，以下来自网络」。
3. 禁止跳过知识库直接用 web_search 或凭模型记忆回答资料性问题。

调用任何知识库工具（search_kb / read_document / manage_kb / kb_grep）之前，**必须先调用 load_skill(name="knowledge-base")**，按返回的技能内容执行检索与引文。

当前工作目录同时也是**知识库根目录**——所有已索引/可检索的文档都在该目录或其子目录内。用户询问已索引内容时，使用知识库工具（search_kb / read_document）检索。\
"""


def kb_root_guidance(workdir) -> str:
    """知识库根用户指导文件 → system prompt 追加段（无文件返回空串）。

    按序读 {workdir}/CLAUDE.md → AGENTS.md，第一个存在且非空的注入全文
    （超 32k 字符截断）。每次构造 agent 时重读——文件改动对下一轮对话
    生效；文件不变则注入内容不变，不破坏 system 前缀缓存。
    """
    for name in GUIDE_FILENAMES:
        path = Path(workdir) / name
        try:
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            continue
        if not text:
            continue
        if len(text) > GUIDE_MAX_CHARS:
            text = text[:GUIDE_MAX_CHARS] + "\n\n…（超长已截断，完整内容可 read_file 读取）"
        return (
            f"# Knowledge base guidance（来自知识库根的 {name}，自动注入）\n\n"
            f"{text}"
        )
    return ""

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
