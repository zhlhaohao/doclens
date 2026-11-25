# -*- coding: utf-8 -*-
"""兜底模型解析器——宿主侧策略（ADR-0061）。

覆盖：候选排序（同源提权三档 + 剔除规则）、并行预检三级口径（窗口阈值 /
余额阈值 / 拿不到退回试调 / 预检失败不弃用）、resolve 逐个出队与
last_report、presets_store 的 fallback_order 读写与引用失效。
"""
import asyncio

import pytest

from doclens.web_v2 import presets_store
from doclens.web_v2.fallback_resolver import (
    QuotaFallbackResolver,
    CandidateEntry,
    precheck_entry,
    provider_key,
    rank_candidates,
)
from doclens.web_v2.quota_probe import QuotaInfo, QuotaProbeError, QuotaWindow


def _preset(pid, name, base_url, model, vision=True, protocol="anthropic"):
    return {
        "id": pid, "name": name, "kind": "llm", "protocol": protocol,
        "base_url": base_url, "model_id": model, "api_key": "k-" + pid,
        "vision": vision,
    }


# 用户实例：GLM 四账号（g1 当前激活）+ Kimi 两个
G1 = _preset("g1", "GLM 主", "https://open.bigmodel.cn/api", "glm-5.3")
G2 = _preset("g2", "GLM 账号2", "https://open.bigmodel.cn/api", "glm-5.3")
G3 = _preset("g3", "GLM 账号3", "https://open.bigmodel.cn/api", "GLM-5.3")  # 大小写差异
G4 = _preset("g4", "GLM 账号4", "https://open.bigmodel.cn/api", "glm-4.6")
K1 = _preset("k1", "Kimi 1", "https://api.kimi.com/coding", "kimi-k3")
K2 = _preset("k2", "Kimi 2", "https://api.kimi.com/coding", "kimi-k3", vision=False)
BY_ID = {p["id"]: p for p in (G1, G2, G3, G4, K1, K2)}


class TestProviderKey:
    def test_hostname_case_insensitive(self):
        assert provider_key("https://Open.BigModel.cn/api") == "open.bigmodel.cn"

    def test_unparseable_falls_back_to_raw(self):
        assert provider_key("not a url") == "not a url"


class TestRankCandidates:
    ORDER = ["k1", "g2", "k3_missing", "g4", "k2", "g3"]

    def _rank(self, **kw):
        base = dict(
            current_model_id="glm-5.3",
            current_base_url=G1["base_url"],
            require_vision=False,
            tried=[],
        )
        base.update(kw)
        return [e.preset["id"] for e in rank_candidates(self.ORDER, BY_ID, **base)]

    def test_same_provider_promoted_same_model_first(self):
        """同源提权：同 model_id（大小写不敏感）→ 同供应商 → 其余按原序。"""
        assert self._rank() == ["g2", "g3", "g4", "k1", "k2"]

    def test_current_preset_excluded_by_id(self):
        """当前激活预设（按 id）在清单里也跳过——切到自己等于没切。"""
        order = ["g1", "k1"]
        ids = [
            e.preset["id"]
            for e in rank_candidates(order, BY_ID, current_model_id="glm-5.3",
                                     current_base_url=G1["base_url"],
                                     require_vision=False, tried=[],
                                     current_preset_id="g1")
        ]
        assert ids == ["k1"]

    def test_same_model_other_account_is_candidate(self):
        """同 model_id 同主机但不同预设（= 另一个账号）是首选候选，不跳过。"""
        ids = [
            e.preset["id"]
            for e in rank_candidates(["k1", "g2"], BY_ID, current_model_id="glm-5.3",
                                     current_base_url=G1["base_url"],
                                     require_vision=False, tried=[],
                                     current_preset_id="g1")
        ]
        assert ids == ["g2", "k1"]

    def test_same_account_skipped_entirely(self):
        """同主机 + 同 api_key = 同账号：额度按 key 计必同耗尽，不预检不试调。"""
        g1b = {**G1, "id": "g1b", "name": "GLM 主(flash)", "model_id": "glm-5.3-flash"}
        by_id = {**BY_ID, "g1b": g1b}
        ids = [
            e.preset["id"]
            for e in rank_candidates(["g1b", "k1", "g2"], by_id, current_model_id="glm-5.3",
                                     current_base_url=G1["base_url"],
                                     require_vision=False, tried=[],
                                     current_preset_id="g1",
                                     current_api_key=G1["api_key"])
        ]
        assert "g1b" not in ids, "同账号候选必须整体跳过"
        assert ids == ["g2", "k1"], "不同账号的同名模型仍是首选"

    def test_same_account_rule_inactive_without_key(self):
        """调用方未提供 api_key 时不启用同账号剔除（退化为只按 id 剔除）。"""
        g1b = {**G1, "id": "g1b", "name": "GLM 主(flash)", "model_id": "glm-5.3-flash"}
        by_id = {**BY_ID, "g1b": g1b}
        ids = [
            e.preset["id"]
            for e in rank_candidates(["g1b"], by_id, current_model_id="glm-5.3",
                                     current_base_url=G1["base_url"],
                                     require_vision=False, tried=[],
                                     current_preset_id="g1")
        ]
        assert ids == ["g1b"]

    def test_tried_excluded(self):
        assert self._rank(tried=["g2"]) == ["g3", "g4", "k1", "k2"]

    def test_vision_required_filters_non_vision(self):
        assert self._rank(require_vision=True) == ["g2", "g3", "g4", "k1"]

    def test_missing_preset_ignored(self):
        assert "k3_missing" not in self._rank()

    def test_non_same_provider_keeps_order(self):
        """主模型换成 Kimi：GLM 全部退回清单原序，Kimi 同源提权。"""
        ids = [
            e.preset["id"]
            for e in rank_candidates(["k2", "g2", "k1"], BY_ID,
                                     current_model_id="kimi-k3",
                                     current_base_url=K1["base_url"],
                                     require_vision=False, tried=[])
        ]
        assert ids == ["k2", "k1", "g2"]


class TestPrecheck:
    @pytest.fixture(autouse=True)
    def _patch_fetch(self, monkeypatch):
        self.results = {}
        self.calls = []

        async def fake_fetch(base_url, api_key, timeout=15.0):
            self.calls.append(base_url)
            r = self.results[base_url]
            if isinstance(r, Exception):
                raise r
            return r

        monkeypatch.setattr("doclens.web_v2.fallback_resolver.fetch_quota", fake_fetch)

    def _entry(self, p):
        return CandidateEntry(preset=p, label=p["name"], provider_key="", model_id=p["model_id"])

    def test_window_at_threshold_rejected(self):
        self.results[G2["base_url"]] = QuotaInfo(
            kind="windows", windows=(QuotaWindow("5 小时", 80.0),)
        )
        out = asyncio.run(precheck_entry(self._entry(G2), window_pct=80, balance_min=10))
        assert out is not None and "80%" in out

    def test_window_below_threshold_ok(self):
        self.results[G2["base_url"]] = QuotaInfo(
            kind="windows", windows=(QuotaWindow("5 小时", 79.9), QuotaWindow("每周", 30.0))
        )
        assert asyncio.run(precheck_entry(self._entry(G2), window_pct=80, balance_min=10)) is None

    def test_weekly_window_ignored(self):
        """只看 5 小时窗口（2026-11-25 决议）：周窗口 95% 但 5h 仅 10% → 可用。"""
        self.results[G2["base_url"]] = QuotaInfo(
            kind="windows", windows=(QuotaWindow("5 小时", 10.0), QuotaWindow("每周", 95.0))
        )
        assert asyncio.run(precheck_entry(self._entry(G2), window_pct=80, balance_min=10)) is None

    def test_five_hour_over_rejects_even_if_weekly_fine(self):
        self.results[G2["base_url"]] = QuotaInfo(
            kind="windows", windows=(QuotaWindow("5 小时", 82.0), QuotaWindow("每周", 5.0))
        )
        out = asyncio.run(precheck_entry(self._entry(G2), window_pct=80, balance_min=10))
        assert out is not None and "5 小时" in out

    def test_weekly_only_falls_back_to_trial(self):
        """只有周窗口无 5h 数据的候选不做判断——退回试调。"""
        self.results[G2["base_url"]] = QuotaInfo(
            kind="windows", windows=(QuotaWindow("每周", 100.0),)
        )
        assert asyncio.run(precheck_entry(self._entry(G2), window_pct=80, balance_min=10)) is None

    def test_balance_below_threshold_rejected(self):
        self.results[K1["base_url"]] = QuotaInfo(
            kind="balance", balances=(("CNY", "5.20"),)
        )
        out = asyncio.run(precheck_entry(self._entry(K1), window_pct=80, balance_min=10))
        assert out is not None and "5.20" in out

    def test_balance_unavailable_flag_rejected(self):
        self.results[K1["base_url"]] = QuotaInfo(
            kind="balance", balances=(("CNY", "100"),), is_available=False
        )
        assert asyncio.run(precheck_entry(self._entry(K1), window_pct=80, balance_min=10)) is not None

    def test_kind_none_falls_back_to_trial(self):
        """无套餐额度（非订阅 key / 不识别供应商）→ 不弃用，退回试调。"""
        self.results[G2["base_url"]] = QuotaInfo(kind="none")
        assert asyncio.run(precheck_entry(self._entry(G2), window_pct=80, balance_min=10)) is None

    def test_probe_error_falls_back_to_trial(self):
        """预检接口报错 ≠ 候选不可用。"""
        self.results[G2["base_url"]] = QuotaProbeError("HTTP 500")
        assert asyncio.run(precheck_entry(self._entry(G2), window_pct=80, balance_min=10)) is None


class TestResolverQueue:
    @pytest.fixture(autouse=True)
    def _store(self, monkeypatch):
        monkeypatch.setattr(presets_store, "get_fallback_order", lambda: ["k1", "g2", "g3"])
        monkeypatch.setattr(
            presets_store, "get_preset_raw", lambda pid: {**BY_ID[pid]}
        )

    def _resolver(self, **kw):
        base = dict(
            current_model_id="glm-5.3", current_base_url=G1["base_url"],
            require_vision=False, window_pct=80, balance_min=10.0,
        )
        base.update(kw)
        return QuotaFallbackResolver(**base)

    def test_lazy_precheck_not_touched_before_resolve(self, monkeypatch):
        called = {"n": 0}

        async def fake(base_url, api_key, timeout=15.0):
            called["n"] += 1
            return QuotaInfo(kind="none")

        monkeypatch.setattr("doclens.web_v2.fallback_resolver.fetch_quota", fake)
        r = self._resolver()
        assert r.enabled
        assert not r.prechecked
        assert called["n"] == 0

    def test_parallel_precheck_all_candidates_once(self, monkeypatch):
        called = []

        async def fake(base_url, api_key, timeout=15.0):
            called.append(base_url)
            return QuotaInfo(kind="none")

        monkeypatch.setattr("doclens.web_v2.fallback_resolver.fetch_quota", fake)
        r = self._resolver()

        async def go():
            return await r.resolve(current_model_id="glm-5.3", tried=[], reason="quota")

        asyncio.run(go())
        # 三个候选各查一次（并行），与清单无关的被剔除者不查
        assert sorted(called) == sorted([K1["base_url"], G2["base_url"], G3["base_url"]])

    def test_resolve_order_same_provider_first(self, monkeypatch):
        async def fake(base_url, api_key, timeout=15.0):
            return QuotaInfo(kind="none")

        monkeypatch.setattr("doclens.web_v2.fallback_resolver.fetch_quota", fake)
        r = self._resolver()
        made = []
        monkeypatch.setattr(
            r, "_make_provider", lambda e: made.append(e.preset["id"]) or object(),
        )

        async def go():
            return [
                await r.resolve(current_model_id="glm-5.3", tried=[], reason="quota"),
                await r.resolve(current_model_id="glm-5.3", tried=["glm-5.3"], reason="quota"),
                await r.resolve(current_model_id="GLM-5.3", tried=["glm-5.3", "GLM-5.3"], reason="quota"),
                await r.resolve(current_model_id="kimi-k3", tried=["glm-5.3", "GLM-5.3", "kimi-k3"], reason="quota"),
            ]

        results = asyncio.run(go())
        # g2、g3 同为 tier0（同 model_id 大小写不敏感）稳定保序 → k1（其余）→ 耗尽
        assert made == ["g2", "g3", "k1"]
        assert [c.label if c else None for c in results] == [
            "GLM 账号2 · glm-5.3", "GLM 账号3 · GLM-5.3", "Kimi 1 · kimi-k3", None,
        ]

    def test_precheck_rejected_goes_to_report(self, monkeypatch):
        async def fake(base_url, api_key, timeout=15.0):
            if base_url == G2["base_url"]:
                return QuotaInfo(kind="windows", windows=(QuotaWindow("5 小时", 99.0),))
            return QuotaInfo(kind="none")

        monkeypatch.setattr("doclens.web_v2.fallback_resolver.fetch_quota", fake)
        r = self._resolver()
        monkeypatch.setattr(r, "_make_provider", lambda e: object())

        async def go():
            await r.resolve(current_model_id="glm-5.3", tried=[], reason="quota")
            await r.resolve(current_model_id="x", tried=["GLM-5.3"], reason="quota")
            await r.resolve(current_model_id="x", tried=["GLM-5.3", "kimi-k3"], reason="quota")

        asyncio.run(go())
        labels = {x["label"]: x["reason"] for x in r.last_report}
        assert "GLM 账号2 · glm-5.3" in labels and "99%" in labels["GLM 账号2 · glm-5.3"]
        assert labels["Kimi 1 · kimi-k3"] == "试调失败（额度耗尽或不可用）"

    def test_empty_order_disabled(self, monkeypatch):
        monkeypatch.setattr(presets_store, "get_fallback_order", lambda: [])
        r = self._resolver()
        assert not r.enabled
        out = asyncio.run(r.resolve(current_model_id="m", tried=[], reason="quota"))
        assert out is None

    def test_make_provider_failure_skips_candidate(self, monkeypatch):
        async def fake(base_url, api_key, timeout=15.0):
            return QuotaInfo(kind="none")

        monkeypatch.setattr("doclens.web_v2.fallback_resolver.fetch_quota", fake)
        r = self._resolver()

        def bad_make(entry):
            if entry.preset["id"] == "g3":
                return None
            return object()

        monkeypatch.setattr(r, "_make_provider", bad_make)
        out = asyncio.run(r.resolve(current_model_id="glm-5.3", tried=[], reason="quota"))
        assert out is not None and out.label.startswith("GLM 账号2"), "g3 构造失败被跳过"

    def test_active_preset_key_filters_same_account(self, monkeypatch):
        """按激活预设名反查其 api_key → 同账号的清单候选整体跳过。"""
        # 清单含 g1 的同账号兄弟 g1b（同 key）与另一账号 g2
        g1b = {**G1, "id": "g1b", "name": "GLM 主(flash)", "model_id": "glm-5.3-flash"}
        by_id = {**BY_ID, "g1b": g1b}
        monkeypatch.setattr(presets_store, "get_fallback_order", lambda: ["g1b", "g2", "k1"])
        monkeypatch.setattr(presets_store, "get_preset_raw", lambda pid: {**by_id[pid]})
        monkeypatch.setattr(
            presets_store, "list_presets",
            lambda kind=None: [{k: v for k, v in p.items() if k != "api_key"} | {"api_key": "***"}
                               for p in by_id.values() if p.get("kind") == "llm"],
        )
        probed = []

        async def fake(base_url, api_key, timeout=15.0):
            probed.append(api_key)
            return QuotaInfo(kind="none")

        monkeypatch.setattr("doclens.web_v2.fallback_resolver.fetch_quota", fake)
        r = QuotaFallbackResolver(
            current_model_id="glm-5.3", current_base_url=G1["base_url"],
            current_preset_name="GLM 主",
        )
        assert r._current_preset_id == "g1"
        assert r._current_api_key == G1["api_key"]
        monkeypatch.setattr(r, "_make_provider", lambda e: object())
        out = asyncio.run(r.resolve(current_model_id="glm-5.3", tried=[], reason="quota"))
        # g1b 与 g1 同 key：既不预检也不出队；首个出队的是另一账号的 g2
        assert G1["api_key"] not in probed
        assert out is not None and out.label.startswith("GLM 账号2")


class TestPresetsStoreFallbackOrder:
    @pytest.fixture
    def ids(self, tmp_path, monkeypatch):
        """建预设后按名称反查真实 id（create_preset 自己生成 uuid）。"""
        monkeypatch.setattr(presets_store, "_presets_path", lambda: tmp_path / "model_presets.json")
        for p in (G1, G2, K1, K2):
            presets_store.create_preset({**p, "kind": "llm"})
        presets_store.create_preset({
            "name": "视觉", "kind": "vision", "base_url": "x", "model_id": "v",
        })
        return {p["name"]: p["id"] for p in presets_store.list_presets()}

    def test_default_empty(self, ids):
        assert presets_store.get_fallback_order() == []

    def test_set_and_get_roundtrip(self, ids):
        out = presets_store.set_fallback_order([ids["Kimi 1"], ids["GLM 账号2"]])
        assert out == [ids["Kimi 1"], ids["GLM 账号2"]]
        assert presets_store.get_fallback_order() == out

    def test_dedup_and_drop_non_llm(self, ids):
        k = ids["Kimi 1"]
        out = presets_store.set_fallback_order([k, k, "nope", ids["视觉"]])
        assert out == [k], "非 LLM 预设与未知 id 剔除，重复去重"

    def test_deleted_preset_dropped_on_read(self, ids):
        presets_store.set_fallback_order([ids["Kimi 1"], ids["GLM 账号2"]])
        presets_store.delete_preset(ids["GLM 账号2"])
        assert presets_store.get_fallback_order() == [ids["Kimi 1"]]

    def test_presets_survive_fallback_write(self, ids):
        """写清单不得丢失 presets（同文件两个顶层键）。"""
        presets_store.set_fallback_order([ids["Kimi 1"]])
        assert len(presets_store.list_presets("llm")) == 4

    def test_old_file_without_key_gets_empty_list(self, tmp_path, monkeypatch):
        """旧版文件（无 fallback_order 键）读取不报错、得空表。"""
        path = tmp_path / "model_presets.json"
        path.write_text('{"version": 1, "presets": []}', encoding="utf-8")
        monkeypatch.setattr(presets_store, "_presets_path", lambda: path)
        assert presets_store.get_fallback_order() == []
