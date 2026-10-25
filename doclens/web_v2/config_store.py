"""Filesystem layer for /api/config endpoints.

Responsibilities:
- Resolve the .env path for a given scope (local|global)
- Read a subset of keys from .env (using python-dotenv)
- Write updates to .env while preserving unrelated keys / comments / order,
  with empty-string => unset_key semantics (spec §6.2)

写入纪律（AP-34）：进程级锁 + 临时文件 + ``os.replace`` + 值转义。`.env`
有多个写方（设置页保存、预设激活、改密、从全局复制、恢复默认），此前各自
read-modify-write 且互不互斥——并发保存会丢更新，半写会让凭证解析失败
（叠加 auth 的 fail-open）。所有写方必须经本模块。
"""
import os
import re
import threading
from pathlib import Path

from dotenv import dotenv_values

from doclens.config import data_dirname, get_global_cortex_dir

MERGED_VALUES_KEY = "values"  # placeholder; not currently used externally

#: 进程级写锁——`.env` 的读-改-写必须整体串行，否则两个写方互相覆盖。
_ENV_WRITE_LOCK = threading.RLock()

# Settings UI keys. Keep in sync with
# cortex/web_v2/frontend/src/views/settings-fields.ts (created in Task 6)
KNOWN_KEYS: frozenset[str] = frozenset({
    # AI（LLM）— 字段散填入口仍保留，供设置页微调；模型预设切换会物化覆盖这些键
    "PLANIFY_BASE_URL",
    "PLANIFY_API_KEY",
    "PLANIFY_MODEL_ID",
    "PLANIFY_PROTOCOL",
    "PLANIFY_CONTEXT_WINDOW",
    "PLANIFY_MAX_TOKENS",
    "CORTEX_ACTIVE_LLM_PRESET",
    # AI 工具外部访问门禁（ADR-0021；空串 = 未设置 = 默认 ask）
    "PLANIFY_OUTSIDE_WORKDIR",
    # AI 对话提问模式（ADR-0033；空串 = 未设置 = 默认 interactive）
    "PLANIFY_ASK_MODE",
    # LLM 思考深度档位（auto/off/low/medium/high；保存即热生效：经
    # apply_config → update_llm_config 重建主 Provider，对新回合生效）
    "PLANIFY_THINKING_DEPTH",
    # 视觉模型（图像文件解析，独立于 AI 对话配置）
    "VISION_API_KEY",
    "VISION_BASE_URL",
    "VISION_MODEL",
    "VISION_PROTOCOL",
    "VISION_AUTO_ROTATE",
    "CORTEX_ACTIVE_VISION_PRESET",
    "CORTEX_ACTIVE_SEARCH_PRESET",
    # PDF 翻译预设（ADR-0039）：激活键 + 物化的服务/模型/envs JSON/默认语言
    "CORTEX_ACTIVE_TRANSLATE_PRESET",
    "CORTEX_TRANSLATE_SERVICE",
    "CORTEX_TRANSLATE_MODEL",
    "CORTEX_TRANSLATE_ENVS",
    "CORTEX_TRANSLATE_LANG_OUT",
    # 百度天气 API（日记录入时抓城市天气；空 = 不带天气，不阻断日记）
    "BAIDU_WEATHER_AK",
    # Search
    "CORTEX_MAX_RESULTS",
    "CORTEX_MAX_SPAN",
    "CORTEX_MIN_SCORE_THRESHOLD",
    "CORTEX_SEARCH_CONTEXT_BEFORE",
    "CORTEX_SEARCH_CONTEXT_AFTER",
    # Scoring
    "CORTEX_WEIGHT_KEYWORD_MATCH",
    "CORTEX_WEIGHT_FILE_NAME_MATCH",
    "CORTEX_WEIGHT_FTS_SCORE",
    "CORTEX_WEIGHT_TITLE_MATCH",
    "CORTEX_WEIGHT_PROXIMITY_MATCH",
    # 网络监听（host/port 改后需重启 gui 才生效）
    "CORTEX_WEB_HOST",
    "CORTEX_WEB_PORT",
    "CORTEX_MCP_ENABLED",
    "CORTEX_MCP_HOST",
    "CORTEX_MCP_PORT",
    # 知识库 Git 同步开关（改后需重启 gui 才生效）
    "CORTEX_SYNC_ENABLED",
    # 工作目录配置（次优先级：显式 -C > 本配置 env/local/global > 启动目录；
    # 改后需重启，空 = 按启动目录）
    "CORTEX_WORKDIR",
    # shell 超时（秒；bash/powershell/background_run 三通道统一预算，
    # 调用期现读 → 保存即热生效；空 = 默认 120，上限 3600）
    "PLANIFY_SHELL_TIMEOUT",
    # LLM trace 落盘保留天数（0 = 关；>0 = 保留天数，tracer 创建时清理过期文件）
    "PLANIFY_LLM_TRACE",
    # AI 轮次预算（保存即热生效：主循环软上限每请求现读 RuntimeConfig，
    # 子代理上限每次调用现读 env；均经 reload_config 的 load_dotenv 同步）
    "PLANIFY_MAX_TOOL_ROUNDS",
    "PLANIFY_MAX_SUBAGENT_ROUNDS",
    # 注入回执总开关（2026-10-25 清剿事故后单一参数化：8 处合成 assistant
    # 注入点统一读 core.config.injection_ack_enabled——env 现读热生效；
    # 仅严格交替端点需要置 1，默认空 = 关）
    "PLANIFY_INJECTION_ACK",
    # 长期记忆开关（ADR-0042；保存即热生效：memory_disabled/guidance 每次
    # 构造 agent 现读进程 env——config API 显式同步，与 ADR-0021 同模式）
    "CORTEX_MEMORY_DISABLE",
})

# 敏感凭据：GET 接口脱敏返回，PUT 时占位符跳过（防泄露 + 防回写覆盖真值）
SECRET_KEYS: frozenset[str] = frozenset({"PLANIFY_API_KEY", "VISION_API_KEY", "BAIDU_WEATHER_AK", "CORTEX_TRANSLATE_ENVS"})
SECRET_MASK = "***"


def mask_secret_values(values: dict[str, str]) -> dict[str, str]:
    """对 SECRET_KEYS 中的非空值用固定占位符替代，避免经 GET /api/config 泄露明文。

    空值（未配置）保持 ""——前端据此显示"未设置"，且不影响 PUT 的占位符跳过逻辑。
    """
    return {
        k: (SECRET_MASK if k in SECRET_KEYS and v else v)
        for k, v in values.items()
    }


def strip_unchanged_secrets(updates: dict[str, str]) -> dict[str, str]:
    """从 PUT updates 中剔除"未改动的密钥"。

    前端设置页保存时提交全部字段（含 GET 返回的占位符）；占位符表示用户未改动
    该密钥，必须跳过，以免用占位符覆盖真值。空串（用户主动清空=删除）与非占位符
    值（用户改成新 key=更新）保留。
    """
    return {
        k: v for k, v in updates.items()
        if not (k in SECRET_KEYS and v == SECRET_MASK)
    }


def resolve_env_path(scope: str) -> Path:
    """Return the .env file path for the given scope.

    local  -> {cwd}/{data_dirname}/.env   （开发 .cortex / 发行版 .doclens）
    global -> {home}/{data_dirname}/.env
    """
    if scope == "local":
        return Path(os.getcwd()) / data_dirname() / ".env"
    if scope == "global":
        return get_global_cortex_dir() / ".env"
    raise ValueError(f"Unknown scope: {scope!r}")


def read_env_values(
    path: Path, keys: frozenset[str] = KNOWN_KEYS
) -> tuple[dict[str, str], bool]:
    """Return (values, exists).

    values maps each requested key to its current string value ("" if unset
    or if the file is missing). exists is False if `path` does not exist.
    """
    if not path.exists():
        return {k: "" for k in keys}, False
    raw = dotenv_values(str(path))  # dict[str, Optional[str]]
    return {k: (raw.get(k) or "") for k in keys}, True


_KEY_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=")

#: 需要加双引号的值：含空白/引号/#（会被截断或误解析）、首尾有空白（会被 strip）、
#: 含换行（会被拆成两行、第二行成为垃圾键）、含反斜杠（双引号内需转义）。
_NEEDS_QUOTE_RE = re.compile(r"""[\s"'#\\]""")


def _quote_value(value: str) -> str:
    """把值渲染成 dotenv 可原样读回的一行（必要时加双引号并转义）。

    不引用时保持原样——`.env` 的可读性/既有测试文本断言都依赖裸值。
    """
    if not _NEEDS_QUOTE_RE.search(value) and value == value.strip():
        return value
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )
    return f'"{escaped}"'


def _atomic_write(path: Path, text: str) -> None:
    """同目录临时文件 + ``os.replace``——写一半崩溃不会留下截断的 `.env`。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass  # 清理失败不影响已完成的替换；残留 tmp 下次覆盖


def _apply_env_updates(text: str, updates: dict[str, str]) -> str:
    """对 .env 文本应用更新，保留无关内容与各 key 的注释块。

    - 非空 value：更新对应 KEY=value（保留其上方注释）。
    - 空 value：删除该 KEY 行 + 上方紧邻注释块 + 相邻空行
      （python-dotenv 的 unset_key 只删 KEY 行会留下孤儿注释，故自行实现）。
    - 新增 KEY（文件中不存在）：追加到末尾。
    """
    lines = text.splitlines()
    n = len(lines)
    delete = [False] * n
    key_idx: dict[str, int] = {}

    for i, line in enumerate(lines):
        m = _KEY_RE.match(line)
        if m:
            key_idx.setdefault(m.group(1), i)  # 取首次出现

    for key, value in updates.items():
        if key not in key_idx:
            continue  # 新增 key 稍后统一追加
        i = key_idx[key]
        if value == "":
            delete[i] = True
            # 上方紧邻注释块
            j = i - 1
            while j >= 0 and lines[j].lstrip().startswith("#"):
                delete[j] = True
                j -= 1
            # 上方一个分隔空行
            if j >= 0 and lines[j].strip() == "":
                delete[j] = True
            # 下方紧邻空行
            k = i + 1
            while k < n and lines[k].strip() == "":
                delete[k] = True
                k += 1
        else:
            lines[i] = f"{key}={_quote_value(value)}"

    result = [line for i, line in enumerate(lines) if not delete[i]]

    # 追加文件中不存在、但 updates 非空的 key
    appended = [
        f"{k}={_quote_value(v)}" for k, v in updates.items()
        if v != "" and k not in key_idx
    ]
    if appended:
        if result and result[-1].strip() != "":
            result.append("")
        result.extend(appended)

    # 清理：抑制开头空行、折叠连续空行、去掉末尾空行
    cleaned: list[str] = []
    prev_blank = True
    for line in result:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        cleaned.append(line)
        prev_blank = is_blank
    while cleaned and cleaned[-1].strip() == "":
        cleaned.pop()

    return "\n".join(cleaned) + "\n" if cleaned else ""


def write_env_values(path: Path, updates: dict[str, str]) -> None:
    """Apply updates to .env at `path`, preserving unrelated keys / comments /
    order. 空串 => 删除该 key 及其注释块。Creates parent dirs and the file if
    missing.

    全模块唯一写入口（AP-34）：进程级锁串行读-改-写，临时文件 + ``os.replace``
    原子替换，值经 ``_quote_value`` 转义。任何绕过本函数直写 `.env` 的代码
    都会重新引入「并发丢更新 / 半写 / 值被截断」三类缺陷。
    """
    with _ENV_WRITE_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        text = path.read_text(encoding="utf-8") if path.exists() else ""
        _atomic_write(path, _apply_env_updates(text, updates))


def copy_env_file(src: Path, dst: Path) -> None:
    """把 ``src`` 的原文整体复制到 ``dst``（原子 + 同一把写锁）。

    用于「从全局复制到本地」——必须走本模块的写入纪律，直接 ``shutil.copyfile``
    会与并发保存互相截断，且绕过统一入口（AP-34）。
    """
    with _ENV_WRITE_LOCK:
        text = src.read_text(encoding="utf-8")
        _atomic_write(dst, text)


def reset_env_to_example(path: Path) -> None:
    """把 .env 重置为包内 ``.env.example`` 模板，保留用户已有的 API key。

    用于设置页「恢复默认」：得到一份与首次运行一致的、带注释与默认值的规范配置，
    而不是把文件掏空。仅密钥类（无出厂默认）从现有 .env 保留，
    包括 PLANIFY_API_KEY（AI 对话）、VISION_API_KEY（视觉模型）与
    BAIDU_WEATHER_AK（百度天气）。
    """
    from doclens.config import bundled_env_example_path

    src = bundled_env_example_path()
    if not src.exists():
        raise FileNotFoundError(f"包内 .env.example 模板缺失: {src}")

    # 读现有关键密钥 + 写模板必须在同一把锁内：否则保存设置并发的写入
    # 会在读与写之间被本函数整体覆盖（AP-34）。
    with _ENV_WRITE_LOCK:
        preserved: dict[str, str] = {}
        if path.exists():
            existing = read_env_values(path, SECRET_KEYS)[0]
            preserved = {k: v for k, v in existing.items() if v}

        content = src.read_text(encoding="utf-8")
        if preserved:
            content = _apply_env_updates(content, preserved)

        _atomic_write(path, content)
