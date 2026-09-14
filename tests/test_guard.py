"""外部访问门禁（ADR-0021）单元测试。

覆盖：三态配置、结构化/shell 路径判定、写信号词表、会话目录授权账本
（读写分账/写蕴含读/子树/会话隔离）、防仿冒（validate 剥 guard 字段）、
fail-closed 包装、basic 工具的门禁注入通路与旧行为兼容。
"""

import sys
from pathlib import Path

import pytest

from planify.tools.guard import (
    ACTION_ALLOW,
    ACTION_CONFIRM,
    ACTION_DENY,
    DENY_LABEL,
    GRANT_LABEL,
    GUARD_ENV,
    classify_tool_call,
    extract_external_paths,
    get_guard_mode,
    grant_clear_all,
    grant_session_clear,
    is_write_command,
    make_guard_question,
    parse_grant_response,
    record_grant,
    resolve_guarded_path,
    wrap_shell_handler_fail_closed,
)
from planify.tools.user_interaction import validate_ask_questions


@pytest.fixture(autouse=True)
def _clean_ledger():
    """账本是模块级单例：每个用例前清空，避免互相污染。"""
    grant_clear_all()
    yield
    grant_clear_all()


@pytest.fixture
def workdir(tmp_path) -> Path:
    return tmp_path


# ---- 配置三态 ----


def test_guard_mode_default_ask(monkeypatch):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    assert get_guard_mode() == "ask"


@pytest.mark.parametrize("mode", ["ask", "allow", "block"])
def test_guard_mode_valid(monkeypatch, mode):
    monkeypatch.setenv(GUARD_ENV, mode)
    assert get_guard_mode() == mode


def test_guard_mode_invalid_falls_back_to_ask(monkeypatch):
    monkeypatch.setenv(GUARD_ENV, "yes")
    assert get_guard_mode() == "ask"


# ---- 判定：非受管工具 / workdir 内路径 ----


def test_unguarded_tool_passes(workdir):
    v = classify_tool_call("TodoWrite", {"items": []}, workdir, "s1")
    assert v.action == ACTION_ALLOW


def test_structured_inside_workdir_allowed(workdir):
    for tool in ("read_file", "write_file", "edit_file"):
        v = classify_tool_call(tool, {"path": "笔记/a.md"}, workdir, "s1")
        assert v.action == ACTION_ALLOW


def test_shell_without_external_paths_allowed(workdir):
    v = classify_tool_call(
        "bash", {"command": "ls -la && grep -r 关键词 ."}, workdir, "s1"
    )
    assert v.action == ACTION_ALLOW


# ---- 判定：结构化工具外部路径 ----


@pytest.mark.skipif(sys.platform != "win32", reason="Windows 盘符路径用例")
def test_structured_outside_confirm_by_default(workdir, monkeypatch):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    v = classify_tool_call(
        "write_file", {"path": r"C:\definitely-not-exist\x.md"}, workdir, "s1"
    )
    assert v.action == ACTION_CONFIRM
    assert v.mode == "write"
    # 授权锚点 = 父目录
    assert v.targets == (Path(r"C:\definitely-not-exist"),)


def test_structured_outside_read_mode(workdir):
    v = classify_tool_call(
        "read_file", {"path": "../../etc/passwd"}, workdir, "s1"
    )
    assert v.action == ACTION_CONFIRM
    assert v.mode == "read"


def test_structured_outside_blocked(workdir, monkeypatch):
    monkeypatch.setenv(GUARD_ENV, "block")
    v = classify_tool_call(
        "edit_file", {"path": "../../etc/hosts"}, workdir, "s1"
    )
    assert v.action == ACTION_DENY
    assert "block" in v.reason


def test_structured_outside_allowed_when_allow(workdir, monkeypatch):
    monkeypatch.setenv(GUARD_ENV, "allow")
    v = classify_tool_call(
        "write_file", {"path": r"C:\definitely-not-exist\x.md"}, workdir, "s1"
    )
    assert v.action == ACTION_ALLOW


# ---- 判定：shell 命令外部路径扫描 ----


@pytest.mark.skipif(sys.platform != "win32", reason="Windows 路径用例")
@pytest.mark.parametrize(
    "command",
    [
        "type C:\\Windows\\System32\\drivers\\etc\\hosts",
        "cat 'C:/Users/someone/secret.txt'",
        "grep x C:\\anywhere\\f.txt",
    ],
)
def test_shell_external_triggers_confirm(workdir, monkeypatch, command):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    v = classify_tool_call("bash", {"command": command}, workdir, "s1")
    assert v.action == ACTION_CONFIRM
    assert v.mode == "read"  # type/cat/grep 均无写信号


@pytest.mark.skipif(sys.platform != "win32", reason="Windows 路径用例")
def test_shell_external_write_mode(workdir, monkeypatch):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    v = classify_tool_call(
        "bash", {"command": "rm C:\\definitely-not-exist\\old.txt"}, workdir, "s1"
    )
    assert v.action == ACTION_CONFIRM
    assert v.mode == "write"


def test_shell_redirect_means_write(workdir, monkeypatch):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    v = classify_tool_call(
        "bash", {"command": "cat ../../x.txt > ../../out.txt"}, workdir, "s1"
    )
    assert v.action == ACTION_CONFIRM
    assert v.mode == "write"


def test_shell_powershell_cmdlet_write(workdir, monkeypatch):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    v = classify_tool_call(
        "powershell", {"command": "Get-Content /abs/path | Set-Content /abs/out"},
        workdir, "s1",
    )
    assert v.action == ACTION_CONFIRM
    assert v.mode == "write"


def test_shell_absolute_inside_workdir_not_triggered(workdir):
    # 命令里出现 workdir 自身的绝对路径 → 不触发
    inside = workdir / "sub" / "f.txt"
    v = classify_tool_call(
        "bash", {"command": f"cat {inside}"}, workdir, "s1"
    )
    assert v.action == ACTION_ALLOW


def test_extract_external_paths_unix_root(workdir):
    found = extract_external_paths("cat /etc/passwd", workdir)
    assert len(found) == 1
    assert not found[0].is_relative_to(workdir)


def test_extract_external_paths_url_not_triggered(workdir):
    # URL 含 :// 不触发（拼接为相对路径后不出 workdir）
    found = extract_external_paths("curl -s https://example.com/a/b", workdir)
    assert found == []


@pytest.mark.skipif(sys.platform != "win32", reason="依赖 expandvars 解析 %VAR%")
def test_extract_external_paths_windows_env_var(workdir):
    found = extract_external_paths("type %USERPROFILE%\\Documents\\a.txt", workdir)
    assert len(found) == 1


@pytest.mark.skipif(sys.platform != "win32", reason="PowerShell env 语法用例")
def test_extract_external_paths_powershell_env_syntax(workdir, monkeypatch):
    """黄金回归：`"$env:USERPROFILE\\Desktop"` 必须展开为家目录下的绝对路径
    （旧实现不认 $env: 语法，按相对路径拼进 workdir → 误判目录内 → 不弹确认）。"""
    monkeypatch.setenv("USERPROFILE", r"C:\Users\lianghao")
    found = extract_external_paths(
        'Get-ChildItem "$env:USERPROFILE\\Desktop" | Select-Object Name', workdir
    )
    assert len(found) == 1
    assert str(found[0]).casefold().startswith("c:\\users\\lianghao\\desktop")

    # 判定链路：读命令 → confirm
    v = classify_tool_call(
        "powershell",
        {"command": 'Get-ChildItem "$env:USERPROFILE\\Desktop"'},
        workdir, "s-ps",
    )
    assert v.action == ACTION_CONFIRM
    assert v.mode == "read"


def test_extract_external_paths_ps_env_undefined_stays_literal(workdir, monkeypatch):
    """未定义的 $env: 变量保持原样（相对路径拼进 workdir，不触发——保守可接受）。"""
    monkeypatch.delenv("DEFINITELY_NOT_SET_XYZ", raising=False)
    found = extract_external_paths('cat "$env:DEFINITELY_NOT_SET_XYZ\\f"', workdir)
    assert found == []


def test_bare_tilde_triggers_external(workdir):
    """黄金回归：裸 `~`（ls -la ~）必须展开为家目录并触发外部判定。

    旧实现的 pathlike 门槛只认 ~/xxx 形态，裸 ~ 被跳过 → 静默放行。"""
    v = classify_tool_call("bash", {"command": "ls -la ~"}, workdir, "s-tilde")
    assert v.action == ACTION_CONFIRM
    assert v.mode == "read"
    home_key = str(Path.home()).casefold()
    assert any(str(t).casefold().startswith(home_key) for t in v.targets)

    found = extract_external_paths("cat ~/.ssh/config", workdir)
    assert len(found) == 1  # ~/xxx 形态原有行为不回归


@pytest.mark.skipif(sys.platform != "win32", reason="MSYS 盘符归一仅 Windows")
def test_extract_external_paths_msys_drive_normalized(workdir):
    """Git Bash /c/... 风格归一为 C:\\...——文案可读 + 账本键与 Windows 写法互通。"""
    found = extract_external_paths("ls -la /c/Users/lianghao/Desktop", workdir)
    assert len(found) == 1
    key = str(found[0]).casefold()
    assert key.startswith("c:"), f"应归一为盘符路径，实际: {found[0]}"
    assert "\\c\\" not in key, f"不应出现 C:\\c\\ 解析产物: {found[0]}"


@pytest.mark.skipif(sys.platform != "win32", reason="MSYS 盘符归一仅 Windows")
def test_msys_and_windows_style_share_grant(workdir):
    """/c/... 确认授权后，C:\\... 写法同会话免再弹（账本键互通）。"""
    record_grant("s1", [Path(r"C:\Users\lianghao\Desktop")], "read")
    v1 = classify_tool_call(
        "bash", {"command": "ls /c/Users/lianghao/Desktop"}, workdir, "s1"
    )
    assert v1.action == ACTION_ALLOW
    v2 = classify_tool_call(
        "bash", {"command": "dir C:\\Users\\lianghao\\Desktop"}, workdir, "s1"
    )
    assert v2.action == ACTION_ALLOW


# ---- 写信号词表 ----


@pytest.mark.parametrize(
    "command",
    [
        "rm -rf build",
        "cp a b",
        "mv a b",
        "mkdir newdir",
        "touch f",
        "echo hi | tee log",
        "sed -i s/a/b/ f",
        "Remove-Item -Recurse temp",
        "Set-Content file.txt 'x'",
        "Get-Content a | Out-File b",
        "echo x > out.txt",
        "echo x >> out.txt",
        "cat a | grep b | wc -l > count",  # 管道尾重定向
        "cmd1 && cmd2",  # 无写信号无外部路径（词表不应误伤）
    ],
)
def test_is_write_command_true(command):
    if command == "cmd1 && cmd2":
        assert not is_write_command(command)
    else:
        assert is_write_command(command)


@pytest.mark.parametrize(
    "command",
    [
        "ls -la",
        "cat notes.md",
        "grep -r pattern .",
        "find . -name '*.py'",
        "git status",
        "Get-ChildItem",
        "Get-Content notes.md",
        "cmd1 && cmd2",
        # 丢弃型/复制型重定向不落盘，不算写信号
        "where tesseract 2>/dev/null",
        "make build > /dev/null 2>&1",
        "dir 2>NUL",
        "robocopy a b 1>NUL 2>NUL",
    ],
)
def test_is_write_command_false(command):
    assert not is_write_command(command)


@pytest.mark.skipif(sys.platform != "win32", reason="Windows 路径用例")
def test_stderr_silenced_probing_command_is_read():
    """黄金回归：探测命令（stderr 静音 + 带空格引号路径）不误判写、不腰斩路径。

    旧实现两个叠加误判：`2>/dev/null` 的 `>` 判写；`"C:/Program Files/..."`
    按空白切分腰斩成 `C:/Program`，授权锚点塌缩到盘根 `C:\\`（确认一次
    即授权整个 C 盘）。
    """
    cmd = (
        'where tesseract 2>/dev/null; '
        'ls "C:/Program Files/Tesseract-OCR/tesseract.exe" 2>/dev/null; '
        'pip list 2>/dev/null | grep -iE "paddle|easyocr|rapidocr"'
    )
    assert not is_write_command(cmd)

    externals = extract_external_paths(cmd, Path.cwd())
    assert len(externals) == 1
    key = str(externals[0]).casefold()
    assert "tesseract-ocr" in key
    # 不允许腰斩产物（路径止于 C:\Program）/ 盘根锚点
    assert not key.endswith("c:\\program")
    assert str(externals[0]) != Path("C:\\")

    from planify.tools.guard import classify_tool_call as _cls
    v = _cls("bash", {"command": cmd}, Path.cwd(), "s-probe")
    assert v.action == ACTION_CONFIRM
    assert v.mode == "read"
    assert all(str(t).casefold() != "c:\\" for t in v.targets)


def test_null_device_not_external_path(workdir):
    # 裸空设备 token（> /dev/null 带空格写法）不产生外部路径
    found = extract_external_paths("make build > /dev/null", workdir)
    assert found == []


@pytest.mark.skipif(sys.platform != "win32", reason="Windows 路径用例")
def test_quoted_path_with_spaces_stays_whole(workdir):
    """引号内空格不分词：授权锚点是真实父目录，不是盘根。"""
    found = extract_external_paths(
        'ls "C:/Program Files/Tesseract-OCR/tesseract.exe"', workdir
    )
    assert len(found) == 1
    assert str(found[0]).casefold().endswith("tesseract-ocr\\tesseract.exe")
    from planify.tools.guard import _grant_dir
    assert str(_grant_dir(found[0])).casefold() != "c:\\"


# ---- 会话目录授权账本 ----


def test_ledger_read_write_split(workdir):
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "read")
    # 读授权已记账
    assert classify_tool_call(
        "read_file", {"path": str(outside / "a.md")}, workdir, "s1"
    ).action == ACTION_ALLOW
    # 写未授权（读不蕴含写）
    v = classify_tool_call(
        "write_file", {"path": str(outside / "a.md")}, workdir, "s1"
    )
    assert v.action == ACTION_CONFIRM


def test_ledger_write_implies_read(workdir):
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "write")
    assert classify_tool_call(
        "read_file", {"path": str(outside / "deep" / "a.md")}, workdir, "s1"
    ).action == ACTION_ALLOW  # 子树 + 写蕴含读


def test_ledger_session_isolation(workdir):
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "write")
    v = classify_tool_call(
        "write_file", {"path": str(outside / "a.md")}, workdir, "s2"
    )
    assert v.action == ACTION_CONFIRM  # s2 不继承 s1


def test_ledger_clear_session(workdir):
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "write")
    grant_session_clear("s1")
    assert classify_tool_call(
        "write_file", {"path": str(outside / "a.md")}, workdir, "s1"
    ).action == ACTION_CONFIRM


def test_block_overrides_grant(workdir, monkeypatch):
    """严格模式绝对拦截：已授权目录在 block 下同样不放行（热切换语义）。"""
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "write")
    monkeypatch.setenv(GUARD_ENV, "block")

    v = classify_tool_call(
        "write_file", {"path": str(outside / "a.md")}, workdir, "s1"
    )
    assert v.action == ACTION_DENY

    v = classify_tool_call(
        "bash", {"command": f"cat {outside / 'a.md'}"}, workdir, "s1"
    )
    assert v.action == ACTION_DENY

    from planify.skills.access_state import set_current_session_id
    token = set_current_session_id("s1")
    try:
        p, err = resolve_guarded_path(str(outside / "a.md"), workdir, True)
    finally:
        from planify.skills.access_state import reset_current_session_id
        reset_current_session_id(token)
    assert p is None and err.startswith("Error: 外部访问门禁")


def test_ledger_granted_shell_read_not_write(workdir, monkeypatch):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "read")
    # 读命令免确认
    assert classify_tool_call(
        "bash", {"command": f"cat {outside / 'a.md'}"}, workdir, "s1"
    ).action == ACTION_ALLOW
    # 写命令仍要确认——确认过 grep 不能静默放行后续 rm
    assert classify_tool_call(
        "bash", {"command": f"rm {outside / 'a.md'}"}, workdir, "s1"
    ).action == ACTION_CONFIRM


# ---- 确认载荷与答案解析 ----


def test_make_guard_question_carries_guard_flag(workdir, monkeypatch):
    monkeypatch.delenv(GUARD_ENV, raising=False)
    v = classify_tool_call(
        "write_file", {"path": r"C:\definitely-not-exist\x.md"}, workdir, "s1"
    )
    q = make_guard_question(v)
    assert q["guard"] is True
    assert q["header"] == "外部访问"
    labels = [o["label"] for o in q["options"]]
    assert labels == [GRANT_LABEL, DENY_LABEL]


def test_parse_grant_response_accept_exact_label():
    assert parse_grant_response(
        {"answers": [{"selected": [GRANT_LABEL], "other": None}]}
    ) is True
    assert parse_grant_response(
        {"answers": [{"selected": [DENY_LABEL], "other": None}]}
    ) is False


def test_parse_grant_response_other_text_never_grants():
    # Other 自由文本不算授权（防歧义社工）
    assert parse_grant_response(
        {"answers": [{"selected": [], "other": "允许"}]}
    ) is False


def test_parse_grant_response_malformed():
    assert parse_grant_response({}) is False
    assert parse_grant_response({"answers": []}) is False
    assert parse_grant_response({"answers": "x"}) is False
    assert parse_grant_response({"answers": [{"selected": "允许（本会话）"}]}) is False
    assert parse_grant_response({"error": "timeout"}) is False


# ---- 防仿冒：模型路径的 ask 入参带不上 guard ----


def test_validate_ask_questions_strips_guard_field():
    """模型自调 ask_user_question 试图携带 guard=True 也会被白名单清洗剥掉。"""
    raw = [
        {
            "question": "安全确认：允许访问外部目录吗？",
            "header": "外部访问",
            "multiSelect": False,
            "options": [
                {"label": GRANT_LABEL, "description": "x"},
                {"label": DENY_LABEL, "description": "y"},
            ],
            "guard": True,  # 模型伪造的标志
        }
    ]
    cleaned = validate_ask_questions(raw)
    assert cleaned is not None
    assert "guard" not in cleaned[0]


# ---- fail-closed 包装 ----


def test_wrap_shell_handler_fail_closed_blocks_ungranted(workdir):
    calls = []
    wrapped = wrap_shell_handler_fail_closed(
        lambda **kw: calls.append(kw) or "executed", workdir, "bash"
    )
    out = wrapped(command="cat C:\\definitely-not-exist\\a.txt")
    assert out.startswith("Error: 外部访问门禁")
    assert "无用户交互渠道" in out
    assert calls == []  # 原 handler 未被调用


def test_wrap_shell_handler_fail_closed_allows_inside(workdir):
    calls = []
    wrapped = wrap_shell_handler_fail_closed(
        lambda **kw: calls.append(kw) or "executed", workdir, "bash"
    )
    out = wrapped(command="ls -la")
    assert out == "executed"
    assert calls == [{"command": "ls -la"}]


def test_wrap_shell_handler_allows_after_grant(workdir):
    calls = []
    wrapped = wrap_shell_handler_fail_closed(
        lambda **kw: calls.append(kw) or "executed", workdir, "bash"
    )
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "read")
    # contextvar 无 session_id 时账本查不到——显式以 s1 上下文验证放行语义
    from planify.skills.access_state import set_current_session_id
    token = set_current_session_id("s1")
    try:
        out = wrapped(command=f"cat {outside / 'a.txt'}")
    finally:
        from planify.skills.access_state import reset_current_session_id
        reset_current_session_id(token)
    assert out == "executed"


# ---- resolve_guarded_path（basic 结构化工具注入通路） ----


def test_resolve_guarded_path_outside_ungranted(workdir):
    p, err = resolve_guarded_path(r"C:\definitely-not-exist\x.md", workdir, True)
    assert p is None
    assert err.startswith("Error: 外部访问门禁")


def test_resolve_guarded_path_inside(workdir):
    p, err = resolve_guarded_path("a/b.md", workdir, True)
    assert err is None
    assert p == workdir / "a" / "b.md"


def test_resolve_guarded_path_after_grant(workdir):
    from planify.skills.access_state import set_current_session_id
    outside = Path(r"C:\definitely-not-exist") if sys.platform == "win32" \
        else Path("/definitely-not-exist")
    record_grant("s1", [outside], "write")
    token = set_current_session_id("s1")
    try:
        p, err = resolve_guarded_path(str(outside / "x.md"), workdir, True)
    finally:
        from planify.skills.access_state import reset_current_session_id
        reset_current_session_id(token)
    assert err is None
    assert p == outside / "x.md"


def test_resolve_guarded_path_allow_mode(workdir, monkeypatch):
    monkeypatch.setenv(GUARD_ENV, "allow")
    p, err = resolve_guarded_path(r"C:\definitely-not-exist\x.md", workdir, True)
    assert err is None
    assert p is not None


# ---- basic 工具双模式行为 ----


def test_make_basic_tools_default_keeps_hard_block(workdir, tmp_path):
    """guard_enabled=False（TUI/CLI 链路）：保留旧 safe_path 硬拒绝行为。"""
    from planify.tools.basic import make_basic_tools, run_read

    handlers = make_basic_tools(workdir, guard_enabled=False)
    out = handlers["read_file"](path=r"C:\definitely-not-exist\a.txt")
    assert out.startswith("Error:")
    assert "escapes workspace" in out
    # 函数直调同样保持旧行为（resolve 缺省）
    out2 = run_read(r"../../outside.txt", workdir)
    assert out2.startswith("Error:")


def test_make_basic_tools_guard_enabled_fail_closed(workdir):
    """guard_enabled=True（GUI 链路）：未授权外部路径 fail-closed 拒绝。"""
    from planify.tools.basic import make_basic_tools

    handlers = make_basic_tools(workdir, guard_enabled=True)
    out = handlers["write_file"](
        path=r"C:\definitely-not-exist\a.txt", content="x"
    )
    assert out.startswith("Error: 外部访问门禁")


# ---- 设置页配置链路（/api/config 通路） ----


def test_config_store_knows_guard_key():
    """KNOWN_KEYS 契约：设置页 GET/PUT 能带上门禁键。"""
    from doclens.web_v2.config_store import KNOWN_KEYS

    assert "PLANIFY_OUTSIDE_WORKDIR" in KNOWN_KEYS


@pytest.mark.parametrize("value", ["ask", "allow", "block", "ASK", "", "  "])
def test_validator_accepts_guard_modes(value):
    from doclens.web_v2.config_validator import validate_values

    errors = validate_values({"PLANIFY_OUTSIDE_WORKDIR": value})
    field_errors = [
        e for e in errors.fields if e.field == "PLANIFY_OUTSIDE_WORKDIR"
    ]
    assert field_errors == []


@pytest.mark.parametrize("value", ["yes", "true", "off", "deny"])
def test_validator_rejects_invalid_guard_mode(value):
    from doclens.web_v2.config_validator import validate_values

    errors = validate_values({"PLANIFY_OUTSIDE_WORKDIR": value})
    field_errors = [
        e for e in errors.fields if e.field == "PLANIFY_OUTSIDE_WORKDIR"
    ]
    assert len(field_errors) == 1
    assert "ask / allow / block" in field_errors[0].error
