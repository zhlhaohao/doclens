# Windows 跨进程文件锁设计

## 目标

在 `_acquire_index_lock()` 中，当 `fcntl` 不可用时（Windows），使用 `msvcrt.locking()` 作为 fallback，实现跨进程文件锁，防止多进程同时写入索引文件导致损坏。

## 背景

- `fcntl.flock()` 是 Unix-only 的，在 Windows 上会触发 `ImportError`
- 当前代码在 Windows 上返回 `_NullLock()`，完全没有进程间锁保护
- 多 cortex-cli 进程同时运行时可能造成索引文件损坏

## 实现方案

### 修改位置

`treesearch/indexer.py` 的 `_acquire_index_lock()` 函数

### Windows 文件锁实现

```python
def _acquire_index_lock(db_path: str):
    """Acquire an exclusive advisory lock on ``{db_path}.lock``."""

    if not db_path or db_path == ":memory:":
        return _NullLock()

    # Unix: 使用 fcntl.flock
    try:
        import fcntl
        lock_path = db_path + ".lock"
        os.makedirs(os.path.dirname(os.path.abspath(lock_path)), exist_ok=True)
        f = open(lock_path, "w")
        try:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            return _Handle(f)
        except OSError as e:
            f.close()
            logger.warning("Failed to acquire index lock %s: %s", lock_path, e)
            return _NullLock()
    except ImportError:
        pass

    # Windows: 使用 msvcrt.locking
    try:
        import msvcrt
        lock_path = db_path + ".lock"
        os.makedirs(os.path.dirname(os.path.abspath(lock_path)), exist_ok=True)

        # 打开文件（必须以读写模式）
        f = open(lock_path, "r+")

        class _WindowsHandle:
            def __init__(self, fh):
                self._fh = fh
            def __enter__(self):
                return self
            def __exit__(self, *a):
                self.release()
                return False
            def release(self):
                if self._fh is not None:
                    try:
                        msvcrt.locking(self._fh.fileno(), msvcrt.LK_UNLCK, 0)
                    finally:
                        self._fh.close()
                        self._fh = None

        # 使用非阻塞锁
        try:
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            return _WindowsHandle(f)
        except (OSError, IOError) as e:
            f.close()
            logger.warning("Failed to acquire Windows index lock %s: %s", lock_path, e)
            return _NullLock()
    except ImportError:
        pass

    # 两者都不可用，返回无锁
    logger.warning("No file locking available on this platform")
    return _NullLock()
```

### `_Handle` 类保留（Unix 版本）

原有的 `_Handle` 类保持不变，用于 Unix 系统。

### 错误处理

- 锁获取失败时记录 warning 并返回 `_NullLock()`（不阻塞程序启动）
- 后续的 DB 写入可能冲突，但不会导致进程崩溃
- 这是 advisory lock，不影响其他进程正常读取

## 兼容性

| 平台 | 锁机制 | 行为 |
|------|--------|------|
| Unix (Linux/macOS) | `fcntl.flock` | 排他文件锁 |
| Windows | `msvcrt.locking` | 非阻塞排他锁 |
| 其他 | `_NullLock` | 无锁，降级运行 |

## 测试场景

1. **单进程正常索引**：与现有行为一致
2. **Windows 双进程同时索引**：第二个进程应等待锁或跳过
3. **Unix 双进程同时索引**：已有 fcntl，不受影响
4. **锁文件不存在**：自动创建 `db_path.lock`
5. **锁获取失败**：graceful degradation，记录 warning

## 影响范围

- 仅修改 `treesearch/indexer.py` 的 `_acquire_index_lock()` 函数
- 对外接口不变
- 现有调用方无需修改
