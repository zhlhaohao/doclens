---
name: test-report
description: "汇报测试结果时使用：每条用例写清预期、实际和结果，结论说明能不能交付。"
metadata:
  display_name: "测试报告"
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "测试报告.md", "kind": "md", "sections": ["用例与结果", "结论"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "columns", "check": "tableColumns", "deliverable": "report", "columns": ["用例", "预期", "实际", "结果"]}, {"id": "sections", "check": "sections", "deliverable": "report"}], "stop": ["没执行过的用例，结果写「未执行」并说明缺什么，不写「通过」。"], "maxFixRounds": 1}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# 测试报告

1. 先写这次测的是什么：版本、改动范围、环境和前置数据。
2. 每条用例一行：用例、预期、实际、结果。实际写看到的现象（报错原文、状态码、界面表现），不写「符合预期」。
3. 结果只有三种：通过 / 失败 / 未执行。没条件跑的写「未执行」并说明缺什么。
4. 用例按风险排：阻塞交付的先写。
5. 结论回答能不能交付，列出必现问题和下次要回归的范围。

## 交付
程序把产物目录交给本次运行，在其中写入 `测试报告.md`，表和结论都要有：

```
# 测试报告

## 用例与结果

| 用例 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- |
| <做什么> | <应该发生什么> | <实际看到什么> | 通过 / 失败 / 未执行 |

## 结论
- 能否交付：能 / 不能，原因：<一句话>
- 必现问题：<现象与复现步骤>
- 回归范围：<下次要重测的地方>
```

失败用例保留最小复现步骤和输入，别只写「有问题」。工具照常经过当前权限、审批、预算和文件边界；方法不授予额外权限。
