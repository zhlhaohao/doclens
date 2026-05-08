# Cortex TUI 端到端测试框架设计

> 日期: 2026-05-08 | 状态: 已批准

## 概述

为 Cortex TUI 创建自动化端到端测试框架，包含测试方案文档、测试用例 JSON 和自动生成的 Markdown 测试报告。

## 交付物

| 文件 | 用途 |
|------|------|
| `test_skill.md` | AI Agent 可执行的测试方案 |
| `test_case.json` | 47 个测试用例（SEARCH 25 + AI 10 + WATCH 12） |
| `test_report_*.md` | 自动生成的测试报告 |

## 设计决策

1. **交互方式**: subprocess + stdout 解析（用户选择）
2. **AI 测试**: 同样通过 subprocess 发送字符，真实 API 调用
3. **Watchdog 等待**: 轮询间隔 5 秒，超时 60 秒（批量 90 秒）
4. **报告格式**: Markdown
5. **唯一标记**: WATCH 测试使用 `E2E_TEST_MARKER_*` 避免冲突
6. **问题来源**: 所有搜索关键词和 AI 问题来自 test_work_dir 文档的真实内容

## 测试覆盖

### 文档类型
- Markdown (.md): 全部类别覆盖
- HTML (.html): 搜索 + 监控
- Word (.docx): 搜索（跨格式）
- PDF (.pdf): 搜索 + 监控
- PPTX (.pptx): 搜索（跨格式）

### 功能点
- 单关键词搜索（中英文）
- 多关键词 AND 搜索
- 跨格式搜索
- 短语/特殊内容搜索
- AI RAG 问答（事实/列举/数值/比较/方法型）
- 文件增删改移重命名后的 watchdog + reindex
- 批量变更合并处理
- 删除后重建同名文件

## 参考
- 测试用例详情见 `test_case.json`
- 执行步骤见 `test_skill.md`
