# -*- coding: utf-8 -*-
"""验证 piexif 无损写 EXIF XPComment：不重编码(像素不变) + Windows 备注可读。"""
import io, sys, hashlib, os
from PIL import Image
import piexif
from piexif import ImageIFD

DESC = "piexif 无损写入的备注：doclens 图像解读结果，含中文与 English。"
OUT = sys.argv[1]

# 1. 生成纯净 JPEG（无 EXIF）
im = Image.new("RGB", (128, 128), (123, 222, 77))
buf = io.BytesIO(); im.save(buf, "JPEG", quality=95)
with open(OUT, "wb") as f:
    f.write(buf.getvalue())

# 2. 像素基准
im0 = Image.open(OUT); im0.load()
ph0 = hashlib.md5(im0.convert("RGB").tobytes()).hexdigest()

# 3. piexif 无损插入 EXIF XPComment（0x9c9c UTF-16LE）
zeroth = {ImageIFD.XPComment: ("piexif备注:" + DESC).encode("utf-16-le") + b"\x00\x00"}
exif_bytes = piexif.dump({"0th": zeroth})
piexif.insert(exif_bytes, OUT)

# 4. 像素验证（无损关键）
im1 = Image.open(OUT); im1.load()
ph1 = hashlib.md5(im1.convert("RGB").tobytes()).hexdigest()
print("像素不变(piexif 无损):", ph0 == ph1)
print("文件大小 前/后:", len(buf.getvalue()), "->", os.path.getsize(OUT))
