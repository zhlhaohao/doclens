---
name: kb-ask
description: 通过 doclens MCP server 对本地知识库做检索问答。当用户的问题可能涉及已索引的文档/笔记/资料（如"知识库里有没有…"、"根据我的文档回答…"、"问问 KB"、"查找资料"），或需要基于本地已索引内容作答时使用。调用 mcp__doclens__search_kb 检索 + mcp__doclens__read_document 深读，给出带来源、不编造的中文回答。
---

# 知识库问答（doclens MCP）

通过本机 doclens MCP server 检索本地知识库并作答。doclens 把文档解析成结构树（标题 / 类 / 函数），用 **FTS5/BM25 关键词检索**——不是语义/向量检索，所以查询策略围绕"关键词命中"展开。

## 前置检查（每次先做）

确认当前会话有 `mcp__doclens__search_kb`、`mcp__doclens__read_document`、`mcp__doclens__file_info` 三个工具：

- **有** → 继续。
- **没有** → doclens MCP 未配置或未运行。**不要硬答**，把以下步骤交给用户：
  1. 启动 doclens（启动时会自动拉起 MCP HTTP server），启动日志会打印一行 `MCP server: http://127.0.0.1:<port>/mcp`：
     ```bash
     doclens gui          # Web UI 模式
     # 或
     doclens             # TUI 模式
     ```
  2. 在 Claude Code 里登记一次（端口默认 `7880`，可用 `CORTEX_MCP_PORT` 配置；实际值看上一步日志里的 URL）：
     ```bash
     claude mcp add --transport http doclens http://127.0.0.1:<port>/mcp --scope local
     ```
  3. **重启当前 Claude Code 会话**（MCP 仅在会话启动时加载）。
  4. 用 `claude mcp list` 确认 `doclens: ... ✔ Connected`。

## 工具

- **`mcp__doclens__search_kb(query, max_results?, paths?)`**：FTS5 全文检索，返回带 `<path>` / `<hierarchy>` / `<content>` 的结构化结果。自然语言关键词，自动中英文分词。`paths` 可选：搜索目标数组（相对目录如 `"科技"`，或相对文件路径如 `"科技/xx.md"`），传入则只搜目标范围。
- **`mcp__doclens__file_info(path)`**：单文件概况（大小/总词数/章节数/章节清单），不返回正文。**read_document 之前先调它**判断规模、挑选章节或词区间。
- **`mcp__doclens__read_document(path, section?)`**：读文档完整或部分内容（md / pdf / docx / pptx / xlsx / html / 代码等）。
  - `path` 取自 `search_kb` 结果的 `<path>`。
  - `section` 传**单个**章节标题（如 `3.4.2. 变更流程`），**不要**拼层级路径（错：`第三章 > 3.4.2. 变更流程`）。传大章节=内容更宽泛，传小章节=更精确。
  - 二进制格式（pdf/docx/pptx/xlsx 等）**必须**用它，不要尝试通用文件读取。

> doclens MCP 只暴露这三个工具。索引重建 / 统计（reindex / stats）不在 MCP 范围内——需要时让用户在 doclens 端做：`doclens index --force`，或 TUI/GUI 里操作。

## 问答流程

1. **检索**：`search_kb` 找候选片段。
2. **探查**：对候选文档调 `file_info` 看规模与章节清单（大文件必做）。
3. **深读**：对最相关的 1–3 条，用 `read_document` 按章节读（传 `section` 单个章节标题）。
4. **作答**：基于读到的内容回答，**标注来源**。

### FTS 查询策略（关键，否则易漏）

`search_kb` 是精确关键词匹配，单次查询常不全。**必须**：

- 多种关键词组合**多次查询**（本地 FTS 很快，多调几次无妨）；
- 中文无结果换英文，反之亦然；
- 同义词 / 近义词替换；
- 长句拆成短词组合；
- 多次结果合并去重。

## 回答规范

- **语言**：中文回答（除非用户用其他语言提问）。
- **来源**：引用处标 `[1]` `[2]`，末尾给 `## 参考资料` 清单，每条**只写相对知识库根目录的文档路径**（取自 `search_kb` 的 `<path>` 或 `read_document` 输出里的 `文档:` 行）。
  - 路径**不要**写成绝对路径 / `file://` URL / markdown 链接 `[t](u)` / 带行号。
  - 同一文档只列一次，保持出现顺序。
  - 示例：
    ```
    量子密钥分发利用量子力学原理实现无条件安全 [1]。

    ## 参考资料
    1. 量子密码学/量子密码学从QKD到后量子密码学.md
    ```
- **不编造**：知识库里没有的内容，明说"知识库中未找到相关内容"，并建议重建索引（`doclens index --force`）或换关键词。**不要**转向 web 搜索或凭训练记忆作答。
- **仅用这两个 MCP 工具**作答；不要混入 Bash / Read / webfetch 去读本地文件或联网。
