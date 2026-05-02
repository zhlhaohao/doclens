"""子代理运行器 (s04)

临时委派代理进行隔离探索或工作。

生命周期：
    spawn -> 执行 -> 返回摘要 -> 销毁

与队友 (s09) 的区别：
- 子代理：临时，任务完成后销毁，返回摘要
- 队友：持久化，空闲后可以继续工作直到显式关闭
"""

import json
from anthropic import Anthropic
from typing import Callable, Dict

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
    client: Anthropic,
    model: str,
    run_bash: Callable,
    run_read: Callable,
    run_write: Callable,
    run_edit: Callable,
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
        client: Anthropic API 客户端
        model: 模型 ID
        run_bash: Bash 执行函数
        run_read: 文件读取函数
        run_write: 文件写入函数
        run_edit: 文件编辑函数

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
            "description": "读取文件内容",
            "input_schema": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
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

    # 子代理消息循环
    workdir_str = str(workdir)
    system_prompt = build_system_prompt(workdir=workdir_str, agent_type="subagent")
    sub_msgs = [{"role": "user", "content": prompt}]

    # 子代理主循环（最多 30 轮）
    resp = None
    for _ in range(30):  # 最多 30 轮
        # LLM 调用
        try:
            resp = client.messages.create(
                model=model,
                system=system_prompt,
                messages=sub_msgs,
                tools=sub_tools,
                max_tokens=8000,
            )
        except Exception:
            return "(subagent failed)"

        sub_msgs.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason != "tool_use":
            break

        # 执行工具调用
        results = []
        for b in resp.content:
            if b.type == "tool_use":
                h = sub_handlers.get(b.name, lambda **kw: "Unknown tool")
                output = h(**b.input) if h else f"Unknown tool: {b.name}"
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": b.id,
                        "content": str(output)[:50000],
                    }
                )

        sub_msgs.append({"role": "user", "content": results})

        # 返回摘要
        if resp:
            return "".join(b.text for b in resp.content if hasattr(b, "text"))
        return "(subagent failed)"
