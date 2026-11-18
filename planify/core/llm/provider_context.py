# -*- coding: utf-8 -*-
"""给 SDK 原生异常打 provider 标记（2026-11-18）。

**为什么需要**：planify 的分类器按 provider 分业务码表（GLM 1000=鉴权失败
不可重试 vs MiniMax 1000=未知错误可重试）。但分类器只拿到一个异常对象，
没有 provider 信息——必须有人在抛出点把 provider 贴上去。

用法（provider 的 ``chat`` / ``astream`` 等调用点的 except 分支）::

    try:
        response = self._client.messages.create(**kwargs)
    except Exception as e:
        mark_provider_error(e, detect_provider(self.base_url, self.model))
        raise

标记用属性 ``_planify_provider``（下划线前缀，避免与 SDK 字段冲突），
只写一次（``setdefault`` 语义）——外层重复包装不覆盖内层已标的 provider。
"""
from __future__ import annotations

from .upstream_errors import PROVIDER_GENERIC

_ATTR = "_planify_provider"


def mark_provider_error(exc: BaseException, provider: str) -> None:
    """在异常对象上标记 provider（幂等：已标记不覆盖）。"""
    if not provider or provider == PROVIDER_GENERIC:
        return
    try:
        if getattr(exc, _ATTR, None) is None:
            setattr(exc, _ATTR, provider)
    except Exception:  # noqa: BLE001 — 某些异常禁止 set attr，忽略
        pass


def provider_of(exc: BaseException) -> str | None:
    """取异常上标记的 provider（无标记返回 None）。"""
    return getattr(exc, _ATTR, None)
