# -*- coding: utf-8 -*-
"""上传图像落盘前压缩 —— 防「上传即 failed」的视觉解析死路。

背景（2026-09-07 工单）：手机原图 JPEG 常超 10MB（VisionWorker 的
``_MAX_IMAGE_BYTES`` 上限，DashScope 系端点 base64 限制），超限图像在
vision_queue 直接 permanent failed、不再重试——用户上传后永远等不到视觉解析。

策略：图像上传在**落盘前**压缩（EXIF 方向校正 + 长边缩放 + 重编码），
从源头保证落盘文件可被视觉解析。非图像 / 小图 / 压缩失败一律原样写盘（降级）。

与 diary.compress_photo 的差异：日记照片统一转 WebP（不保留原格式）；
本模块保留原扩展名（jpg→jpg / png→png / webp→webp），上传的是「文档本身」，
格式语义不变，文件名与扩展名必须匹配。
"""
from __future__ import annotations

import io
import logging
import os

logger = logging.getLogger(__name__)

# 参与压缩的图像扩展名（与 vision 解读格式一致：INTERPRETED_IMAGE_EXTS）
_COMPRESSIBLE_EXTS = frozenset({".jpg", ".jpeg", ".png", ".webp"})

# 触发压缩的文件大小阈值。低于 vision worker 的 10MB 上限留出余量
# （重编码后大小无法精确控制，二分逼近到阈值以下即可）。
COMPRESS_THRESHOLD_BYTES = 9 * 1024 * 1024  # 9 MB

# 缩放与编码参数（与 diary 照片压缩同量级：视觉模型对 2048px 已足够）
_MAX_EDGE = 2048
_JPEG_QUALITY = 85
_WEBP_QUALITY = 85

# 压缩仍超阈值时的二分逼近下限
_MIN_EDGE = 512
_BISECT_STEPS = 4


def _reencode(img, ext: str) -> bytes:
    """按目标格式重编码（调用方保证 img 已 thumbnail 缩放、已 convert RGB）。"""
    buf = io.BytesIO()
    if ext in (".jpg", ".jpeg"):
        img.save(buf, "JPEG", quality=_JPEG_QUALITY, optimize=True)
    elif ext == ".webp":
        img.save(buf, "WEBP", quality=_WEBP_QUALITY)
    else:  # .png
        img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def compress_image_bytes(data: bytes, ext: str) -> tuple[bytes, bool]:
    """压缩图像字节。返回 ``(落盘字节, 是否压缩过)``。

    - 非图像扩展名 / 小于阈值 / 解码失败：``(data, False)`` 原样返回（降级不阻断上传）；
    - 压缩结果反而更大（已高度优化的图）：保留原字节；
    - 超 9MB 压不进阈值：二分缩小边长继续压，仍超则取最后一次结果
      （视觉 worker 对 <10MB 的文件即可处理）。
    """
    ext = ext.lower()
    if ext not in _COMPRESSIBLE_EXTS or len(data) <= COMPRESS_THRESHOLD_BYTES:
        return data, False

    try:
        from PIL import Image, ImageOps

        with Image.open(io.BytesIO(data)) as opened:
            img = ImageOps.exif_transpose(opened)
            img = img.convert("RGB")
    except Exception as e:
        logger.warning("图像压缩降级（解码失败，写原图）: %s", e)
        return data, False

    edge = _MAX_EDGE
    best = b""
    for _ in range(_BISECT_STEPS + 1):
        thumb = img.copy()
        thumb.thumbnail((edge, edge), Image.LANCZOS)
        try:
            encoded = _reencode(thumb, ext)
        except Exception as e:
            logger.warning("图像压缩降级（编码失败，写原图）: %s", e)
            return data, False
        if len(encoded) <= len(data):
            best = encoded
            if len(encoded) <= COMPRESS_THRESHOLD_BYTES:
                break  # 达标：体积合格且比原图小
        if edge <= _MIN_EDGE:
            break  # 保底：缩到最小边仍超阈值，取最小版本
        edge = max(_MIN_EDGE, edge // 2)

    if not best:
        # 所有尝试都比原图大（极端：几百 KB 的 PNG 放大成 9MB+？防御分支）
        return data, False
    return best, True


def should_compress(filename_or_ext: str, size: int) -> bool:
    """快速判断：该文件是否需要走压缩路径（不读内容）。"""
    ext = os.path.splitext(filename_or_ext)[1].lower()
    return ext in _COMPRESSIBLE_EXTS and size > COMPRESS_THRESHOLD_BYTES
