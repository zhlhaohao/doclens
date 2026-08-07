# Spike 工单 01 结论 — 图像元数据写入库选型

> 关联工单：`issues/01-metadata-lib-spike.md` ｜ ADR-0009 ｜ spec `docs/specs/vision-result-writeback-to-image-metadata.md`
> 环境：Pillow 12.1.1（项目已装）、Windows 11、Python 3.10。piexif 经 `pip install` 验证可装。

## 一句话结论

三格式全部可行、依赖轻量：**JPEG 用 piexif 无损写 EXIF `XPComment`，PNG/WebP 用 Pillow 原生**。但 spike 戳破了 spec/ADR-0009 的一个字段假设——**XMP `dc:description` 在 Windows 资源管理器读不到；要让「备注」可读，JPEG 必须改用 EXIF `XPComment`**。

## 最终选型表

| 格式 | 写入载体 | 库 | 无损(像素不变) | Windows 资源管理器 | doclens 读回 |
|---|---|---|---|---|---|
| JPEG/JPG | EXIF `XPComment` (0x9c9c, UTF-16LE) | **piexif**（`piexif.insert` 无损） | ✅ 验证 | ✅「备注」列读出完整中文 | `piexif.load` 读 EXIF |
| PNG | `iTXt` chunk (UTF-8) | **Pillow** `PngInfo.add_itxt` | ✅ 验证 | ❌ 不可靠（已知接受） | Pillow `Image.info` |
| WebP | XMP ancillary (UTF-8) | **Pillow** `save(xmp=, lossless=True)` | ✅ 验证 | ❌ 看 codec（已知接受） | Pillow `info["xmp"]` / `getxmp` |

新增依赖：**piexif**（纯 Python、无编译、`pip install piexif` 通过）。Pillow 已在 pyproject。

## 关键发现 1：JPEG XMP `dc:description` 在 Windows 读不到（戳破 spec 假设）

spec/ADR-0009 原假设「写 XMP `dc:description` → Windows 资源管理器备注可读」。实测（`gen_sample.py` + Windows Property System `ExtendedProperty`）：

- XMP `dc:title` → `System.Title`（「标题」）✅
- **XMP `dc:description` → `System.Subject` / `System.Comment` = 空 ❌**

Windows 11 的 WIC **不**把 `dc:description` 映射到任何可见属性（与 WIC 文档宣称的 `dc:description → Subject` 不符）。

## 关键发现 2：EXIF `XPComment` 才是 Windows「备注」的正解

第二轮（`gen2_fields.py`）同时写 XMP 多字段 + EXIF XP 系列，Windows 读出：

- EXIF **`XPComment` (0x9c9c, UTF-16LE) → `System.Comment` → 资源管理器「备注」列**，完整中文长文本 ✅
- EXIF `XPSubject` (0x9c9f) → 「主题」✅
- XMP `dc:title` → 「标题」✅

结论：JPEG 想让 Windows「备注」读到解读，字段必须是 **EXIF `XPComment`**，不是 XMP `dc:description`。

## 关键发现 3：EXIF 无损写入 = piexif

Pillow 的 `save(exif=)` 会重编码 JPEG（有损、像素变）。EXIF 必须无损写入：

- **`piexif.insert(exif_bytes, file)`**：直接操作文件字节、插入/替换 APP1 EXIF 段、不动像素数据。`gen3_piexif.py` 验证：像素 md5 写前 = 写后 ✅，Windows「备注」读出完整中文 ✅。
- piexif 纯 Python、无编译、pip 装得上。

> 注意：Pillow 12 的 JPEG `save(xmp=)` 其实支持写 XMP（探针 B 通过），但它重编码有损，**不能用**。WebP 的 `save(xmp=)` 必须配 `lossless=True` 才保像素。

## 像素不变验证（全部通过）

- JPEG：piexif.insert 无损，像素 md5 写前=写后 ✅
- PNG：Pillow `save(pnginfo=)` 无损，像素 md5 对照一致 ✅
- WebP：Pillow `save(lossless=True, xmp=)` 像素对照一致 ✅

## 对上游文档的修正（需回写，否则 02+ 按错误字段开发）

1. **ADR-0009**：JPEG 载体从「XMP `dc:description`」改为「EXIF `XPComment` (0x9c9c UTF-16LE)，piexif 无损写入」；新增依赖 piexif。PNG/WebP 不变。
2. **spec**：同上字段修正；Implementation Decisions 的载体段、依赖风险段、User Story 3 更新。
3. **工单 02**：JPEG `write_back` 用 piexif 写 EXIF `XPComment`（非 XMP）；`read_back` 用 piexif 读 EXIF；验收更新。

## 遗留实现细节（留给 02+）

- **版本 payload 张力**：JPEG 的 `XPComment` 同时供 Windows 人看 + doclens 机器读（版本校验）。需设计「版本头 + 干净描述」格式，使 Windows「备注」虽含版本元数据但人眼能看到描述主体。PNG/WebP 无此张力（doclens 自读自解析、Windows 不读）。
- **已有 EXIF 的合并**：`piexif.insert` 对已含 EXIF 的 JPEG（如相机原图有曝光参数）是合并还是覆盖？实现时验证——**不能覆盖用户原图的 EXIF**。
- **content_fingerprint 剥离口径**：JPEG 剥离 APP1（EXIF）段后算 hash；PNG 剥离 `tEXt`/`iTXt`；WebP 剥离 XMP chunk。具体剥离实现留工单 02/03。

## 探针脚本与样本（spike 产物）

- `metadata_probe.py` — 三格式 round-trip + 像素 + JPEG 三方法（A EXIF ImageDescription / B save(xmp=) / C 手动 APP1 注入）对比
- `gen_sample.py` — 方法 C XMP 注入样本（验证 `dc:description` 读不到、`dc:title` 可读）
- `gen2_fields.py` — XMP + EXIF 多字段样本（找到 `XPComment → 备注`）
- `gen3_piexif.py` — piexif 无损 `XPComment` 样本（最终方案验证）
- `sample_xmp.jpg` / `sample_fields.jpg` / `sample_piexif.jpg` — 样本图像
