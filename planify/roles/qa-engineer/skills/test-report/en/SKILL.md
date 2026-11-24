---
name: test-report
description: "Use when reporting test results: one row per case with expected, actual and outcome, then a delivery verdict."
metadata:
  display_name: "Test Report"
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "测试报告.md", "kind": "md", "sections": ["用例与结果", "结论"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "columns", "check": "tableColumns", "deliverable": "report", "columns": ["用例", "预期", "实际", "结果"]}, {"id": "sections", "check": "sections", "deliverable": "report"}], "stop": ["没执行过的用例，结果写「未执行」并说明缺什么，不写「通过」。"], "maxFixRounds": 1}
---
> **运行环境说明（planify 移植版）**：本文提到的 Pi Bot 专属工具在本环境**不可用**：
> `office_create` / `office_read` / `office_inspect` / `office_edit` / `office_validate` / `office_render` /
> `office_template_*`（Office 文档工具）、`review_finding`（审查记录工具）、`ask_bot` / `assign_task`（群协作）。
> 替代：文档一律用 `write_file` 写 **Markdown**（用户坚持要 Word/PPT 时如实说明暂不支持，不要改扩展名冒充）；
> 审查发现按本文「汇总格式」直接写在回复里；「群」「演示设计师」「交给开发 Bot」等协作句忽略——你是被 DAG
> 派单的独立 Bot，交付物写到 assignment 指定的输出目录。「Pi Bot」一词指本系统。
> 契约（`contract`）里的 `deliverables` / `acceptance` 由派工程序消费，你按它写产物即可。

# Test report

1. State what was tested first: version, scope of the change, environment and fixture data.
2. One row per case: case, expected, actual, outcome. Actual records what you observed (error text, status code, screen behaviour), not "as expected".
3. The outcome is one of three: 通过 / 失败 / 未执行. A case you could not run is 未执行 plus what was missing.
4. Order cases by risk; blocking ones first.
5. The verdict answers whether it can ship, lists reproducible defects and the next regression scope.

## Delivery
The program supplies this run's output folder; write `测试报告.md` there with both sections. Keep the section names and the column headers in Chinese exactly as the contract lists them, because the check reads them:

```
# 测试报告

## 用例与结果

| 用例 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- |
| <what you did> | <what should happen> | <what actually happened> | 通过 / 失败 / 未执行 |

## 结论
- 能否交付：能 / 不能，原因：<one line>
- 必现问题：<symptom and reproduction>
- 回归范围：<what to retest next time>
```

Keep the shortest reproduction and inputs for failing cases instead of just saying "broken". Tools still go through the current permissions, approvals, budget and file boundaries; this method grants no extra permission.
