# TreeSearch V1 升级方案：智能索引与检索加速

## 1. 愿景与目标
将 TreeSearch 从一个基础的结构化代码解析器，升级为一个**工业级**、**高性能**且**用户友好**的代码库索引引擎。核心目标是减少用户的配置成本（"It just works"）并极大提升在大规模项目上的搜索性能。

## 2. 核心功能设计

### A. 智能目录自动发现 (Smart Directory Discovery)
**需求背景**：目前用户必须指定具体的 Glob 模式，无法直接通过 `ts.index("path/to/dir")` 快速建立索引，增加了初学者的门槛。

**改进方案**：
- **递归遍历**：支持将目录路径直接传入 `index()` 和 `build_index()`。
- **Parser 联动**：遍历过程中，自动利用 `ParserRegistry` 中的后缀映射进行过滤，仅处理已支持的文件类型。
- **默认排除逻辑 (Smart Ignore)**：
    - 自动跳过 `.git`, `node_modules`, `__pycache__`, `.venv`, `dist`, `build` 等目录。
    - **.gitignore 支持**：尝试读取项目下的 `.gitignore` 文件，尊重用户的版本控制忽略规则。
- **安全防护**：
    - `MAX_DIR_FILES`：设置默认上限（如 10,000 文件），防止在根目录误操作。
    - **符号链接处理**：默认不跟随目录符号链接，防止死循环。

### B. 基于 Ripgrep 的检索加速 (Ripgrep Integration)
**需求背景**：Python 原生的 `re` 模块在处理海量 Node 的文本过滤时速度较慢，难以支撑毫秒级的实时搜索。

**改进方案**：
- **混合动力引擎 (Hybrid Engine)**：
    - **Ripgrep 模式**：优先检测系统环境中的 `rg`。如果可用，直接调用 `rg --json` 进行并发扫描。
    - **Native 模式**：如果环境无 `rg` 或处理纯内存文档，则回退到现有的 Python 匹配逻辑。
- **行号映射算法 (Line-to-Node Mapping)**：
    - `rg` 返回匹配的文件行号。
    - `TreeSearch` 利用 Node 的 `line_start` 和 `line_end` 区间，将匹配行快速映射到对应的 `node_id`。
- **性能预期**：在大规模代码库中，`GrepFilter` 的响应时间预计降低 80% 以上。

## 3. 架构设计

### 3.1 路径解析逻辑 (Resolution Workflow)
1. **输入识别**：判断是 Glob 模式、单个文件还是目录。
2. **规则应用**：如果是目录，应用 `ParserRegistry` 允许的后缀。
3. **黑名单过滤**：应用默认忽略列表及 `.gitignore`。
4. **安全检查**：统计文件总数，超出 `MAX_DIR_FILES` 则抛出警告或错误。

### 3.2 检索分发策略 (Search Strategy)
```python
class GrepFilter:
    def score_nodes(self, nodes: List[Node], pattern: str):
        if system_has_rg() and all_nodes_have_files(nodes):
            return self._ripgrep_search(nodes, pattern)
        return self._native_search(nodes, pattern)
```

## 4. 路线图 (Roadmap)

1.  **Phase 1: 基础设施增强 (即刻实施)**
    - 实现 `resolve_paths` 工具函数。
    - 更新 `TreeSearch.aindex()` 支持目录递归。
2.  **Phase 2: 高性能引擎 (计划中)**
    - 引入 `RipGrepEngine` 类。
    - 实现 `rg --json` 结果与 Node ID 的高效映射算法。
3.  **Phase 3: 体验优化**
    - 完善 `.gitignore` 解析支持。
    - 增加 CLI 扫描时的进度条反馈。

## 5. 向后兼容性
本升级完全向后兼容。现有的 Glob 字符串输入行为保持不变，新增功能通过可选参数和环境自动检测触发。
