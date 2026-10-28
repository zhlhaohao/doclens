"""即梦 CLI 子命令实现（``doclens jimeng generate ...``）。

skill/脚本直调入口（2026-10-28 决议）：与 MCP server 共享同一核心客户端。
handler 不依赖索引组件（cortex_cli.main 特判跳过 _init_components，
仿 auth 先例），自行 CortexConfig.load() 拿配置。

双形态调用：发行版 ``doclens jimeng ...``，开发版
``.venv/Scripts/python.exe -m doclens jimeng ...``——同一模块，
is_installed_mode() 自动分对配置目录。
"""
from __future__ import annotations

import argparse
from typing import Any, List, Optional


def register_parser(sub: argparse._SubParsersAction) -> None:
    """注册 ``doclens jimeng`` 子命令（二级 subparsers，仿 auth）。"""
    jimeng_parser = sub.add_parser(
        "jimeng",
        help="即梦文生图（火山方舟 Seedream；生成图落盘知识库）",
    )
    jimeng_sub = jimeng_parser.add_subparsers(dest="jimeng_action", required=True)
    gen = jimeng_sub.add_parser(
        "generate",
        help="文生图 / 图生图（参考图可选），生成图落盘知识库并输出本地路径",
    )
    gen.add_argument("prompt", nargs="+", help="生成提示词")
    gen.add_argument(
        "--ref", action="append", default=None, metavar="PATH",
        help="参考图路径（可多次传 = 多图融合；知识库相对路径或绝对路径）",
    )
    gen.add_argument("--n", type=int, default=1, help="张数（默认 1）")
    gen.add_argument(
        "--size", type=str, default=None,
        help="尺寸：1K/2K/4K 档位或像素值 1280x720–4096x4096（默认 2K；宽高比在 prompt 里描述）",
    )
    gen.add_argument(
        "--model", type=str, default=None,
        help="模型 ID（默认 JIMENG_MODEL 配置或 doubao-seedream-4-0）",
    )
    gen.add_argument("--seed", type=int, default=None, help="随机种子（复现用）")
    gen.add_argument(
        "--output-dir", type=str, default=None,
        help="落盘子目录（默认 图片/AI）",
    )
    gen.add_argument(
        "--describe", action="store_true",
        help="额外入视觉解析队列做视觉转写（图生图 prompt 不完整描述画面时）",
    )
    jimeng_parser.set_defaults(func=_cli_jimeng_generate)


def _cli_jimeng_generate(args: Any, config: Any, idx: Any) -> None:
    """``doclens jimeng generate`` handler。"""
    from pathlib import Path

    from doclens.config import CortexConfig
    from doclens.jimeng.client import JimengError, generate_and_save

    cfg = CortexConfig.load()
    api_key = getattr(cfg, "jimeng_api_key", None)
    if not api_key:
        print(
            "错误: 未配置 JIMENG_API_KEY。请在全局配置 .env"
            "（发行版 ~/.doclens/.env，开发版 ~/.cortex/.env）中设置：\n"
            "  JIMENG_API_KEY=<火山方舟 API Key>",
        )
        raise SystemExit(1)

    model = args.model or getattr(cfg, "jimeng_model", None) or "doubao-seedream-4-0"
    prompt = " ".join(args.prompt)
    workdir = Path(cfg.search_path)

    fts = None
    if args.describe:
        fts = _open_fts(cfg, workdir)

    try:
        result = generate_and_save(
            api_key=api_key,
            prompt=prompt,
            workdir=workdir,
            output_dir=args.output_dir,
            model=model,
            size=args.size,
            n=max(1, args.n),
            seed=args.seed,
            ref_images=args.ref,
            describe=args.describe,
            fts=fts,
        )
    except JimengError as e:
        print(f"生成失败: {e}")
        raise SystemExit(1) from e

    print(f"已生成 {len(result['paths'])} 张图（模型 {result['model']}，目录 {result['output_dir']}）：")
    for p in result["paths"]:
        print(f"  {p}")


def _open_fts(cfg: Any, workdir: Path) -> Optional[Any]:
    """describe 入队用 TreeSearch（只读打开；失败返回 None）。"""
    try:
        from treesearch.tree_search import TreeSearch

        db = Path(cfg.index_path)
        if not db.exists():
            print("提示: 索引库不存在，describe 入队跳过（--describe 忽略）")
            return None
        return TreeSearch(str(workdir), db_path=db)
    except Exception as e:  # noqa: BLE001
        print(f"提示: 打开索引库失败，describe 入队跳过: {e}")
        return None
