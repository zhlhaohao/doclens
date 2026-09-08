"""图像方向自动校正 —— 视觉判向 + 像素级旋转（ADR-0017）。

背景：上传图片（文件管理 / 日记）存在像素级方向错误（无可用 EXIF，
EXIF 校正无能为力），导致页面展示歪、视觉转写错。

设计要点（决策均见 ADR-0017）：
- 仅两条上传入口触发（POST /files/upload、POST /diary/photos），
  手动拷贝进目录的图不管；
- 判向是独立轻量调用（ORIENTATION_PROMPT，max_tokens 极小），
  与转写互不耦合；
- 严格解析：只接受精确的 0/90/180/270，其余一律不转——宁可漏转不可错转；
- 调用失败（网络/限流/5xx）不重试，静默放弃；
- 旋转为 PIL 像素级旋转 + 同格式重编码（JPEG q95 / WebP q90 / PNG 无损）；
- 视觉 API 并发由 vision_client.call_vision 的全局串行锁统一控制
  （判向 / 转写 / caption 互斥）。
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from doclens.vision_client import call_vision, encode_image

logger = logging.getLogger(__name__)

# 判向 prompt：只回答顺时针角度，max_tokens 极小（成本 ≈ 1/400 次转写）
ORIENTATION_PROMPT = (
    "这张图片需要顺时针旋转多少度，画面内容（风景、人物、文字）才能正面朝上？"
    "只回答一个数字：0、90、180 或 270。不要输出任何其他内容。"
)

# 判向调用 max_tokens：回答只有一个数字，给足余量防截断
_ORIENTATION_MAX_TOKENS = 32

# 参与判向的图像扩展名（与上传压缩 / 视觉解读同一集合）
ORIENTABLE_IMAGE_EXTS = frozenset({".jpg", ".jpeg", ".png", ".webp"})

# 合法回答：恰好是 0/90/180/270（strip 后精确匹配，不容忍解释/围栏/单位）
_ANGLE_RE = re.compile(r"^(0|90|180|270)$")

# 重编码质量（JPEG/WebP 有损一代，肉眼不可辨；PNG 本身无损）
_JPEG_QUALITY = 95
_WEBP_QUALITY = 90


def parse_orientation_answer(text: str) -> int | None:
    """严格解析判向回答 → 顺时针角度；非精确 0/90/180/270 返回 None（不转）。"""
    m = _ANGLE_RE.match(text.strip())
    return int(m.group(1)) if m else None


def detect_rotation(path: str | Path, config) -> int | None:
    """调视觉模型判向，返回顺时针角度；调用失败或解析失败返回 None（不转）。

    不重试（ADR-0017 §失败策略）：临时故障放弃即可，下张图不受影响。
    """
    try:
        b64, media = encode_image(path)
        answer = call_vision(b64, media, ORIENTATION_PROMPT, config,
                             max_tokens=_ORIENTATION_MAX_TOKENS)
    except Exception as e:  # noqa: BLE001 — 调用失败静默放弃，不阻断上传主流程
        logger.info("orientation detect call failed for %s: %s", path, e)
        return None
    angle = parse_orientation_answer(answer)
    if angle is None:
        logger.info("orientation answer unparsable for %s: %r", path, answer[:80])
    return angle


def rotate_image_inplace(path: str | Path, clockwise_degrees: int) -> bool:
    """像素级旋转并同格式重编码覆盖原文件。返回是否成功（失败不动原文件）。

    PIL rotate 是逆时针语义，故取负。先编码到内存成功后再覆盖写盘，
    避免编码失败毁掉原文件。
    """
    from PIL import Image

    path = Path(path)
    ext = path.suffix.lower()
    try:
        with Image.open(path) as opened:
            rotated = opened.rotate(-clockwise_degrees, expand=True)
            rotated = rotated.convert("RGB") if ext in (".jpg", ".jpeg", ".webp") else rotated
            import io

            buf = io.BytesIO()
            if ext in (".jpg", ".jpeg"):
                rotated.save(buf, "JPEG", quality=_JPEG_QUALITY, optimize=True)
            elif ext == ".webp":
                rotated.save(buf, "WEBP", quality=_WEBP_QUALITY)
            else:  # .png
                rotated.save(buf, "PNG", optimize=True)
            data = buf.getvalue()
    except Exception as e:  # noqa: BLE001 — 解码/编码失败不动原文件
        logger.warning("rotate encode failed for %s: %s", path, e)
        return False
    try:
        path.write_bytes(data)
    except OSError as e:
        logger.warning("rotate write failed for %s: %s", path, e)
        return False
    return True


def auto_rotate_image(path: str | Path, config) -> bool:
    """判向 + 需要时旋转落盘。返回是否发生了旋转（0 度/失败/跳过均 False）。"""
    if os.path.splitext(str(path))[1].lower() not in ORIENTABLE_IMAGE_EXTS:
        return False
    angle = detect_rotation(path, config)
    if not angle:  # None（失败/存疑）或 0（正向）都不动
        return False
    rotated = rotate_image_inplace(path, angle)
    if rotated:
        logger.info("auto-rotated %s by %d° clockwise", path, angle)
    return rotated
