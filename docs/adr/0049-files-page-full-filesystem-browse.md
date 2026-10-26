# ADR-0049: 文件页整机浏览（绝对路径通道）

files 页此前把用户锁死在工作目录（workdir）内——`safe_resolve` 拒绝一切越界路径，面包屑以 workdir 为根，无法查看磁盘上其他位置的文件；想换库只能靠顶栏「工作目录指示器」盲切（看不到目标目录内容）。本决议开放**整机只读浏览**：`/api/files/list|attrs` 与 `/api/preview`（文本/PDF）、`/api/preview/download|pdf` 接受 Windows 绝对路径（正斜杠规范形），workdir 外任意可读目录可列目录、可预览文本/PDF、可下载。写端点（mkdir/create/delete/move/rename/upload）显式拒绝绝对路径（400）——浏览是自由的，写入仍以 workdir 为界。二进制合成预览（docx/pptx/xlsx/epub/图像/PST，依赖索引 DB）对 workdir 外文件返回 422 `OUTSIDE_WORKDIR_PREVIEW`。2026-10-26 决议。

## Context

- 现有安全模型：`path_safety.safe_resolve` 强制 `base/requested` 落在 workdir 内（`..` 越权 404）；点文件（`.` 开头组件）保护；写端点复用同一闸门。
- 已有先例：ADR-0043 工作目录热切换本就接受任意绝对路径（`POST /workdir/switch`），整机路径并非新攻击面；ADR-0021 planify 工具层对外部路径是「确认后放行」而非硬拒绝。本机个人工具 + 登录闸门（ADR-0004）为信任基座。
- 前端约束：文件搜索框是「知识库文件名搜索」（数据源为索引），与「浏览外部目录」语义互斥。

## Decision

1. **路径双形态**：`path` 参数承载相对 POSIX（workdir 内，现状）或 Windows 绝对路径（`D:/a/b`，正斜杠）。前后端共用判定「`X:/` 或 `//` 开头 = 绝对」。外部目录条目的 Entry.path 即绝对路径串（前端同一函数判定，不新增字段）。
2. **「此电脑」层**：`GET /api/files/drives` 返回盘符清单；前端上溯到盘符根之上时渲染盘符列表（哨兵 `~drives` 仅在前端 store 内使用，不进后端）。
3. **写边界不动**：写端点检测绝对路径直接 400「写操作仅在工作目录内可用」——不放宽 safe_resolve，不做外部写。
4. **外部目录点文件照旧隐藏**（`.` 开头不列出），与 workdir 内口径一致。
5. **上溯入口**：面包屑「上溯」按钮在 workdir 根（`""`）变为可用，进入 workdir 父目录的绝对路径——这是相对世界跨入绝对世界的唯一跳板。
6. **浏览目录不持久化**：外部浏览态（currentDir 为绝对路径）刷新后回 workdir 根。
7. **搜索框外部禁用**：外部浏览时置灰 + 提示「搜索仅覆盖工作目录」。
8. **file-tree 不变**：树是索引范围的可视化，不是文件浏览器。

## Considered Options

- **双根模式（`..` 特殊标记上溯）**——否决：表达不了跨盘跳转，且与 safe_resolve 语义纠缠。
- **临时索引让外部二进制可预览**——否决：大目录建索引分钟级，违背「浏览只读」语义；文本+PDF 覆盖绝大多数「看看这是什么文件」场景。
- **外部图像直接读字节渲染**——裁剪：本期 422，后续再议。
- **外部目录文件名搜索**——否决：实时递归扫描外部大目录成本高，与索引搜索语义混杂。

## Consequences

- `safe_resolve` 保留为 workdir 内路径的闸门；绝对路径走新分支（`files_browse.resolve_browse_path`），不复用越权校验。
- 下载文件名的 hash6 后缀对绝对路径串照算——hash 反查闭环只在 workdir 索引内命中，外部文件自然走常规上传，不破坏既有行为。
- 前端 treeCache 键扩展为「相对 or 绝对 or `~drives`」三种字符串；`_restoreSelection` 对绝对路径 currentDir 重置为根。
- 回归面：files 列表/预览既有测试 + 新增 `test_web_files_browse.py`。
