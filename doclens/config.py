"""
Cortex 配置模块 - 从 .env 文件或环境变量加载配置
"""

import os
from pathlib import Path
from typing import Optional

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings


def is_installed_mode() -> bool:
    """发行版（wheel 装进 site-packages）= True；开发（editable/源码）= False。

    判据是 doclens 包自身的安装位置：editable 安装或源码树直接运行时，
    ``__file__`` 指向项目源码目录；wheel 安装时指向 site-packages/dist-packages。
    这与“python -m doclens（开发）vs doclens.exe（发行版）”两种入口精确吻合。
    """
    import doclens

    parts = Path(doclens.__file__).resolve().parts
    return any(p in ("site-packages", "dist-packages") for p in parts)


def data_dirname() -> str:
    """数据目录名：开发模式 ``.cortex``，发行版模式 ``.doclens``。

    不缓存，便于测试 monkeypatch ``doclens.__file__``。
    """
    return ".doclens" if is_installed_mode() else ".cortex"


def get_global_cortex_dir() -> Path:
    """返回全局配置目录：开发 ``~/.cortex``，发行版 ``~/.doclens``。

    由 ``_init_first_run`` 保证存在。保留原函数名以最小化调用点改动。
    """
    return Path.home() / data_dirname()


def bundled_env_example_path() -> Path:
    """包内 ``.env.example`` 模板路径（dev 源码树 / release site-packages 均可用）。

    首次运行引导与「恢复默认」均以此为规范默认配置来源。
    """
    return Path(__file__).parent / ".env.example"


# 模块级：把模式决策写入 env，供 planify（不反向依赖 doclens）读取。
# setdefault 不覆盖用户已显式设置的 CORTEX_DATA_DIRNAME（高级用户可强制）。
os.environ.setdefault("CORTEX_DATA_DIRNAME", data_dirname())


class CortexConfig(BaseSettings):
    """Cortex 配置模型"""

    # 搜索路径
    search_path: str = Field(default_factory=lambda: os.getcwd())

    # 索引路径（默认 None，会在代码中拼接为 {search_path}/.cortex/index.db）
    index_path: Optional[str] = None

    # 搜索参数
    max_results: int = Field(default=50)
    max_nodes_per_doc: int = Field(default=1000)
    top_k_docs: int = Field(default=100)
    min_score_threshold: float = Field(
        default=0.3, description="综合评分阈值，低于此值的结果将被过滤"
    )

    # 匹配参数
    max_span: int = Field(default=50)
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

    # read_document 输出选项
    read_doc_show_toc: bool = Field(
        default=False,
        description="read_document 是否输出目录结构（默认关闭以节省 token）",
    )

    # Ripgrep 降级搜索上下文
    rg_context_before: int = Field(default=6)
    rg_context_after: int = Field(default=5)

    # Grep 工具配置
    grep_score_threshold: float = Field(
        default=0.0,
        description="grep 评分阈值（0.0-1.0），低于此比例的词项命中率的结果将被过滤",
    )
    grep_max_results: int = Field(default=50, description="grep 工具最大返回结果数")

    # 文件监控
    watch_enabled: bool = Field(default=True)
    watch_debounce: float = Field(default=5.0)

    # Web UI 监听（FastAPI + uvicorn）；改 host/port 需重启 gui 才生效
    web_host: str = Field(
        default="127.0.0.1",
        alias="CORTEX_WEB_HOST",
        description="Web UI 绑定地址；0.0.0.0 暴露局域网（非环回地址将启用密码登录闸门，请先在设置页设置访问密码）",
    )
    web_port: int = Field(
        default=7860,
        ge=1,
        le=65535,
        alias="CORTEX_WEB_PORT",
        description="Web UI 端口",
    )
    # 访问密码哈希（格式 iterations$salt_hex$hash_hex），由设置页 /api/auth/password
    # 或 `cortex auth reset` 写入全局 .env；不进设置页字段白名单，读 AuthCredentials。
    # 注册为字段是为了让 pydantic-settings（extra=forbid）容忍 .env 中该键。
    web_password_hash: str = Field(
        default="",
        alias="CORTEX_WEB_PASSWORD_HASH",
        description="Web UI 访问密码哈希（请勿手工编辑；由密码设置接口维护）",
    )

    # MCP server（进程内 Streamable HTTP，TUI/GUI 自动启动）
    mcp_enabled: bool = Field(
        default=True, description="是否在 TUI/GUI 启动时自动拉起 MCP HTTP server"
    )
    mcp_port: int = Field(
        default=7880,
        ge=1,
        le=65535,
        alias="CORTEX_MCP_PORT",
        description="MCP server 端口",
    )
    mcp_host: str = Field(
        default="127.0.0.1",
        alias="CORTEX_MCP_HOST",
        description="MCP server 绑定地址；非环回地址必须配 mcp_token",
    )
    mcp_token: Optional[str] = Field(
        default=None, description="MCP bearer token；host 非环回时必填"
    )

    # 失败文件自动跳过阈值
    max_index_fail_count: int = Field(default=3)

    # Shadow Markdown（为二进制文件生成 .md 副本用于 ripgrep 降级搜索）
    treesearch_enable_shadow_md: bool = Field(
        default=False,
        alias="TREESEARCH_ENABLE_SHADOW_MD",
    )

    # XLSX 解析限制（透传至 TreeSearchConfig）
    treesearch_xlsx_max_rows_per_sheet: int = Field(
        default=10000,
        alias="TREESEARCH_XLSX_MAX_ROWS_PER_SHEET",
    )
    treesearch_xlsx_max_consecutive_empty_rows: int = Field(
        default=100,
        alias="TREESEARCH_XLSX_MAX_CONSECUTIVE_EMPTY_ROWS",
    )

    # 允许解析的文件类型（逗号分隔；空=全部允许）
    # 可选值: markdown, code, text, json, jsonl, csv, html, xml, pdf, doc, docx, pptx, excel
    # 默认仅文档类（markdown/csv/pdf/doc/docx/pptx/excel），排除 code/text/json/html/xml
    allowed_source_types_str: str = Field(
        default="markdown,csv,pdf,doc,docx,pptx,excel",
        alias="CORTEX_ALLOWED_SOURCE_TYPES",
    )

    @computed_field
    @property
    def allowed_source_types(self) -> list[str]:
        """解析逗号分隔的 allowed_source_types_str 为列表。"""
        if not self.allowed_source_types_str:
            return []
        return [
            t.strip() for t in self.allowed_source_types_str.split(",") if t.strip()
        ]

    # 分词器
    cjk_tokenizer: str = Field(default="jieba")

    # 评分权重（0=禁用，值越大越重要；加权平均，只有相对比例起作用）
    weight_keyword_match: float = Field(default=4.0)
    weight_file_name_match: float = Field(default=2.0)
    weight_fts_score: float = Field(default=1.0)
    weight_title_match: float = Field(default=2.0)
    weight_proximity_match: float = Field(default=1.0)

    # Planify / Agent 配置
    planify_api_key: Optional[str] = Field(default=None, alias="PLANIFY_API_KEY")
    planify_model_id: str = Field(default="", alias="PLANIFY_MODEL_ID")
    planify_base_url: Optional[str] = Field(default=None, alias="PLANIFY_BASE_URL")
    planify_context_window: int = Field(
        default=200000,
        alias="PLANIFY_CONTEXT_WINDOW",
        description="LLM 上下文窗口大小（tokens）。compact 阈值 = context_window × 0.8。",
    )
    planify_provider: str = Field(default="minimax", alias="PLANIFY_PROVIDER")
    planify_protocol: Optional[str] = Field(default=None, alias="PLANIFY_PROTOCOL")

    @classmethod
    def _init_first_run(cls):
        """首次运行引导：把包内打包的 .env.example 和 skills/ 拷贝到数据目录。

        离线可用 —— 这些资源随包分发（dev 源码树、release wheel 的 package-data
        均包含 .env.example 与 skills/**），无需联网下载。
        """
        import shutil

        global_dir = get_global_cortex_dir()
        env_dest = global_dir / ".env"

        if env_dest.exists():
            return  # 已有 .env，跳过

        global_dir.mkdir(parents=True, exist_ok=True)
        print(f"首次运行，正在初始化配置目录: {global_dir}")

        pkg_dir = Path(
            __file__
        ).parent  # doclens/ 包目录（dev 源码树 / release site-packages）

        # 1. 拷贝 .env.example -> {数据目录}/.env
        env_example = pkg_dir / ".env.example"
        if env_example.exists():
            shutil.copy2(env_example, env_dest)
            print(f"已创建配置文件: {env_dest}")
        else:
            # 包内模板缺失（异常情况），退化为占位符，避免阻断首次运行
            env_dest.write_text(
                "# 请手动创建此文件并设置 PLANIFY_API_KEY\n", encoding="utf-8"
            )
            print(f"[警告] 未找到包内配置模板 .env.example，已创建空占位: {env_dest}")

        # 2. 拷贝 skills/ -> {数据目录}/skills/（仅当不存在；Agent 启动时也会从本地部署）
        skills_src = pkg_dir / "skills"
        skills_dest = global_dir / "skills"
        if skills_src.exists() and skills_src.is_dir() and not skills_dest.exists():
            shutil.copytree(skills_src, skills_dest)
            print(f"已创建技能目录: {skills_dest}")

        # 首次运行提示（不阻断启动 —— key 可稍后在应用内「设置」页配置）
        print(f"\n首次运行已创建配置文件: {env_dest}")
        print("如需 AI 问答，请设置 PLANIFY_API_KEY，或启动后在「设置」页配置。")

    @classmethod
    def load(cls) -> "CortexConfig":
        """从 ~/.cortex/.env 和 {cwd}/.cortex/.env 加载配置，项目级覆盖全局"""
        # 首次运行引导
        cls._init_first_run()

        global_env = get_global_cortex_dir() / ".env"
        local_env = Path(os.getcwd()) / data_dirname() / ".env"

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
            logger.debug(
                "CortexConfig.load max_nodes_per_doc=%d", result.max_nodes_per_doc
            )
            return result

        # 降级到环境变量
        return cls(_env_file=None)

    class Config:
        env_prefix = "CORTEX_"
        env_file = None  # 初始为 None，运行时动态设置
        populate_by_name = True  # 允许使用 alias 填充字段
