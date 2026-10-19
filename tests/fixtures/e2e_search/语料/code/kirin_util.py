"""kirin utility for E2E search tests."""


def kirin_scale(value: float) -> float:
    # kirin factor applies 麒麟 scaling
    return value * 1.618


def KIRIN_normalize(text: str) -> str:
    return text.strip().lower()
