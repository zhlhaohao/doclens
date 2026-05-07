"""日志配置

提供安全的文件日志记录，支持编码错误处理。
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


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
        # 全局配置: ~/.cortex/.env
        global_env = Path.home() / ".cortex" / ".env"
        if global_env.exists():
            load_dotenv(global_env, override=True)
        # 项目配置: {cwd}/.cortex/.env
        local_env = Path.cwd() / ".cortex" / ".env"
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
        log_dir: 日志文件目录（默认为 .cortex/logs）
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
            # 从 .env 文件读取（支持 ~/.cortex/.env 或 {cwd}/.cortex/.env）
            _load_cortex_env()
            env_dir = os.environ.get("CORTEX_LOG_DIR")
            if env_dir:
                log_dir = Path(env_dir)
            else:
                log_dir = Path(".cortex") / "logs"

    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"debug_{datetime.now().strftime('%Y%m%d')}.log"

    # 格式化器
    fmt = '%(asctime)s | %(levelname)s | %(message)s'
    formatter = logging.Formatter(fmt)

    # 创建处理器列表（默认只有文件日志）
    handlers = []
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

    logger = logging.getLogger(__name__)
    logger.info("=" * 50 + " Session Started " + "=" * 50)

    return logger
