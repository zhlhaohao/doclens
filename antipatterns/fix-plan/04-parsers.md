# 1025-4 解析器任务书（parsers/**）· 全独立版

> worktree `../1025-4`｜分支 `1025-4`｜上游 `00-orchestration.md` v2
> **独立性**：全部条目在 parsers/** 内闭环；parse_status 契约自包含定义——文件级失败走 raise 直接入 indexer **既有** except 通道（indexer.py:1847-1857），无需 indexer 任何配合（1025-2 的 RI-5 是锦上添花的消费侧，合入先后皆可）。
> **文件红线**：`treesearch/parsers/**`；扩 `test_pst_parser.py test_anydoc_parser.py test_docx_parser.py test_pdf_native_preview_api.py`，新增 `test_rq_*.py`/`test_rp_*.py`。

## 执行顺序（16 提交 + 拆分）

### ① RQ-1 [P1] pst finally 死锁（含旧AP-4 补证据）
- `pst_parser.py:717-722` 消费者异常先 `proc.kill()`+drain 再 await；`store_for_email` mkdir(:90) 包 try；收口 :561→586 Popen 窗口、`pst_attachment_store.py:86-90` 先删后建补偿。
- 回归（先红后绿，mock 注入）：消费者异常 → producer 退出 + tmp 清理 + 无僵尸进程。

### ② RP-1 [P1] 文件级失败 raise 化 + parse_status 契约（自包含版）
- **契约**：解析返回 dict 可带 `parse_status ∈ {ok, empty, degraded, failed}` + `parse_error`；**failed = 直接 raise**（流入 indexer 既有通道，无需配合）；`empty` 仅限文件级证据（size==0）；`degraded` = 部分能力降级。
- 五处改造：`markitdown_parser.py:189-191`、`anydoc_parser.py:166-168`、`mhtml_parser.py:91-94`、`pdf_parser.py:410-413`（宽 except 拆三类）、`pdf_parser.py:418-428`+`excel_parser.py:200-203`（占位根节点仅限真 empty）。含旧 P-AP-1（pdf :174-176 raise 化）/P-AP-2 并账。
- 回归（先红后绿）：损坏 PDF→raise、空文件→empty、图片失败→degraded 三态断言。

### ③ RQ-4 [P2] sidecar idle 超时 + 附件池可中断
- stdout N 秒无输出 kill（默认 120s，env 可覆盖）；`:146-149` 附件超时换可中断（取消标志/进程池）。
- 回归：挂起 sidecar（mock 静默）被超时清理断言。

### ④ RQ-3 [P2] 损坏图像读失败退避
- `image_metadata.py` 读失败与未解读分离（哨兵/双返回）；失败计数 + N 次（默认 3）退避；`image_parser.py:45-49` 消费新信号（parsers 内闭环——入队由 indexer 依解析结果驱动，改信号即改行为）。
- 回归：损坏图二次解析不入队断言（解析层）。

### ⑤ RQ-5 [P2] ast_parser 补 regex 兜底（修契约谎言）
- `ast_parser.py:28-30` SyntaxError 走 regex 兜底（对照 treesitter :378-391）；docstring 对齐。
- 回归：坏语法 py 产出 regex 结构非空断言。

### ⑥ RP-2 [P2] markitdown/anydoc to_thread
- `anydoc_parser.py:63-64`、`markitdown_parser.py:186` convert 包 `asyncio.to_thread`。
- 回归：并发 wall time 断言。

### ⑦ RP-3 [P2] anydoc 双重解析消一
- `:159-165` 核对两产物消费面——共享单次解析或懒加载第二产物；assets 流式落盘。
- 回归：大 epub 内存峰值护栏断言。

### ⑧ RQ-6 [P2] treesitter to_thread + 递归上限；image 全像素解码 to_thread
- `treesitter_parser.py:367-368/276/282` parse/read 包 to_thread；`_walk_tree`(:299-337) 深度上限 64 截断+warning；`image_metadata.py:230/251/284` load() 段 to_thread。
- 回归：深度异常 AST 不爆栈 + 并发断言。

### ⑨ RQ-2 [P2] image_metadata 双竞态
- `:103/:191-193` 计数器加锁；`:89-99` 版本口径显式传参去模块级可变。
- 回归：16 线程计数不丢断言（对照 AP-34 先例）。

### ⑩ RP-5 [P2] PDF 图像逐页落盘 + 页上限
- `pdf_parser.py:123-146/402-403` 逐页即交 image_store；`:124/:164` 页上限 cfg 化（默认 2000，超限 degraded）。
- 回归：多页 PDF 内存峰值护栏断言。

### ⑪ P-AP-5 [P2] 办公文档资源 try/finally（台账清单文件逐一补 with/finally）
### ⑫ RP-4 [P3] registry 清单派生（SHADOW_MD 从 SOURCE_TYPE_MAP 派生；:232 "pptx" 查表；内部重判改传参）
### ⑬ RP-6 [P3] excel deque(maxlen=200)+计数分离；裸 200 提 cfg
### ⑭ RP-7 [P3] html heading 行号一次遍历建索引 O(1) 查
### ⑮ RQ-7 [P3] 图像扩展名单源（**parsers 内闭环**：image_parser 改 import image_metadata:29 真源；indexer 那份归 RI-6 自理）
### ⑯ RQ-9 [P3] pst 邮件树分批 + 失败计数入汇总（:687-692 计数→:725 汇总；聚合改生成器小步走）

### P4 记录项（并入相关提交顺带）：P-AP-9 私有 import 公共化；P-AP-10 建议改判关闭（留注记）；P-AP-12/13/14 维持记录。

## lead 下令才做

### ⑰ P-AP-3 pst_to_trees God Object 拆分【前置①-⑯完成】
- 提取 sidecar 协程/附件管线/树装配三类；只读 0-diff 取证；`test_pst_parser.py` 全绿。

## 台账
每提交改 `antipatterns/treesearch-parsers.md` 对应条目 → `done(<commit>)`。
