---
name: review-report
description: "给出审查结论时使用：结论、必须改、建议改写成一份可存档的报告。"
metadata:
  display_name: "审查报告"
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "审查报告.md", "kind": "md", "sections": ["结论", "必须改", "建议改"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "sections", "check": "sections", "deliverable": "report"}], "stop": ["只读审查：不代作者改代码；没跑过的检查标「未验证」，不写成结论。"], "maxFixRounds": 1}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 审查报告

1. 结论只有三种：可以合并 / 改完再看 / 需要讨论。写清依据的是哪个版本或哪次改动。
2. 必须改：每条写文件与位置、触发条件、可观察后果、建议改法，按影响排序。
3. 建议改：不阻塞交付的改进，写清收益和代价。
4. 没跑过的检查（构建、测试、手点）标「未验证」，不把推断写成结论。
5. 只读审查：不代作者写补丁，问题由作者或开发成员改。

## 交付
程序把产物目录交给本次运行，在其中写入 `审查报告.md`，三节都要有：

```
# 审查报告

## 结论
- 可以合并 / 改完再看 / 需要讨论；审查范围：<分支、提交或文件>

## 必须改
1. <文件:位置> —— <问题> —— <后果> —— <建议改法>

## 建议改
1. <文件:位置> —— <改进> —— <收益 / 代价>
```

同一条问题不要在两节里重复。工具照常经过当前权限、审批、预算和文件边界；方法不授予额外权限。
