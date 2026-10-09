"""日志配置

提供安全的文件日志记录，支持编码错误处理与大小轮转。
"""

import logging
import logging.handlers
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


# =============================================================================
# 宿主数据目录名（注入式单一真相源）
# =============================================================================
# 框架不知道宿主的数据目录叫什么（.cortex / .doclens / 其它）——由宿主在启动时
# 经 register_data_dirname() 注入；未注入回退 ".cortex"（planify 独立运行）。
#
# 历史（2026-10-09 收敛）：旧实现读 CORTEX_DATA_DIRNAME env，而宿主侧
# doclens.config.data_dirname() 是现场计算（is_installed_mode）——两个同名
# 函数、两套真相源。宿主用 setdefault 把自己的决策写入 env 本意是同步给
# planify，但「外部已有值则尊重」的语义让子进程继承宿主 env 时被劫持
# （AI 宿主 .doclens → 其启动的 dev 实例日志落错目录，DB 却因现场计算而
# 落对——同进程内分裂）。注入通路不经过进程环境，天然免疫继承劫持。
_data_dirname: str = ".cortex"


def register_data_dirname(name: str) -> None:
    """宿主注入数据目录名（如 doclens 在装配期调用，传 ".cortex"/".doclens"）。

    必须在首次 data_dirname() 调用前完成（日志/agent.md/临时目录定位都依赖
    它）；重复调用以最后一次为准（测试 monkeypatch 场景）。
    """
    global _data_dirname
    _data_dirname = name


def data_dirname() -> str:
    """数据目录名：宿主注入值；未注入（planify 独立运行）回退 ".cortex"。"""
    return _data_dirname


class SafeFileHandler(logging.handlers.RotatingFileHandler):
    """
    安全的轮转文件日志处理器

    继承 RotatingFileHandler（大小轮转，默认单文件 20MB × 5 个备份），
    添加编码错误处理。轮转兜底任何自反馈/刷屏类日志异常，防日志文件无限增长。
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
    # 防御（2026-10-09）：宿主若可导入但尚未注册数据目录名（启动序颠倒：
    # 本函数先于宿主装配代码执行），planify 回退 ".cortex" 会让发行版宿主
    # 读错 .env（~/.cortex/.env 的端口/预设压过宿主自己的 ~/.<dir>/.env）。
    # 宿主侧约定：模块 <host>.config 暴露 data_dirname()。用 importlib 按
    # 名探测而非静态 import——planify 对宿主保持零静态依赖（架构红线：
    # 底层不得 import 高层），宿主缺席时保持 ".cortex" 回退。
    if _data_dirname == ".cortex":
        try:
            import importlib

            _host_cfg = importlib.import_module("doclens.config")
            _host_dd = getattr(_host_cfg, "data_dirname", None)
            if callable(_host_dd):
                register_data_dirname(_host_dd())
        except Exception:
            pass
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


# CORTEX_LOG_LEVEL 可选值 → logging 常数（大小写不敏感；WARN 为 WARNING 别名）
_LOG_LEVEL_NAMES: dict[str, int] = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARN": logging.WARNING,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


def _resolve_log_level(explicit: Optional[int]) -> int:
    """日志级别解析：显式参数 > CORTEX_LOG_LEVEL（env / .env）> INFO。

    显式传参的调用方（如 planify 独立 CLI 的 WARNING）不受 env 影响；
    未传参的调用方（doclens gui/tui/子命令）由 env 调节文件日志详细程度。
    非法值回落 INFO 并告警（fail-open：宁可多记不可漏记）。调试需要
    DEBUG 时显式设 CORTEX_LOG_LEVEL=DEBUG。
    """
    if explicit is not None:
        return explicit
    raw = os.environ.get("CORTEX_LOG_LEVEL")
    if not raw:
        _load_cortex_env()
        raw = os.environ.get("CORTEX_LOG_LEVEL")
    if not raw:
        return logging.INFO
    level = _LOG_LEVEL_NAMES.get(raw.strip().upper())
    if level is None:
        logging.getLogger(__name__).warning(
            "CORTEX_LOG_LEVEL=%r 无法识别（可选 %s），回落 INFO",
            raw, "/".join(_LOG_LEVEL_NAMES),
        )
        return logging.INFO
    return level


def setup_logging(
    log_dir: Optional[Path] = None,
    log_level: Optional[int] = None,
    console_output: bool = False,
    console_level: int = logging.INFO,
) -> logging.Logger:
    """
    设置应用日志记录。

    Args:
        log_dir: 日志文件目录（默认为 <数据目录>/logs，即 .cortex 或 .doclens；
            可用 CORTEX_LOG_DIR 覆盖）
        log_level: 日志级别。None（默认）时读 CORTEX_LOG_LEVEL
            （DEBUG/INFO/WARNING/ERROR/CRITICAL，默认 INFO）；显式传参优先于 env
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

    log_level = _resolve_log_level(log_level)

    # 创建日志目录（默认信任，不再询问）
    log_dir.mkdir(parents=True, exist_ok=True)

    # 格式化器
    fmt = '%(asctime)s | %(levelname)s | %(message)s'
    formatter = logging.Formatter(fmt)

    # 创建处理器列表
    handlers = []

    log_file = log_dir / f"debug_{datetime.now().strftime('%Y%m%d')}.log"
    # 大小轮转兜底：即使出现自反馈/刷屏类异常，单日日志封顶 maxBytes × (backupCount+1)
    file_handler = SafeFileHandler(
        log_file, maxBytes=20 * 1024 * 1024, backupCount=5, encoding='utf-8'
    )
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
    # watchdog: inotify/observers 每个内核事件 debug 一次（in-event ...）——日志
    #   文件若在被监控目录内，写日志 → IN_MODIFY → 再 debug 的自反馈风暴（曾把
    #   单日 debug log 刷到 GB 级；Linux inotify 下 1ms 多条）
    for _name in ("pdfminer", "pdfplumber", "markitdown",
                  "urllib3", "httpx", "httpcore", "asyncio", "filelock",
                  "sse_starlette", "PIL", "watchdog"):
        logging.getLogger(_name).setLevel(logging.WARNING)

    logger = logging.getLogger(__name__)
    logger.info("=" * 50 + " Runtime Started " + "=" * 50)

    return logger
