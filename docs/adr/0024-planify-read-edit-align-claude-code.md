# ADR-0024: planify read/edit 工具对齐 Claude Code（废词序号切片）

planify 的 `read_file`/`edit_file` 与 Claude Code 的 FileReadTool/FileEditTool 存在三处断裂：① 输出无行号，而 `prompts.py` 早已要求模型用 `file_path:line_number` 引用代码——模型看不到行号却要产出行号；② 分块寻址用自造词序号（CJK 每字一词），与主流编码助手的行口径不一致；③ `edit_file` 静默替换**第一个**匹配，多处重复文本时会改错位置。本决议把 planify 两工具对齐 Claude Code 方案；doclens 侧 `read_document` 的词体系**不动**。2026-09-17 决议。

## Context

- **参照系**：Claude Code 源码（`FileReadTool.ts` + `utils/file.ts` 的 `addLineNumbers`）——文本读取输出带行号前缀，紧凑格式为 `行号<TAB>内容`（1-based，killswitch 回退旧 `padStart(6)+→` 格式）；FileEditTool 有 old_string 唯一性校验 + `replace_all` 参数 + read-before-edit 门禁 + mtime 新鲜度检查 + readFileState 去重 stub。
- **词序号切片的由来**：为中文知识库场景造——CJK 长段落常整段一行，按行分块粒度太粗，词序号提供确定性细粒度寻址。该体系被 doclens `read_document` 深度依赖（`kb_tools.py`、`knowledge_base`/`summarize-files` 技能文档、MCP server 均引用）。
- **共享实现耦合**：`doclens/kb_tools.py:24` 直接 `from planify.tools.basic import split_words_with_seps`——有意的单一真相源（已记入 ARCHITECTURE-planify-boundary.md）。
- **无法照搬的部分**：Claude Code 的 token 预算校验走自家 countTokens API；readFileState/dedup stub/read-before-edit/mtime 检查依赖 per-session 读取状态设施，planify 工具层当前是无状态函数字典。

## Decision

### 1. read_file：行号输出 + offset/limit 按行分块

- 输出格式 `行号<TAB>内容`（1-based，对齐 Claude Code 紧凑格式）。
- 参数：`path` 保留（不改名 `file_path`——纯改名零收益且破坏既有习惯），新增 `offset`（起始行号，1-based）/ `limit`（行数），删除 `start_word`/`end_word`。
- 保留 50k 字符预算：超预算按行截断 + 续读提示（`已显示第 1-N 行 / 共 M 行，使用 offset=N+1 续读`）。**仅预算截断附提示**——显式 limit 是调用方自己开的窗，不打扰（对齐 Claude Code 行为；token 计数校验因无双后端通用计数通道不做）。
- 边界：空文件返回「（文件为空。）」；offset 超总行数返回「文件共 N 行」提示。

### 2. edit_file：唯一性校验 + replace_all

- `old_text` 出现 0 次 → `Error: Text not found`；出现多次且未传 `replace_all` → 报错并提示补充上下文或 `replace_all=True`（**否决旧的静默替换首匹配**——多处重复时改错位置是真实安全隐患）。
- `replace_all=True` 替换全部并在返回中报告替换处数。
- 工具描述明示：old_text/new_text 不得包含 read_file 输出的行号前缀。
- **不做** read-before-edit 门禁与 mtime 检查（需引入 per-session 读取状态设施，改动面扩到 runtime 层，本期裁剪）。

### 3. 词序号体系：planify 退出、doclens 保留

`split_words_with_seps`/`join_word_slice` 保留在 `planify/tools/basic.py` 原位（doclens 既有 import 不破），注释更新为「仅供 doclens read_document 词序号体系使用，planify 内部勿新增消费方」。两侧工具的寻址语义从此**有意分叉**：planify 管代码/通用文件（行口径），doclens read_document 管中文知识库文档（词口径）。

### 4. 同步面

`tools/registry.py`（主 schema）、`subagent/runner.py`（子代理 schema）、`managers/teammate_manager.py`（teammate schema + dispatch 透传）、`docs/ARCHITECTURE.md` 工具表。测试新增 `tests/test_basic_read_edit.py`。

## Considered Options

- **只加行号、保留词切片**（输出每行标全文行号）——否决（词/行两套寻址在同一工具并存，模型心智负担大；词体系的价值在中文长文档，已由 doclens read_document 承接）。
- **词切片模式不加行号**——否决（大文件必须切片读，恰恰最需要行号的场景缺失）。
- **edit 对齐全套（含 read-before-edit + mtime + dedup stub）**——本期否决（需新增 per-session 状态设施；唯一性校验已堵住最危险的误改路径，剩余为增量增强可后续跟进）。
- **截断改硬报错（对齐 Claude Code 的 maxSizeBytes 错误）**——否决（模型须失败一轮再重试；截断+续读提示对模型更友好，且 50k 预算是实践调出的值）。
- **path 改名 file_path 全面对齐**——否决（纯改名零功能收益，历史会话与模型旧习惯失效；offset/limit 已同名同义）。

## Consequences

- **工具契约变更**：`start_word`/`end_word` 从 read_file schema 删除——依赖词切片的模型行为将收到 schema 校验错误；发布说明须写明。
- **edit 行为收紧**：非唯一 old_text 从「静默改第一处」变为报错——既有依赖首匹配语义的工作流会断裂（改为报错的失败是显性的，优于静默错改）。
- **planify 须发版**（双形态分发纪律：改 `planify/**` 后跑 `publish-pypi.ps1 planify`）。
- **doclens 零改动**：`kb_tools.py` 的 `split_words_with_seps` import 继续有效；read_document 词序号语义不变。
- **teammate 能力补齐**：teammate 的 read_file schema 此前只暴露 `path`，本次顺带补上 offset/limit 与 replace_all。
