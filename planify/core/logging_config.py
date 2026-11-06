"""日志配置

提供安全的文件日志记录，支持编码错误处理与大小轮转。

框架层与宿主层的边界（CLAUDE.md 红线 1「底层禁止 import 高层」）：

- 框架**不知道**宿主的数据目录叫什么（.cortex / .doclens / 其它），也不
  知道宿主的 .env 放在哪、哪些 env 键属于宿主——这些一律由宿主经
  ``register_data_dirname()`` / ``register_env_loader()`` **注入**；
- 框架**不得**为「猜」宿主口径而反向 import 宿主模块（哪怕用 importlib
  按名探测——那只是把静态依赖藏进字符串，运行时反向依赖照旧）。宿主缺席
  时框架用中性回退值，宿主在场时宿主说了算。
"""

import logging
import logging.handlers
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional


# =============================================================================
# 宿主数据目录名（注入式单一真相源）
# =============================================================================
# 框架不知道宿主的数据目录叫什么（宿主开发态 .cortex / 发行态 .doclens / 其它）
# ——由宿主在启动时经 register_data_dirname() 注入；未注入回退 ".planify"
# （框架自己的命名空间，见下方说明）。
#
# 历史（2026-10-09 收敛）：旧实现读 CORTEX_DATA_DIRNAME env，而宿主侧
# 宿主 config 的 data_dirname() 是现场计算（is_installed_mode）——两个同名
# 函数、两套真相源。宿主用 setdefault 把自己的决策写入 env 本意是同步给
# planify，但「外部已有值则尊重」的语义让子进程继承宿主 env 时被劫持
# （AI 宿主 .doclens → 其启动的 dev 实例日志落错目录，DB 却因现场计算而
# 落对——同进程内分裂）。注入通路不经过进程环境，天然免疫继承劫持。
#
# 2026-11-06（ADR-0053）：此处曾有一处 importlib 按名探测宿主模块
# （importlib.import_module("doclens.config")）来「猜」数据目录名——用动态
# import 规避静态依赖检查，实质仍是运行时反向依赖（框架知道宿主模块名），
# 违反红线 1。现改为纯注入：宿主调 register_data_dirname()，未注入则回退
# 框架自己的 ".planify"（**不再**回退宿主的 ".cortex"——框架层不该知道
# 宿主的数据目录名，哪怕只是个字符串常量）。
_data_dirname: str = ".planify"


def register_data_dirname(name: str) -> None:
    """宿主注入数据目录名（宿主在装配期调用，传 ".cortex"/".doclens"）。

    必须在首次 data_dirname() 调用前完成（日志/agent.md/临时目录定位都依赖
    它）；重复调用以最后一次为准（测试 monkeypatch 场景）。
    """
    global _data_dirname
    _data_dirname = name


def data_dirname() -> str:
    """数据目录名：宿主注入值；未注入（planify 独立运行）回退 ".planify"。"""
    return _data_dirname


# =============================================================================
# 宿主 .env 加载器（注入式扩展点）
# =============================================================================
# 框架需要 .env 里的两类东西：
#   1. 框架自己的键（PLANIFY_*）——供 planify.core.config 等消费；
#   2. 宿主的键（端口、预设、日志级别……）——供宿主自己消费。
# 但 .env 文件的**位置**由宿主决定（宿主数据目录名 + 宿主自己的 .env 约定），
# 框架无从得知。旧实现用 importlib 反向 import 宿主模块来问「你的 .env 在哪」，
# 属运行时反向依赖（红线 1），已删除。
#
# 现由宿主注入一个 loader 回调：框架调用它加载 .env，框架只负责「把 env
# 灌进 os.environ」这一动作，**不关心**文件在哪、里面有什么键。
#
# 契约：
#   - 回调签名为 ``loader() -> None``，在进程内被调用至多一次（幂等）；
#   - 回调内部自行决定加载哪些文件、用什么 override 语义；
#   - 宿主未注册 loader 时，框架**不加载任何 .env**（planify 独立运行走
#     自身 ``.planify/.env`` 约定，见 planify.core.config.get_config）。
#
# 宿主注入时机：必须在首次 setup_logging() / data_dirname() 消费前完成
# （doclens 在 config 模块级完成——见 ADR-0053）。
_env_loader: Optional[Callable[[], None]] = None
_env_loaded: bool = False


def register_env_loader(loader: Callable[[], None]) -> None:
    """宿主注入 .env 加载器（回调：无参，加载宿主约定的 .env 到 os.environ）。

    重复调用以最后一次为准（测试 monkeypatch 场景）。注册后本进程内
    _load_env() 会调用一次该回调。
    """
    global _env_loader, _env_loaded
    _env_loader = loader
    _env_loaded = False


def _load_env() -> None:
    """加载 .env（宿主注入 loader 时委派；未注册则什么都不做）。

    幂等：进程内至多真正加载一次（避免重复 load_dotenv 覆盖热更新的值）。
    """
    global _env_loaded
    if _env_loaded:
        return
    _env_loaded = True
    loader = _env_loader
    if loader is None:
        return
    try:
        loader()
    except Exception:  # noqa: BLE001 — env 加载失败不得阻断启动
        pass


# =============================================================================
# 原生崩溃捕获（faulthandler）
# =============================================================================
# 原生扩展（sqlite3 / 各文档解析器等）发生段错误/访问违例时进程直接死掉，
# Python 层无异常可写、日志戛然而止，只能靠 WER dump 事后取证（2026-10-16
# 0xc0000005 事故）。faulthandler 在致命信号（SIGSEGV / Windows 0xc0000005
# 等）时把崩溃线程及全部线程的 Python 层调用栈直接写入文件，绕过 logging
# （崩溃时 logging 自身可能已不可用）。
#
# 文件策略：<log_dir>/crash_<pid>.log——正常启动只创建空文件（零写入开销），
# 崩溃时才有内容；进程每次启动清理历史空崩溃文件，非空文件 = 崩溃留证，
# 保留待查（重启不丢证据）。必须持引用防 GC 关闭 fd。
_fault_file = None


def _enable_faulthandler(log_dir: Path) -> Optional[Path]:
    """启用 faulthandler，崩溃栈写入 log_dir/crash_<pid>.log。

    Returns:
        崩溃文件路径；不可用时返回 None（绝不阻断启动）。
    """
    global _fault_file
    try:
        import faulthandler

        # 清理历史空崩溃文件（非空 = 崩溃留证，保留；Windows 上打开中的
        # 文件 unlink 会 PermissionError，正好跳过其它进程的活文件）
        for old in log_dir.glob("crash_*.log"):
            try:
                if old.stat().st_size == 0:
                    old.unlink()
            except OSError:
                pass

        if _fault_file is not None:
            try:
                _fault_file.close()
            except OSError:
                pass
        crash_path = log_dir / f"crash_{os.getpid()}.log"
        _fault_file = open(crash_path, "w", encoding="utf-8")
        faulthandler.enable(file=_fault_file, all_threads=True)
        return crash_path
    except Exception:
        _fault_file = None
        return None


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


# PLANIFY_LOG_LEVEL 可选值 → logging 常数（大小写不敏感；WARN 为 WARNING 别名）
_LOG_LEVEL_NAMES: dict[str, int] = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARN": logging.WARNING,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


def _resolve_log_level(explicit: Optional[int]) -> int:
    """日志级别解析：显式参数 > PLANIFY_LOG_LEVEL（env / .env）> INFO。

    显式传参的调用方（如 planify 独立 CLI 的 WARNING）不受 env 影响；
    未传参的调用方（宿主 gui/tui/子命令）由 env 调节文件日志详细程度。
    非法值回落 INFO 并告警（fail-open：宁可多记不可漏记）。调试需要
    DEBUG 时显式设 PLANIFY_LOG_LEVEL=DEBUG。
    """
    if explicit is not None:
        return explicit
    raw = os.environ.get("PLANIFY_LOG_LEVEL")
    if not raw:
        _load_env()
        raw = os.environ.get("PLANIFY_LOG_LEVEL")
    if not raw:
        return logging.INFO
    level = _LOG_LEVEL_NAMES.get(raw.strip().upper())
    if level is None:
        logging.getLogger(__name__).warning(
            "PLANIFY_LOG_LEVEL=%r 无法识别（可选 %s），回落 INFO",
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
        log_dir: 日志文件目录（默认为 <数据目录>/logs，即 .planify 或宿主
            注入的数据目录；可用 PLANIFY_LOG_DIR 覆盖）
        log_level: 日志级别。None（默认）时读 PLANIFY_LOG_LEVEL
            （DEBUG/INFO/WARNING/ERROR/CRITICAL，默认 INFO）；显式传参优先于 env
        console_output: 是否输出到控制台（默认为 False）
        console_level: 控制台日志级别（默认为 INFO）

    Returns:
        配置好的日志记录器实例
    """
    if log_dir is None:
        # 优先从环境变量读取
        env_dir = os.environ.get("PLANIFY_LOG_DIR")
        if env_dir:
            log_dir = Path(env_dir)
        else:
            # 从 .env 文件读取（宿主注入 loader 时由 loader 负责加载）
            _load_env()
            env_dir = os.environ.get("PLANIFY_LOG_DIR")
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

    # unraisable/线程异常兜底（见 logging_capture 模块注释）：GC 终结器、
    # __del__、线程里吞不掉的异常默认只进 stderr，log 文件无凭——装钩子
    # 落文件（幂等，先于 faulthandler：Python 层先兜，原生崩溃归 faulthandler）
    from .logging_capture import install_unraisable_capture

    install_unraisable_capture()

    # 原生崩溃捕获（见 _enable_faulthandler 文档字符串）：放最后，日志目录
    # 落定、Runtime Started 落盘之后再挂 fatal-signal handler
    crash_path = _enable_faulthandler(log_dir)
    if crash_path:
        logger.debug("faulthandler enabled, crash file: %s", crash_path)

    return logger
