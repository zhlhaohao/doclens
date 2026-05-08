# Cortex TUI 端到端测试方案 - Subprocess 模式 (test_skill_subprocess.md)

> 版本: 1.0 | 日期: 2026-05-08
> **主选方案**: 通过 subprocess 启动 cortex TUI，stdin 发送命令，stdout 解析输出
> 本文件是 AI Agent 可直接执行的测试方案。按顺序阅读并执行即可。

---

## 1. 概述

本方案对 Cortex TUI 进行端到端测试，覆盖以下功能：

| 分类 | 编号前缀 | 用例数 | 说明 |
|------|---------|--------|------|
| 搜索功能 | SEARCH | 25 | 各类文档、组合条件搜索 |
| AI 问答 | AI | 10 | 基于知识库的 RAG 问答 |
| 文件监控与索引重建 | WATCH | 12 | 增删改移文件后的 watchdog + reindex |

**测试用例文件**: `test_case.json`（与本文档同目录）
**测试工作目录**: `test_work_dir/`（项目根目录下）
**测试报告**: `test_report_YYYYMMDD_HHMM.md`（自动生成）

---

## 2. 前置条件

执行测试前，必须确认以下条件：

### 2.1 环境要求

```
- test_work_dir/ 目录存在且包含样本文档
```

### 2.2 环境检查步骤

```bash
# 1. 确认 cortex 可运行
python -c "from cortex.tui.app import CortexApp; print('cortex OK')"

# 2. 确认 test_work_dir 存在且有内容
ls test_work_dir/ | head -5

# 3. 确认 test_case.json 存在
python -c "import json; data=json.load(open('test_case.json')); print(f'{len(data[\"test_cases\"])} test cases')"

```

### 2.3 索引准备

在执行测试前，必须确保 test_work_dir 已有有效索引：

```bash
# 检查索引是否存在
ls test_work_dir/.cortex/index.db

# 如果索引不存在或需要重建，执行：
cd test_work_dir && python -c "
from treesearch.treesearch import TreeSearch
ts = TreeSearch('.', db_path='.cortex/index.db')
ts.index('.', progress_callback=lambda f,i,t: print(f'[{i}/{t}] {f}'))
print('索引创建完成')
" && cd ..
```

---

## 3. 测试执行方法

### 3.1 TUI 交互方式

通过 subprocess 启动 cortex TUI 进程，使用 stdin 发送命令，后台线程读取 stdout，ANSI 清洗后解析输出。

**测试运行器模板**：

```python
import subprocess
import threading
import time
import re
import os
import sys
import glob
import shutil


def strip_ansi(text: str) -> str:
    """清除终端 ANSI 转义序列"""
    pattern = re.compile(
        r'\x1b\[[0-9;]*[a-zA-Z]'   # CSI sequences (cursor, color, etc.)
        r'|\x1b\].*?(?:\x07|\x1b\\)'  # OSC sequences (title, hyperlink)
        r'|\x1b[\(\)][A-Z0-9]'     # Character set designation
        r'|\x1b[>=<]'              # Keypad modes
        r'|\x1b\[[0-9;]*m'         # SGR (color/formatting)
        r'|\r'                      # Carriage return
    )
    text = pattern.sub('', text)
    # 清理多余空行（保留有意义的内容）
    lines = [l for l in text.split('\n')]
    return '\n'.join(lines)


class CortexTUITester:
    """Cortex TUI 子进程交互测试器"""

    def __init__(self, work_dir: str):
        self.work_dir = os.path.abspath(work_dir)
        self.proc = None
        self._output_lines: list[str] = []
        self._reader_thread = None
        self._reader_stop = threading.Event()

    def _reader(self):
        """后台线程持续读取 stdout"""
        while not self._reader_stop.is_set():
            try:
                line = self.proc.stdout.readline()
                if line:
                    self._output_lines.append(strip_ansi(line))
                elif self.proc.poll() is not None:
                    break
            except Exception:
                break

    def start(self, timeout: int = 15) -> "CortexTUITester":
        """启动 cortex TUI 子进程"""
        env = os.environ.copy()
        env['TERM'] = 'xterm-256color'
        env['PYTHONUNBUFFERED'] = '1'
        env['PYTHONIOENCODING'] = 'utf-8'

        self.proc = subprocess.Popen(
            [sys.executable, '-m', 'cortex.cortex_cli'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.work_dir,
            env=env,
            text=True,
            bufsize=1,
            encoding='utf-8',
            errors='replace',
        )

        # 启动后台读取线程
        self._reader_stop.clear()
        self._reader_thread = threading.Thread(target=self._reader, daemon=True)
        self._reader_thread.start()

        # 等待 TUI 初始化 + 索引加载
        time.sleep(timeout)
        return self

    def send_command(self, command: str, wait: float = 5.0) -> str:
        """发送命令并获取新产生的输出"""
        if not self.proc or self.proc.poll() is not None:
            raise RuntimeError("cortex 进程未运行")

        # 记录当前输出位置
        start_idx = len(self._output_lines)

        # 发送命令
        try:
            self.proc.stdin.write(command + '\n')
            self.proc.stdin.flush()
        except BrokenPipeError:
            raise RuntimeError("cortex 进程已退出")

        # 等待输出产生
        time.sleep(wait)

        # 获取新输出
        new_output = ''.join(self._output_lines[start_idx:])
        return new_output

    def search(self, keyword: str, wait: float = 5.0) -> str:
        """执行搜索命令"""
        return self.send_command(f'/s {keyword}', wait=wait)

    def ask_ai(self, question: str, wait: float = 30.0) -> str:
        """执行 AI 问答（无斜杠前缀）"""
        return self.send_command(question, wait=wait)

    def get_full_output(self) -> str:
        """获取所有已收集的输出"""
        return ''.join(self._output_lines)

    def stop(self):
        """停止 cortex TUI"""
        self._reader_stop.set()
        if self.proc:
            try:
                self.proc.stdin.write('/q\n')
                self.proc.stdin.flush()
                time.sleep(1)
            except Exception:
                pass
            try:
                self.proc.terminate()
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
            self.proc = None
```

**测试用例示例**：

```python
def test_search_ransomware():
    """SEARCH-001: 搜索'勒索软件'"""
    tester = CortexTUITester("test_work_dir")
    tester.start(timeout=15)
    try:
        output = tester.search("勒索软件", wait=5)
        assert "2025网络安全趋势报告" in output
        assert "网络安全与AI防御" in output
        print("✅ SEARCH-001 通过")
    finally:
        tester.stop()
```

> **平台兼容**: 后台读取线程模式在 Windows 和 Unix 均可工作。
> `strip_ansi()` 函数清除 Textual 渲染产生的终端控制序列，保留纯文本内容。

### 3.2 搜索结果验证规则

对于搜索测试，按以下规则判断通过/失败：

| 规则 | 说明 |
|------|------|
| 文件名匹配 | 输出中包含预期文件名（支持部分匹配，如只匹配文件名不含路径） |
| 关键词出现 | 输出中包含预期关键词或数值 |
| 最少结果数 | 搜索结果数量 >= 预期最低值 |
| 空结果 | 对于无结果搜索，确认返回空/无匹配 |

**验证函数示例**：

```python
def verify_search_result(output: str, expected_files: list, expected_keywords: list,
                         min_results: int = 1) -> dict:
    """验证搜索结果"""
    passed = True
    details = []

    for f in expected_files:
        found = f.lower() in output.lower()
        details.append(f"文件 '{f}': {'✓ 找到' if found else '✗ 未找到'}")
        if not found:
            passed = False

    for kw in expected_keywords:
        found = kw.lower() in output.lower()
        details.append(f"关键词 '{kw}': {'✓ 找到' if found else '✗ 未找到'}")
        if not found:
            passed = False

    return {"passed": passed, "details": details}
```

### 3.3 AI 问答验证规则

| 规则 | 说明 |
|------|------|
| 关键数据 | AI 回答中包含预期的数值/事实 |
| 来源引用 | AI 回答引用了知识库文档 |
| 一致性 | 回答内容与文档数据一致 |

AI 问答的验证需要更灵活——允许 AI 以不同表述回答，但关键数据点必须出现。

### 3.4 文件监控验证规则

| 规则 | 说明 |
|------|------|
| 轮询策略 | 文件变更后每 5 秒搜索一次，最多 60 秒 |
| 唯一标记 | 使用 E2E_TEST_MARKER_* 格式的唯一字符串验证 |
| 路径更新 | 移动/重命名后文件路径正确更新 |
| 内容清除 | 删除文件后内容不再出现在搜索结果中 |

**轮询等待函数**：

```python
def wait_and_search(tester, keyword: str, max_wait: int = 60, interval: int = 5) -> tuple:
    """轮询等待搜索结果（用于 WATCH 测试等待 reindex）"""
    elapsed = 0
    output = ""
    while elapsed < max_wait:
        time.sleep(interval)
        elapsed += interval
        output = tester.search(keyword, wait=3)
        if keyword in output:
            return output, elapsed
    return output, elapsed  # 超时，返回最后输出
```

---

## 4. 测试执行流程

### 执行顺序

```
Phase 1: 环境准备
  ├── 检查前置条件（§2）
  ├── 确认索引存在（§2.3）
  └── 创建测试报告文件

Phase 2: 搜索功能测试（SEARCH-001 ~ SEARCH-025）
  ├── 按优先级排序执行（P0 → P1 → P2）
  ├── 每个用例执行后立即写入报告
  └── 记录详细的 TUI 输出

Phase 3: AI 问答测试（AI-001 ~ AI-010）
  ├── 检查 API Key 可用性
  ├── 如无 API Key 则标记全部为"跳过"
  └── 每个用例执行后立即写入报告

Phase 4: 文件监控测试（WATCH-001 ~ WATCH-012）
  ├── 依赖搜索功能正常（Phase 2 通过）
  ├── 按顺序执行（后续用例可能依赖前置用例）
  ├── 每个用例执行后立即写入报告
  └── 测试完成后清理临时文件

Phase 5: 生成测试摘要
  └── 统计通过/失败/跳过数量
```

### 4.1 搜索测试执行步骤

对每个 SEARCH 用例：

```
1. 从 test_case.json 读取用例详情
2. 启动 cortex TUI 子进程（CortexTUITester.start()）
3. 调用 tester.search(keyword) 发送搜索命令
4. 等待结果（最多 10 秒）
5. 通过后台读取线程获取 strip_ansi 后的输出
6. 验证预期结果（§3.2 规则）
7. 将结果写入测试报告
8. 更新 test_case.json 中的"实测结果"和"状态"字段
```

### 4.2 AI 问答测试执行步骤

对每个 AI 用例：

```
1. 从 test_case.json 读取用例详情
2. 确认 API Key 可用
3. 调用 tester.ask_ai(question) 发送问题（无斜杠前缀）
4. 等待 AI 回答完成（最多 60 秒）
5. 获取并解析 stdout 输出
6. 验证预期结果（§3.3 规则）
7. 将结果写入测试报告
```

### 4.3 文件监控测试执行步骤

对每个 WATCH 用例：

```
1. 从 test_case.json 读取用例详情
2. 执行文件操作（创建/编辑/删除/移动/重命名）
3. 使用轮询策略等待 reindex（§3.4）
4. 执行搜索验证
5. 将结果写入测试报告
6. （可选）清理临时文件
```

---

## 5. 测试报告格式

### 5.1 报告文件命名

`test_report_YYYYMMDD_HHMM.md`，例如 `test_report_20260508_1530.md`

### 5.2 报告模板

```markdown
# Cortex TUI 端到端测试报告

## 测试信息

| 项目 | 值 |
|------|-----|
| 测试日期 | {YYYY-MM-DD HH:MM} |
| 测试环境 | {操作系统/Python版本} |
| Cortex 版本 | {从 config 获取} |
| 测试用例文件 | test_case.json |
| 测试工作目录 | test_work_dir/ |
| 交互方式 | Subprocess (stdin/stdout) |

## 测试摘要

| 分类 | 总数 | 通过 | 失败 | 跳过 |
|------|------|------|------|------|
| 搜索功能 (SEARCH) | 25 | {X} | {X} | {X} |
| AI 问答 (AI) | 10 | {X} | {X} | {X} |
| 文件监控 (WATCH) | 12 | {X} | {X} | {X} |
| **合计** | **47** | **{X}** | **{X}** | **{X}** |

## 详细测试结果

---

### SEARCH-001: 搜索'勒索软件' - 网络安全主题

- **状态**: ✅ 通过 / ❌ 失败 / ⏭️ 跳过
- **优先级**: P0
- **执行时间**: {HH:MM:SS}
- **测试输入**: `/s 勒索软件`

**预期结果**:
- 搜索结果包含文件：2025网络安全趋势报告.html
- 搜索结果包含文件：网络安全与AI防御2025威胁态势.md
- 至少返回 2 条搜索结果

**实测输出**:
```
{这里粘贴 strip_ansi() 清洗后的完整 TUI 输出}
```

**验证详情**:
- 文件 '2025网络安全趋势报告.html': ✓ 找到
- 文件 '网络安全与AI防御2025威胁态势.md': ✓ 找到
- 关键词 '勒索软件': ✓ 找到

**实测结果**: {通过/失败的具体描述}

---
```

### 5.3 报告写入规则

1. **即时写入**: 每完成一个测试用例，立即追加到报告文件
2. **必须包含**: 测试编号（如 SEARCH-001）和详细的 TUI 输出
3. **状态标记**: ✅ 通过 / ❌ 失败 / ⏭️ 跳过
4. **实测输出**: 必须包含完整的 strip_ansi 清洗后的输出
5. **环境信息**: 报告开头记录测试环境
6. **摘要更新**: 每写入一个结果后更新摘要统计

---

## 6. 注意事项

### 6.1 测试隔离

- WATCH 测试使用唯一的 `E2E_TEST_MARKER_*` 标记，避免与现有文档内容冲突
- 每次测试前确认测试环境干净（无残留临时文件）
- 测试完成后应清理所有临时文件（`e2e_test_*`, `e2e_batch_*`, `e2e_new_category/`, `e2e_archive/`）

### 6.2 错误处理

- 如果 cortex TUI 启动失败，记录错误并终止测试
- 如果搜索超时无结果，记录为"失败"并继续下一个用例
- 如果 AI 问答超时（60秒），记录为"失败"
- 如果 watchdog reindex 超时（60秒），记录实际等待时间

### 6.3 Subprocess 注意事项

- **后台读取线程**: 使用 daemon 线程持续读取 stdout，避免管道阻塞
- **ANSI 清洗**: Textual 渲染产生大量终端控制序列，必须通过 `strip_ansi()` 清除
- **编码**: 设置 `PYTHONIOENCODING=utf-8` 和 `errors='replace'` 确保中文输出正确
- **缓冲**: 设置 `PYTHONUNBUFFERED=1` 和 `bufsize=1` 确保实时输出
- **进程退出**: 先尝试发送 `/q` 正常退出，超时后 `terminate()`，最终 `kill()`
- 文件操作使用 Python 的 `shutil` 和 `os` 模块确保跨平台兼容

### 6.4 临时文件清理

测试完成后，执行清理：

```python
import glob
import shutil

# 清理测试临时文件
for f in glob.glob('test_work_dir/e2e_test_*'):
    os.remove(f)
for f in glob.glob('test_work_dir/e2e_batch_*'):
    os.remove(f)

# 清理测试临时目录
for d in ['test_work_dir/e2e_new_category', 'test_work_dir/e2e_archive']:
    if os.path.exists(d):
        shutil.rmtree(d)
```

---

## 7. 测试执行检查清单

测试执行者（AI Agent）在开始前请确认：

- [ ] 已读取并理解本测试方案
- [ ] 已确认 test_case.json 存在且包含 47 个测试用例
- [ ] 已确认 test_work_dir/ 目录存在且包含样本文档
- [ ] 已确认索引文件存在（test_work_dir/.cortex/index.db）
- [ ] 已确认 cortex 可以正常启动（subprocess 方式）
- [ ] 已检查 API Key 可用性（决定 AI 测试是否执行）
- [ ] 已创建测试报告文件（使用 §5.2 模板）
- [ ] 准备就绪，开始按 Phase 1-5 执行测试
