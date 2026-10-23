"""Validate a {env_var: value} dict against the CortexConfig schema.

We construct a CortexConfig with the supplied values (via env injection) and
catch pydantic ValidationError, mapping each error to (field, message).
Unknown keys are reported separately.
"""
from __future__ import annotations

import os

from pydantic import ValidationError

from doclens.config import CortexConfig
from doclens.web_v2.config_store import KNOWN_KEYS
from doclens.web_v2.models.config import ConfigValidationError


# Build mapping from pydantic field names to env var names
# This is needed because pydantic ValidationError uses field names,
# but our API uses env var names (e.g., "max_results" vs "CORTEX_MAX_RESULTS")
_FIELD_TO_ENV: dict[str, str] = {}
for field_name, field_info in CortexConfig.model_fields.items():
    # Use alias if available, otherwise construct from env_prefix
    if hasattr(field_info, 'alias') and field_info.alias:
        env_name = field_info.alias
    else:
        env_name = f"CORTEX_{field_name.upper()}"
    _FIELD_TO_ENV[field_name] = env_name


class ValidationErrors(Exception):
    """Aggregated per-field validation errors."""

    def __init__(self, fields: list[ConfigValidationError]) -> None:
        self.fields = fields
        super().__init__("; ".join(f"{f.field}: {f.error}" for f in fields))


def _llm_endpoint_rules(values: dict[str, str]) -> list[ConfigValidationError]:
    """LLM 端点校验（provider 概念已废弃，ADR-0009；预设切换时也走此校验）。"""
    errors: list[ConfigValidationError] = []
    protocol = values.get("PLANIFY_PROTOCOL", "").strip()
    base_url = values.get("PLANIFY_BASE_URL", "").strip()

    if protocol == "openai_compat" and base_url and not base_url.startswith(("http://", "https://")):
        errors.append(ConfigValidationError(
            field="PLANIFY_BASE_URL",
            error="openai_compat 协议需要 http:// 或 https:// URL",
        ))

    return errors


def _outside_workdir_rule(values: dict[str, str]) -> list[ConfigValidationError]:
    """外部访问门禁三态校验（ADR-0021；空串 = 未设置 = 默认 ask，跳过）。"""
    raw = values.get("PLANIFY_OUTSIDE_WORKDIR", "").strip().lower()
    if raw and raw not in ("ask", "allow", "block"):
        return [ConfigValidationError(
            field="PLANIFY_OUTSIDE_WORKDIR",
            error="合法值：ask / allow / block",
        )]
    return []


def _ask_mode_rule(values: dict[str, str]) -> list[ConfigValidationError]:
    """对话提问模式校验（ADR-0033；空串 = 未设置 = 默认 interactive，跳过）。"""
    raw = values.get("PLANIFY_ASK_MODE", "").strip().lower()
    if raw and raw not in ("interactive", "chat"):
        return [ConfigValidationError(
            field="PLANIFY_ASK_MODE",
            error="合法值：interactive / chat",
        )]
    return []


def _thinking_depth_rule(values: dict[str, str]) -> list[ConfigValidationError]:
    """思考深度档位校验（空串 = 未设置 = 默认 auto，跳过）。"""
    raw = values.get("PLANIFY_THINKING_DEPTH", "").strip().lower()
    if raw and raw not in ("auto", "off", "low", "medium", "high"):
        return [ConfigValidationError(
            field="PLANIFY_THINKING_DEPTH",
            error="合法值：auto / off / low / medium / high",
        )]
    return []


def _workdir_dir_rule(values: dict[str, str]) -> list[ConfigValidationError]:
    """CORTEX_WORKDIR 非空时必须是已存在的目录（启动时目录不存在会退出）。"""
    import os

    raw = values.get("CORTEX_WORKDIR", "").strip()
    if raw and not os.path.isdir(os.path.expanduser(raw)):
        return [ConfigValidationError(
            field="CORTEX_WORKDIR",
            error=f"目录不存在: {raw}",
        )]
    return []


def _shell_timeout_rule(values: dict[str, str]) -> list[ConfigValidationError]:
    """shell 超时校验：空 = 默认 120；非空必须是 1–3600 的整数。"""
    raw = values.get("PLANIFY_SHELL_TIMEOUT", "").strip()
    if not raw:
        return []
    try:
        t = int(raw)
    except ValueError:
        return [ConfigValidationError(
            field="PLANIFY_SHELL_TIMEOUT",
            error="必须是整数（秒）",
        )]
    if not (1 <= t <= 3600):
        return [ConfigValidationError(
            field="PLANIFY_SHELL_TIMEOUT",
            error="合法范围：1–3600 秒",
        )]
    return []


def _int_range_rule(
    field: str, values: dict[str, str], lo: int, hi: int, unit: str
) -> list[ConfigValidationError]:
    """通用整数范围校验：空串跳过（= 用字段默认/不限语义）。"""
    raw = values.get(field, "").strip()
    if not raw:
        return []
    try:
        v = int(raw)
    except ValueError:
        return [ConfigValidationError(field=field, error=f"必须是整数（{unit}）")]
    if not (lo <= v <= hi):
        return [ConfigValidationError(field=field, error=f"合法范围：{lo}–{hi} {unit}")]
    return []


def _round_budget_rules(values: dict[str, str]) -> list[ConfigValidationError]:
    """AI 轮次预算校验。

    - PLANIFY_MAX_TOOL_ROUNDS（主循环软上限）：空 = 默认 0 = 不限；
      非空必须是 0–500 的整数（0 = 不限；硬阈值 = 本值 + 10）。
    - PLANIFY_MAX_SUBAGENT_ROUNDS（task 子代理上限）：空 = 默认 30；
      非空必须是 1–200 的整数。
    """
    return (
        _int_range_rule("PLANIFY_MAX_TOOL_ROUNDS", values, 0, 500, "轮")
        + _int_range_rule("PLANIFY_MAX_SUBAGENT_ROUNDS", values, 1, 200, "轮")
    )


def _llm_trace_rule(values: dict[str, str]) -> list[ConfigValidationError]:
    """LLM trace 保留天数校验（空/0 = 关闭；非空必须是 1–365 的整数天）。"""
    raw = values.get("PLANIFY_LLM_TRACE", "").strip()
    if not raw:
        return []
    try:
        d = int(raw)
    except ValueError:
        return [ConfigValidationError(
            field="PLANIFY_LLM_TRACE",
            error="必须是整数（天）",
        )]
    if not (0 <= d <= 365):
        return [ConfigValidationError(
            field="PLANIFY_LLM_TRACE",
            error="合法范围：0–365 天（0 = 关闭）",
        )]
    return []


def validate_values(values: dict[str, str]) -> ValidationErrors:
    """Return ValidationErrors (possibly empty) for the given values dict.

    Two sources of error:
    1. Unknown key (not in KNOWN_KEYS)
    2. pydantic ValidationError when constructing CortexConfig with these values
       (covers type mismatches like non-numeric strings for int fields)
    """
    errors: list[ConfigValidationError] = []

    # 1. Unknown keys
    for key in values:
        if key not in KNOWN_KEYS:
            errors.append(ConfigValidationError(
                field=key,
                error=f"未知的配置项: {key}",
            ))

    # 2. Type validation via CortexConfig
    # CortexConfig uses env_prefix="CORTEX_" and several aliases (PLANIFY_*,
    # TREESEARCH_*). The cleanest cross-cutting validation is to construct it
    # inside a modified environment.
    env_backup = dict(os.environ)
    try:
        # Clear our known keys from env first so only `values` apply
        for key in KNOWN_KEYS:
            os.environ.pop(key, None)
        for key, value in values.items():
            # 空字符串 = 删除/未设置（write_env_values 的 unset_key 语义），
            # 不参与校验：让 CortexConfig 用字段默认值，避免未填的可选数值
            # 字段被当作 "" 解析为 number 失败。
            if key in KNOWN_KEYS and value != "":
                os.environ[key] = value
        try:
            CortexConfig(_env_file=None)
        except ValidationError as ve:
            for err in ve.errors():
                # err["loc"] is a tuple like ("max_results",) or ("planify_api_key",)
                # We map it back to env var name for user-facing errors
                loc_parts = err.get("loc", ())
                if loc_parts:
                    field_name = str(loc_parts[0])  # First part is the field name
                    # Map to env var name
                    env_name = _FIELD_TO_ENV.get(field_name, field_name)
                    msg = err.get("msg", "invalid")
                    errors.append(ConfigValidationError(field=env_name, error=msg))
    finally:
        # Restore env
        os.environ.clear()
        os.environ.update(env_backup)

    # LLM 端点规则（provider 概念已废弃，ADR-0009）
    errors.extend(_llm_endpoint_rules(values))
    # 外部访问门禁三态规则（ADR-0021）
    errors.extend(_outside_workdir_rule(values))
    # 对话提问模式规则（ADR-0033）
    errors.extend(_ask_mode_rule(values))
    # 思考深度档位规则（auto/off/low/medium/high）
    errors.extend(_thinking_depth_rule(values))
    # 工作目录覆盖规则（目录存在性）
    errors.extend(_workdir_dir_rule(values))
    # shell 超时规则（1–3600 整数）
    errors.extend(_shell_timeout_rule(values))
    # LLM trace 保留天数规则（0–365 整数天；0 = 关闭）
    errors.extend(_llm_trace_rule(values))
    # AI 轮次预算规则（主循环 0–500、子代理 1–200；0 = 不限）
    errors.extend(_round_budget_rules(values))

    return ValidationErrors(fields=errors)
