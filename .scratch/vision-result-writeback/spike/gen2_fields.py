# -*- coding: utf-8 -*-
"""第二轮：同时写 XMP 多字段 + EXIF XP 系列，找出 Windows 能读出中文长文本的字段。
注意：本脚本用 save(exif=) 重编码（有损），仅为验证字段映射；实现时改无损注入。"""
import io, sys
from PIL import Image

DESC = "这是一段较长的中文解读内容，测试哪个字段能被 Windows 资源管理器完整读出 hello 123"

XMP = (
    b'<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    b'<x:xmpmeta xmlns:x="adobe:ns:meta/">'
    b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    b'<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">'
    b'<dc:title><rdf:Alt><rdf:li xml:lang="x-default">XMPtitle:' + DESC.encode("utf-8") + b'</rdf:li></rdf:Alt></dc:title>'
    b'<dc:description><rdf:Alt><rdf:li xml:lang="x-default">XMPdesc:' + DESC.encode("utf-8") + b'</rdf:li></rdf:Alt></dc:description>'
    b'<dc:subject><rdf:Bag><rdf:li>XMPsubject</rdf:li></rdf:Bag></dc:subject>'
    b'</rdf:Description></rdf:RDF></x:xmpmeta>'
    b'<?xpacket end="w"?>'
)


def xp(s):
    return ("XP:" + s).encode("utf-16-le") + b"\x00\x00"


im = Image.new("RGB", (128, 128), (123, 222, 77))
exif = im.getexif()
exif[0x010e] = "EXIFimgdesc:" + DESC          # ImageDescription (ASCII，预期乱)
exif[0x9c9c] = xp("Comment:" + DESC)           # XPComment  -> System.Comment
exif[0x9c9d] = xp("Title:" + DESC)             # XPTitle    -> System.Title
exif[0x9c9e] = xp("Keywords")                  # XPKeywords -> System.Keywords
exif[0x9c9f] = xp("Subject:" + DESC)           # XPSubject  -> System.Subject

buf = io.BytesIO()
im.save(buf, "JPEG", quality=95, exif=exif.tobytes())
pure = buf.getvalue()
ns = b"http://ns.adobe.com/xap/1.0/\x00"
payload = ns + XMP
seg = b"\xff\xe1" + (len(payload) + 2).to_bytes(2, "big") + payload
injected = pure[:2] + seg + pure[2:]
with open(sys.argv[1], "wb") as f:
    f.write(injected)
print(f"written {len(injected)} bytes")
