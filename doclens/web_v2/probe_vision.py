"""视觉能力行为学探测（/api/presets/probe-vision，ADR-0034 增补）。

原理：程序合成一张随机密码串图片（红底白字），问模型「图中字母数字序列」，
按回答判定——读出密码串 → 支持；报错或答不出（**含静默吞图**：网关接受
image 但模型看不见，按报错判定永远测不出）→ 不支持；连接/鉴权失败 →
探测中止（ProbeError，不判定）。单次判定受思考型模型思维链长度波动影响，
N 次尝试内任一次读出即判支持。

随机化密码串使「读图」成为唯一信息来源（防模型靠训练记忆蒙对固定串）。
"""
import base64
import io
import logging
import random
import re
import string

logger = logging.getLogger(__name__)

# 密码串字符集：去除易混字符（0O1I）的大写字母+数字
_CODE_ALPHABET = "".join(set(string.ascii_uppercase + string.digits) - set("0O1I"))
_CODE_LEN = 5
_IMG_SIZE = 512
_BG = (200, 30, 30)      # 红底
_FG = (255, 255, 255)    # 白字
_QUESTION = "图中白色大写字母和数字序列是什么？只回答该序列。"
# 思考型模型（GLM-4.5+/5.x 等）默认开思维链：输出预算先供思考消耗，剩余才产文本。
# 32 token 时思维链经常耗尽预算 → content=[] + stop=max_tokens，被误判「不支持」
# （2026-10-05 glm-5.3-flash 实测失败率 4/6，全部为该模式）。1024 足够「短思考 +
# 密码串答案」，非思考模型不受影响（答案本身 <10 token）。
_MAX_TOKENS = 1024
# 单次判定对随机性敏感（思维链长度波动/偶发拒答），N 选 1 过即支持：
# 视觉探测目标是「能不能读图」而非「读得多稳」，一次成功即为能力存在证明。
_MAX_ATTEMPTS = 3


class ProbeError(Exception):
    """探测中止（连接/鉴权等错误），由 API 层映射为 4xx/502。"""


def _gen_code() -> str:
    return "".join(random.choices(_CODE_ALPHABET, k=_CODE_LEN))


def _render_probe_image(code: str) -> tuple[bytes, str]:
    """合成探测图：纯色底 + 居中大字密码串（JPEG）。

    返回 (jpeg_bytes, base64)。ImageFont.load_default(size=…) 使用 Pillow
    内置可缩放字体，零外部字体文件依赖。
    """
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (_IMG_SIZE, _IMG_SIZE), _BG)
    draw = ImageDraw.Draw(img)
    # 从大号往下试，找到能水平放下的最大字号（~140pt 量级）
    font = None
    for size in range(180, 40, -10):
        font = ImageFont.load_default(size=size)
        box = draw.textbbox((0, 0), code, font=font)
        if box[2] - box[0] <= _IMG_SIZE - 60:
            break
    assert font is not None
    # 居中绘制
    box = draw.textbbox((0, 0), code, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(
        ((_IMG_SIZE - w) / 2 - box[0], (_IMG_SIZE - h) / 2 - box[1]),
        code, fill=_FG, font=font,
    )
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return buf.getvalue(), base64.b64encode(buf.getvalue()).decode("ascii")


def _normalize(text: str) -> str:
    """判定归一：去空白/标点、统一大写。容错模型答 'The sequence is XXXXX'。"""
    return re.sub(r"[^A-Z0-9]", "", (text or "").upper())


def probe_vision(protocol: str, base_url: str, model_id: str, api_key: str) -> bool:
    """行为学探测模型是否真能读图。返回 True=支持 / False=不支持。

    Raises:
        ProbeError: 连接/鉴权/模型名等错误（探测中止，不判定）。
    """
    from planify.core.llm import create_provider

    provider = create_provider({
        "protocol": protocol,
        "model_id": model_id,
        "base_url": base_url or None,
        "api_key": api_key,
    })
    last_text = ""
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        code = _gen_code()
        _, b64 = _render_probe_image(code)
        try:
            resp = provider.chat(
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                        {"type": "text", "text": _QUESTION},
                    ],
                }],
                system="",
                tools=[],
                max_tokens=_MAX_TOKENS,
            )
        except Exception as e:
            # API 报错（400/415/unsupported media 等）：不支持视觉。
            # 注意区分「连接/鉴权失败」——这类错误不代表模型能力，但与能力类
            # 报错无法可靠二分（各家网关文案不一），统一按「不支持」返回会把
            # 链路问题误判成能力问题；按「中止」返回会掩盖真 400。取舍：错误
            # 信息含连接/鉴权特征词 → 中止；其余 → 不支持。
            msg = str(e).lower()
            if any(k in msg for k in ("connection", "timed out", "timeout", "unauthorized", "401", "api key", "invalid_api_key", "forbidden", "403", "not found", "404", "resolve", "ssl")):
                raise ProbeError(f"探测中止：请求失败（{type(e).__name__}: {e}），请检查网络/密钥/模型名") from e
            logger.info("probe_vision: model=%s rejected image (%s: %s)", model_id, type(e).__name__, e)
            return False
        last_text = "".join(
            getattr(b, "text", "") for b in resp.content
        )
        ok = _normalize(code) in _normalize(last_text)
        logger.info(
            "probe_vision: model=%s attempt=%d/%d code=%s answered=%r -> %s",
            model_id, attempt, _MAX_ATTEMPTS, code, last_text[:80], ok,
        )
        if ok:
            return True
    return False
