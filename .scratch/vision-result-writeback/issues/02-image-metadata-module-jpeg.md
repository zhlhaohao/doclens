# 02 — image_metadata deep module（JPEG）+ 单元测试

**What to build:** 新建「图像元数据网关」deep module，先实现 JPEG 的三接口：`read_back`（读元数据里的解读 payload，含 markdown + model_tag + prompt 版本；无或版本不符返回 None）、`write_back`（按 01 选定的库写入 JPEG XMP，失败返回 False 不抛）、`content_fingerprint`（剥离 JPEG 元数据段后对核心内容算指纹）。定义格式范围常量（解读+写回集合 = jpg/jpeg/png/webp）。配套单元测试覆盖 JPEG 的 round-trip、指纹写回前后不变、像素写回前后不变、版本不符返回 None。模块对外稳定，内部格式分支/编码/剥离算法藏背后。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] JPEG `write_back` 后 `read_back` 读回的 markdown 与写入一致（含中文、含 model_tag/prompt 版本）
- [ ] JPEG `write_back` 前后 `content_fingerprint` 不变
- [ ] JPEG `write_back` 前后像素/核心视觉内容不变
- [ ] `read_back` 对无元数据 / 版本不符的图返回 None
- [ ] `write_back` 对只读/损坏文件返回 False 不抛异常
- [ ] 格式范围常量定义，供后续工单复用
