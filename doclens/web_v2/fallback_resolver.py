"""兜底模型解析器（ADR-0061）——宿主侧策略，实现 planify ``FallbackResolver`` 协议。

框架（planify runner）只出机制：切换触发时来问「下一个该用谁」。本模块
回答这个问题，三步：

1. **候选排序**：兜底清单（``presets_store.get_fallback_order``，有序）
   → 剔除当前模型 → **同源提权**：与当前模型同供应商（按 base_url 主机名
   识别）的排最前，同供应商内 ``model_id`` 大小写不敏感精确相等者再排前
   （= 换账号续跑同一模型）；其余按清单原序。带图回合只选 ``vision`` 预设。
2. **并行预检**：对所有候选并发查额度（``quota_probe.fetch_quota``），
   按三级口径过滤——窗口已用 ≥ 阈值 / 余额 < 阈值 → 不可用；都拿不到或
   预检出错 → 退回试调（保留在队列）。
3. **逐个出队**：每次 ``resolve`` 弹出队首构造 provider 交给 runner；
   runner 试调失败会再来问，本模块把失败原因记进 ``last_report``。

每回合一个实例（chat.py 每请求新建 StreamingAgent 时一并新建）；清单与
阈值在实例化时读一次，回合内固定。
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from planify.core.llm import create_provider
from planify.streaming.types import FallbackCandidate

from doclens.web_v2 import presets_store
from doclens.web_v2.quota_probe import QuotaInfo, fetch_quota

logger = logging.getLogger(__name__)

#: 预检单候选的超时（额度接口 15s 上限；并行后总耗时 ≈ 最慢者）
PRECHECK_TIMEOUT_S = 15.0


@dataclass
class CandidateEntry:
    """一个候选的内部表示。"""

    preset: Dict[str, Any]
    label: str
    provider_key: str          # base_url 主机名（小写）——同源判定键
    model_id: str
    outcome: Optional[str] = None  # 被拒原因（进 failed 报告）


def provider_key(base_url: str) -> str:
    """base_url → 供应商识别键（主机名小写；解析不出退回原串）。"""
    try:
        parsed = urlparse(base_url or "")
        host = (parsed.hostname or "").lower()
        return host or (base_url or "").lower()
    except Exception:  # noqa: BLE001
        return (base_url or "").lower()


def _label(preset: Dict[str, Any]) -> str:
    """用户可见名：预设名 + 模型 id（「GLM-5.3（账号2）」形态）。"""
    name = str(preset.get("name") or "").strip()
    model = str(preset.get("model_id") or "").strip()
    return f"{name} · {model}" if name and model else (name or model or "未命名预设")


def rank_candidates(
    order_ids: List[str],
    presets_by_id: Dict[str, Dict[str, Any]],
    *,
    current_model_id: str,
    current_base_url: str,
    require_vision: bool,
    tried: List[str],
    current_preset_id: Optional[str] = None,
) -> List[CandidateEntry]:
    """候选排序（纯函数，便于测试）：剔除 → 同源提权 → 稳定排序。

    同源提权三档（稳定排序，档内保持清单原序）：
      0. 同供应商 且 同 model_id（大小写不敏感精确相等）
      1. 同供应商
      2. 其余
    ``current_preset_id`` = 当前激活预设（跳过它——切到自己等于没切）。
    """
    cur_key = provider_key(current_base_url)
    cur_model = (current_model_id or "").strip().lower()
    tried_set = set(tried)
    # 当前激活预设的 id（base_url+model_id+api_key 全同才是「同一个预设」）：
    # 同 model_id 同主机但不同账号 = 换账号续跑同一模型，正是首选候选，
    # 不得跳过。调用方以 current_preset_id 显式告知时按 id 判；否则按
    # 三元组全等判（缺 api_key 时退化为 base_url+model_id 全等）。
    cur_pid = current_preset_id

    entries: List[CandidateEntry] = []
    for pid in order_ids:
        p = presets_by_id.get(pid)
        if p is None or p.get("kind") != "llm":
            continue
        if cur_pid is not None:
            if pid == cur_pid:
                continue
        if pid in tried_set:
            continue
        # 带图回合只选支持视觉的预设（ADR-0034 能力位）
        if require_vision and not p.get("vision"):
            continue
        entries.append(CandidateEntry(
            preset=p,
            label=_label(p),
            provider_key=provider_key(p.get("base_url", "")),
            model_id=str(p.get("model_id") or ""),
        ))

    def tier(e: CandidateEntry) -> int:
        if e.provider_key == cur_key:
            return 0 if e.model_id.strip().lower() == cur_model else 1
        return 2

    return sorted(entries, key=tier)  # sorted 稳定：档内保持清单原序


async def precheck_entry(entry: CandidateEntry, *, window_pct: int, balance_min: float) -> Optional[str]:
    """预检单候选；返回被拒原因，可用 / 拿不到数据 / 出错 → None（退回试调）。"""
    base_url = entry.preset.get("base_url", "")
    api_key = entry.preset.get("api_key", "")
    try:
        info: QuotaInfo = await asyncio.wait_for(
            fetch_quota(base_url, api_key), timeout=PRECHECK_TIMEOUT_S
        )
    except Exception:  # noqa: BLE001 — QuotaProbeError / Timeout / 任何解析异常
        # 预检失败 ≠ 候选不可用：接口挂了 / 非订阅 key / 超时 → 退回试调
        return None

    # 窗口限额：任一窗口已用 ≥ 阈值 → 不可用
    if info.kind == "windows":
        for w in info.windows:
            if w.percentage >= window_pct:
                return f"额度已用 {w.percentage:.0f}%（{w.label}窗口 ≥ {window_pct}%）"
        return None
    # 账户余额：< 阈值 → 不可用；is_available=False → 不可用
    if info.kind == "balance":
        if not info.is_available:
            return "账户余额不足"
        for _cur, total in info.balances:
            try:
                if float(total) < balance_min:
                    return f"余额 {total} < {balance_min:g}"
            except (TypeError, ValueError):
                continue
        return None
    # kind=none（无套餐额度 / 不识别的供应商）→ 退回试调
    return None


class QuotaFallbackResolver:
    """宿主侧 ``FallbackResolver`` 实现：每回合一个实例。

    ``resolve`` 第一次调用时才做预检（惰性——主模型没耗尽就零开销）；
    之后每次调用弹出队首。``last_report`` 供 runner 发 failed 通知。
    """

    def __init__(
        self,
        *,
        current_model_id: str,
        current_base_url: str,
        require_vision: bool = False,
        window_pct: int = 80,
        balance_min: float = 10.0,
        thinking_depth: Optional[str] = None,
        current_preset_name: str = "",
    ) -> None:
        self.current_model_id = current_model_id
        self.current_base_url = current_base_url
        self.require_vision = require_vision
        self.window_pct = window_pct
        self.balance_min = balance_min
        self.thinking_depth = thinking_depth
        # 回合开始时读一次清单 + 预设（回合内固定）
        order_ids = presets_store.get_fallback_order()
        by_id: Dict[str, Dict[str, Any]] = {}
        for pid in order_ids:
            raw = presets_store.get_preset_raw(pid)
            if raw is not None:
                by_id[pid] = raw
        self._order_ids = order_ids
        self._presets_by_id = by_id
        # 当前激活预设以**名称**记（CORTEX_ACTIVE_LLM_PRESET 物化的是预设名，
        # ADR-0011），这里按名（大小写不敏感）反查 id；查不到则不按 id 剔除
        # （退化为不剔除——清单里若有与当前三元组全同的预设也只是多试一次）
        self._current_preset_id: Optional[str] = None
        if current_preset_name:
            want = current_preset_name.strip().lower()
            for pid, p in by_id.items():
                if str(p.get("name", "")).strip().lower() == want:
                    self._current_preset_id = pid
                    break
        self._queue: Optional[List[CandidateEntry]] = None  # 惰性：首次 resolve 时预检
        self._all_entries: List[CandidateEntry] = []        # 预检前的全量候选（标签回查）
        self._rejected: List[CandidateEntry] = []            # 预检/试调被拒的候选
        self.last_report: Optional[List[Dict[str, str]]] = None
        self.prechecked = False

    @property
    def enabled(self) -> bool:
        """是否配置了兜底清单（空清单 = 功能未启用）。"""
        return bool(self._order_ids)

    async def resolve(
        self,
        *,
        current_model_id: str,
        tried: List[str],
        reason: str,
    ) -> Optional[FallbackCandidate]:
        if self._queue is None:
            await self._build_queue(tried=tried)
            self.prechecked = True

        # 上一轮交给 runner 的候选若又失败，runner 会再来问——runner 传来
        # 的 tried 尾部即刚失败的 model_id：在原始候选里按 model_id 找回
        # 其真实标签（找不到就用 model_id 本身）
        if tried:
            last = tried[-1]
            if not any(e.model_id == last for e in self._rejected):
                label = next(
                    (e.label for e in self._all_entries if e.model_id == last), last,
                )
                self._rejected.append(CandidateEntry(
                    preset={}, label=label, provider_key="", model_id=last,
                    outcome="试调失败（额度耗尽或不可用）",
                ))

        while self._queue:
            entry = self._queue.pop(0)
            provider = self._make_provider(entry)
            if provider is None:
                entry.outcome = "预设配置无效（协议/模型/密钥缺失）"
                self._rejected.append(entry)
                continue
            return FallbackCandidate(
                provider=provider, model_id=entry.model_id, label=entry.label,
            )

        self.last_report = [
            {"label": e.label, "reason": e.outcome or "不可用"}
            for e in self._rejected
        ]
        return None

    async def _build_queue(self, *, tried: List[str]) -> None:
        entries = rank_candidates(
            self._order_ids, self._presets_by_id,
            current_model_id=self.current_model_id,
            current_base_url=self.current_base_url,
            require_vision=self.require_vision,
            tried=tried,
            current_preset_id=self._current_preset_id,
        )
        if not entries:
            self._queue = []
            return
        # 并行预检（总耗时 = 最慢者），再按同源提权序过滤
        results = await asyncio.gather(*(
            precheck_entry(e, window_pct=self.window_pct, balance_min=self.balance_min)
            for e in entries
        ))
        kept: List[CandidateEntry] = []
        for entry, outcome in zip(entries, results):
            if outcome is None:
                kept.append(entry)
            else:
                entry.outcome = outcome
                self._rejected.append(entry)
        self._queue = kept
        self._all_entries = list(entries)
        logger.info(
            "[FallbackResolver] 预检完成：候选 %d，可用 %d，预检剔除 %d",
            len(entries), len(kept), len(entries) - len(kept),
        )

    def _make_provider(self, entry: CandidateEntry) -> Any:
        p = entry.preset
        try:
            return create_provider({
                "protocol": p.get("protocol") or "",
                "base_url": p.get("base_url") or "",
                "model_id": entry.model_id,
                "api_key": p.get("api_key") or "",
                "thinking_depth": self.thinking_depth or "auto",
            })
        except Exception as e:  # noqa: BLE001
            logger.warning("[FallbackResolver] 构造候选 provider 失败 %s: %s", entry.label, e)
            return None
