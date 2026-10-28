"""即梦 MCP stdio server 壳（GUI 内置注册，2026-10-28 决议）。

启动形态：``python -m doclens.jimeng``（mcp_client 内置注册经
``sys.executable -m doclens.jimeng`` spawn；不经设置页 mcp_servers.json）。

单工具 ``generate``（注册名 ``mcp__jimeng__generate``），同步阻塞语义：
生成 + 下载落盘完成才返回（MCP 条目 timeout 120s 兜底）。

子进程环境继承宿主 env（全局 .env 的 JIMENG_* 由本进程内
CortexConfig.load() 读取——.env 解析逻辑在 config 模块，子进程独立加载）。
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server.mcpserver import MCPServer

from doclens.jimeng.client import JimengError, generate_and_save

SERVER_NAME = "jimeng"

# 工具描述（agent 可见；参数语义在此说清）。
_TOOL_DESCRIPTION = """AI 文生图（即梦/Seedream）。用户要「生成/画一张图」等图像产出时用本工具，
无需用户点名——听到生图意图即调。生成图落盘知识库并自动在对话回答中展示。

prompt 即图片自描述（写入图像元数据，可全文搜索）。

参数：
- prompt（必填）：生成提示词，中文英文均可；想清楚主体/风格/构图/光影
- ref_images：参考图路径列表（可选，知识库相对路径或绝对路径）——传入即图生图/多图融合
- n：张数（默认 1；>1 时 Ark 按单请求组图返回，实际张数以响应为准）
- size：默认 2K。Seedream 4.0 语义：档位 1K/2K/4K（宽高比在 prompt 里自然语言描述，如「竖版 3:4 构图」）或 像素值（范围 1280x720–4096x4096，如 2048x2048 / 2560x1440）；不支持小尺寸
- model：默认 doubao-seedream-4-0（可换 doubao-seedream-3-0-t2i 等）
- seed：随机种子（可选，复现用）
- output_dir：落盘子目录（默认 图片/AI）
- describe：true 时额外入视觉解析队列做视觉转写（图生图 prompt 不完整描述画面时才需要；默认 false——prompt 已可搜）"""


def _load_config() -> Any:
    """加载 doclens 配置（读全局 .env + 工作目录 .env）。

    server 进程的 cwd = 宿主 spawn 时传的 cwd（GUI 的知识库工作目录），
    因此 CortexConfig.load() 的 search_path 默认与宿主一致。
    """
    from doclens.config import CortexConfig

    return CortexConfig.load()


def _get_workdir(config: Any) -> Path:
    """知识库工作目录（与宿主 GUI 的 search_path 同源）。"""
    return Path(config.search_path)


def _get_fts(config: Any) -> Optional[Any]:
    """describe 入队用的 TreeSearch 实例（连宿主同一 index.db）。

    只读打开（describe=True 才实际用到）；失败返回 None 不阻断生成。
    """
    if not getattr(config, "index_path", None):
        return None
    try:
        from treesearch.tree_search import TreeSearch
        from pathlib import Path as _P

        db = _P(config.index_path)
        if not db.exists():
            return None
        ts = TreeSearch(str(_get_workdir(config)), db_path=db)
        return ts
    except Exception:
        return None


def create_jimeng_server() -> MCPServer:
    """构建 jimeng MCP server（工具注册）。"""
    mcp = MCPServer(SERVER_NAME)

    @mcp.tool(name="generate", description=_TOOL_DESCRIPTION)
    def generate(
        prompt: str,
        ref_images: Optional[List[str]] = None,
        n: int = 1,
        size: Optional[str] = None,
        model: Optional[str] = None,
        seed: Optional[int] = None,
        output_dir: Optional[str] = None,
        describe: bool = False,
    ) -> str:
        config = _load_config()
        api_key = getattr(config, "jimeng_api_key", None)
        if not api_key:
            return (
                "Error: 未配置 JIMENG_API_KEY。请在全局配置 .env"
                "（~/.doclens/.env，开发版 ~/.cortex/.env）中设置后重启应用。"
            )
        eff_model = model or getattr(config, "jimeng_model", None) or "doubao-seedream-4-0"
        try:
            result = generate_and_save(
                api_key=api_key,
                prompt=prompt,
                workdir=_get_workdir(config),
                output_dir=output_dir,
                model=eff_model,
                size=size,
                n=max(1, n),
                seed=seed,
                ref_images=ref_images,
                describe=describe,
                fts=_get_fts(config) if describe else None,
            )
        except JimengError as e:
            return f"Error: {e}"
        # 返回可读文本（agent 消费）：路径 + 元信息。
        # 路径用 workdir 相对形态（正斜杠）——agent 写进 markdown 时能被
        # 聊天气泡的 kb-img 渲染（相对知识库根的图像路径才重写为 raw URL）
        wd = _get_workdir(config).resolve()
        rel_paths = []
        for p in result["paths"]:
            try:
                rel_paths.append(str(Path(p).resolve().relative_to(wd)).replace("\\", "/"))
            except ValueError:
                rel_paths.append(p)
        lines = [f"已生成 {len(rel_paths)} 张图（模型 {result['model']}）："]
        for p in rel_paths:
            lines.append(f"![生成图]({p})")
        lines.append(
            "（把上面的 markdown 图片语法原样放进你的回答里，图会直接展示给用户；"
            "prompt 已写入图像元数据可搜索，文件已落知识库自动入索引。）"
        )
        return "\n".join(lines)

    return mcp


def main() -> None:
    """stdio 入口：python -m doclens.jimeng"""
    server = create_jimeng_server()
    server.run()


if __name__ == "__main__":
    main()
