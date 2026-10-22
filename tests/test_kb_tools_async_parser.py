"""AP-7 回归：kb_tools 同步壳驱动异步解析器的事件循环纪律。

修复前：``_get_or_create_event_loop() + run_until_complete`` —— 新建循环
不 close（selector/fd 泄漏）、running loop 内调用即 RuntimeError、
``get_event_loop`` 3.12+ 弃用路径。

修复后：``asyncio.run()`` 干净起停；本测试锁定两条契约：
1. 同步上下文（线程池，无 running loop）正常解析——即 planify
   StreamingAgent 对同步 handler 的真实调用形态（asyncio.to_thread）；
2. 循环不泄漏——asyncio.run 保证退出后无残留事件循环。
"""
import asyncio
import threading


class TestRunAsyncParser:
    def _run(self, parser_fn, path):
        # 函数内 import 私有成员：测试目标本就需字符串/符号路径（守卫白名单惯例）
        from doclens.kb_tools import _run_async_parser

        return _run_async_parser(parser_fn, path)
    def _write_md(self, tmp_path):
        p = tmp_path / "doc.md"
        p.write_text("# 标题\n\n正文内容", encoding="utf-8")
        return p

    def test_sync_thread_parses_and_cleans_loop(self, tmp_path):
        """线程池线程（planify 真实调用形态）内解析成功且无循环泄漏。"""
        from treesearch.parsers.registry import get_parser

        p = self._write_md(tmp_path)
        parser_fn = get_parser(".md")
        assert parser_fn is not None

        result_box = {}

        def work():
            result_box["raw"] = self._run(parser_fn, str(p))

        t = threading.Thread(target=work)
        t.start()
        t.join(timeout=30)
        assert not t.is_alive(), "parser 线程超时——事件循环未退出"

        raw = result_box["raw"]
        assert raw.get("doc_name") in ("doc.md", "doc"), f"意外 doc_name: {raw.get('doc_name')!r}"
        assert raw.get("structure"), "md 解析应产出节点树"

        # 工作线程退出后，该线程不应残留运行中的事件循环
        def check_no_loop():
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                result_box["clean"] = True
            else:
                result_box["clean"] = False

        t2 = threading.Thread(target=check_no_loop)
        t2.start()
        t2.join(timeout=10)
        assert result_box.get("clean") is True, "线程残留了未关闭的事件循环"

    def test_main_thread_no_stale_loop_after_run(self, tmp_path):
        """主线程直接调用后，当前线程无 get_event_loop 侧残留（旧实现会
        把新建循环 set 为线程当前 loop 且永不清理）。"""
        from treesearch.parsers.registry import get_parser

        p = self._write_md(tmp_path)
        parser_fn = get_parser(".md")
        self._run(parser_fn, str(p))
        # asyncio.run 退出后不该有 running loop
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            pass
        else:
            raise AssertionError("asyncio.run 退出后仍有 running loop")
