# -*- coding: utf-8 -*-
"""工单 01 spike：实测 Pillow 12 对 JPEG/PNG/WebP 元数据的写入-读回 + 像素不变。
重点验证 JPEG XMP（Pillow 短板）。产出供选型结论文档引用。"""
import io, hashlib
from PIL import Image
from PIL.PngImagePlugin import PngInfo

DESC = "测试描述 中文 hello 123"          # 含中文 + ASCII
DESC_UTF8 = "测试描述 中文".encode("utf-8")  # 在原始字节里探测中文用

XMP = (
    b'<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    b'<x:xmpmeta xmlns:x="adobe:ns:meta/">'
    b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    b'<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">'
    b'<dc:description><rdf:Alt>'
    b'<rdf:li xml:lang="x-default">' + DESC.encode("utf-8") + b'</rdf:li>'
    b'</rdf:Alt></dc:description>'
    b'</rdf:Description></rdf:RDF></x:xmpmeta>'
    b'<?xpacket end="w"?>'
)


def new_img():
    return Image.new("RGB", (8, 8), (123, 222, 77))


def pixel_md5(buf):
    im = Image.open(buf if isinstance(buf, io.BytesIO) else io.BytesIO(buf))
    im.load()
    return hashlib.md5(im.convert("RGB").tobytes()).hexdigest()


def line(k, v):
    print(f"  [{k}] {v}")


print("== PNG (iTXt, UTF-8) ==")
try:
    pi = PngInfo()
    pi.add_itxt("Description", DESC)
    buf = io.BytesIO()
    new_img().save(buf, "PNG", pnginfo=pi)
    im2 = Image.open(io.BytesIO(buf.getvalue())); im2.load()
    got = im2.info.get("Description")
    bare = io.BytesIO(); new_img().save(bare, "PNG")
    line("round-trip", "OK" if got == DESC else f"MISMATCH {got!r}")
    line("像素一致(对照无元数据)", pixel_md5(bare) == pixel_md5(io.BytesIO(buf.getvalue())))
except Exception as e:
    line("ERR", f"{type(e).__name__}: {e}")

print("== WebP (save xmp= 参数) ==")
try:
    buf = io.BytesIO()
    new_img().save(buf, "WEBP", lossless=True, xmp=XMP)
    im2 = Image.open(io.BytesIO(buf.getvalue())); im2.load()
    raw = im2.info.get("xmp") or b""
    bare = io.BytesIO(); new_img().save(bare, "WEBP", lossless=True)
    line("round-trip", "OK" if DESC_UTF8 in raw else f"MISMATCH rawlen={len(raw)}")
    line("getxmp", str(im2.getxmp())[:200])
    line("像素一致(对照无元数据)", pixel_md5(bare) == pixel_md5(io.BytesIO(buf.getvalue())))
except Exception as e:
    line("ERR", f"{type(e).__name__}: {e}")

print("== JPEG A: EXIF ImageDescription(270) ==")
try:
    im = new_img(); exif = im.getexif(); exif[270] = DESC
    buf = io.BytesIO(); im.save(buf, "JPEG", exif=exif.tobytes())
    im2 = Image.open(io.BytesIO(buf.getvalue())); exif2 = im2.getexif()
    line("读回", repr(exif2.get(270)))
    line("说明", "EXIF ImageDescription 为 ASCII,中文预期乱码")
except Exception as e:
    line("ERR", f"{type(e).__name__}: {e}")

print("== JPEG B: Pillow save(xmp=) 是否支持 ==")
try:
    im = new_img(); buf = io.BytesIO()
    im.save(buf, "JPEG", xmp=XMP)
    im2 = Image.open(io.BytesIO(buf.getvalue()))
    raw = im2.info.get("xmp") or b""
    line("结果", "支持! OK" if DESC_UTF8 in raw else f"未生效 rawlen={len(raw)}")
except TypeError as e:
    line("结果", f"不支持: {e}")
except Exception as e:
    line("ERR", f"{type(e).__name__}: {e}")

print("== JPEG C: 手动 APP1 XMP 注入(不重编码,保像素) ==")
try:
    bare = io.BytesIO(); new_img().save(bare, "JPEG")
    pure = bare.getvalue()
    assert pure[:2] == b"\xff\xd8", "not SOI"
    ns = b"http://ns.adobe.com/xap/1.0/\x00"
    payload = ns + XMP
    seg = b"\xff\xe1" + (len(payload) + 2).to_bytes(2, "big") + payload
    injected = pure[:2] + seg + pure[2:]
    im2 = Image.open(io.BytesIO(injected)); im2.load()
    raw = im2.info.get("xmp") or b""
    xmp = im2.getxmp() if hasattr(im2, "getxmp") else {}
    line("读回原始", "OK" if DESC_UTF8 in raw else f"MISMATCH rawlen={len(raw)}")
    line("getxmp", str(xmp)[:300])
    line("像素一致(注入前后)", pixel_md5(io.BytesIO(pure)) == pixel_md5(io.BytesIO(injected)))
except Exception as e:
    line("ERR", f"{type(e).__name__}: {e}")

print("\n== 库版本 ==")
import PIL
print("Pillow", PIL.__version__)
