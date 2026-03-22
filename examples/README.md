# TreeSearch Examples

本目录包含 TreeSearch 的使用示例和 benchmark 评测代码。

## 目录结构

```
examples/
├── benchmark/               # Benchmark 评测套件
│   ├── qasper_benchmark.py          # QASPER 学术论文 QA 评测
│   ├── financebench_benchmark.py    # FinanceBench SEC 年报评测
│   ├── codesearchnet_benchmark.py  # CodeSearchNet 代码检索评测
│   ├── benchmark_utils.py           # Benchmark 通用工具
│   ├── metrics.py                   # 评测指标 (MRR, P@K, R@K, NDCG@K)
│   └── README.md                    # Benchmark 详细说明
├── 01_basic_demo.py        # 基础索引和搜索
├── 02_index_and_search.py  # 索引管理 + 搜索
├── 03_cli_workflow.py      # CLI 工作流
├── 04_multi_doc_search.py  # 多文档搜索
├── 05_directory_and_grep.py # 目录遍历 + RipGrep
├── 06_pdf_demo.py          # PDF 文档处理
└── 07_tree_search_demo.py  # Tree Search 演示
```

## 快速开始

### 基础搜索

```bash
# CLI 快速搜索 (自动发现文件，延迟索引)
treesearch "How does auth work?" src/ docs/

# Python API
python examples/01_basic_demo.py
```

### Benchmark 评测

```bash
# QASPER (学术论文 QA) - 默认评测 fts5 + tree
python examples/benchmark/qasper_benchmark.py --max-samples 50

# FinanceBench (SEC 年报)
python examples/benchmark/financebench_benchmark.py --max-samples 50

# CodeSearchNet (代码检索)
python examples/benchmark/codesearchnet_benchmark.py --max-samples 50
```

## Benchmark 结果汇总

| 数据集 | FTS5 MRR | Tree MRR | 结论 |
|--------|----------|----------|------|
| **QASPER** | 0.4033 | 0.4763 | ✅ Tree +18.1% |
| **FinanceBench** | 0.2420 | 0.2386 | ✅ 基本持平 |
| **CodeSearchNet** | 0.8400 | 0.0029 | ❌ Tree 不适用 |

详见 [benchmark/README.md](benchmark/README.md)

## 示例说明

| 文件 | 描述 |
|------|------|
| `01_basic_demo.py` | 最简单的搜索示例：索引 + 搜索 |
| `02_index_and_search.py` | 管理索引生命周期，预建索引 |
| `03_cli_workflow.py` | 使用 CLI 命令行工具 |
| `04_multi_doc_search.py` | 多文档批量搜索 |
| `05_directory_and_grep.py` | 目录遍历 + 代码级 grep 搜索 |
| `06_pdf_demo.py` | PDF 文档解析和搜索 |
| `07_tree_search_demo.py` | Tree Search 模式演示 (带可视化) |

