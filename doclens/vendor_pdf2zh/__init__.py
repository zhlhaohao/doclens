"""pdf2zh 核心引擎闭包（vendor 自 PDFMathTranslate v1.9.12，ADR-0039）。

来源：https://github.com/Byaidu/PDFMathTranslate（AGPL-3.0；本仓库自用不分发，
网络服务条款不触发——若未来公开分发须重估，见 ADR-0039）。

vendor 纪律：
1. **砍掉**：gui / backend / mcp_server / CLI(pdf2zh.py) / kernel/ / converter_docx
   （doc/docx 输入）/ ocr.py（OCR 路径）——上游对应能力不在本集成范围。
2. **副作用斩断**（相对上游的差异，全部标注 `# [doclens]`）：
   - ConfigManager 不再读写 ~/.config/PDFMathTranslate/config.json（envs 由宿主
     每次翻译注入，不持久化）；
   - 翻译缓存 SQLite 落位 <workdir>/.cortex/translate_cache.db（init_db 由宿主
     显式调用，模块层不再自动建库）；
   - translator.py 六个上游 SDK（deepl/ollama/openai/xinference/azure/tencentcloud）
     顶层 import 改为各 do_translate 内懒 import——未安装 SDK 时选到对应服务
     才报错，import 引擎不崩。
3. **不要**在本目录做无关重构：保持与 upstream 的 diff 最小，便于 cherry-pick
   上游修复。

懒加载约定（沿上游）：doclayout（onnx/cv2/babeldoc）、ultrafast（pdf_inspector）
均为调用方函数内 import——宿主不装对应依赖时引擎仍可 import，选到相关模式才报错。
"""

import logging

log = logging.getLogger(__name__)

__version__ = "1.9.12-vendor"
__all__ = ["translate", "translate_stream"]
