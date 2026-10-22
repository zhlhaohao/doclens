"""AP-3 回归：FTS5Index 单连接跨线程共享的串行化保护。

背景：全局单例 get_fts_index 的连接被 uvicorn 搜索线程 + 后台 reindex
线程 + lazy 补录写路径共享（check_same_thread=False）。修复前零锁：
sqlite3 连接非线程安全 + 连接级隐式事务会被并发 execute/commit 交叉
提交/回滚（脏索引）。

修复后契约（_LockedConnection：一条 RLock 贯穿语句与事务）：
1. 并发 search + index_document 无异常、数据一致（每文档节点数完整）；
2. ``with conn:`` 隐式事务独占连接——并发批量写不互相提交半截事务；
3. 单语句级并发（execute）不崩（ProgrammingError/OperationalError）。
"""
import threading
from concurrent.futures import ThreadPoolExecutor

from treesearch.fts import FTS5Index
from treesearch.tree import Document


def _doc(doc_id: str, n_nodes: int = 5) -> Document:
    nodes = [
        {
            "node_id": f"{doc_id}-n{i}",
            "title": f"章节{i}",
            "summary": f"{doc_id} 的第 {i} 节内容，关键词 alpha beta",
            "depth": 1,
        }
        for i in range(n_nodes)
    ]
    return Document(doc_id=doc_id, doc_name=f"{doc_id}.md",
                    structure=nodes, source_type="markdown")


class TestConcurrentSearchAndIndex:
    def test_mixed_read_write_no_exception_and_consistent(self, tmp_path):
        """并发 search + index_document：无异常、每文档节点完整落库。"""
        fts = FTS5Index(db_path=str(tmp_path / "idx.db"))
        # 预置一半文档
        for i in range(10):
            fts.index_document(_doc(f"pre{i}"), auto_commit=True)

        errors: list[str] = []
        N_WRITERS, N_ROUNDS = 4, 10

        def writer(wid: int):
            try:
                for r in range(N_ROUNDS):
                    fts.index_document(_doc(f"w{wid}d{r}"), auto_commit=True)
            except Exception as e:  # noqa: BLE001
                errors.append(f"writer{wid}: {e!r}")

        def reader(rid: int):
            try:
                for _ in range(N_ROUNDS * 2):
                    fts.search("alpha", top_k=50)
            except Exception as e:  # noqa: BLE001
                errors.append(f"reader{rid}: {e!r}")

        with ThreadPoolExecutor(max_workers=8) as pool:
            futs = [pool.submit(writer, i) for i in range(N_WRITERS)]
            futs += [pool.submit(reader, 100 + i) for i in range(4)]
            for f in futs:
                f.result(timeout=60)

        assert not errors, f"并发读写出异常: {errors}"
        # 一致性：每个写文档的节点数完整（无半截事务残留）
        total_docs = 10 + N_WRITERS * N_ROUNDS
        for i in range(total_docs):
            doc_id = f"pre{i}" if i < 10 else None
        for wid in range(N_WRITERS):
            for r in range(N_ROUNDS):
                doc = fts.load_document(f"w{wid}d{r}")
                assert doc is not None, f"w{wid}d{r} 丢失"
                assert len(doc.structure) == 5, f"w{wid}d{r} 节点不完整: {len(doc.structure)}"
        fts.close()

    def test_concurrent_implicit_transactions_do_not_cross_commit(self, tmp_path):
        """with conn: 隐式事务独占——线程 A 的事务进行中，线程 B 的
        execute/commit 必须等 A 提交后才能进（RLock 贯穿）。"""
        import sqlite3

        raw = sqlite3.connect(str(tmp_path / "t.db"), check_same_thread=False)
        raw.execute("CREATE TABLE t(v INTEGER)")
        raw.commit()
        raw.close()

        fts = FTS5Index(db_path=str(tmp_path / "t.db"))
        conn = fts._conn
        order: list[str] = []
        in_a = threading.Event()
        a_done = threading.Event()

        def txn_a():
            with conn:
                order.append("a-begin")
                conn.execute("INSERT INTO t(v) VALUES (1)")
                in_a.set()          # B 现在尝试进入
                import time
                time.sleep(0.15)    # 模拟事务中段
                order.append("a-end")
            a_done.set()

        def stmt_b():
            in_a.wait(timeout=5)
            conn.execute("INSERT INTO t(v) VALUES (2)")
            order.append("b-exec")

        ta = threading.Thread(target=txn_a)
        tb = threading.Thread(target=stmt_b)
        ta.start(); tb.start()
        ta.join(timeout=10); tb.join(timeout=10)
        assert a_done.is_set()

        # B 的语句必须排在 A 事务结束之后（若 B 抢进 A 的事务，
        # b-exec 会先于 a-end）
        assert order.index("b-exec") > order.index("a-end"), (
            f"语句穿透了进行中的事务: {order}"
        )
        rows = list(conn.execute("SELECT v FROM t ORDER BY v"))
        assert [r[0] for r in rows] == [1, 2]
        fts.close()

    def test_reader_writer_threads_share_single_instance(self, tmp_path):
        """复刻真实形态：一个 FTS5Index 实例，多线程交替 search（读）与
        index_document（写，走 with conn 事务）——无 ProgrammingError。"""
        fts = FTS5Index(db_path=str(tmp_path / "idx.db"))
        fts.index_document(_doc("seed"), auto_commit=True)

        errors: list[str] = []
        stop = threading.Event()

        def reader():
            while not stop.is_set():
                try:
                    fts.search("alpha", top_k=10)
                except Exception as e:  # noqa: BLE001
                    errors.append(repr(e))
                    return

        threads = [threading.Thread(target=reader, daemon=True) for _ in range(3)]
        for t in threads:
            t.start()
        try:
            for i in range(20):
                fts.index_document(_doc(f"mix{i}"), auto_commit=True)
        finally:
            stop.set()
            for t in threads:
                t.join(timeout=10)
        assert not errors, errors
        fts.close()
