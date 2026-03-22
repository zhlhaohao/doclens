# TreeSearch Benchmark Suite

Benchmark 模块用于在长文档 QA/检索任务上评估 TreeSearch 的检索质量。

## 支持的数据集

| 数据集 | 类型 | 描述 |
|--------|------|------|
| **QASPER** | 长文档问答 | 学术论文 QA，section 级证据标注 |
| **FinanceBench** | 金融文档检索 | SEC 年报问答 |
| **CodeSearchNet** | 代码检索 | 6 种编程语言函数级检索 |

## 快速开始

```bash
# QASPER benchmark (50 samples)
python examples/benchmark/qasper_benchmark.py --strategies fts5 tree --max-samples 50

# FinanceBench benchmark (50 samples)
python examples/benchmark/financebench_benchmark.py --max-samples 50

# CodeSearchNet benchmark (50 samples)
python examples/benchmark/codesearchnet_benchmark.py --max-samples 50
```

## 评测结果

### QASPER (学术论文 QA)
```
Metric           FTS5       TREE
mrr              0.4033     0.4763 (+18.1%)
precision@3      0.1986     0.2482 (+24.9%)
recall@3         0.3387     0.4344 (+28.3%)
ndcg@3           0.2929     0.3702 (+26.4%)
hit@1            0.2128     0.2979 (+40.0%)
```

**结论**: Tree 模式在学术论文 QA 上显著优于 FTS5，特别是在多 term 查询和结构化文档上。

### FinanceBench (SEC 年报)
```
Metric           FTS5       TREE
mrr              0.2420     0.2386 (-1.4%)
recall@5         0.2067     0.2076 (+0.4%)
hit@1            0.1000     0.1200 (+20.0%)
```

**结论**: Tree 与 FTS5 基本持平，Recall@5 略优。核心挑战在于 59.2% 的 both-miss 案例需要多节点推理/数值计算。

### CodeSearchNet (代码检索)
```
Metric           FTS5       TREE       EMBEDDING
mrr              0.8400     0.0029     0.8483
recall@5         0.8600     0.0000     0.9400
```

**结论**: Tree 模式**完全失效** (MRR=0.0029)，因为代码函数名与文档层级结构不匹配。FTS5 表现接近 Embedding。应使用 `--search-mode flat` (FTS5-only)。

### 评测结果汇总

| 数据集 | FTS5 MRR | Tree MRR | 差距 | 结论 |
|--------|----------|----------|------|------|
| **QASPER** | 0.4033 | 0.4763 | **+18.1%** | ✅ Tree 显著胜出 |
| **FinanceBench** | 0.2420 | 0.2386 | **-1.4%** | ✅ 基本持平 |
| **CodeSearchNet** | 0.8400 | 0.0029 | **-99.7%** | ❌ Tree 不适用 |

## 核心策略

### Search Mode 说明

- `--search-mode auto` (默认): 自动选择，代码文档降级为 FTS5-only
- `--search-mode tree`: 全程使用 Tree Search (Best-First Walk)
- `--search-mode flat`: 仅使用 FTS5 (无 Tree Walk)

### Tree Search 核心机制

```
FTS5 锚点检索
    ↓
Best-First Walk (基于 path_score 优先队列)
    ↓
Path Aggregation: score_path = 0.30 * leaf_score + 0.30 * leaf_fts_score + ...
    ↓
Boosting Stages:
  1. Generic Section Demotion (depth=0 根节点豁免)
  2. Walk-Only Injection (fts_s == 0 时注入)
  3. Parent Context Boost (parent FTS5 高 → child 加权)
  4. Grandparent Boost (祖父 FTS5 高 → 子树加权)
  5. Term Density Boost (多 term 命中 → 加权)
```

### 关键发现

1. **FTS5-only = 0** (FinanceBench): Tree 不再错过任何 FTS5 能命中的案例
2. **Both-hit = 40.8%**: 两者都能命中的案例
3. **Both-miss = 59.2%**: 真正困难案例 (需要多节点推理)
4. **Walk-only = 0**: walk-only 注入对 FinanceBench 无效

## 输出格式

每个 benchmark 运行后：
- 结果保存到: `benchmark_results/{dataset}_{strategy}_report.json`
- 示例: `benchmark_results/qasper_tree_report.json`


## 添加新数据集

1. 在 `benchmark_utils.py` 实现 `load_{dataset}()` 函数
2. 返回 `list[BenchmarkSample]`
3. 在 `benchmark_{dataset}.py` 中调用

```python
# 示例
def load_my_dataset(data_path: str, max_samples: int = 200) -> list[BenchmarkSample]:
    samples = []
    # 解析数据集...
    return samples
```
