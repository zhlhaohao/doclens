#!/usr/bin/env python3
"""FileWatcher 自动化测试脚本 — 使用 test_work_dir 真实样本"""

import os
import sys
import time
import shutil
import io
import gc
import glob
from contextlib import redirect_stdout

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager
from cortex.file_watcher import FileWatcher

ROOT = os.path.dirname(os.path.abspath(__file__))
TEST_DIR = os.path.join(ROOT, "test_work_dir")


class WatcherTestRunner:
    def __init__(self):
        self.results = []
        self._idx = None
        print(f"测试目录: {TEST_DIR}")

    def _make_idx(self, debounce=1.0):
        config = CortexConfig(search_path=TEST_DIR, watch_enabled=True, watch_debounce=debounce)
        return IndexManager(config)

    def _create_file(self, name, content):
        path = os.path.join(TEST_DIR, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return path

    def _wait_reindex(self, idx, timeout=20):
        start = time.time()
        while time.time() - start < timeout:
            if idx._pending_swap is not None:
                idx._check_swap()
                return True
            time.sleep(0.2)
        return False

    def _search(self, idx, query):
        try:
            nodes, docs = idx.search(query, max_results=10)
            return len(nodes) > 0 or len(docs) > 0
        except Exception:
            return False

    def _search_in_file(self, idx, query, filename_substring):
        """搜索 query，返回结果中是否包含指定文件名的文档"""
        try:
            nodes, docs = idx.search(query, max_results=50)
            for d in docs:
                doc_id = d.get('doc_id', '')
                path = idx.path_map.get(doc_id, '')
                if filename_substring in path or filename_substring in doc_id:
                    return True
            for n in nodes:
                doc_id = n.get('doc_id', '')
                path = idx.path_map.get(doc_id, '')
                if filename_substring in path or filename_substring in doc_id:
                    return True
            return False
        except Exception:
            return False

    def _assert(self, name, condition, detail=""):
        status = "PASS" if condition else "FAIL"
        msg = f"  [{status}] {name}"
        if detail and not condition:
            msg += f" — {detail}"
        print(msg)
        self.results.append((name, condition))

    def _cleanup(self, *paths):
        for p in paths:
            full = os.path.join(TEST_DIR, p) if not os.path.isabs(p) else p
            if os.path.isfile(full):
                os.remove(full)
            elif os.path.isdir(full):
                shutil.rmtree(full, ignore_errors=True)

    def _release_ts(self, idx):
        """释放 TreeSearch 实例的 SQLite 连接"""
        if idx and idx._ts is not None:
            idx._ts = None
        gc.collect()

    def _full_rebuild_index(self):
        """强制全量重建索引，保证基线干净"""
        self._release_ts(self._idx)
        gc.collect()
        time.sleep(0.3)
        self._idx = self._make_idx()
        self._idx.load_or_build_index()
        print(f"  [基线] {len(self._idx.documents)} 个文档")

    def run(self):
        print("\n" + "=" * 60)
        print("FileWatcher 测试 (test_work_dir 真实样本)")
        print("=" * 60)

        # 全局初始化：构建一次干净索引
        self._idx = self._make_idx()
        self._idx.load_or_build_index()
        print(f"  [初始化] {len(self._idx.documents)} 个文档\n")

        try:
            self.tc1_create_file()
            self.tc2_modify_file()
            self.tc3_delete_file()
            self.tc4_create_directory()
            self.tc5_delete_directory()
            self.tc6_rename_file()
            self.tc7_debounce()
            self.tc8_search_not_blocked()
            self.tc9_ignore_cortex_dir()
            self.tc10_ignore_unsupported()
            self.tc11_manual_index_mutex()
        finally:
            pass

        print("\n" + "=" * 60)
        passed = sum(1 for _, ok in self.results if ok)
        total = len(self.results)
        print(f"结果: {passed}/{total} 通过")
        if passed < total:
            for name, ok in self.results:
                if not ok:
                    print(f"  FAIL: {name}")
        print("=" * 60)
        return passed == total

    # ---- 测试用例 ----

    def tc1_create_file(self):
        """TC1: 新建文件 → reindex → 能搜到"""
        print("TC1: 新建文件 - 索引自动更新")

        idx = self._idx
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            self._create_file("科技/watcher_test_new.md",
                              "# 量子纠缠测试XYZ\n\n量子纠缠是核心现象。\n")
            ok = self._wait_reindex(idx, timeout=20)
            self._assert("reindex 触发", ok)
            if ok:
                found = self._search(idx, "量子纠缠测试XYZ")
                self._assert("搜索到新文件内容", found)
        finally:
            watcher.stop()
            self._cleanup("科技/watcher_test_new.md")

    def tc2_modify_file(self):
        """TC2: 修改文件 → reindex → 能搜到新内容"""
        print("\nTC2: 修改文件 - 索引自动更新")

        target = os.path.join(TEST_DIR, "健康", "居家健身指南.md")
        if not os.path.exists(target):
            print("  [SKIP] 样本文件不存在")
            return

        with open(target, 'r', encoding='utf-8') as f:
            original = f.read()

        idx = self._idx
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            marker = "FileWatcher测试专用标记UNIQUE2025"
            with open(target, 'a', encoding='utf-8') as f:
                f.write(f"\n\n## {marker}\n\n深度学习辅助训练。\n")
            ok = self._wait_reindex(idx, timeout=20)
            self._assert("reindex 触发", ok)
            if ok:
                found = self._search(idx, marker)
                self._assert("搜索到修改后的新内容", found)
        finally:
            watcher.stop()
            with open(target, 'w', encoding='utf-8') as f:
                f.write(original)

    def tc3_delete_file(self):
        """TC3: 删除文件 → reindex → 搜不到"""
        print("\nTC3: 删除文件 - 索引自动更新")

        marker = "待删除唯一标记DEL999XYZ"

        # Step 1: 创建文件并手动 reindex 让它进入索引
        target = self._create_file("天文航天/watcher_del.md",
                                   f"# {marker}\n\n删除测试专用。\n")
        idx = self._idx
        idx.reindex()  # 手动 reindex 让新文件进入索引

        found_before = self._search_in_file(idx, marker, "watcher_del")
        self._assert("删除前能搜到", found_before, "文件应该先进入索引")
        if not found_before:
            self._cleanup("天文航天/watcher_del.md")
            return

        # Step 2: 启动 watcher，删除文件
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            os.remove(target)
            ok = self._wait_reindex(idx, timeout=20)
            self._assert("reindex 触发", ok)
            if ok:
                found_after = self._search_in_file(idx, marker, "watcher_del")
                self._assert("删除后搜不到", not found_after, "应该搜不到已删除文件")
        finally:
            watcher.stop()

    def tc4_create_directory(self):
        """TC4: 新建目录 + 文件 → reindex → 能搜到"""
        print("\nTC4: 新建目录 + 文件 - 索引自动更新")

        idx = self._idx
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            self._create_file("新领域/新发现.md",
                              "# 新领域新发现ABC\n\n跨学科研究带来突破。\n")
            ok = self._wait_reindex(idx, timeout=20)
            self._assert("reindex 触发", ok)
            if ok:
                found = self._search(idx, "新领域新发现ABC")
                self._assert("搜索到新目录中的文件", found)
                path_found = any("新领域" in p for p in idx.path_map.values())
                self._assert("路径包含新目录名", path_found)
        finally:
            watcher.stop()
            self._cleanup("新领域")

    def tc5_delete_directory(self):
        """TC5: 删除目录 → reindex → 搜不到"""
        print("\nTC5: 删除目录 - 索引自动更新")

        marker = "临时唯一标记DELDIR777XYZ"

        # Step 1: 创建目录和文件，手动 reindex
        self._create_file("待删目录/临时文件.md",
                          f"# {marker}\n\n该目录将被整体删除。\n")
        idx = self._idx
        idx.reindex()

        found_before = self._search_in_file(idx, marker, "待删目录")
        self._assert("删除前能搜到", found_before, "文件应该先进入索引")
        if not found_before:
            self._cleanup("待删目录")
            return

        # Step 2: 启动 watcher，删除目录
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            shutil.rmtree(os.path.join(TEST_DIR, "待删目录"))
            ok = self._wait_reindex(idx, timeout=20)
            self._assert("reindex 触发", ok)
            if ok:
                found_after = self._search_in_file(idx, marker, "待删目录")
                self._assert("目录删除后搜不到", not found_after, "应该搜不到已删除目录内容")
        finally:
            watcher.stop()

    def tc6_rename_file(self):
        """TC6: 重命名文件 → reindex → 新名称可搜"""
        print("\nTC6: 重命名文件 - 索引自动更新")

        marker = "重命名唯一标记RN888XYZ"

        old_path = self._create_file("编程/watcher_rename.md",
                                     f"# {marker}\n\nRust所有权机制。\n")
        idx = self._idx
        idx.reindex()

        found_before = self._search(idx, marker)
        self._assert("重命名前能搜到", found_before)

        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            new_path = os.path.join(TEST_DIR, "编程", "watcher_renamed.md")
            os.rename(old_path, new_path)
            ok = self._wait_reindex(idx, timeout=20)
            self._assert("reindex 触发", ok)
            if ok:
                found = self._search(idx, marker)
                self._assert("重命名后能搜索到", found)
                has_new = any("watcher_renamed" in p for p in idx.path_map.values())
                self._assert("路径更新为新名称", has_new)
        finally:
            watcher.stop()
            self._cleanup("编程/watcher_renamed.md")

    def tc7_debounce(self):
        """TC7: 连续快速创建 3 个文件 → 只触发 1 次 reindex"""
        print("\nTC7: 防抖机制验证")

        idx = self._idx
        reindex_count = [0]
        original_do_reindex = FileWatcher._do_reindex

        def counting_reindex(self_w):
            reindex_count[0] += 1
            return original_do_reindex(self_w)

        FileWatcher._do_reindex = counting_reindex

        watcher = FileWatcher(idx, debounce_seconds=2.0)
        watcher.start()
        time.sleep(0.5)

        try:
            self._create_file("科技/debounce_a.md", "# 防抖A标记XYZ\n\n防抖A。\n")
            time.sleep(0.3)
            self._create_file("科技/debounce_b.md", "# 防抖B标记XYZ\n\n防抖B。\n")
            time.sleep(0.3)
            self._create_file("科技/debounce_c.md", "# 防抖C标记XYZ\n\n防抖C。\n")

            ok = self._wait_reindex(idx, timeout=20)
            self._assert("防抖: reindex 触发", ok)
            self._assert("防抖: 只触发一次 reindex", reindex_count[0] == 1,
                         f"实际触发 {reindex_count[0]} 次")
            if ok:
                found = self._search(idx, "防抖A标记XYZ")
                self._assert("所有防抖文件都被索引", found)
        finally:
            FileWatcher._do_reindex = original_do_reindex
            watcher.stop()
            self._cleanup("科技/debounce_a.md", "科技/debounce_b.md", "科技/debounce_c.md")

    def tc8_search_not_blocked(self):
        """TC8: reindex 进行中搜索不受阻塞"""
        print("\nTC8: 搜索不受阻塞验证")

        target = os.path.join(TEST_DIR, "编程", "python_async_programming.md")
        if not os.path.exists(target):
            print("  [SKIP] 样本文件不存在")
            return

        with open(target, 'r', encoding='utf-8') as f:
            original = f.read()

        idx = self._idx
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            with open(target, 'w', encoding='utf-8') as f:
                f.write(original + "\n\n## 阻塞测试标记BLK555\n\n搜索不应被阻塞。\n")

            t0 = time.time()
            self._search(idx, "Python")
            elapsed = time.time() - t0
            self._assert("搜索未阻塞 (<1s)", elapsed < 1.0, f"耗时 {elapsed:.2f}s")

            ok = self._wait_reindex(idx, timeout=20)
            self._assert("reindex 完成", ok)
            if ok:
                found_new = self._search(idx, "阻塞测试标记BLK555")
                self._assert("新内容可搜索", found_new)
        finally:
            watcher.stop()
            with open(target, 'w', encoding='utf-8') as f:
                f.write(original)

    def tc9_ignore_cortex_dir(self):
        """TC9: .cortex 目录变化不触发 reindex"""
        print("\nTC9: .cortex 目录变化被忽略")

        idx = self._idx
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            cortex_file = os.path.join(TEST_DIR, ".cortex", "test_ignore.md")
            os.makedirs(os.path.dirname(cortex_file), exist_ok=True)
            with open(cortex_file, 'w', encoding='utf-8') as f:
                f.write("# Cortex Internal\n不应触发。\n")

            time.sleep(3.0)
            triggered = idx._pending_swap is not None
            self._assert("忽略 .cortex 目录变化", not triggered)
        finally:
            watcher.stop()
            cf = os.path.join(TEST_DIR, ".cortex", "test_ignore.md")
            if os.path.exists(cf):
                os.remove(cf)

    def tc10_ignore_unsupported(self):
        """TC10: 不支持的文件类型不触发 reindex"""
        print("\nTC10: 不支持的文件类型被忽略")

        idx = self._idx
        watcher = FileWatcher(idx, debounce_seconds=1.0)
        watcher.start()
        time.sleep(0.5)

        try:
            bin_file = os.path.join(TEST_DIR, "不支持的文件.bin")
            with open(bin_file, 'wb') as f:
                f.write(b'\x00\x01\x02\x03' * 100)

            time.sleep(3.0)
            triggered = idx._pending_swap is not None
            self._assert("忽略不支持的文件类型", not triggered)
        finally:
            watcher.stop()
            self._cleanup("不支持的文件.bin")

    def tc11_manual_index_mutex(self):
        """TC11: 手动 /index 与自动 reindex 互斥"""
        print("\nTC11: 手动 /index 与自动 reindex 互斥")

        from cortex.cortex_cli import NotebookSearchCLI

        idx = self._idx
        cli = NotebookSearchCLI()
        cli.idx = idx
        cli.watcher = FileWatcher(idx, debounce_seconds=1.0)
        cli.watcher.start()
        time.sleep(0.5)

        try:
            cli.watcher.reindexing = True

            buf = io.StringIO()
            with redirect_stdout(buf):
                cli.cmd_index()
            output = buf.getvalue()
            rejected = "后台正在更新索引" in output or "稍后" in output
            self._assert("手动 reindex 被拒绝", rejected,
                         f"期望被拒绝，实际输出: {output.strip()}")

            cli.watcher.reindexing = False
            buf2 = io.StringIO()
            with redirect_stdout(buf2):
                cli.cmd_index()
            output2 = buf2.getvalue()
            ok = "正在" in output2 or "完成" in output2 or "索引已更新" in output2
            self._assert("后台空闲时手动 reindex 正常", ok,
                         f"期望正常执行，实际输出: {output2.strip()}")
        finally:
            cli.watcher.stop()


if __name__ == "__main__":
    runner = WatcherTestRunner()
    success = runner.run()
    sys.exit(0 if success else 1)
