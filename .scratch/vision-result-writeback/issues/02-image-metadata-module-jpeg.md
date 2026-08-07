# 02 — image_metadata deep module（JPEG）+ 单元测试

**What to build:** 新建「图像元数据网关」deep module，先实现 JPEG 的三接口：`read_back`（用 piexif 读 EXIF，取 `XPComment` 里的解读 payload，含 markdown + model_tag + prompt 版本；无或版本不符返回 None）、`write_back`（用 **piexif 无损写入** EXIF `XPComment` (0x9c9c UTF-16LE)；**合并而非覆盖**已有 EXIF；失败返回 False 不抛）、`content_fingerprint`（剥离 JPEG 的 APP1 EXIF 段后对核心内容算指纹）。定义格式范围常量（解读+写回集合 = jpg/jpeg/png/webp）。配套单元测试覆盖 JPEG 的 round-trip、指纹写回前后不变、像素写回前后不变、版本不符返回 None、已有 EXIF 不被覆盖。模块对外稳定，内部格式分支/编码/剥离算法藏背后。

> 依据工单 01 spike：JPEG 载体是 EXIF `XPComment`（**非 XMP `dc:description`**——Windows 读不到），库用 piexif（无损）。详见 `spike/findings.md` 与 ADR-0009 Spike 修正。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] JPEG `write_back` 后 `read_back` 读回的 markdown 与写入一致（含中文、含 model_tag/prompt 版本）
- [ ] JPEG `write_back` 前后 `content_fingerprint` 不变
- [ ] JPEG `write_back` 前后像素/核心视觉内容不变
- [ ] `read_back` 对无元数据 / 版本不符的图返回 None
- [ ] `write_back` 对只读/损坏文件返回 False 不抛异常
- [ ] 格式范围常量定义，供后续工单复用
