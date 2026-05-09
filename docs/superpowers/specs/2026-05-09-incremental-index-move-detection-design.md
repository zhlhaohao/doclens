# 增量索引文件移动/重命名检测修复方案

**日期**: 2026-05-09
**状态**: 实施中（方案C）

---

## 问题描述

增量索引在文件被移动或重命名后，无法正确检测和更新索引中的路径信息。测试报告（WATCH-004, 006, 007, 012）显示需要全量重建才能修复路径。

### 根因

1. **`stat` 模式指纹不可靠**：默认使用 `(mtime_ns, size)` 作为指纹。文件移动后 `mtime_ns` 通常会改变，导致移动检测预扫描中指纹不匹配。
2. **`has_changed_files()` 无移动检测**（`cortex/index_manager.py:111-161`）：仅做路径-指纹比对。
3. **`_get_changed_files()` 无移动检测**（`treesearch/treesearch.py:104-129`）：仅做简单指纹比对。
4. **`asearch()` 惰性更新**依赖 `_get_changed_files()`，同样受影响。

### 影响范围

| 入口 | 移动检测 | 孤立清理 |
|------|---------|---------|
| `build_index()` | 有（但 stat 模式下不可靠） | 有 |
| `has_changed_files()` | 无 | 无 |
| `_get_changed_files()` | 无 | 无 |
| `asearch()` 惰性更新 | 无（调用 `_get_changed_files()`） | 无 |

---

## 方案A：路径比对增强

核心思路：不依赖指纹匹配来判断移动。

```
增量索引流程:
1. 获取磁盘文件列表 (disk_paths)
2. 获取索引路径列表 (indexed_paths)
3. diff 分析:
   - deleted_paths = indexed_paths - disk_paths
   - new_paths = disk_paths - indexed_paths
4. 对 deleted_paths + new_paths:
   - 检查是否为移动 (同名文件、同内容)
   - 是 → rename_document()
   - 否 → 正常删除/新增
```

**优点**: 不依赖指纹模式，逻辑清晰可靠
**缺点**: 修改集中在 build_index()，其他入口未修复

---

## 方案B：stat 模式回退 content 模式

核心思路：移动检测时，指纹不匹配则用内容哈希重试。

```
移动检测流程:
1. 默认 stat 指纹比对 → 失败
2. 回退: 计算新路径的 content 指纹
3. 构建 hash_to_old_path (使用 content 模式)
4. 重新匹配 → 成功则判定为移动
```

**优点**: 修改最小，仅影响移动检测预扫描阶段
**缺点**: 每次增量索引需要额外 md5 计算，仅修复 build_index() 路径

---

## 方案C：全入口修复（选定方案）

同时修复所有三个入口，确保任何场景都能检测文件移动。

### 修改范围

| # | 文件 | 修改点 |
|---|------|--------|
| 1 | `treesearch/indexer.py` | `build_index()` 的移动检测预扫描：路径 diff + 指纹回退 |
| 2 | `cortex/index_manager.py` | `has_changed_files()` 增加路径 diff 检测 |
| 3 | `treesearch/treesearch.py` | `_get_changed_files()` 增加移动检测 |
| 4 | `treesearch/treesearch.py` | `asearch()` 惰性更新使用增强后的检测 |

### 实施步骤

1. **`build_index()` 增强**：在现有指纹匹配失败时，回退到 content 模式重新计算指纹并匹配
2. **`has_changed_files()` 增强**：增加磁盘文件列表 vs 索引路径列表的 diff 检测
3. **`_get_changed_files()` 增强**：增加路径 diff 和移动检测逻辑
4. **`asearch()` 增强**：利用增强后的 `_get_changed_files()`

**优点**: 所有入口行为一致，最彻底的修复
**缺点**: 改动范围大，需要充分测试回归
