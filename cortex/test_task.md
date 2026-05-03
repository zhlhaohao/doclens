# Cortex CLI 测试任务书

## 一、概述

你是 Cortex CLI 的测试执行者。你的任务是按照 `cortex/test_plan.json` 中的测试用例，逐条执行测试，并将结果写入 `cortex/test_results.md`。

**核心文件**:
- 测试方案: `cortex/test_plan.json`
- 结果模板: `cortex/test_results_template.md`（格式参照，严格遵循）
- 结果输出: `cortex/test_results.md`（最终产出）
- 被测代码: `cortex/` 目录下的 `.py` 文件

## 二、测试前准备

### 2.1 环境检查

```
1. 确认 Python venv 存在: E:\github\TreeSearch\.venv\Scripts\python.exe
2. 确认 treesearch 包已安装: python -c "import treesearch; print(treesearch.__file__)"
3. 确认 cortex 模块可导入: python -c "from cortex.config import CortexConfig; print('OK')"
4. 确认 rg (ripgrep) 可用: rg --version
5. 确认工作目录中有可供搜索的测试文件（.md, .py 等）
```

### 2.2 测试数据准备

测试工作目录为项目根目录下的 `test_work_dir/`。执行测试前，将 `samples/` 中的文件按主题分门别类拷贝到 `test_work_dir/` 的子目录下（最多两层）。

```
test_work_dir/
├── 科技/                         # AI、量子、通信、网络安全
│   ├── 5G与6G通信技术发展.md
│   ├── AI伦理与治理.md
│   ├── AI辅助教育重塑学习方式.md
│   ├── 中国AI词元调用量爆发式增长.md
│   ├── 元宇宙与VR_AR技术发展.md
│   ├── 智慧城市与物联网.md
│   ├── 机器人与AI融合2025年发展报告.md
│   ├── 量子密码学从QKD到后量子密码学.md
│   ├── 量子计算与人工智能报告2025-2026.docx
│   ├── 量子计算与人工智能演示.pptx
│   ├── quantum_ai_report.pdf
│   ├── quantum_error_correction.md
│   ├── 网络安全与AI防御2025威胁态势.md
│   └── 2025网络安全趋势报告.html
│
├── 天文航天/                      # 天文学、太空探索
│   ├── 韦伯望远镜揭示黑洞起源新理论.md
│   ├── dark_matter_stars.md
│   ├── direct_collapse_blackholes.md
│   ├── 嫦娥六号月球背面演化历史.md
│   └── 商业航天发展2025新纪元.md
│
├── 生命科学/                      # 生物、医学、遗传、古人类
│   ├── CRISPR基因治疗逆转肺癌耐药性.md
│   ├── crispr_lung_cancer.md
│   ├── brain_computer_interface_speech.md
│   ├── 地球已知最深动物生态系统.md
│   ├── 深海生物新物种发现.md
│   ├── 生物技术新药2025前沿突破.md
│   └── 哈尔滨古人类化石与丹尼索瓦人.md
│
├── 能源环境/                      # 气候、新能源、电池、电动车
│   ├── 气候变化与碳中和技术.md
│   ├── 中国可再生能源突破性进展.md
│   ├── 固态电池技术进展与产业化.md
│   ├── 中国新能源汽车市场2025.md
│   ├── renewable_energy_record.md
│   ├── solid_state_ev_2026.md
│   ├── 太阳能与风能技术详解.html
│   └── 电动车电池技术对比.html
│
├── 经济/                          # 宏观经济、贸易、市场数据
│   ├── 2026年全球经济形势分析.md
│   ├── 全球贸易前景展望2025-2026.md
│   ├── 英伟达市值突破5万亿美元.md
│   ├── 全球科技与健康数据.xlsx
│   └── 全球科技与健康数据.xls
│
├── 健康/                          # 运动、营养、心理、中医
│   ├── 体重管理年科学减重指南.md
│   ├── 睡眠科学如何获得高质量睡眠.md
│   ├── 肠道健康与益生菌科学指南.md
│   ├── Z世代心理健康与保健品消费.md
│   ├── 中医理疗养生传统智慧的现代应用.md
│   ├── 居家健身指南.md
│   ├── healthy_meal_prep.md
│   ├── meditation_beginner.md
│   ├── running_marathon_guide.md
│   ├── stress_management_work.md
│   ├── 2025年健康生活与科学养生指南.html
│   └── 营养素速查手册.html
│
└── 编程/                          # 开发框架、语言、DevOps
    ├── api_design_rest.md
    ├── docker_kubernetes_guide.md
    ├── git_workflow.md
    ├── linux_system_admin.md
    ├── microservices_patterns.md
    ├── postgresql_optimization.md
    ├── python_async_programming.md
    ├── Python数据科学与机器学习指南.md
    ├── react_hooks_guide.md
    ├── rust_ownership.md
    └── typescript_generics.md
```

**目录结构说明**:

| 子目录 | 文件数 | 格式覆盖 | 语言 |
|--------|--------|----------|------|
| 科技 | 14 | .md .docx .pptx .pdf .html | 中/英 |
| 天文航天 | 5 | .md | 中/英 |
| 生命科学 | 7 | .md | 中/英 |
| 能源环境 | 8 | .md .html | 中/英 |
| 经济 | 5 | .md .xlsx .xls | 中文 |
| 健康 | 12 | .md .html | 中/英 |
| 编程 | 11 | .md | 中/英 |
| **合计** | **62** | 7种格式 | — |

**准备命令**（在项目根目录执行）:

```bash
# 创建工作目录及子目录
mkdir -p test_work_dir/{科技,天文航天,生命科学,能源环境,经济,健康,编程}

# 拷贝文件（从 samples/ 到 test_work_dir/ 对应子目录）
# 科技
cp samples/5G与6G通信技术发展.md              test_work_dir/科技/
cp samples/AI伦理与治理.md                     test_work_dir/科技/
cp samples/AI辅助教育重塑学习方式.md            test_work_dir/科技/
cp samples/中国AI词元调用量爆发式增长.md        test_work_dir/科技/
cp samples/元宇宙与VR_AR技术发展.md            test_work_dir/科技/
cp samples/智慧城市与物联网.md                  test_work_dir/科技/
cp samples/机器人与AI融合2025年发展报告.md      test_work_dir/科技/
cp samples/量子密码学从QKD到后量子密码学.md     test_work_dir/科技/
cp samples/量子计算与人工智能报告2025-2026.docx test_work_dir/科技/
cp samples/量子计算与人工智能演示.pptx          test_work_dir/科技/
cp samples/quantum_ai_report.pdf               test_work_dir/科技/
cp samples/quantum_error_correction.md          test_work_dir/科技/
cp samples/网络安全与AI防御2025威胁态势.md      test_work_dir/科技/
cp samples/2025网络安全趋势报告.html            test_work_dir/科技/

# 天文航天
cp samples/韦伯望远镜揭示黑洞起源新理论.md      test_work_dir/天文航天/
cp samples/dark_matter_stars.md                  test_work_dir/天文航天/
cp samples/direct_collapse_blackholes.md         test_work_dir/天文航天/
cp samples/嫦娥六号月球背面演化历史.md           test_work_dir/天文航天/
cp samples/商业航天发展2025新纪元.md             test_work_dir/天文航天/

# 生命科学
cp samples/CRISPR基因治疗逆转肺癌耐药性.md      test_work_dir/生命科学/
cp samples/crispr_lung_cancer.md                 test_work_dir/生命科学/
cp samples/brain_computer_interface_speech.md    test_work_dir/生命科学/
cp samples/地球已知最深动物生态系统.md           test_work_dir/生命科学/
cp samples/深海生物新物种发现.md                 test_work_dir/生命科学/
cp samples/生物技术新药2025前沿突破.md           test_work_dir/生命科学/
cp samples/哈尔滨古人类化石与丹尼索瓦人.md       test_work_dir/生命科学/

# 能源环境
cp samples/气候变化与碳中和技术.md               test_work_dir/能源环境/
cp samples/中国可再生能源突破性进展.md           test_work_dir/能源环境/
cp samples/固态电池技术进展与产业化.md           test_work_dir/能源环境/
cp samples/中国新能源汽车市场2025.md             test_work_dir/能源环境/
cp samples/renewable_energy_record.md            test_work_dir/能源环境/
cp samples/solid_state_ev_2026.md                test_work_dir/能源环境/
cp samples/太阳能与风能技术详解.html             test_work_dir/能源环境/
cp samples/电动车电池技术对比.html               test_work_dir/能源环境/

# 经济
cp samples/2026年全球经济形势分析.md             test_work_dir/经济/
cp samples/全球贸易前景展望2025-2026.md          test_work_dir/经济/
cp samples/英伟达市值突破5万亿美元.md            test_work_dir/经济/
cp samples/全球科技与健康数据.xlsx               test_work_dir/经济/
cp samples/全球科技与健康数据.xls                test_work_dir/经济/

# 健康
cp samples/体重管理年科学减重指南.md             test_work_dir/健康/
cp samples/睡眠科学如何获得高质量睡眠.md         test_work_dir/健康/
cp samples/肠道健康与益生菌科学指南.md           test_work_dir/健康/
cp samples/Z世代心理健康与保健品消费.md          test_work_dir/健康/
cp samples/中医理疗养生传统智慧的现代应用.md     test_work_dir/健康/
cp samples/居家健身指南.md                       test_work_dir/健康/
cp samples/healthy_meal_prep.md                  test_work_dir/健康/
cp samples/meditation_beginner.md                test_work_dir/健康/
cp samples/running_marathon_guide.md             test_work_dir/健康/
cp samples/stress_management_work.md             test_work_dir/健康/
cp samples/2025年健康生活与科学养生指南.html     test_work_dir/健康/
cp samples/营养素速查手册.html                   test_work_dir/健康/

# 编程
cp samples/api_design_rest.md                    test_work_dir/编程/
cp samples/docker_kubernetes_guide.md            test_work_dir/编程/
cp samples/git_workflow.md                       test_work_dir/编程/
cp samples/linux_system_admin.md                 test_work_dir/编程/
cp samples/microservices_patterns.md             test_work_dir/编程/
cp samples/postgresql_optimization.md            test_work_dir/编程/
cp samples/python_async_programming.md           test_work_dir/编程/
cp samples/Python数据科学与机器学习指南.md       test_work_dir/编程/
cp samples/react_hooks_guide.md                  test_work_dir/编程/
cp samples/rust_ownership.md                     test_work_dir/编程/
cp samples/typescript_generics.md                test_work_dir/编程/
```

**测试时注意**:
1. 在 `test_work_dir/` 目录下启动 cortex CLI（`cd test_work_dir && python -m cortex`），索引将建在该目录的 `.cortex/` 下
2. 索引覆盖 7 种文件格式：.md、.html、.docx、.pptx、.pdf、.xlsx、.xls
3. 中英文混合：可测试中文分词搜索和英文精确匹配
4. 子目录结构可测试跨目录搜索和路径聚合能力

### 2.3 创建结果文件

按 `test_results_template.md` 格式创建 `cortex/test_results.md`，填写头部信息：
- 测试日期
- 测试环境
- 当前 commit hash（`git rev-parse --short HEAD`）

## 三、测试执行方法

### 3.1 交互式命令测试

对于需要启动 cortex CLI 后在 REPL 中输入命令的测试用例：

**方法 A — 管道输入（推荐）**:
```bash
echo -e "/help\n/quit" | E:\github\TreeSearch\.venv\Scripts\python.exe -m cortex
```

**方法 B — 脚本批量输入**:
```python
import subprocess
proc = subprocess.run(
    [python, "-m", "cortex"],
    input="/s 测试关键词\n/status\n/quit\n",
    capture_output=True, text=True, encoding="utf-8"
)
print(proc.stdout)
print(proc.stderr)
```

**方法 C — 直接调用 Python 函数（适用于单元级测试）**:
```python
from cortex.cortex_cli import NotebookSearchCLI
cli = NotebookSearchCLI()
cli.load_or_build_index()
# 测试搜索
nodes, docs = cli.do_search("机器学习")
cli.format_results(nodes, docs, "机器学习")
# 测试命令
cli.cmd_help()
cli.cmd_status()
```

**优先使用方法 C**，因为它可以捕获完整的 stdout 输出而不依赖终端交互。

### 3.2 搜索功能测试

```python
from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
from cortex.index_manager import IndexManager
from cortex.config import CortexConfig
from cortex.formatting import hl, truncate_ansi_safe, make_vscode_link

# 验证分词
tokens = tokenize_query("自然语言处理")
print(f"分词结果: {tokens}")

# 验证近邻评分
count, prox = calc_proximity_score("自然语言处理是AI的子领域", ["自然语言", "处理"])
print(f"匹配数: {count}, 近邻分: {prox}")

# 验证综合评分
score, factors = compute_composite_score(
    matched_count=2, total_keywords=3,
    doc_name="nlp_intro.md", node_title="自然语言处理",
    fts_score=1.5, query_words=["自然语言", "处理"],
    weights={"keyword_match_ratio": 3.0, "file_name_match": 2.0,
             "fts_score": 2.0, "title_match": 1.5}
)
print(f"综合评分: {score}, 因子: {factors}")
```

### 3.3 格式化输出测试

```python
from cortex.formatting import hl, truncate_ansi_safe, strip_ansi, make_vscode_link

# 验证高亮
result = hl("机器学习入门指南", ["机器学习"])
print(repr(result))

# 验证安全截断
long_text = "A" * 50 + "\033[1;31m关键词\033[0m" + "B" * 50
truncated = truncate_ansi_safe(long_text, 40, ["关键词"])
print(repr(truncated))

# 验证超链接
link = make_vscode_link("E:/notes/test.md", 42)
print(repr(link))
```

### 3.4 ripgrep 降级测试

```python
from cortex.ripgrep import rg_fallback_search, build_rg_paths

# 验证 rg 可用性
from treesearch.ripgrep import rg_available
print(f"rg 可用: {rg_available()}")

# 验证路径构建
paths, shadow_map = build_rg_paths(path_map_dict, doc_ids_set)
print(f"搜索路径: {paths}")
print(f"Shadow 映射: {shadow_map}")
```

## 四、测试执行流程

```
第 1 步: 读取 test_plan.json，加载全部测试用例
第 2 步: 按分类顺序执行（一→二→...→九）
第 3 步: 每个分类内按编号顺序执行（如 CMD-001 → CMD-002 → ...）
第 4 步: 每条用例执行后立即将结果追加到 test_results.md
第 5 步: 全部完成后，在 test_results.md 末尾追加汇总统计
```

### 优先级执行顺序

```
P0 全部 → P1 全部 → P2 全部 → P3 全部
```

如果 P0 用例出现未通过，**立即停止**并报告阻塞问题，不继续执行后续用例。

## 五、结果记录规范

### 5.1 必须遵守

1. **输出响应内容不得删减** — 终端输出什么就记录什么，包括 ANSI 转义码
2. **不得意译** — 不能把 `[1;31m机器学习[0m` 改写为 "机器学习(红色)"
3. **每条结果用 `---` 分隔**
4. **结论必须明确** — 只能是以下三者之一:
   - ✅ 通过
   - ❌ 未通过
   - ⚠️ 部分通过

### 5.2 结论判定标准

| 结论 | 条件 |
|------|------|
| ✅ 通过 | 所有预期结果全部满足，无异常 |
| ❌ 未通过 | 任一预期结果不满足，或出现异常/崩溃 |
| ⚠️ 部分通过 | 核心功能正常但部分预期不满足（如格式偏差、非关键信息缺失） |

### 5.3 测试问题记录

- 无问题填 `无`
- 有问题时必须描述: 现象是什么、与预期的偏差是什么、可能的原因
- 如果是异常，记录完整的 traceback

## 六、测试注意事项

### 6.1 搜索测试关键词选择

不要使用 `test_plan.json` 中的示例关键词直接搜索（目录中可能不存在）。应先确认测试数据中有哪些内容可被搜索：

```python
# 先查看索引中有什么文档
from cortex.config import CortexConfig
from cortex.index_manager import IndexManager
config = CortexConfig.load()
idx = IndexManager(config)
idx.load_or_build_index()

# 列出所有文档名和标题
for doc in idx.documents:
    name = getattr(doc, 'doc_name', '')
    path = idx.path_map.get(name, '')
    print(f"{name}: {path}")
```

然后**选择确实存在于索引中的关键词**进行搜索测试。

### 6.2 索引状态管理

- 部分测试需要删除/损坏索引文件，测试后**必须恢复**原始索引
- 增量索引测试前先记录当前文档数，测试后验证数量一致
- `/index -f` 会重建索引，执行前确认不会影响其他测试的数据

### 6.3 输出捕获

- 使用 `io.StringIO` 重定向 stdout 来捕获完整输出
- ANSI 转义码属于输出的一部分，**不要过滤掉**

```python
import io, sys

buf = io.StringIO()
old_stdout = sys.stdout
sys.stdout = buf

# 执行被测操作
cli.cmd_help()

sys.stdout = old_stdout
output = buf.getvalue()  # 完整输出，含 ANSI 码
```

### 6.4 测试隔离

- 每条测试用例应独立执行，不依赖其他用例的副作用
- 如果必须依赖（如 INDEX-004 损坏索引），在测试后恢复状态
- `/set` 命令会修改全局状态，测试后恢复默认值（20）

## 七、结果文件汇总格式

全部测试完成后，在 `test_results.md` 末尾追加汇总:

```markdown
---

## 测试汇总

| 优先级 | 总数 | 通过 | 未通过 | 部分通过 | 通过率 |
|--------|------|------|--------|----------|--------|
| P0     | 12   |      |        |          |        |
| P1     | 18   |      |        |          |        |
| P2     | 13   |      |        |          |        |
| P3     | 1    |      |        |          |        |
| **合计** | **44** |      |        |          |        |

### 未通过用例清单

| 编号 | 功能点 | 问题描述 |
|------|--------|----------|
| ...  | ...    | ...      |
```
