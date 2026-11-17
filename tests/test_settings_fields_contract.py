# -*- coding: utf-8 -*-
"""设置页字段契约守卫（AP-6）：前端 settings-fields.ts 的 envVar 集合必须
是后端 config_store.KNOWN_KEYS 的子集——漂移即红（jimeng 两次 feat 提交
加字段未同步测试的实证教训，见 antipatterns/frontend-views.md AP-8）。

方向说明：KNOWN_KEYS 是「后端认识的可写键」全集（含预设物化键，如
PLANIFY_BASE_URL 等由预设区块接管、不在散填字段清单里）；SETTINGS_FIELDS
是「设置页散填字段」子集。守卫单向：前端字段 ⊆ 后端键（前端写了后端不
认识的键 = 静默丢值）；反向不约束（后端键可以无 UI 字段）。
"""
import re
from pathlib import Path

from doclens.web_v2.config_store import KNOWN_KEYS

_SETTINGS_FIELDS_TS = (
    Path(__file__).resolve().parent.parent
    / "doclens/web_v2/frontend/src/views/settings-fields.ts"
)

_ENVVAR_RE = re.compile(r'^\s*envVar:\s*"([A-Z][A-Z0-9_]*)"', re.MULTILINE)


def _frontend_env_vars() -> set[str]:
    text = _SETTINGS_FIELDS_TS.read_text(encoding="utf-8")
    return set(_ENVVAR_RE.findall(text))


def test_settings_fields_ts_exists():
    assert _SETTINGS_FIELDS_TS.is_file(), f"前端字段清单缺失: {_SETTINGS_FIELDS_TS}"


def test_frontend_fields_subset_of_known_keys():
    """前端散填字段的 envVar 必须全部在 KNOWN_KEYS 中（否则保存静默丢值）。"""
    fields = _frontend_env_vars()
    assert fields, "settings-fields.ts 未解析到任何 envVar——解析规则可能已失效"
    unknown = fields - KNOWN_KEYS
    assert not unknown, (
        f"前端字段不在后端 KNOWN_KEYS（保存会被静默丢弃）: {sorted(unknown)}"
    )


def test_frontend_fields_use_ui_reachable_keys():
    """KNOWN_KEYS 中的「散填入口」键应在前端有字段——本守卫只抽查历史漂移
    高发键（即梦/天气/思考深度/门禁），不全等约束（预设物化键无 UI 字段属正常）。"""
    fields = _frontend_env_vars()
    drift_prone = {
        "JIMENG_API_KEY",
        "JIMENG_MODEL",
        "JIMENG_ACCESS_KEY",
        "JIMENG_SECRET_KEY",
        "BAIDU_WEATHER_AK",
        "VISION_AUTO_ROTATE",
        "PLANIFY_ASK_MODE",
        "PLANIFY_OUTSIDE_WORKDIR",
        "PLANIFY_THINKING_DEPTH",
    }
    missing = drift_prone - fields
    assert not missing, (
        f"后端键缺前端字段（用户在 UI 不可见/不可配）: {sorted(missing)}"
    )
