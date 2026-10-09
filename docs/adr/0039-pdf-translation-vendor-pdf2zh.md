# ADR-0039: PDF 翻译——vendor pdf2zh 核心引擎

- 状态：已接受
- 日期：2026-10-08
- 关联决议：预览页主入口、翻译预设（复用模型预设机制）、SSE 进度任务模型

## 背景

用户需要在 doclens 中对知识库 PDF 做布局保持翻译（公式/图表/目录不破坏）。
评估了 PDFMathTranslate（pdf2zh v1.9.x）：引擎成熟（ONNX 布局 + 段落重排 +
24 翻译服务 + 公式占位符保护），但其发行包为主依赖捆绑 gradio 等无关重依赖，
且 translator 顶层硬 import 六个翻译 SDK、ConfigManager 有写回全局 config.json
的副作用。同时 pdf2zh 为 AGPL-3.0，doclens 为 Apache-2.0（单向兼容：Apache
代码可入 AGPL 项目，反之不行）。

## 决策

### 1. vendor 核心闭包（非 pip 依赖、非进程隔离）

从 ../PDFMathTranslate 移植 **9 文件引擎闭包**到 doclens 仓库内 vendor 子树
（high_level / converter / pdfinterp / text_spacing / doclayout / translator /
ultrafast / config / cache + __init__）。许可证姿态：doclens 为个人自用、
不分发、不对外提供网络服务，AGPL 网络服务条款不触发；若未来转向公开分发，
须重估此决策（fork 出独立 AGPL 包或改为子进程隔离）。

**砍掉**：gui / backend / mcp_server / pdf2zh.py(CLI) / kernel/ 整目录
（fast 路径直调 high_level 即可，precise 的 submodule+venv 子进程机制对宿主
无意义）、converter_docx（doc/docx 输入）、ocr.py（OCR 路径，连带 pooch 依赖）。

### 2. 依赖最小化（起步 10 包）

```
必装：pymupdf<1.25.3、pdfminer-six==20250506、numpy、tenacity、requests、
      tqdm、peewee、onnxruntime、opencv-python-headless、
      babeldoc>=0.1.22,<0.3.0（ONNX 模型 + Noto 字体资产）

（pdfminer-six 上游 pdf2zh 原钉 20250416，但 pdfplumber 每版精确钉死
pdfminer-six 的离散集合不含它——与 treesearchlib[parsers] 共存时依赖树
无解、pip 回溯风暴；2026-10-08 改钉邻版 20250506（pdfplumber 0.11.7
配套），vendor 闭包 API 兼容，由 uv pubgrub 冲突报告实锤定位。）
翻译 SDK：按预设所选服务按需装（openai 起步；google/bing 零 SDK）
可选：pdf-inspector（ultrafast 模式）
```

不进 doclens 依赖：gradio、huggingface_hub、rich、ollama、deepl、
azure-ai-translation-text、tencentcloud-sdk、xinference-client、pikepdf
（PDF/A 未纳入本期）。

改造项：translator.py 六个 SDK 的顶层 import 改为各 do_translate() 内懒
import——不装 SDK 时选到对应服务报友好错误，而非 import 崩溃。

### 3. 斩断 pdf2zh 全局副作用，统一进 .cortex/

- ConfigManager 写回 ~/.config/PDFMathTranslate/config.json 的行为禁用——
  翻译凭据统一走宿主「翻译预设」（模型预设机制第四类 kind=translate），
  envs 每次翻译由宿主注入，不持久化到 pdf2zh 自己的配置体系。
- 翻译缓存 SQLite 从 ~/.cache/pdf2zh/cache.v1.db 迁到
  `<workdir>/.cortex/translate_cache.db`（路径注入化）。

### 4. 入口与产物

- 入口：PDF 预览页 header「翻译」按钮（沿 TOC 抽屉/书签圆钮的 header 按钮
  范式）→ 弹框（预设/语言对/页码范围/mono-dual-both）→ 后台执行。
- 产物：写回知识库**源 PDF 同目录**，命名 `<原名>.<目标语言>.pdf`
  （如 `报告.zh.pdf`）。产物随 FileWatcher 自然入索引、随 Git 同步走——
  译本即知识。mono（纯译文）/ dual（原文译文逐页交错）由弹框选择。

### 5. 任务模型

后台线程执行引擎（同步阻塞调用包 to_thread），任务级**串行队列**（同宿主
视觉 API 全局串行锁先例；ONNX ModelInstance 单例非线程安全）。SSE 推送
逐页进度（引擎 callback 本身按页回调），普通模式支持取消
（cancellation_event）；ultrafast 两遍扫描对取消支持弱，一期不承诺。

## 后果

- doclens 主进程新增 ~10 个直接依赖，其中 onnxruntime/opencv 有平台二进制
  体积（接受；Windows arm64 开发机已有 wheel 先例可验证）。
- upstream pdf2zh 演进需手动 cherry-pick（vendor 无自动同步）；接受漂移
  成本，换取对源码的完全控制（懒加载改造、副作用斩断都动在 vendor 内）。
- PDF/A 兼容输出（pikepdf）、doc/docx 输入、OCR 纯图页三条能力明确不在
  本期范围，架构上留了加回的口子（闭包外文件不删 upstream 联系）。
