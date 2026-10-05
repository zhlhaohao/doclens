# 白名单外文本文件登记（ghost 行）

# Ghost Registration for Unlisted Text Files

Status: accepted

## 背景

doclens 宿主默认 `allowed_source_types` 排除 code/json/xml 等类型，这些文件在**发现阶段**即被过滤——files 页显示为「未索引」灰态、文件搜索搜不到，但知识库里它们真实存在，盘点不完整。ADR-0032（服务端语法高亮）刚确立「代码文件默认不进索引，allowed_source_types 不动」。

## 决议

白名单外的**全部文本文件**在 treesearch 引擎层发现阶段旁路登记：不解析、不建树、不分词、不写倒排，只在 `documents` 表落一行 **ghost 行**（空 `structure_json`、`node_count=0`、不写 `fts_nodes`、照常写 `index_meta` 指纹）。

- **可见性边界**：文件搜索（`/api/files/documents` 全量清单 → 前端文件名过滤）可见可搜；**KB 全文搜索不命中**（FTS 无行、通配 LIKE 对空树天然不命中，fts.py 已有空树防御）。
- **与 ADR-0032 的关系**：不推翻——`allowed_source_types` 与 FTS 索引口径原样不动；登记是发现阶段的元数据旁路通道，「不用于知识库搜索」的语义由空树+无倒排行结构性保证，而非靠过滤规则。
- **读取闸门**：`read_document`（KB 工具）遇 ghost **拒绝并提示改用 read_file**——与「不读取内容」意图自洽，AI 读代码走 planify 行口径链路。预览不受影响（code 预览本就与索引解耦，直读磁盘）。
- **UI 口径**：files 徽标三态（未登记灰 / 已登记 / 已索引），状态页统计分开报「已索引 X + 已登记 Y」。
- **文本判定**：已知文本后缀直通；无/未知后缀读前 8KB 嗅探（含 NUL 字节即二进制，不登记，git 同款判据）——嗅探只用于分类，字节不入库。
- **指纹加盐**：ghost 指纹格式带盐（PST `:pst5` 同模式），将来白名单扩大时旧 ghost 自动失效重建为真索引，不会因指纹未变被增量跳过卡死在 ghost 态。

## Considered Options

- **独立 registrations 表**：documents 语义保持纯净，但 files 搜索、徽标、统计、变更检测、prune、移动检测六处消费方全要双表 UNION 改造，改动面翻倍且长期漂移——否决。
- **doclens 宿主层独立 walk**：引擎零改动，但两套发现逻辑并行，锁/prune/变更检测语义须人工对齐——否决。
- **read_document 回退现场解析**：零行为回归，但 KB 读取链路对登记文件留后门，与「不读取内容」动机矛盾——否决（拒绝并提示）。
- **占位节点模式**（图像先例）：占位节点会被后台替换且文件名可 FTS 搜索，ghost 永不升级且不可搜——语义不同，不混用。

## Consequences

- `documents` 表语义扩容：`node_count=0` 成为「仅登记」标记，所有读方须按此区分（徽标/统计已跟进；未来消费方同理）。
- 增量索引、prune、移动检测、FileWatcher 对 ghost 行自动生效（同一套 `index_meta`），零额外维护。
- 代码文件在 files 页与文件搜索中成为一等公民，但全文搜索维持 ADR-0032 边界——「文件名可搜、内容不可搜」是有意的两层可见性。
