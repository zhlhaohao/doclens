"""Filesystem layer for /api/config endpoints.

Responsibilities:
- Resolve the .env path for a given scope (local|global)
- Read a subset of keys from .env (using python-dotenv)
- Write updates to .env while preserving unrelated keys / comments / order,
  with empty-string => unset_key semantics (spec §6.2)
"""
import os
import re
from pathlib import Path

from dotenv import dotenv_values

from doclens.config import data_dirname, get_global_cortex_dir

MERGED_VALUES_KEY = "values"  # placeholder; not currently used externally

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
    # 视觉模型（图像文件解析，独立于 AI 对话配置）
    "VISION_API_KEY",
    "VISION_BASE_URL",
    "VISION_MODEL",
    "VISION_PROTOCOL",
    "CORTEX_ACTIVE_VISION_PRESET",
    "CORTEX_ACTIVE_SEARCH_PRESET",
    # 百度天气 API（日记录入时抓城市天气；空 = 不带天气，不阻断日记）
    "BAIDU_WEATHER_AK",
    # Search
    "CORTEX_MAX_RESULTS",
    "CORTEX_MAX_SPAN",
    "CORTEX_MIN_SCORE_THRESHOLD",
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
})

# 敏感凭据：GET 接口脱敏返回，PUT 时占位符跳过（防泄露 + 防回写覆盖真值）
SECRET_KEYS: frozenset[str] = frozenset({"PLANIFY_API_KEY", "VISION_API_KEY", "BAIDU_WEATHER_AK"})
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
            lines[i] = f"{key}={value}"

    result = [line for i, line in enumerate(lines) if not delete[i]]

    # 追加文件中不存在、但 updates 非空的 key
    appended = [
        f"{k}={v}" for k, v in updates.items() if v != "" and k not in key_idx
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
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.touch()
    text = path.read_text(encoding="utf-8")
    path.write_text(_apply_env_updates(text, updates), encoding="utf-8")


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

    # 保留现有密钥（若有）
    preserved: dict[str, str] = {}
    if path.exists():
        existing = read_env_values(path, SECRET_KEYS)[0]
        preserved = {k: v for k, v in existing.items() if v}

    content = src.read_text(encoding="utf-8")
    if preserved:
        content = _apply_env_updates(content, preserved)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
