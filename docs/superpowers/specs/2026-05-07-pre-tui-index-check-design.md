# 启动 TUI 前索引存在性检查与全量创建

**日期**: 2026-05-07
**状态**: Draft

## 问题

当前 `cortex` 启动时，`main()` 直接创建 `CortexApp` 并进入 TUI 界面。索引是在 TUI 启动后由后台线程调用 `load_or_build_index()` 异步加载或构建的。这导致两个问题：

1. **首次使用体验差**：用户在新目录首次运行 `cortex` 时，TUI 先出现但索引为空，后台才开始默默构建，用户不知道发生了什么，也无法感知进度。
2. **无法拒绝**：如果用户意外在错误目录运行了 `cortex`，没有给用户一个确认或退出的机会。

## 方案

在进入 TUI 之前，在命令行层面对当前目录的索引进行检查：

1. 检查 `index.db` 文件是否存在，且 `documents` 表中至少有一条记录。
2. 若不存在，在命令行询问用户是否给当前目录创建索引。
3. 用户同意后，创建 `TreeSearch` 实例，调用 `ts.index(progress_callback=...)` 进行全量索引，并在命令行实时显示进度（`Indexing [N/M] filename`）。
4. 索引完成后，再启动 TUI。TUI 的 `on_mount()` 会检测到索引已存在，直接加载。

### 架构流程

```
运行 cortex
    |
    v
main() in cortex_cli.py
    |
    v
加载 CortexConfig，获取 index_path
    |
    v
检查 SQLite: SELECT COUNT(*) FROM documents
    |
    v
记录数 > 0?
    |--- 是 ---> 直接进入 TUI
    |
    否
    v
终端询问: "当前目录尚未建立索引，是否创建？ [Y/n]"
    |
    v
用户拒绝?
    |--- 是 ---> 打印提示，sys.exit(1)
    |
    否
    v
创建 TreeSearch 实例
    |
    v
调用 ts.index(progress_callback=on_progress)
    |
    v
命令行输出: "Indexing [1/150] README.md"
    "Indexing [2/150] cortex/config.py"
    ...
    |
    v
索引完成
    |
    v
创建 CortexApp()，app.run()
    |
    v
on_mount() -> _do_init_index() -> 发现索引已存在，直接加载
```

### 改动范围

- `cortex/cortex_cli.py` - 修改 `main()`，添加索引检查和预构建逻辑
- `treesearch/treesearch.py` - 修改 `TreeSearch.index()` / `aindex()`，添加可选的 `progress_callback` 参数
- `treesearch/indexer.py` - 修改 `build_index()`，在文件处理循环中调用可选的 `progress_callback`

### 实现细节

#### 1. `treesearch/indexer.py` 新增 `progress_callback`

在 `build_index()` 签名中添加可选参数：

```python
async def build_index(
    paths,
    *,
    ts_config=None,
    index_path=None,
    progress_callback=None,
    force=False,
):
```

在文件解析循环中（`for doc_idx, (source_path, root) in enumerate(doc_trees)`），每开始处理一个新文件时调用：

```python
if progress_callback is not None:
    progress_callback(str(source_path), doc_idx + 1, len(doc_trees))
```

#### 2. `treesearch/treesearch.py` 透传 `progress_callback`

修改 `TreeSearch.index()` 和 `TreeSearch.aindex()`，添加并透传 `progress_callback`：

```python
def index(self, *paths, progress_callback=None, force=False):
    return asyncio.run(self.aindex(*paths, progress_callback=progress_callback, force=force))

async def aindex(self, *paths, progress_callback=None, force=False):
    ...
    docs = await build_index(
        paths,
        ts_config=self.ts_config,
        index_path=self.index_path,
        progress_callback=progress_callback,
        force=force,
    )
```

#### 3. `cortex/cortex_cli.py` 修改 `main()`

```python
def main():
    """主函数 - 启动 TUI"""
    from cortex.config import CortexConfig
    from cortex.tui.app import CortexApp
    from treesearch.treesearch import TreeSearch
    import sqlite3
    import sys

    config = CortexConfig.load()
    index_path = config.index_path

    # 检查索引是否存在且包含文档
    doc_count = 0
    if index_path.exists():
        try:
            conn = sqlite3.connect(str(index_path))
            cursor = conn.execute("SELECT COUNT(*) FROM documents")
            doc_count = cursor.fetchone()[0]
            conn.close()
        except Exception:
            pass  # 文件损坏或表不存在，视为无索引

    if doc_count == 0:
        # 询问用户
        search_path = config.search_path
        response = input(
            f"当前目录 '{search_path}' 尚未建立索引，是否创建？ [Y/n] "
        ).strip().lower()
        if response and response not in ('y', 'yes'):
            print("已取消。如需进入 TUI，请先建立索引。")
            sys.exit(1)

        # 创建索引并显示进度
        print("正在创建索引...")

        def on_progress(current_file: str, processed: int, total: int):
            print(f"Indexing [{processed}/{total}] {current_file}")

        try:
            ts = TreeSearch(search_path, index_path=index_path)
            ts.index(progress_callback=on_progress)
            print("索引创建完成。")
        except Exception as e:
            print(f"索引创建失败: {e}")
            sys.exit(1)

    # 启动 TUI
    app = CortexApp()
    app.run(mouse=True)
```

### 用户体验

- **已有索引**：`cortex` 直接启动 TUI，无任何额外交互。
- **无索引**：命令行显示询问，用户按 Enter（默认 Yes）后，逐行打印 `Indexing [N/M] filename`，直观感知进度。
- **拒绝**：优雅退出并提示原因。
- **索引失败**：在命令行打印具体错误，不进入空状态 TUI。

### 边界情况

| 场景 | 行为 |
|------|------|
| `index.db` 存在但 `documents` 表为空 | 视为无索引，询问用户 |
| `index.db` 文件损坏（无法打开） | 视为无索引，询问用户；若用户同意，底层会删除重建 |
| 用户同意但在索引过程中按 Ctrl+C | `TreeSearch.index()` 抛异常，catch 后打印错误并 exit(1) |
| `search_path` 下无任何文件 | `ts.index()` 成功但 doc_trees 为空，进度回调不触发，打印 "索引创建完成。" 后正常进入 TUI |
| 在非交互式环境运行（如 CI） | `input()` 会报错 `EOFError`，需要捕获并给出明确退出提示 |

### 测试计划

1. 在已有索引目录运行 `cortex`，验证直接进入 TUI，无询问。
2. 在无索引目录运行 `cortex`，验证出现询问，输入 `Y` 后显示进度并完成索引，随后进入 TUI。
3. 在无索引目录输入 `n`，验证程序退出并提示。
4. 在无索引目录直接按 Enter（默认 Yes），验证正常建索引。
5. 在 `search_path` 为空目录运行，验证询问后建索引（空操作）并进入 TUI。
6. 故意损坏 `index.db`，验证程序询问后重建索引。
