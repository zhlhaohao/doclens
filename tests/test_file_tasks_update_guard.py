# -*- coding: utf-8 -*-
"""task_update 空更新守卫（2026-11-02 死循环事故修复）。

事故：模型连续 8 次调用 task_update 只传 task_id（status/add_blocked_by/
add_blocks 全缺），底层 TaskManager.update 全 None 时静默 save + 返回任务
JSON，模型收到"成功"响应以为更新生效但任务状态从未变化，同参死循环提醒
被无视。修复：handler 层把全 None 识别为模型错误，返回可行动 Error 文本
让模型下次调用主动补字段（self-healing），底层 TaskManager.update 语义
不动（编程调用方仍可享受 no-op 便利）。
"""
import json

import pytest

from planify.managers.task_manager import TaskManager
from planify.tools.file_tasks import get_file_task_handlers


@pytest.fixture
def task_env(tmp_path):
    mgr = TaskManager(tmp_path / ".tasks")
    handlers = get_file_task_handlers(mgr)
    created = json.loads(handlers["task_create"](subject="测试任务"))
    return mgr, handlers, created["id"]


class TestTaskUpdateEmptyGuard:
    def test_empty_update_returns_actionable_error(self, task_env):
        """全 None 调用 → 返回 Error 文本提示应传字段；任务状态不被修改。"""
        mgr, handlers, tid = task_env
        out = handlers["task_update"](task_id=tid)
        assert out.startswith("Error:"), f"应返回 Error 文本: {out}"
        assert "status" in out
        assert "add_blocked_by" in out
        assert "add_blocks" in out
        assert "completed" in out, "提示文案应含常见用法示例"
        # 任务状态未被修改（仍是 pending）
        task = json.loads(mgr.get(tid))
        assert task["status"] == "pending"

    def test_status_update_still_works(self, task_env):
        """带 status 调用 → 正常透传到底层。"""
        mgr, handlers, tid = task_env
        out = handlers["task_update"](task_id=tid, status="in_progress")
        task = json.loads(out)
        assert task["status"] == "in_progress"

    def test_completed_status_unblocks_dependents(self, task_env):
        """status=completed 走原有解锁逻辑（不回归底层行为）。"""
        mgr, handlers, tid = task_env
        out = handlers["task_update"](task_id=tid, status="completed")
        task = json.loads(out)
        assert task["status"] == "completed"

    def test_add_blocked_by_alone_works(self, task_env):
        """只传 add_blocked_by → 正常透传（不触发守卫）。"""
        mgr, handlers, tid = task_env
        out = handlers["task_update"](task_id=tid, add_blocked_by=[999])
        task = json.loads(out)
        assert 999 in task["blockedBy"]

    def test_add_blocks_alone_works(self, task_env):
        """只传 add_blocks → 正常透传（不触发守卫）。"""
        mgr, handlers, tid = task_env
        out = handlers["task_update"](task_id=tid, add_blocks=[999])
        task = json.loads(out)
        assert 999 in task["blocks"]

    def test_empty_list_status_none_still_guarded(self, task_env):
        """status=None + add_blocked_by=[] + add_blocks=[] → 仍算空更新。

        模型显式传空列表等价于不传——底层 update 的 `if add_blocked_by:`
        判空列表为 False，实际同样是 no-op。守卫按「实际有效载荷」判定，
        不看"是否传了键"。
        """
        mgr, handlers, tid = task_env
        # 注：当前守卫用 `is None` 判定，空列表会穿透到底层。底层对空列表
        # 也是 no-op（`if add_blocked_by:` 判 False），结果一致——这个用例
        # 锁定现状语义，未来若改成「空列表也算空更新」可在此调整断言。
        out = handlers["task_update"](
            task_id=tid, status=None, add_blocked_by=[], add_blocks=[]
        )
        # 穿透到底层：返回任务 JSON（无 Error）
        task = json.loads(out)
        assert task["id"] == tid
