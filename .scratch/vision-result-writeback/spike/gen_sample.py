# -*- coding: utf-8 -*-
"""生成方法 C 注入 XMP 的 JPEG 样本，供 Windows Property System 读取验证。"""
import io, sys
from PIL import Image

DESC = "这是一段 doclens 测试描述，含中文与 English。验证 Windows 资源管理器能否从 XMP dc:description 读出。"
TITLE = "doclens 测试标题"

XMP = (
    b'<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    b'<x:xmpmeta xmlns:x="adobe:ns:meta/">'
    b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    b'<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">'
    b'<dc:description><rdf:Alt><rdf:li xml:lang="x-default">' + DESC.encode("utf-8") + b'</rdf:li></rdf:Alt></dc:description>'
    b'<dc:title><rdf:Alt><rdf:li xml:lang="x-default">' + TITLE.encode("utf-8") + b'</rdf:li></rdf:Alt></dc:title>'
    b'</rdf:Description></rdf:RDF></x:xmpmeta>'
    b'<?xpacket end="w"?>'
)

im = Image.new("RGB", (128, 128), (123, 222, 77))
buf = io.BytesIO(); im.save(buf, "JPEG", quality=95)
pure = buf.getvalue()
assert pure[:2] == b"\xff\xd8", "not SOI"

ns = b"http://ns.adobe.com/xap/1.0/\x00"
payload = ns + XMP
seg = b"\xff\xe1" + (len(payload) + 2).to_bytes(2, "big") + payload
injected = pure[:2] + seg + pure[2:]

out = sys.argv[1]
with open(out, "wb") as f:
    f.write(injected)
print(f"written {out}  ({len(injected)} bytes, XMP seg {len(seg)} bytes)")
