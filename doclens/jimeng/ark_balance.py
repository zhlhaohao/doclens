"""火山引擎账户余额查询（费用中心 QueryBalanceAcct，2026-10-28）。

即梦文生图按量付费余额展示的数据源。火山方舟（Ark）本身不提供
Bearer API Key 查余额的接口——账户余额在**费用中心**（Billing），
走火山引擎 Signature V4 签名（Access Key + Secret Key），与推理
调用的 Bearer Token 是两套凭证：

- JIMENG_API_KEY（Bearer）：调 ``/api/v3/images/generations`` 生成图片
- JIMENG_ACCESS_KEY / JIMENG_SECRET_KEY（V4 签名）：查账户余额

签名规范：https://www.volcengine.com/docs/6369/67269
接口文档：https://www.volcengine.com/docs/6269/66184（QueryBalanceAcct）

密钥由调用方（/api/config/jimeng-balance 端点）从全局 .env 回源传入，
本模块不接触配置存储。
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = 15.0

# 费用中心 OpenAPI（全局服务，不按 Region 提供服务——region 可任取，
# 官方签名文档示例用 cn-beijing）
_BILLING_HOST = "billing.volcengineapi.com"
_BILLING_REGION = "cn-beijing"
_BILLING_SERVICE = "billing"

# GET 无 body 的 payload hash（sha256("")）
_EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()


class ArkBalanceError(Exception):
    """余额查询失败（网络/HTTP/签名/解析）。消息面向用户可读。"""


@dataclass(frozen=True)
class ArkBalance:
    """账户余额查询结果（人民币，单位：元）。"""

    available: Optional[float] = None   # 可用余额
    cash: Optional[float] = None        # 现金余额
    credit_limit: Optional[float] = None  # 信控额度
    frozen: Optional[float] = None      # 冻结金额
    arrears: Optional[float] = None     # 欠费金额


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _sign_v4_get(
    ak: str, sk: str, host: str, region: str, service: str,
    action: str, version: str, x_date: str,
) -> tuple[str, str]:
    """构造 V4 签名的 GET 请求头（Authorization + X-Date）。

    返回 (authorization_header, x_date)。GET 无 body，只签
    host;x-date 两个头（与官方签名文档 GET 示例一致）。
    """
    date_short = x_date[:8]
    canonical_query = urlencode({"Action": action, "Version": version})
    # urlencode 排序：Action < Version（ASCII 升序），canonical 要求按名排序
    canonical_headers = f"host:{host}\nx-date:{x_date}\n"
    signed_headers = "host;x-date"
    canonical_request = (
        f"GET\n/\n{canonical_query}\n{canonical_headers}\n{signed_headers}\n{_EMPTY_SHA256}"
    )

    credential_scope = f"{date_short}/{region}/{service}/request"
    string_to_sign = (
        f"HMAC-SHA256\n{x_date}\n{credential_scope}\n"
        + hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    )

    k_date = _hmac_sha256(sk.encode("utf-8"), date_short)
    k_region = _hmac_sha256(k_date, region)
    k_service = _hmac_sha256(k_region, service)
    k_signing = _hmac_sha256(k_service, "request")
    signature = hmac.new(
        k_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    authorization = (
        f"HMAC-SHA256 Credential={ak}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    return authorization, x_date


def _to_float(v: object) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


async def fetch_ark_balance(
    access_key: str, secret_key: str, timeout: float = TIMEOUT
) -> ArkBalance:
    """V4 签名调费用中心 QueryBalanceAcct，返回账户余额。

    Raises:
        ArkBalanceError: 密钥缺失 / 网络 / HTTP / 解析失败。
    """
    if not access_key or not secret_key:
        raise ArkBalanceError(
            "未配置火山引擎 Access Key / Secret Key（JIMENG_ACCESS_KEY / JIMENG_SECRET_KEY）"
        )

    x_date = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    authorization, x_date = _sign_v4_get(
        ak=access_key,
        sk=secret_key,
        host=_BILLING_HOST,
        region=_BILLING_REGION,
        service=_BILLING_SERVICE,
        action="QueryBalanceAcct",
        version="2022-01-01",
        x_date=x_date,
    )

    url = (
        f"https://{_BILLING_HOST}/?Action=QueryBalanceAcct&Version=2022-01-01"
    )
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                url,
                headers={
                    "Authorization": authorization,
                    "Host": _BILLING_HOST,
                    "X-Date": x_date,
                    "Accept": "application/json",
                },
            )
    except httpx.TimeoutException:
        raise ArkBalanceError(f"请求超时（{timeout:.0f}s）") from None
    except httpx.HTTPError as e:
        raise ArkBalanceError(f"网络请求失败：{e}") from None

    if resp.status_code in (401, 403):
        raise ArkBalanceError(
            f"认证失败 (HTTP {resp.status_code})——请检查 Access Key / Secret Key 是否正确"
        )

    try:
        payload = resp.json()
    except ValueError:
        if resp.status_code != 200:
            raise ArkBalanceError(f"HTTP {resp.status_code}: {resp.text[:200]}") from None
        raise ArkBalanceError("返回内容不是合法 JSON") from None

    # V4 错误结构：ResponseMetadata.Error（含 200 带错与非 200 带 body 两种）
    meta = payload.get("ResponseMetadata") or {}
    err = meta.get("Error")
    if err:
        raise ArkBalanceError(
            f"接口报错：{err.get('Code')} {err.get('Message')}"
        )

    if resp.status_code != 200:
        raise ArkBalanceError(f"HTTP {resp.status_code}: {resp.text[:200]}")

    result = payload.get("Result") or {}
    if not result:
        raise ArkBalanceError("接口未返回余额数据")

    return ArkBalance(
        available=_to_float(result.get("AvailableBalance")),
        cash=_to_float(result.get("CashBalance")),
        credit_limit=_to_float(result.get("CreditLimit")),
        frozen=_to_float(result.get("FreezeAmount")),
        arrears=_to_float(result.get("ArrearsBalance")),
    )
