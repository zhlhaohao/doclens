---
name: competitive-analysis
description: "比较几款竞品或替代方案时使用：定维度、收集有来源的事实、对比表、结论和机会点。"
metadata:
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "报告.md", "kind": "md", "sections": ["对比表", "来源"]}, {"id": "dimensions", "path": "维度表.xlsx", "kind": "xlsx"}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "sections", "check": "sections", "deliverable": "report"}, {"id": "columns", "check": "tableColumns", "columns": ["维度"], "deliverable": "report"}, {"id": "xlsx-exists", "check": "exists", "deliverable": "dimensions"}, {"id": "xlsx-columns", "check": "tableColumns", "columns": ["维度"], "deliverable": "dimensions"}], "maxFixRounds": 2}
  display_name: "竞品分析"
  params: "[{\"name\":\"竞品\",\"description\":\"要比较的产品或方案，逗号分隔\"},{\"name\":\"分析目的\",\"description\":\"比如定价参考、找差异化、选型\",\"default\":\"找出差异和机会\"}]"
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 竞品分析

对象：{竞品}
目的：{分析目的}

## 步骤
1. 根据目的定 5–8 个比较维度，例如：目标用户、核心功能、定价、上手难度、平台支持、集成、口碑、商业模式。
2. 每个维度收集事实，优先官网、文档、定价页、更新日志；每条事实记下来源和查看日期。联网遵守本次实际权限和审批结果。
3. 查不到的写「未找到公开信息」，不要猜。
4. 区分事实（有来源）和判断（你的分析），判断单独放在「分析」里。
5. 最后回到目的：给出结论、机会点和建议的下一步。

## 模板

```
# 竞品分析：<主题>
目的：…　日期：…

## 一句话结论

## 对比表
| 维度 | 竞品 A | 竞品 B | 我们 / 方案 C |
|---|---|---|---|

## 各家要点
### 竞品 A
- 定位：…
- 强项：…
- 弱项：…
- 来源：[1] [2]

## 分析
- 共同点 / 行业惯例：…
- 差异与空白：…
- 机会点：…
- 风险：…

## 建议的下一步

## 来源
[1] 标题 —— 链接或出处 —— 查看日期
```

## 维度表交付
使用 office_create 写出合同的 `维度表.xlsx`，第一张工作表第一行至少要有 `维度` 列；其余列直接用实际比较的产品名（合同不强制固定列名），比较占位方案时才用「竞品 A」「竞品 B」。单元格保留来源编号和缺失信息说明；不要把 CSV 改后缀冒充 xlsx。
