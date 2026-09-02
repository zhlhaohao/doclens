"""日志配置

提供安全的文件日志记录，支持编码错误处理。
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


def data_dirname() -> str:
    """数据目录名：读宿主应用设置的 CORTEX_DATA_DIRNAME env；未设则回退 .cortex。

    宿主（如 doclens）在模块加载时把模式决策写入该 env，planify 读取即可与
    宿主保持一致；planify 独立运行时 env 未设 → 回退 .cortex。
    """
    return os.environ.get("CORTEX_DATA_DIRNAME", ".cortex")


class SafeFileHandler(logging.FileHandler):
    """
    安全的文件日志处理器

    继承自 logging.FileHandler，添加编码错误处理。
    当遇到无法编码的字符时，自动替换为 UTF-8 安全字符。
    """

    def emit(self, record):
        """发出日志记录，包含编码错误处理。"""
        try:
            super().emit(record)
        except (UnicodeDecodeError, UnicodeEncodeError):
            # 通过移除问题字符来处理编码错误
            record.msg = record.msg.encode('utf-8', errors='replace').decode('utf-8')
            super().emit(record)


def _load_cortex_env():
    """从 .env 文件加载环境变量（如果尚未加载）"""
    if os.environ.get("CORTEX_ENV_LOADED"):
        return
    try:
        from dotenv import load_dotenv
        # 全局配置: ~/.<数据目录>/.env （开发 .cortex / 发行版 .doclens）
        global_env = Path.home() / data_dirname() / ".env"
        if global_env.exists():
            load_dotenv(global_env, override=True)
        # 项目配置: {cwd}/<数据目录>/.env
        local_env = Path.cwd() / data_dirname() / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)
        os.environ["CORTEX_ENV_LOADED"] = "1"
    except ImportError:
        pass  # dotenv 未安装


def setup_logging(
    log_dir: Optional[Path] = None,
    log_level: int = logging.DEBUG,
    console_output: bool = False,
    console_level: int = logging.INFO,
) -> logging.Logger:
    """
    设置应用日志记录。

    Args:
        log_dir: 日志文件目录（默认为 <数据目录>/logs，即 .cortex 或 .doclens）
        log_level: 日志级别（默认为 DEBUG）
        console_output: 是否输出到控制台（默认为 False）
        console_level: 控制台日志级别（默认为 INFO）

    Returns:
        配置好的日志记录器实例
    """
    if log_dir is None:
        # 优先从环境变量读取
        env_dir = os.environ.get("CORTEX_LOG_DIR")
        if env_dir:
            log_dir = Path(env_dir)
        else:
            # 从 .env 文件读取（支持 ~/<数据目录>/.env 或 {cwd}/<数据目录>/.env）
            _load_cortex_env()
            env_dir = os.environ.get("CORTEX_LOG_DIR")
            if env_dir:
                log_dir = Path(env_dir)
            else:
                log_dir = (Path.cwd() / data_dirname() / "logs").resolve()

    # 创建日志目录（默认信任，不再询问）
    log_dir.mkdir(parents=True, exist_ok=True)

    # 格式化器
    fmt = '%(asctime)s | %(levelname)s | %(message)s'
    formatter = logging.Formatter(fmt)

    # 创建处理器列表
    handlers = []

    log_file = log_dir / f"debug_{datetime.now().strftime('%Y%m%d')}.log"
    file_handler = SafeFileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    handlers.append(file_handler)

    # 仅在显式要求时添加控制台处理器
    if console_output and hasattr(sys, 'stdout'):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(console_level)  # 控制台只显示指定级别以上
        console_handler.setFormatter(formatter)
        handlers.append(console_handler)

    logging.basicConfig(
        level=log_level,
        handlers=handlers
    )

    # Suppress noisy third-party loggers to WARNING (they spam DEBUG millions of lines)
    # sse_starlette: 每个 SSE chunk/ping 都 debug 一次（watch/chat 流），刷屏且无用
    # PIL: 读 PNG 每个数据块（IDAT 等）都 debug 一次（STREAM ...），图像解析时刷屏
    for _name in ("pdfminer", "pdfplumber", "markitdown",
                  "urllib3", "httpx", "httpcore", "asyncio", "filelock",
                  "sse_starlette", "PIL"):
        logging.getLogger(_name).setLevel(logging.WARNING)

    logger = logging.getLogger(__name__)
    logger.info("=" * 50 + " Session Started " + "=" * 50)

    return logger
