# Cortex TUI E2E 测试设计

## 概述

为 Cortex TUI 编写端到端测试用例，使用 Textual 的 Pilot 框架，覆盖 `test_case.json` 中定义的 47 个测试用例。

**测试数据目录：** `test_work_dir/`（只读）
**测试代码目录：** `unit-test/`

---

## 测试文件结构

```
unit-test/
├── test_case.json           # 测试用例定义（从根目录移入）
├── conftest.py              # 共享 pytest fixtures
├── test_e2e_search.py      # SEARCH 测试 (25 个)
├── test_e2e_ai.py          # AI 测试 (10 个)
└── test_e2e_watch.py       # WATCH 测试 (12 个)
```

---

## 测试分类

| 类别 | 文件 | 数量 | 前缀 |
|------|------|------|------|
| 搜索功能 | `test_e2e_search.py` | 25 | SEARCH |
| AI 问答 | `test_e2e_ai.py` | 10 | AI |
| 文件监控与索引重建 | `test_e2e_watch.py` | 12 | WATCH |

---

## 共享 Fixtures (`conftest.py`)

### `test_data_dir`
```python
@pytest.fixture
def test_data_dir():
    """test_work_dir 目录路径"""
    return Path("test_work_dir").resolve()
```

### `cortex_app_with_index`
```python
@pytest.fixture
async def cortex_app_with_index(test_data_dir, tmp_path):
    """
    创建配置好索引的 CortexApp 实例用于测试。
    - 临时 ~/.cortex 目录（Isolation）
    - 索引指向 test_data_dir
    - 等待索引加载完成后再返回
    """
```

### `wait_for_index_ready`
```python
async def wait_for_index_ready(pilot, timeout=60):
    """等待 StatusBar 显示 '就绪' 或 '索引: N 文档'"""
```

---

## 核心测试辅助函数

### `run_search(pilot, query) -> SearchResult`
```python
async def run_search(pilot, query: str) -> SearchResult:
    """
    在 TUI 中执行搜索命令 /s {query}，返回结构化结果。

    返回结构：
    {
        "files": ["file1.md", "file2.html", ...],
        "content": "完整的 ContentArea 文本",
        "line_count": int
    }
    """
```

### `run_ai_query(pilot, question, timeout=120) -> AiResult`
```python
async def run_ai_query(pilot, question: str, timeout=120) -> AiResult:
    """
    在 TUI 中执行 AI 问答，返回响应文本。

    返回结构：
    {
        "text": "AI 回答的完整文本",
        "cancelled": bool
    }
    """
```

### `wait_for_file_indexed(pilot, marker, timeout=30) -> bool`
```python
async def wait_for_file_indexed(pilot, marker: str, timeout=30):
    """
    WATCH 测试用：轮询搜索直到找到 marker 关键词或超时。
    返回 True if found, False if timeout.
    """
```

---

## SEARCH 测试设计

### 测试模式
```python
async def test_search_001_ransomware(pilot, test_data_dir):
    await wait_for_index_ready(pilot)

    result = await run_search(pilot, "勒索软件")

    assert "2025网络安全趋势报告.html" in result["content"]
    assert "网络安全与AI防御2025威胁态势.md" in result["content"]
    assert len(result["files"]) >= 2
```

### 验证方式
- **精确验证**：检查预期文件名出现在 ContentArea 输出中
- 每个测试用例对应 `test_case.json` 中一个条目

---

## AI 测试设计

### 测试模式
```python
async def test_ai_001_ransomware_damage(pilot, test_data_dir):
    await wait_for_index_ready(pilot)

    result = await run_ai_query(pilot,
        "2025年勒索软件攻击造成的年损失金额大约是多少？",
        timeout=120
    )

    assert "300亿" in result["text"] or "300亿美元" in result["text"]
    assert "勒索软件" in result["text"].lower()
```

### 验证方式
- **精确事实验证**：检查 AI 回答中是否包含具体数值（如 300亿美元、33.9%、1100km）
- **超时设置**：AI 查询最多等待 120 秒

---

## WATCH 测试设计

### 测试模式
```python
async def test_watch_001_new_file(pilot, test_data_dir):
    await wait_for_index_ready(pilot)

    # 创建测试文件
    test_file = test_data_dir / "e2e_test_new_001.md"
    test_file.write_text(
        "E2E_TEST_MARKER_001: 量子纠缠态在量子通信中的应用前景广阔。"
    )

    # 等待 watchdog 检测 (最长 30 秒轮询)
    found = await wait_for_file_indexed(pilot, "E2E_TEST_MARKER_001", timeout=30)
    assert found, "文件未被索引"

    result = await run_search(pilot, "E2E_TEST_MARKER_001")
    assert "e2e_test_new_001.md" in result["content"]
```

### 验证方式
- **长等待机制**：使用 30 秒超时 + 5 秒轮询间隔
- **不重置索引**：依赖 watchdog 自动检测
- **测试后清理**：每个测试使用唯一的 marker 避免冲突

---

## 关键技术细节

### Pilot 使用模式
```python
async with CortexApp().run_test() as pilot:
    await pilot.pause()  # 等待 UI 初始化
    # 执行测试操作
```

### 输入模拟
```python
cmd_input = pilot.app.query_one("#cmd-input")
cmd_input.focus()
cmd_input.value = "/s ransomware"
await pilot.press("enter")
await pilot.pause()
```

### ContentArea 内容获取
```python
content = pilot.app.query_one(ContentArea)
text = content.origin.dumps()  # 获取所有文本内容
```

---

## 测试执行

### 运行所有测试
```bash
pytest unit-test/ -v
```

### 按类别运行
```bash
pytest unit-test/test_e2e_search.py -v
pytest unit-test/test_e2e_ai.py -v
pytest unit-test/test_e2e_watch.py -v
```

### 按优先级运行
```bash
# P0 测试
pytest unit-test/ -v -k "SEARCH-001 or SEARCH-002 or ..."
```

---

## 测试覆盖

### SEARCH 类 (25 个)
- 单关键词中文：勒索软件、固态电池、膳食纤维 等
- 单关键词英文：CRISPR、Surface Code
- 多关键词 AND：量子 密码、AI 教育
- 跨格式搜索：140万亿、潘建伟
- 短语搜索：吃动平衡、朋克养生
- 技术术语：钙钛矿 叠层
- 无结果搜索：xyz_nonexistent

### AI 类 (10 个)
- 事实型：勒索软件损失金额
- 列举型：NIST 后量子密码学标准
- 数值型：钙钛矿效率世界纪录
- 规格型：NIO ET7 续航里程
- 比较型：固态电池 vs 液态锂电池

### WATCH 类 (12 个)
- 新增文件
- 编辑文件
- 删除文件
- 移动文件
- 重命名文件
- 批量变更

---

## 设计决策

1. **使用 unit-test 目录**：与现有 tests 目录分离，明确区分单元测试和 E2E 测试
2. **精确验证**：SEARCH 检查文件名，AI 检查具体数值，确保测试有效性
3. **长等待机制**：WATCH 测试使用 30 秒超时容忍文件系统监控延迟
4. **共享 fixtures**：避免重复代码，统一测试环境配置
