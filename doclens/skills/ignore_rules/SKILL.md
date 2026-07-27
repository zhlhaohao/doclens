---
name: ignore-rules
description: 知识库忽略规则管理技能。当用户要求"忽略/不索引/排除"某些文件或目录（如"忽略所有叫 temp 的目录""别索引 .log 文件"），或询问/取消已有忽略规则时，必须加载本技能。加载方式：load_skill("ignore-rules")。
---

# 忽略规则管理技能

通过改写**知识库根目录的 `.gitignore`** 控制哪些文件不进索引。索引扫描器（pathspec）只读取这一份文件，语法为 gitignore 标准语法。

## 载体与硬约束

- **唯一生效文件**：workdir 根目录的 `.gitignore`。子目录里的 .gitignore **不生效**，禁止创建。
- 文件不存在时用 `write_file` 创建（知识库不是 git 仓库也能用，扫描器只看文件本身）。
- **只用基础语法**，禁止 `!` 取反、`[abc]` 字符集等高阶写法。

## 场景翻译表

| 用户说 | 写入规则 |
|--------|---------|
| 忽略所有叫 X 的目录（任何层级） | `**/X/` |
| 忽略根下的 X 目录 / 某具体路径 | `X/` 或 `docs/草稿/` |
| 忽略所有 .ext 文件 | `*.ext` |
| 忽略文件名含"XX"的文件 | `*XX*`（前缀则 `XX*`） |

目录规则末尾必须带 `/`；路径分隔符一律用 `/`（Windows 也一样）。

## 无效操作识别（先判断，别瞎加）

以下情况**规则无效或多余**，直接告知用户而非写入：

1. **内置已忽略**：`.git`、`node_modules`、`__pycache__`、`.venv`、`venv`、`dist`、`build`、`.cortex`、`.doclens`、`.tox`、`.mypy_cache`、`.pytest_cache`、`.eggs`、`.hg`、`.svn` —— 扫描器内置跳过，加规则是 no-op。
2. **本就不索引**：扩展名不在支持列表（md/pdf/docx/pptx/xlsx/html/txt/log/代码/图片等）的文件，如 `.exe`、`.zip`、`.psd` 本就不进索引。

## 执行流程（直接执行，事后汇报）

1. `read_file(".gitignore")` 读当前规则（不存在则跳过）。
2. 按翻译表生成规则，用 `edit_file` 追加（避免重复行；保留原有内容不动）。
3. `manage_kb(action="reindex")` 重建索引——被新规则排除的已索引文档会自动清除。
4. 向用户汇报：**加了哪几条规则 + 各自含义 + reindex 结果（移除/索引文档数）**。

## 反向操作

- **"我忽略了什么"**：读 `.gitignore`，逐条用自然语言解释每条规则的效果。
- **"别忽略 X 了"**：`edit_file` 精确删除对应行，然后 reindex + 汇报。

## 禁止事项

- 禁止备份 .gitignore（出错凭对话记录修复）。
- 禁止改动用户原有的无关规则行。
- 禁止用 `bash` 操作 .gitignore（统一走 `read_file`/`edit_file`/`write_file`）。
