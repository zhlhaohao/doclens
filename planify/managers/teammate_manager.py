"""TeammateManager - 持久化自主代理队友管理 (s09/s11)

管理持久的自主代理队友（线程安全）。

队友生命周期：
    spawn -> [work -> idle -> work -> ...] -> shutdown

工作阶段 (WORK PHASE)：
- 执行任务，使用工具
- 处理收件箱消息
- 可以调用 idle 进入空闲阶段

空闲阶段 (IDLE PHASE)：
- 轮询收件箱和未认领任务
- 发现工作后自动恢复到工作阶段
- 超时后自动关闭 (s11 自主代理)

自动认领任务 (s11)：
- 空闲时检查未认领的任务
- 自动认领并开始工作
- 压缩后重新注入身份信息

配置文件 (.team/config.json)：
    {
        "team_name": "default",
        "members": [
            {"name": "alice", "role": "coder", "status": "idle"}
        ]
    }
"""

import json
import threading
import time
from pathlib import Path
from typing import Dict, List
from anthropic import Anthropic


class TeammateManager:
    """队友管理器（线程安全）"""

    def __init__(
        self,
        bus,
        task_mgr,
        team_dir: Path,
        workdir: Path,
        model: str,
        client: Anthropic,
        poll_interval: int,
        idle_timeout: int,
        run_bash,
        run_read,
        run_write,
        run_edit,
    ):
        """
        初始化队友管理器

        Args:
            bus: 消息总线实例
            task_mgr: 任务管理器实例
            team_dir: 团队配置目录
            workdir: 工作目录
            model: 模型 ID
            client: Anthropic API 客户端
            poll_interval: 空闲轮询间隔
            idle_timeout: 空闲超时时间
            run_bash: Bash 执行函数
            run_read: 文件读取函数
            run_write: 文件写入函数
            run_edit: 文件编辑函数
        """
        team_dir.mkdir(exist_ok=True, parents=True)
        self.bus = bus
        self.task_mgr = task_mgr
        self.team_dir = team_dir
        self.workdir = workdir
        self.model = model
        self.client = client
        self.poll_interval = poll_interval
        self.idle_timeout = idle_timeout
        self.run_bash = run_bash
        self.run_read = run_read
        self.run_write = run_write
        self.run_edit = run_edit
        self.config_path = team_dir / "config.json"
        self._config_lock = threading.RLock()
        self.threads: Dict[str, threading.Thread] = {}  # name -> Thread
        self._threads_lock = threading.RLock()
        self.config = self._load()

    def _load(self) -> dict:
        """加载团队配置（线程安全）"""
        with self._config_lock:
            if self.config_path.exists():
                return json.loads(self.config_path.read_text(encoding='utf-8'))
            return {"team_name": "default", "members": []}

    def _save(self):
        """保存团队配置（线程安全）"""
        with self._config_lock:
            self.config_path.write_text(json.dumps(self.config, indent=2, ensure_ascii=False), encoding='utf-8')

    def _find(self, name: str) -> dict:
        """按名称查找队友（线程安全）"""
        with self._config_lock:
            for m in self.config["members"]:
                if m["name"] == name:
                    return m
            return None

    def _set_status(self, name: str, status: str):
        """更新队友状态（线程安全）"""
        with self._config_lock:
            member = self._find(name)
            if member:
                member["status"] = status
                self._save()

    def spawn(self, name: str, role: str, prompt: str) -> str:
        """
        启动队友

        如果队友已存在且处于 idle/shutdown 状态，重新激活。
        否则创建新队友。

        Args:
            name: 队友名称
            role: 角色描述
            prompt: 初始任务提示

        Returns:
            启动确认信息
        """
        with self._config_lock:
            member = self._find(name)
            if member:
                if member["status"] not in ("idle", "shutdown"):
                    return f"Error: '{name}' is currently {member['status']}"
                member["status"] = "working"
                member["role"] = role
            else:
                member = {"name": name, "role": role, "status": "working"}
                self.config["members"].append(member)
            self._save()

        # 启动线程
        thread = threading.Thread(target=self._loop, args=(name, role, prompt), daemon=True)
        with self._threads_lock:
            self.threads[name] = thread
        thread.start()
        return f"Spawned '{name}' (role: {role})"

    def shutdown(self, name: str) -> str:
        """
        关闭队友

        Args:
            name: 队友名称

        Returns:
            关闭确认信息
        """
        # 发送关闭请求
        self.bus.send("lead", name, "", msg_type="shutdown_request")

        # 等待线程结束
        thread = None
        with self._threads_lock:
            if name in self.threads:
                thread = self.threads[name]

        if thread and thread.is_alive():
            thread.join(timeout=5)
            with self._threads_lock:
                if name in self.threads:
                    del self.threads[name]

        return f"Shutdown '{name}'"

    def _loop(self, name: str, role: str, prompt: str):
        """
        队友主循环（在独立线程中运行）

        包含两个阶段：
        1. WORK PHASE: 执行任务直到 idle 或完成
        2. IDLE PHASE: 等待新工作或超时关闭

        Args:
            name: 队友名称
            role: 角色描述
            prompt: 初始提示
        """
        with self._config_lock:
            team_name = self.config["team_name"]

        sys_prompt = (
            f"You are '{name}', role: {role}, team: {team_name}, at {self.workdir}. "
            f"Use idle when done with current work. You may auto-claim tasks."
        )
        messages = [{"role": "user", "content": prompt}]

        # 队友可用工具
        tools = [
            {
                "name": "bash",
                "description": "Run command.",
                "input_schema": {
                    "type": "object",
                    "properties": {"command": {"type": "string"}},
                    "required": ["command"]
                }
            },
            {
                "name": "read_file",
                "description": "Read file.",
                "input_schema": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"]
                }
            },
            {
                "name": "write_file",
                "description": "Write file.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["path", "content"]
                }
            },
            {
                "name": "edit_file",
                "description": "Edit file.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "old_text": {"type": "string"},
                        "new_text": {"type": "string"}
                    },
                    "required": ["path", "old_text", "new_text"]
                }
            },
            {
                "name": "send_message",
                "description": "Send message.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "to": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["to", "content"]
                }
            },
            {
                "name": "idle",
                "description": "Signal no more work.",
                "input_schema": {"type": "object", "properties": {}}
            },
            {
                "name": "claim_task",
                "description": "Claim task by ID.",
                "input_schema": {
                    "type": "object",
                    "properties": {"task_id": {"type": "integer"}},
                    "required": ["task_id"]
                }
            },
        ]

        try:
            while True:
                # ==================== WORK PHASE ====================
                for _ in range(50):  # 最多 50 轮
                    # 检查收件箱
                    inbox = self.bus.read_inbox(name)
                    for msg in inbox:
                        if msg.get("type") == "shutdown_request":
                            self._set_status(name, "shutdown")
                            return
                        messages.append({"role": "user", "content": json.dumps(msg, ensure_ascii=False)})

                    # LLM 调用
                    try:
                        response = self.client.messages.create(
                            model=self.model, system=sys_prompt, messages=messages,
                            tools=tools, max_tokens=8000
                        )
                    except Exception:
                        self._set_status(name, "shutdown")
                        return

                    messages.append({"role": "assistant", "content": response.content})
                    if response.stop_reason != "tool_use":
                        break

                    # 执行工具
                    results = []
                    idle_requested = False
                    last_block = None
                    for block in response.content:
                        if block.type == "tool_use":
                            last_block = block
                            if block.name == "idle":
                                idle_requested = True
                                output = "Entering idle phase."
                            elif block.name == "claim_task":
                                output = self.task_mgr.claim(block.input["task_id"], name)
                            elif block.name == "send_message":
                                output = self.bus.send(name, block.input["to"], block.input["content"])
                            else:
                                dispatch = {
                                    "bash": lambda **kw: self.run_bash(kw["command"], self.workdir),
                                    "read_file": lambda **kw: self.run_read(kw["path"], self.workdir),
                                    "write_file": lambda **kw: self.run_write(kw["path"], kw["content"], self.workdir),
                                    "edit_file": lambda **kw: self.run_edit(kw["path"], kw["old_text"], kw["new_text"], self.workdir),
                                }
                                output = dispatch.get(block.name, lambda **kw: "Unknown")(**block.input)
                            print(f"  [{name}] {block.name}: {str(output)[:120]}")
                            results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": str(output)
                            })

                    messages.append({"role": "user", "content": results})
                    if idle_requested:
                        break

                # ==================== IDLE PHASE ====================
                # 轮询收件箱和未认领任务，超时后关闭
                self._set_status(name, "idle")
                resume = False
                for _ in range(self.idle_timeout // max(self.poll_interval, 1)):
                    time.sleep(self.poll_interval)
                    # 检查收件箱
                    inbox = self.bus.read_inbox(name)
                    if inbox:
                        for msg in inbox:
                            if msg.get("type") == "shutdown_request":
                                self._set_status(name, "shutdown")
                                return
                            messages.append({"role": "user", "content": json.dumps(msg, ensure_ascii=False)})
                        resume = True
                        break

                    # 自动认领未认领的任务 (s11)
                    unclaimed = []
                    for f in sorted(self.task_mgr.tasks_dir.glob("task_*.json")):
                        t = json.loads(f.read_text(encoding='utf-8'))
                        if t.get("status") == "pending" and not t.get("owner") and not t.get("blockedBy"):
                            unclaimed.append(t)
                    if unclaimed:
                        task = unclaimed[0]
                        self.task_mgr.claim(task["id"], name)
                        # 身份重新注入（用于压缩后的上下文）
                        if len(messages) <= 3:
                            messages.insert(
                                0,
                                {
                                    "role": "user",
                                    "content": f"<identity>You are '{name}', role: {role}, team: {team_name}.</identity>"
                                }
                            )
                            messages.insert(
                                1,
                                {"role": "assistant", "content": f"I am {name}. Continuing."}
                            )
                        messages.append({
                            "role": "user",
                            "content": f"<auto-claimed>Task #{task['id']}: {task['subject']}\n{task.get('description', '')}</auto-claimed>"
                        })
                        messages.append({
                            "role": "assistant",
                            "content": f"Claimed task #{task['id']}. Working on it."
                        })
                        resume = True
                        break

                if not resume:
                    self._set_status(name, "shutdown")
                    return
                self._set_status(name, "working")
        finally:
            # 线程结束时清理
            with self._threads_lock:
                if name in self.threads:
                    del self.threads[name]

    def list_all(self) -> str:
        """列出所有队友及其状态"""
        with self._config_lock:
            if not self.config["members"]:
                return "No teammates."
            lines = [f"Team: {self.config['team_name']}"]
            for m in self.config["members"]:
                lines.append(f"  {m['name']} ({m['role']}): {m['status']}")
            return "\n".join(lines)

    def member_names(self) -> List[str]:
        """获取所有队友名称列表"""
        with self._config_lock:
            return [m["name"] for m in self.config["members"]]
