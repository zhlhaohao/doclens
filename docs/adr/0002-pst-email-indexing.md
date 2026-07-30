# ADR-0002: PST 邮件文件解析索引 —— Go sidecar 解包 + 每封邮件一个文档

- 日期：2026-07-26
- 状态：已接受（经 grill-with-docs 会议逐项确认）

## 背景

doclens 需要支持 Outlook 邮件数据文件（.pst）的解析索引。单个 PST 可达数 GB、
包含成百上千封邮件（实测样本 2.4 GB / 3576 条消息 / 3196 封邮件 / 2075 个附件）。
现有架构约定「1 文件 = 1 文档」，且全部 parser 为 Python 实现。

关键问题：PST 是复杂的二进制容器格式（MAPI 属性、B-tree、加密变体），Python 生态
缺乏可用的成熟解析库。

## 决策

### 1. 解析路线：Go sidecar（go-pst）

`tools/pst-extract/`（Go CLI，基于 go-pst v6.0.2）把 PST 解包为流式 JSONL
（stdout 每行一封邮件），Python 端 `treesearch/parsers/pst_parser.py` 逐行消费建树。
**Go 源码与编译产物 `treesearch/_bin/pst-extract.exe` 都提交进仓库**（随 treesearch 包经 package-data 打进 wheel，`pip install` 后开箱即用）——
重新编译只需 `cd tools/pst-extract && go build -o ../../treesearch/_bin/pst-extract.exe .`。

### 2. 索引粒度：每封邮件一个文档（打破 1 文件 = 1 文档）

- parser 返回 `{"multi_docs": [tree, ...]}`，索引器为每个树建独立 Document。
- 派生 `source_path` = `<pst绝对路径>#<entry_id>`（MAPI message identifier 作唯一键）。
- 派生 doc_id = `<pst文档id>__<entry_id>`。
- 检索/预览侧：`instr(source_path, ?) = 1` 前缀匹配实现 PST 级级联：
  文件 hash 变化 → 按 doc_id 差集删除 stale 派生文档后重建；文件删除 → 级联删除全部派生文档。
- `index_meta` 只记物理 PST 文件的指纹（与派生文档解耦）。

### 3. 执行模式：主索引同步解析

接受分钟级阻塞（实测 2.4 GB PST：sidecar 解包 4–7s；含附件全文解析的总时长
取决于附件体积）。不设异步队列——与 ADR-0001 图像不同，PST 解析是 CPU 本地任务，
没有外部 API 延迟，复杂度收益不成比例。

### 4. 内容范围：仅邮件

sidecar 按 `properties.Message` 类型过滤（IPM.Note 等）；联系人/日历/任务/便笺跳过
（go-pst 对未映射 message class 的 fallback 邮件照常收编）。实测样本：3576 条消息
迭代，3196 封邮件入索引（380 条非邮件消息正确跳过）。

### 5. 附件：内容并入所属邮件文档

> **2026-07-29 修订**：「不持久落盘」已被 ADR-0003 推翻——全部 ≤100MB
> 附件索引时落盘供下载；白名单解析并入正文的逻辑不变。

- 白名单类型（pdf/docx/doc/xlsx/pptx/csv/txt/md/html）由 sidecar 提取到临时目录，
  Python 端复用现有 parser 解析为文本，以 `## 附件: <名称>` 章节并入邮件正文
  （单附件截断于 200k 字符）；解析后临时文件即删。
- 图像/zip/exe 及单附件 >20MB：只在邮件头部记录文件名与大小。
- 附件不产出独立文档、不持久落盘。

### 6. 管道与输出卫生的两个实测陷阱（已修复）

- **go-pst 库内 `fmt.Printf` 诊断直写 os.Stdout**（message.go 的
  `Unmapped message class ...`），会混进 JSONL 流把一行 JSON 劈成两段。
  sidecar 启动时把 `os.Stdout` 换成管道（转储 stderr），JSON 编码器写事先保存的
  真实 stdout。
- **Python 消费者只捕 `json.JSONDecodeError`**：`json.loads(bytes)` 遇非法 UTF-8
  抛 `UnicodeDecodeError`，漏捕导致生产者线程崩溃 → sidecar 阻塞在管道写 →
  `proc.wait()` 死锁。修复：先 `raw.decode("utf-8", errors="replace")` 再解析，
  宽捕异常并记录行数审计日志，`proc.wait(timeout=120)` 兜底。

## 备选方案（已否决）

- **Aspose.Email (Python via .NET)**：实测免费版**每个文件夹限枚举 50 封邮件**
  （收件箱 2799 → 50），不可用。
- **pypff (libpff)**：无 win-amd64 预编译 wheel，需本机 Visual Studio 编译 C 扩展，
  本机无 VS，且把构建负担转嫁给用户。
- **readpst (libpst) 子进程**：C 工具链，Windows 分发困难。
- **PST 整体作为一个文档**：数千封邮件挤进单个文档，检索粒度过粗，违反
  结构感知检索的初衷。
- **附件独立成文档**：附件脱离邮件上下文（发件人/日期/主题），检索命中率反而下降；
  且使派生文档数量翻倍。
