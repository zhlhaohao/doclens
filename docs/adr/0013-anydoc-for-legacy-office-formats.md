# ADR-0013: 遗留 Office 格式解析引擎切换为 anydoc

`.doc/.docm/.ppt/.pps/.pot/.xls/.rtf/.epub` 的解析统一改用 Firecrawl 的 **anydoc**（纯 Rust 库，PyPI `firecrawl-anydoc`，MIT），转换出 Markdown 后走既有 `md_to_tree` 管线建树。废除旧 `doc_parser.py` 的外部工具链（textutil/antiword/catdoc/LibreOffice）——该链在 Windows 上全部不可用，`.doc` 实际等于解析不了；`.ppt/.xls/.rtf` 此前连 source_type 都没有，落 text 兜底把二进制乱码索引进库。

关键决策：

- **最小范围切分**：只有 doc/docm/ppt/pps/pot/xls/rtf/epub 走 anydoc；**pptx/xlsx/docx 不动**（pptx 的 markitdown 路径带 slide 级图片注入增强，xlsx/docx 的 openpyxl/python-docx 路径工作正常）。因此代码库里 markitdown 与 anydoc 两个 Markdown 转换引擎**有意共存**——不要试图"统一"掉其中一个。
- **主依赖而非可选组**：`firecrawl-anydoc` 进主依赖，默认安装即可解析上述格式。代价：PyPI 无 win_arm64 wheel（仅 win_amd64/macOS/linux），win_arm64 需 Rust 工具链从 sdist 构建；运行时注册环节 try/except ImportError 保护，未装时这些扩展名落回 text 兜底（照 tree-sitter `[ast]` 组先例的降级口径）。
- **内嵌图片全面对齐**：anydoc `to_document().assets` 接 ImageStore（仅 image/* 落盘，OLE 对象跳过），与 docx/pptx 预览能力对齐。但 anydoc 的 Markdown 序列化器不输出图片位置引用（仅保留 alt 文本），图片统一**附加到文档末尾**而非精确锚定。
- **ppt 不做根节点包裹**：anydoc 的 ppt 输出是扁平段落（无 slide 边界、无标题），无法仿照 pptx（markitdown 每 slide 一个 `#` 标题）做 slide 级包裹，直接走 md_to_tree 平铺。
- **失败走统一 `_failed_paths`**：EncryptedError/MalformedError 等 ConvertError 各族记具体 warning 后抛出，由 indexer 记入失败列表，不发明新的降级。

## Considered Options

- **保留旧外部工具链作 anydoc 降级**：四连工具（textutil/antiword/catdoc/LibreOffice）在 Windows 全为死代码，Linux/macOS 也极少安装；维护两条路径无收益——否决（git 历史可捞回）。
- **Office 全系统一 anydoc**（含 pptx/xlsx/docx）：需用 assets 重做 pptx slide 图片注入，爆炸半径翻倍且无用户痛点——否决，先小范围验证。
- **可选依赖组 `.[anydoc]`**：win_arm64 安全，但默认安装依旧解析不了这些格式，本期目标落空——否决。

## Consequences

- PST 附件并入白名单含 `doc`，换 anydoc 后 PST 附件里的老 doc 自动可解析（附带收益）。
- 新增 `tests/fixtures/anydoc/` 五格式 fixtures（取自 anydoc 仓库测试样例，MIT）。
- **DRM 加密 epub 不可解析**（如掌阅：`META-INF/encryption.xml` + 全书密文）。不做 DRM 绕过；anydoc_parser 预检 encryption.xml 并抛清晰中文错误（anydoc 原生报 "no rootfile entry" 系误导——container.xml 也是密文），经 failed_files.last_error 在 UI 可见。
