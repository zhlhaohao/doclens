"""
Cortex 配置模块 - 从 .env 文件或环境变量加载配置
"""

import os
import shutil
import sys
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


def get_global_cortex_dir() -> Path:
    """返回全局配置目录 ~/.cortex（已由 _init_first_run 保证存在）"""
    return Path.home() / ".cortex"


def _get_package_dir() -> Path:
    """Return the directory containing the cortex package."""
    import cortex as _pkg
    return Path(os.path.dirname(os.path.abspath(_pkg.__file__)))


class CortexConfig(BaseSettings):
    """Cortex 配置模型"""

    # 搜索路径
    search_path: str = Field(default_factory=lambda: os.getcwd())

    # 索引路径（默认 None，会在代码中拼接为 {search_path}/.cortex/index.db）
    index_path: Optional[str] = None

    # 搜索参数
    max_results: int = Field(default=20)
    max_nodes_per_doc: int = Field(default=5)
    top_k_docs: int = Field(default=100)

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

    # 分词器
    cjk_tokenizer: str = Field(default="jieba")

    # 评分权重（0=禁用，值越大越重要）
    weight_keyword_match: float = Field(default=3.0)
    weight_file_name_match: float = Field(default=2.0)
    weight_fts_score: float = Field(default=2.0)
    weight_title_match: float = Field(default=1.5)

    # Planify / Agent 配置
    planify_api_key: Optional[str] = Field(default=None, alias="PLANIFY_API_KEY")
    planify_model_id: str = Field(default="claude-opus-4-6", alias="PLANIFY_MODEL_ID")
    planify_base_url: Optional[str] = Field(default=None, alias="PLANIFY_BASE_URL")

    @classmethod
    def _init_first_run(cls):
        """首次运行引导：复制 .env.example 和 skills/ 到 ~/.cortex"""
        global_dir = get_global_cortex_dir()
        env_dest = global_dir / ".env"

        if env_dest.exists():
            return  # 已有 .env，跳过

        # 创建 ~/.cortex 目录（如果还不存在）
        global_dir.mkdir(parents=True, exist_ok=True)

        pkg_dir = _get_package_dir()
        print(f"首次运行，正在初始化配置目录: {global_dir}")

        # 复制 .env.example -> ~/.cortex/.env
        env_example = pkg_dir / ".env.example"
        if env_example.exists():
            with open(env_example, "r", encoding="utf-8") as f:
                env_dest.write_text(f.read(), encoding="utf-8")
            print(f"已创建配置文件: {env_dest}")

        # 复制 skills/
        skills_src = pkg_dir / "skills"
        skills_dest = global_dir / "skills"
        if skills_src.exists() and not skills_dest.exists():
            shutil.copytree(skills_src, skills_dest)
            print(f"已复制技能目录: {skills_dest}")

        print("\n请在以下文件中设置大模型 API 密钥:")
        print(f"  {env_dest}")
        print("\n打开文件后设置: PLANIFY_API_KEY=你的密钥")
        sys.exit(0)

    @classmethod
    def load(cls) -> "CortexConfig":
        """从 ~/.cortex/.env 或 {cwd}/.cortex/.env 加载配置，失败则降级到环境变量"""
        # 首次运行引导
        cls._init_first_run()

        # 优先读取全局配置
        global_env = get_global_cortex_dir() / ".env"
        if global_env.exists():
            return cls(_env_file=str(global_env), _env_file_encoding="utf-8")

        # 降级到项目级配置
        local_env = Path(os.getcwd()) / ".cortex" / ".env"
        if local_env.exists():
            return cls(_env_file=str(local_env), _env_file_encoding="utf-8")

        # 降级到环境变量
        return cls(_env_file=None)

    class Config:
        env_prefix = "CORTEX_"
        env_file = None  # 初始为 None，运行时动态设置
        populate_by_name = True  # 允许使用 alias 填充字段