"""二分探测服务端允许的 max_tokens 上限（/api/presets/probe-max-tokens）。

算法（用户给定）：
    low=1, high=262144, answer=0
    while low <= high:
        mid = (low+high)//2
        resp = call(model, prompt="ping", max_tokens=mid)
        if resp.ok: answer=mid, low=mid+1
        else:       high=mid-1
    answer 即服务端允许的最大 max_tokens。

防误判护栏：失败仅当错误信息提及 max_tokens 时才判定"超限"（high=mid-1）；
鉴权/网络/模型名等其他错误会污染二分结果，直接中止并抛出。
"""
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

PROBE_HIGH = 262144
PROBE_LOW = 1
_PROBE_PROMPT = "ping"


class ProbeError(Exception):
    """探测中止（连接/鉴权等非 max_tokens 错误），由 API 层映射为 4xx/502。"""


def _is_max_tokens_error(err: Exception) -> bool:
    """失败是否由 max_tokens 超限引起（否则是连接/鉴权等问题，不能参与二分）。"""
    msg = str(err).lower()
    return "max_tokens" in msg or "max tokens" in msg


def _ping(client, max_tokens: int) -> Tuple[bool, Optional[Exception]]:
    """以给定 max_tokens 发一次最小请求；返回 (是否被服务端接受, 异常)。"""
    try:
        client.chat(
            messages=[{"role": "user", "content": _PROBE_PROMPT}],
            system="",
            tools=[],
            max_tokens=max_tokens,
        )
        return True, None
    except Exception as e:
        return False, e


def probe_max_tokens(
    protocol: str,
    base_url: str,
    model_id: str,
    api_key: str,
    low: int = PROBE_LOW,
    high: int = PROBE_HIGH,
) -> Tuple[int, int]:
    """二分探测 max_tokens 上限。返回 (answer, 尝试次数)。

    Raises:
        ProbeError: low=1 即失败（连接/鉴权错误），或中途出现非 max_tokens 错误。
    """
    from planify.core.llm import create_provider

    client = create_provider({
        "protocol": protocol,
        "model_id": model_id,
        "base_url": base_url or None,
        "api_key": api_key,
    })

    # 先用最小值验证链路：low=1 都失败说明是连接/鉴权/模型名问题，二分无意义
    ok, err = _ping(client, low)
    if not ok:
        raise ProbeError(f"探测中止：max_tokens={low} 的最小请求即失败（{type(err).__name__}: {err}）")

    answer = 0
    attempts = 0
    while low <= high:
        mid = (low + high) // 2
        ok, err = _ping(client, mid)
        attempts += 1
        if ok:
            answer = mid
            low = mid + 1
        elif _is_max_tokens_error(err):
            high = mid - 1
        else:
            raise ProbeError(
                f"探测中止：max_tokens={mid} 出现非超限错误（{type(err).__name__}: {err}），"
                "二分结果不可信，请检查网络/额度后重试"
            )
        logger.debug("probe max_tokens: mid=%d ok=%s -> answer=%d", mid, ok, answer)

    logger.info("probe max_tokens done: model=%s answer=%d attempts=%d", model_id, answer, attempts)
    return answer, attempts
