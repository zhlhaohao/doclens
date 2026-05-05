# FileWatcher 测试用例

## 测试环境
- 创建临时目录作为 search_path
- 使用短防抖间隔（1 秒）加速测试
- 每个测试前清空索引

## 测试用例

### TC1: 新建文件 - 索引自动更新
1. 启动 FileWatcher，创建初始索引（空）
2. 在搜索目录下新建 `test1.md`，内容为 `# Hello World`
3. 等待防抖间隔 + reindex 完成
4. 搜索 "Hello"，应能找到结果
5. 验证 `_pending_swap` 已被消费，`_ts` 已替换

### TC2: 修改文件 - 索引自动更新
1. 已有 `test2.md`，内容为 `# Old Content`
2. 修改文件内容为 `# New Content Updated`
3. 等待防抖间隔 + reindex 完成
4. 搜索 "Updated"，应能找到
5. 搜索 "Old Content"，应无结果（或不再包含新内容）

### TC3: 删除文件 - 索引自动更新
1. 已有 `test3.md`，内容为 `# To Be Deleted`
2. 删除 `test3.md`
3. 等待防抖间隔 + reindex 完成
4. 搜索 "Deleted"，应无结果

### TC4: 新建目录 + 文件 - 索引自动更新
1. 在搜索目录下新建子目录 `subdir/`
2. 在子目录下新建 `subdir/nested.md`，内容为 `# Nested File`
3. 等待防抖间隔 + reindex 完成
4. 搜索 "Nested"，应能找到，路径包含 `subdir/nested.md`

### TC5: 删除目录 - 索引自动更新
1. 已有 `subdir/nested.md`
2. 删除整个 `subdir/` 目录
3. 等待防抖间隔 + reindex 完成
4. 搜索 "Nested"，应无结果

### TC6: 重命名文件 - 索引自动更新
1. 已有 `rename_me.md`，内容为 `# Rename Test`
2. 将 `rename_me.md` 重命名为 `renamed.md`
3. 等待防抖间隔 + reindex 完成
4. 搜索 "Rename"，应能找到，路径为 `renamed.md`

### TC7: 防抖机制验证
1. 连续快速创建 3 个文件（间隔 < 1 秒）
2. 只应触发一次 reindex（防抖合并）
3. 搜索任一文件内容，应全部能找到

### TC8: 搜索不受阻塞验证
1. 触发文件变化（后台 reindex 进行中）
2. 立即执行搜索，应使用旧索引正常返回
3. reindex 完成后再次搜索，应使用新索引

### TC9: .cortex 目录变化被忽略
1. 在搜索目录的 `.cortex/` 下创建/修改文件
2. 等待防抖间隔
3. 不应触发 reindex（`_do_reindex` 不被调用）

### TC10: 不支持的文件类型被忽略
1. 创建 `test.bin`（不在 SUPPORTED_FORMATS 中）
2. 等待防抖间隔
3. 不应触发 reindex

### TC11: 手动 /index 与自动 reindex 互斥
1. 触发文件变化，后台 reindex 开始
2. 同时执行手动 reindex（`cmd_index`）
3. 手动 reindex 应被拒绝（打印提示）

---

## 测试结果（2026-05-05）

全部 27/27 通过。使用 `test_work_dir/` 真实样本（62 个文件，7 种格式）。

| 用例 | 断言数 | 结果 |
|------|--------|------|
| TC1: 新建文件 | 2 | PASS |
| TC2: 修改文件 | 2 | PASS |
| TC3: 删除文件 | 3 | PASS |
| TC4: 新建目录+文件 | 3 | PASS |
| TC5: 删除目录 | 3 | PASS |
| TC6: 重命名文件 | 3 | PASS |
| TC7: 防抖合并 | 3 | PASS |
| TC8: 搜索不阻塞 | 3 | PASS |
| TC9: 忽略 .cortex | 1 | PASS |
| TC10: 忽略不支持类型 | 1 | PASS |
| TC11: 手动/自动互斥 | 2 | PASS |

测试脚本: `test_watcher.py`，运行命令:
```bash
.venv/Scripts/python.exe test_watcher.py
```

### 测试注意事项
- 删除场景（TC3/TC5）使用 `_search_in_file()` 按文件路径断言，而非简单检查搜索有无结果（FTS5 BM25 可能返回其他文档的部分匹配）
- 每个删除测试前先手动 `reindex()` 确保目标文件已进入索引
