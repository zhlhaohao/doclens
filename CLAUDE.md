# Cortex CLAUDE.md

## 项目概述

Cortex — 结构感知文档检索工具，使用 SQLite FTS5/BM25 全文索引，支持 Markdown、Python、JavaScript、PDF、DOCX 等多种文件类型。

## 开发命令

```bash
pip install -e "."
python -m cortex search <query>
python -m cortex ai <message>
python -m cortex index [--force]
python -m cortex status
python -m cortex
```
