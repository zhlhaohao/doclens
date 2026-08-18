"""子代理运行器 (s04)

临时委派代理进行隔离探索或工作。

生命周期：
    spawn -> 执行 -> 返回摘要 -> 销毁

与队友 (s09) 的区别：
- 子代理：临时，任务完成后销毁，返回摘要
- 队友：持久化，空闲后可以继续工作直到显式关闭
"""

from __future__ import annotations

import json
import logging
from typing import Callable, Dict

logger = logging.getLogger("planify.subagent")

from ..core.llm.provider import LLMProvider
from ..core.llm.types import Tool, ToolUseBlock

# prompts 模块导入（支持直接运行 cli.py 和作为模块运行两种方式）
try:
    # 当作为模块运行时（python -m backend.app.planify.main）
    from ..prompts import build_system_prompt
except ImportError:
    # 当直接运行 cli.py 时，使用绝对导入
    from planify.prompts import build_system_prompt


def run_subagent(
    prompt: str,
    agent_type: str,
    workdir,
    client: LLMProvider,
    model: str,
    run_bash: Callable,
    run_read: Callable,
    run_write: Callable,
    run_edit: Callable,
    extra_tools: list | None = None,
    extra_handlers: Dict[str, Callable] | None = None,
    max_tokens: int = 8000,
) -> str:
    """
    启动子代理执行隔离任务

    创建临时代理循环，执行任务后返回摘要，然后销毁。

    Args:
        prompt: 任务提示
        agent_type: 代理类型
            - "Explore": 只读工具（bash, read_file），用于探索代码库
            - "general-purpose": 读写工具（bash, read_file, write_file, edit_file），用于修改文件
        workdir: 工作目录
        client: LLM Provider 实例
        model: 模型 ID
        run_bash: Bash 执行函数
        run_read: 文件读取函数
        run_write: 文件写入函数
        run_edit: 文件编辑函数
        extra_tools: 追加的工具定义（如宿主应用注入的 read_document/file_info）
        extra_handlers: extra_tools 对应的处理器
        max_tokens: 子代理每轮 LLM 调用的最大输出 tokens（由宿主应用按对话模型参数传入；
            过小会截断子代理的最终摘要，表现为"只总结了前几章"）

    Returns:
        任务执行摘要
    """
    # 根据代理类型配置可用工具
    sub_tools = [
        {
            "name": "bash",
            "description": "运行 shell 命令",
            "input_schema": {
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
        },
        {
            "name": "read_file",
            "description": "读取文件内容（纯文本）。支持按词序号切片：中日韩文字每字算一词，其余按空白切分。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "start_word": {
                        "type": "integer",
                        "description": "起始词序号（可选，1-based）。不传词参数读全文（超长截断并提示续读位置）。",
                    },
                    "end_word": {
                        "type": "integer",
                        "description": "结束词序号（可选，1-based，含该词）。",
                    },
                },
                "required": ["path"],
            },
        },
    ]

    # 非 Explore 类型代理可以写入文件
    if agent_type != "Explore":
        sub_tools.extend(
            [
                {
                    "name": "write_file",
                    "description": "写入文件内容",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "content": {"type": "string"},
                        },
                        "required": ["path", "content"],
                    },
                },
                {
                    "name": "edit_file",
                    "description": "编辑文件内容",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "old_text": {"type": "string"},
                            "new_text": {"type": "string"},
                        },
                        "required": ["path", "old_text", "new_text"],
                    },
                },
            ]
        )

    # 工具处理器 - 直接使用传入的处理器函数
    sub_handlers = {
        "bash": run_bash,
        "read_file": run_read,
        "write_file": run_write,
        "edit_file": run_edit,
    }

    # 宿主应用注入的额外工具（如 doclens 的 read_document/file_info——
    # 子代理读 PDF/DOCX 等二进制格式的唯一途径）
    if extra_tools:
        sub_tools.extend(extra_tools)
    if extra_handlers:
        sub_handlers.update(extra_handlers)

    # 子代理消息循环
    workdir_str = str(workdir)
    system_prompt = build_system_prompt(workdir=workdir_str, agent_type="subagent")
    sub_msgs = [{"role": "user", "content": prompt}]

    # 把工具定义转换为 Tool dataclass
    tool_defs = [
        Tool(
            name=t["name"],
            description=t.get("description", ""),
            input_schema=t.get("input_schema", {"type": "object"}),
        )
        for t in sub_tools
    ]

    # 子代理主循环（最多 30 轮）
    resp = None
    for _ in range(30):  # 最多 30 轮
        # LLM 调用（通过 LLMProvider 抽象接口）
        try:
            resp = client.chat(
                messages=sub_msgs,
                system=system_prompt,
                tools=tool_defs,
                max_tokens=max_tokens,
            )
        except Exception as e:
            # 不能静默吞掉：子代理失败时主代理只会看到 "(subagent failed)"，
            # 没有异常内容就完全无法排查（如模型拒绝 max_tokens、上下文超长等）
            logger.exception(
                "子代理 LLM 调用失败 (agent_type=%s, max_tokens=%d, 已累积消息=%d): %s",
                agent_type, max_tokens, len(sub_msgs), e,
            )
            return f"(subagent failed: {type(e).__name__}: {e})"

        # 把响应内容块序列化为 dict（兼容后续 _execute_tools 风格）
        assistant_blocks: list[dict] = []
        for b in resp.content:
            if isinstance(b, dict):
                assistant_blocks.append(b)
                continue
            block_type = getattr(b, "type", None)
            if block_type == "text":
                assistant_blocks.append({"type": "text", "text": getattr(b, "text", "")})
            elif block_type == "tool_use":
                assistant_blocks.append({
                    "type": "tool_use",
                    "id": b.id,
                    "name": b.name,
                    "input": dict(b.input),
                })
            else:
                # 未知类型：降级为 dict 形式
                assistant_blocks.append({"type": block_type or "unknown", "raw": str(b)})
        sub_msgs.append({"role": "assistant", "content": assistant_blocks})

        if resp.stop_reason != "tool_use":
            break

        # 执行工具调用
        results = []
        for b in assistant_blocks:
            if b.get("type") != "tool_use":
                continue
            block_name = b.get("name", "")
            block_id = b.get("id", "")
            block_input = b.get("input", {})
            h = sub_handlers.get(block_name, lambda **kw: "Unknown tool")
            output = h(**block_input) if h else f"Unknown tool: {block_name}"
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block_id,
                    "content": str(output)[:50000],
                }
            )

        sub_msgs.append({"role": "user", "content": results})

    # 返回摘要（循环正常结束 = 最后一轮无工具调用的 assistant 文本；
    # 跑满 30 轮仍要工具时，返回最后一轮文本，可能不完整）
    if resp:
        return "".join(b.get("text", "") for b in assistant_blocks if b.get("type") == "text")
    return "(subagent failed)"
