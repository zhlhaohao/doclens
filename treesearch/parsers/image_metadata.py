# -*- coding: utf-8 -*-
"""图像元数据网关（deep module）—— vision 解读结果写回 / 读回 + 内容指纹。

载体（ADR-0009 + 工单 01 spike 实证）：
- JPEG/JPG：EXIF ``XPComment`` (0x9c9c, UTF-16LE)，经 piexif 无损写入；
  Windows 资源管理器「备注」可读完整中文。
- PNG / WebP：工单 05/06 实现，本期 ``read_back`` 返回 None、其余抛 NotImplementedError。

``XPComment`` payload 为「markdown 主体 + 末尾 HTML 注释元数据」，人机共用——
Windows「备注」里人眼能看到描述主体，doclens 解析末尾注释取版本::

    {markdown}

    <!--doclens model={model_tag} prompt={prompt_version}-->

设计目标：解读结果「跟文件走」；写回不改像素、不改内容指纹（避免增量死循环）。
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

# 走 vision 解读 + 写回的图像格式（ADR-0009：仅这四种）
INTERPRETED_IMAGE_EXTS: frozenset[str] = frozenset({".jpg", ".jpeg", ".png", ".webp"})

# 全图像格式集合（含本期不解读的，供「其他图像格式跳过」判断，工单 07）
ALL_IMAGE_EXTS: frozenset[str] = frozenset({
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif",
})

_JPEG_EXTS: frozenset[str] = frozenset({".jpg", ".jpeg"})

# EXIF XPComment tag（Microsoft 扩展，UTF-16LE 字符串）
_XPCOMMENT_TAG = 0x9C9C

# payload 末尾元数据标记（HTML 注释，markdown 不渲染、Windows 备注可见但不喧宾夺主）
_META_MARKER = "<!--doclens"
_META_RE = re.compile(r"model=(?P<model>\S+)\s+prompt=(?P<prompt>\S+?)\s*-->")


def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


def _encode_xpcomment(text: str) -> bytes:
    """XPComment：UTF-16LE + 双字节 null 终止。"""
    return text.encode("utf-16-le") + b"\x00\x00"


def _decode_xpcomment(raw) -> str:
    if not raw:
        return ""
    if isinstance(raw, (tuple, list)):  # piexif.load 对 BYTE 类返回 tuple[int, ...]
        raw = bytes(raw)
    # 先在完整 bytes 上 decode（保 UTF-16LE 双字节对齐），再在 str 层去尾部 null 字符。
    # 不能先 rstrip 字节——会误删高字节为 0x00 的字符（如 '>' = 0x003E），破坏对齐。
    try:
        text = raw.decode("utf-16-le")
    except UnicodeDecodeError:
        text = raw.decode("utf-16-le", errors="replace")
    return text.rstrip("\x00")


def _format_payload(markdown: str, model_tag: str, prompt_version: str) -> str:
    return f"{markdown}\n\n{_META_MARKER} model={model_tag} prompt={prompt_version}-->"


def _parse_payload(text: str) -> dict:
    """从 XPComment 文本解析 payload；无元数据标记则视为纯描述（版本字段为空）。"""
    idx = text.rfind(_META_MARKER)
    if idx < 0:
        return {"markdown": text, "model_tag": "", "prompt_version": ""}
    markdown = text[:idx].rstrip("\n").rstrip()
    m = _META_RE.search(text[idx:])
    return {
        "markdown": markdown,
        "model_tag": m.group("model") if m else "",
        "prompt_version": m.group("prompt") if m else "",
    }


# 期望版本：doclens 在 reindex 前经 set_expected_version 设置；read_back 默认据此校验，
# payload 版本不符则当无解读 → image_to_tree 占位入队重解读（工单 08）。
_expected_model_tag: Optional[str] = None
_expected_prompt_version: Optional[str] = None


def set_expected_version(
    model_tag: Optional[str] = None, prompt_version: Optional[str] = None
) -> None:
    """设置当前期望的解读版本（doclens 在 reindex 前调用）。"""
    global _expected_model_tag, _expected_prompt_version
    _expected_model_tag = model_tag
    _expected_prompt_version = prompt_version


def read_back(
    image_path: str,
    *,
    model_tag: Optional[str] = None,
    prompt_version: Optional[str] = None,
) -> Optional[dict]:
    """读图像元数据里的解读 payload。

    返回 ``{"markdown", "model_tag", "prompt_version"}``；无元数据返回 None。
    传入 ``model_tag`` / ``prompt_version`` 且与 payload 不符时返回 None（版本不符）。
    """
    ext = _ext(image_path)
    if ext in _JPEG_EXTS:
        text = _read_jpeg_xpcomment(image_path)
    elif ext == ".png":
        text = _read_png(image_path)
    elif ext == ".webp":
        text = _read_webp(image_path)
    else:
        # 其他格式不解读
        return None
    if not text:
        return None
    payload = _parse_payload(text)
    mt = model_tag if model_tag is not None else _expected_model_tag
    pv = prompt_version if prompt_version is not None else _expected_prompt_version
    if mt is not None and payload["model_tag"] != mt:
        return None
    if pv is not None and payload["prompt_version"] != pv:
        return None
    return payload


def _read_jpeg_xpcomment(image_path: str) -> Optional[str]:
    try:
        import piexif
    except ImportError:
        logger.warning("piexif 未安装，无法读 JPEG 元数据")
        return None
    try:
        exif_dict = piexif.load(image_path)
    except Exception as e:  # 无 EXIF / 损坏 → piexif 抛异常
        logger.debug("piexif.load 失败 %s: %s", image_path, e)
        return None
    raw = exif_dict.get("0th", {}).get(_XPCOMMENT_TAG)
    if raw is None:
        return None
    return _decode_xpcomment(raw)


def write_back(
    image_path: str,
    markdown: str,
    *,
    model_tag: str,
    prompt_version: str,
) -> bool:
    """无损写入解读 payload 到图像元数据。失败返回 False（不抛）。

    JPEG：合并已有 EXIF（只改 XPComment，不覆盖其他字段），piexif 无损 insert。
    """
    ext = _ext(image_path)
    if ext in _JPEG_EXTS:
        return _write_jpeg(image_path, markdown, model_tag, prompt_version)
    if ext == ".png":
        return _write_png(image_path, markdown, model_tag, prompt_version)
    if ext == ".webp":
        return _write_webp(image_path, markdown, model_tag, prompt_version)
    logger.warning("write_back 暂不支持 %s", ext)
    return False


def _write_jpeg(
    image_path: str, markdown: str, model_tag: str, prompt_version: str
) -> bool:
    try:
        import piexif
    except ImportError:
        logger.error("piexif 未安装，无法写 JPEG 元数据")
        return False
    payload = _format_payload(markdown, model_tag, prompt_version)
    try:
        # 合并已有 EXIF：无 EXIF 时 piexif.load 抛异常 → 用空 0th
        try:
            exif_dict = piexif.load(image_path)
            zeroth = dict(exif_dict.get("0th", {}))
        except Exception:
            zeroth = {}
        zeroth[_XPCOMMENT_TAG] = _encode_xpcomment(payload)
        exif_bytes = piexif.dump({"0th": zeroth})
        piexif.insert(exif_bytes, image_path)  # 无损：只动 APP1 EXIF，不碰像素
        return True
    except Exception as e:
        logger.warning("write_back JPEG 失败 %s: %s", image_path, e)
        return False


# PNG iTXt chunk 的 key（UTF-8，doclens 自读自写；Windows 资源管理器不读 PNG 元数据）
_PNG_KEY = "Description"


def _read_png(image_path: str) -> Optional[str]:
    try:
        from PIL import Image
        with Image.open(image_path) as img:
            img.load()
            text = img.info.get(_PNG_KEY)
        return text if isinstance(text, str) else None
    except Exception as e:
        logger.debug("读 PNG 元数据失败 %s: %s", image_path, e)
        return None


def _write_png(
    image_path: str, markdown: str, model_tag: str, prompt_version: str
) -> bool:
    """PNG：Pillow ``PngInfo`` iTXt（UTF-8）。

    ``save`` 会重编码，但 PNG 无损 → 像素不变 → ``content_fingerprint`` 不变（不死循环）。
    仅写 ``_PNG_KEY``，不保留原图其他 tEXt（PNG 的 tEXt 多为软件元信息，可接受丢失）。
    """
    try:
        from PIL import Image
        from PIL.PngImagePlugin import PngInfo
        payload = _format_payload(markdown, model_tag, prompt_version)
        with Image.open(image_path) as img:
            img.load()
            pi = PngInfo()
            pi.add_itxt(_PNG_KEY, payload)
            img.save(image_path, "PNG", pnginfo=pi)
        return True
    except Exception as e:
        logger.warning("write_back PNG 失败 %s: %s", image_path, e)
        return False


def _webp_xmp_packet(payload: str) -> bytes:
    """把 payload 包成 XMP packet（dc:description）。XML-escape 防止 payload 里的
    ``<!--`` 破坏 XML 结构；``getxmp`` 读回时自动 unescape。"""
    import xml.sax.saxutils as su
    desc = su.escape(payload)
    return (
        b'<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        b'<x:xmpmeta xmlns:x="adobe:ns:meta/">'
        b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        b'<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">'
        b'<dc:description><rdf:Alt>'
        b'<rdf:li xml:lang="x-default">' + desc.encode("utf-8") + b'</rdf:li>'
        b'</rdf:Alt></dc:description>'
        b'</rdf:Description></rdf:RDF></x:xmpmeta>'
        b'<?xpacket end="w"?>'
    )


def _read_webp(image_path: str) -> Optional[str]:
    """读 WebP XMP 的 dc:description 文本（getxmp 自动 unescape）。"""
    try:
        from PIL import Image
        with Image.open(image_path) as img:
            img.load()
            try:
                xmp = img.getxmp()
            except Exception:
                return None
        li = (
            (((xmp.get("xmpmeta") or {}).get("RDF") or {}).get("Description") or {})
            .get("description", {}).get("Alt", {}).get("li")
        )
        if isinstance(li, dict):
            t = li.get("text")
            if isinstance(t, str):
                return t
        return None
    except Exception as e:
        logger.debug("读 WebP XMP 失败 %s: %s", image_path, e)
        return None


def _write_webp(
    image_path: str, markdown: str, model_tag: str, prompt_version: str
) -> bool:
    """WebP：Pillow ``save(xmp=, lossless=True)``。lossless 保像素 → content_fingerprint 不变。"""
    try:
        from PIL import Image
        payload = _format_payload(markdown, model_tag, prompt_version)
        xmp = _webp_xmp_packet(payload)
        with Image.open(image_path) as img:
            img.load()
            img.save(image_path, "WEBP", lossless=True, xmp=xmp)
        return True
    except Exception as e:
        logger.warning("write_back WebP 失败 %s: %s", image_path, e)
        return False


def content_fingerprint(image_path: str) -> str:
    """对图像核心内容（解码像素）算指纹（md5）。

    用解码像素而非文件字节，确保写回元数据（EXIF/XMP，含 piexif 写入时对段结构
    的调整）不改变指纹 —— 这是避免「写回 → file_hash 变 → 增量重解析」死循环的关键
    （工单 03 把它注入 file_hash_fn）。对所有图像格式通用（JPEG/PNG/WebP）。

    注：spike 曾试「剥离 EXIF 段算字节 hash」，但 piexif.insert 会移除原图 APP0/JFIF
    段（副作用、像素不变），导致字节 hash 漂移；像素 hash 完全不受段结构影响，故改用。
    """
    ext = _ext(image_path)
    if ext in ALL_IMAGE_EXTS:
        return _pixel_hash(image_path)
    raise NotImplementedError(f"content_fingerprint 不支持 {ext}")


def _pixel_hash(image_path: str) -> str:
    """解码像素（RGB）的 md5。元数据/段结构不影响，对所有图像格式通用。"""
    try:
        from PIL import Image
        with Image.open(image_path) as img:
            return hashlib.md5(img.convert("RGB").tobytes()).hexdigest()
    except Exception as e:
        logger.warning("像素指纹失败 %s: %s，回退文件字节 hash", image_path, e)
        with open(image_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
