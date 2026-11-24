---
name: csv-profile
description: "拿到一份新的 CSV / 表格数据时使用：先用附带脚本看行列、缺失、重复和每列取值，再决定怎么分析。"
metadata:
  display_name: "数据初探"
  params: "[{\"name\":\"数据文件\",\"description\":\"CSV 文件的路径；Excel 文件也可以，用 office_read 读取\"}]"
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 数据初探

数据：{数据文件}

## 步骤
1. 确认文件在工作文件夹里。Excel（xlsx / xls）先用 `office_read` 读取，说明看的是哪个工作表；需要脚本的完整统计时再请用户另存为 CSV。
2. 运行附带脚本（只读文件，不改数据、不联网）。命令遵守本次实际权限和审批结果：
   - macOS / Linux：`python3 "<本技能目录>/scripts/profile_csv.py" "{数据文件}"`
   - Windows：`python "<本技能目录>\scripts\profile_csv.py" "{数据文件}"`
   - 分隔符不是逗号时加 `--delimiter ";"`（制表符用 `--delimiter tab`）；中文乱码时加 `--encoding gb18030`。
3. 电脑上没有 Python、或用户拒绝运行时：直接读文件的前 50 行和后 20 行，手动给出同样的概况，并说明是抽样看的。
4. 根据结果写数据质量小结：
   - 缺失多的列（> 20%）、全空的列
   - 完全重复的行
   - 列数不齐的行（可能是分隔符或引号问题）
   - 类型可疑的列（数字列里混了文本、日期格式不统一）
   - 明显的异常值（负数金额、未来日期）
5. 提出下一步：要不要清洗、清洗规则是什么（写成新文件，不改原文件）、可以回答哪些问题。

## 输出
```
**数据概况**：（脚本输出的表）
**质量问题**：1. … 2. …
**对分析的影响**：…
**建议的清洗规则**：…
**可以回答的问题**：…
```

## 使用边界

优先使用已有信息；用户的数量、格式和任务范围优先于本文默认模板。工具权限、主目录/附加只读、Plan 模式与预算以当次实际能力为准；不换工具规避拒绝。这里只给工作方法，不授权写入、命令、付费、发送、提交或发布；未执行/验证的步骤如实标明。
