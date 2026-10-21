"""chat.py 兜底 toast 常量（AP-26 清理后的最小残留）。

历史：本模块原名 refs_retry，含 A 方案的合规判定实现 evaluate_round /
RoundResult——已被 refs_curator.curate_references 取代（docstring 曾自认），
2026-10-20 AP-26 处置删除。唯一仍被消费的资产 FALLBACK_TOAST 保留于此，
chat.py 的兜底分支引用。
"""
from __future__ import annotations

FALLBACK_TOAST = (
    "AI 多次回答的参考资料均不合规，已改用检索结果兜底，建议重建索引确保路径有效。"
)
