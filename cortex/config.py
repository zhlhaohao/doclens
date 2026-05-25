"""
Cortex 配置模块 - 从 .env 文件或环境变量加载配置
"""

import os
import sys
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


def get_global_cortex_dir() -> Path:
    """返回全局配置目录 ~/.cortex（已由 _init_first_run 保证存在）"""
    return Path.home() / ".cortex"


class CortexConfig(BaseSettings):
    """Cortex 配置模型"""

    # 搜索路径
    search_path: str = Field(default_factory=lambda: os.getcwd())

    # 索引路径（默认 None，会在代码中拼接为 {search_path}/.cortex/index.db）
    index_path: Optional[str] = None

    # 搜索参数
    max_results: int = Field(default=20)
    max_nodes_per_doc: int = Field(default=3)
    top_k_docs: int = Field(default=100)
    min_score_threshold: float = Field(default=0.0, description="综合评分阈值，低于此值的结果将被过滤")

    # 匹配参数
    max_span: int = Field(default=20)
    min_keyword_match: int = Field(default=2)
    min_proximity_score: int = Field(default=1)
    min_keywords_per_line: int = Field(default=2)

    # 终端显示参数
    title_width: int = Field(default=55)
    line_width: int = Field(default=78)
    max_context_lines: int = Field(default=5)
    max_anchor_lines: int = Field(default=3)
    context_expand_range: int = Field(default=5)

    # KB 工具字符限制（影响 LLM token 消耗）
    max_context_chars_per_result: int = Field(default=800)
    max_total_chars: int = Field(default=10000)
    max_read_chars: int = Field(default=6000)

    # Ripgrep 降级搜索上下文
    rg_context_before: int = Field(default=6)
    rg_context_after: int = Field(default=5)

    # 文件监控
    watch_enabled: bool = Field(default=True)
    watch_debounce: float = Field(default=5.0)

    # 失败文件自动跳过阈值
    max_index_fail_count: int = Field(default=3)

    # Shadow Markdown（为二进制文件生成 .md 副本用于 ripgrep 降级搜索）
    treesearch_enable_shadow_md: bool = Field(
        default=True,
        alias="TREESEARCH_ENABLE_SHADOW_MD",
    )

    # 分词器
    cjk_tokenizer: str = Field(default="jieba")

    # 评分权重（0=禁用，值越大越重要）
    weight_keyword_match: float = Field(default=3.0)
    weight_file_name_match: float = Field(default=2.0)
    weight_fts_score: float = Field(default=2.0)
    weight_title_match: float = Field(default=1.5)
    weight_proximity_match: float = Field(default=1.0)

    # Planify / Agent 配置
    planify_api_key: Optional[str] = Field(default=None, alias="PLANIFY_API_KEY")
    planify_model_id: str = Field(default="claude-opus-4-6", alias="PLANIFY_MODEL_ID")
    planify_base_url: Optional[str] = Field(default=None, alias="PLANIFY_BASE_URL")

    @classmethod
    def _init_first_run(cls):
        """首次运行引导：从 GitHub 下载 .env.example 和 skills/ 到 ~/.cortex"""
        global_dir = get_global_cortex_dir()
        env_dest = global_dir / ".env"

        if env_dest.exists():
            return  # 已有 .env，跳过

        global_dir.mkdir(parents=True, exist_ok=True)
        print(f"首次运行，正在初始化配置目录: {global_dir}")

        # 下载 .env.example
        env_example_url = (
            "https://raw.githubusercontent.com/zhlhaohao/cortex/main/cortex/.env.example"
        )
        try:
            import urllib.request
            with urllib.request.urlopen(env_example_url, timeout=10) as resp:
                env_dest.write_bytes(resp.read())
            print(f"已下载配置文件: {env_dest}")
        except Exception as e:
            print(f"[警告] 下载 .env.example 失败: {e}")
            env_dest.write_text("# 请手动创建此文件并设置 PLANIFY_API_KEY\n", encoding="utf-8")

        # 下载 skills/knowledge_base/ 目录
        skills_dest = global_dir / "skills" / "knowledge_base"
        if not skills_dest.exists():
            skills_url = (
                "https://api.github.com/repos/zhlhaohao/cortex/contents/cortex/skills/knowledge_base"
            )
            try:
                import urllib.request
                import json
                with urllib.request.urlopen(skills_url, timeout=10) as resp:
                    items = json.loads(resp.read().decode())
                skills_dest.mkdir(parents=True, exist_ok=True)
                for item in items:
                    if item["type"] == "file":
                        file_url = item["download_url"]
                        file_path = skills_dest / item["name"]
                        with urllib.request.urlopen(file_url, timeout=10) as f:
                            file_path.write_bytes(f.read())
                print(f"已下载技能目录: {skills_dest}")
            except Exception as e:
                print(f"[警告] 下载 skills 目录失败: {e}")

        print("\n请在以下文件中设置大模型 API 密钥:")
        print(f"  {env_dest}")
        print("\n打开文件后设置: PLANIFY_API_KEY=你的密钥")
        sys.exit(0)

    @classmethod
    def load(cls) -> "CortexConfig":
        """从 ~/.cortex/.env 和 {cwd}/.cortex/.env 加载配置，项目级覆盖全局"""
        # 首次运行引导
        cls._init_first_run()

        global_env = get_global_cortex_dir() / ".env"
        local_env = Path(os.getcwd()) / ".cortex" / ".env"

        env_files = []
        if global_env.exists():
            env_files.append(str(global_env))
        if local_env.exists():
            env_files.append(str(local_env))

        if env_files:
            import logging
            logger = logging.getLogger(__name__)
            logger.debug("CortexConfig.load env_files: %s", env_files)
            result = cls(_env_file=env_files, _env_file_encoding="utf-8")
            logger.debug("CortexConfig.load max_nodes_per_doc=%d", result.max_nodes_per_doc)
            return result

        # 降级到环境变量
        return cls(_env_file=None)

    class Config:
        env_prefix = "CORTEX_"
        env_file = None  # 初始为 None，运行时动态设置
        populate_by_name = True  # 允许使用 alias 填充字段