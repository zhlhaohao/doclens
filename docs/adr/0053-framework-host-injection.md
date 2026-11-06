# ADR-0053: 框架↔宿主的装配改为纯注入（消除运行时反向依赖）

- 状态：已接受
- 日期：2026-11-06
- 关联决议：ADR-0043（工作目录热切换）、CLAUDE.md「模块边界（红线）」规则 1 / 3 / 5

## 背景

`planify/core/logging_config.py` 里有一段：

```python
if _data_dirname == ".cortex":
    import importlib
    _host_cfg = importlib.import_module("doclens.config")   # ← 反向探测宿主
    _host_dd = getattr(_host_cfg, "data_dirname", None)
    if callable(_host_dd):
        register_data_dirname(_host_dd())
```

注释自辩「用 importlib 按名探测而非静态 import——planify 对宿主保持零静态
依赖（架构红线：底层不得 import 高层）」。**这个自辩是错的**：importlib 只是
把静态依赖藏进字符串，运行时依赖（框架知道宿主模块名、会去 import 它）照旧
成立。红线 1 保护的是**依赖方向**，不是依赖的**书写形式**。

这段代码存在的原因是历史包袱，不是设计：

1. **planify 需要两样宿主才知道的东西**——数据目录名（`.cortex` /
   `.doclens`）与 `.env` 的位置（`~/<数据目录>/.env` + `{cwd}/<数据目录>/.env`）。
   框架无从得知，于是去反查宿主。
2. **启动序颠倒的补丁**（2026-10-09 事故）：发行版 GUI 读了 `~/.cortex/.env`
   的 `CORTEX_WEB_PORT`（7860），压过自己的 `~/.doclens/.env`（8000）。根因是
   planify 侧回退 `.cortex` 且抢先加载了错目录的 .env。这段 importlib 探测是
   当时打的**症状补丁**——真正的正解是让宿主在装配期就把口径注入给框架。

同期的命名空间越界：planify 直接读 `CORTEX_LOG_LEVEL` / `CORTEX_LOG_DIR`
——CLAUDE.md 规则 3 明写「底层不碰 `CORTEX_*`」，这同样是越界（只是方向
较轻：读一个键，不是 import 一个模块）。

`tests/test_architecture.py` 的红线 1 只查**静态 import**（正则匹配
`import X` / `from X import`），抓不到 importlib 这条路——所以问题一直没被
守卫拦住。

## 决策

### 1. 纯注入：宿主主动注册，框架被动接收

框架侧新增两个扩展点（`planify/core/logging_config.py`）：

| 扩展点 | 作用 | 契约 |
|---|---|---|
| `register_data_dirname(name)` | 注入数据目录名 | 必须在首次 `data_dirname()` 消费前调用；后调用覆盖先调用 |
| `register_env_loader(loader)` | 注入 `.env` 加载回调 | `loader() -> None`；框架进程内至多调用一次；回调自行决定加载哪些文件、什么 override 语义 |

宿主侧（`doclens/config.py` 模块级，**唯一真相源**）：

```python
_reg_dd(_dirname)                 # 数据目录名
_reg_loader(_load_host_env_files) # .env 加载回调
```

框架**不再知道**宿主是谁：不再 import 宿主模块、不再出现宿主模块名、不再
读宿主命名空间前缀。

### 2. `.env` 加载归宿主

`~/<数据目录>/.env` 与 `{cwd}/<数据目录>/.env` 的位置与加载顺序是**宿主
的约定**，框架无从得知。收敛到宿主后：

- 宿主 loader 按「全局 → 项目（覆盖全局）」加载，`override=True`；
- 框架自身的 `.env` 约定另走 `.planify/.env`（`planify.core.config.get_config`
  既有逻辑，不动）；
- 框架未注册 loader 时**不加载任何 .env**（planify 独立运行语义）。

### 3. 命名空间映射：宿主键 → 框架键

用户可见开关名不变（`.env` 里仍是 `CORTEX_LOG_LEVEL` / `CORTEX_LOG_DIR`，
见 `.env.example` 与 `docs/doclens-config-parameters.md`），但宿主在 loader
里做一次性映射到框架命名空间：

```
CORTEX_LOG_LEVEL → PLANIFY_LOG_LEVEL
CORTEX_LOG_DIR   → PLANIFY_LOG_DIR
```

宿主键优先（用户配的生效），未配时框架键兜底（planify 独立运行）。这样
planify 侧代码不再出现 `CORTEX_*`——规则 3 真正落地，而用户配置口径不变。

### 4. 框架中性回退值

未注入时 `data_dirname()` 回退 `".planify"`（框架自己的命名空间），**不再**
回退 `".cortex"`（宿主的目录名）。框架层不该知道宿主的数据目录叫什么，
哪怕只是个字符串常量。

### 5. 启动序：宿主先注册

`doclens.config` 必须先于 `setup_logging()` 导入。已在三处入口确认/加固：

- `doclens/cortex_cli.py`（`main()` 与 `_cli_gui()`）——原有注释已说明
  顺序要求，措辞更新为新的注入语义；
- `doclens/tui/app.py`——**新发现**：此处 `setup_logging()` 在
  `from doclens.config import ...` **之前**执行，过去靠 importlib 探测
  兜住（探测能拿到目录名，但拿不到宿主 loader）。已改为先 import
  `doclens.config` 触发注册。

## 后果

- **红线 1 真正闭合**：`planify` 现在对 `doclens` 零静态依赖、零动态依赖、
  零代码级宿主名。
- **守卫补漏**：`tests/test_architecture.py` 新增三条——
  1. `test_no_dynamic_import_of_high_level`：AST 扫描，禁底层用
     `importlib.import_module` / `__import__` / `find_spec` 指向高层包
     （标准库动态 import 如 `__import__("time")` 不误伤）；
  2. `test_framework_does_not_name_the_host`：禁框架层**可执行字符串**里出现
     宿主模块名（docstring/注释不算——那是解释不是依赖）；
  3. `test_framework_does_not_read_host_namespace`：禁框架层读宿主配置命名
     空间（`os.environ["CORTEX_*"]` / `os.environ.get("CORTEX_*")` /
     `os.getenv("CORTEX_*")`）——规则 3「底层不碰 `CORTEX_*`」此前无守卫，
     planify 读 `CORTEX_LOG_LEVEL` 一直无人拦。
  三条都以「把原 bug 塞回去，守卫必须报」验证过。
- **守卫扫描范围修正**：`_py_sources()` 排除 `build/` 目录——setuptools
  构建产物是源码快照（gitignored），扫它会命中已修掉的旧代码。
- **行为等价**：数据目录名、`.env` 加载顺序、override 语义、启动序均与改前
  一致；`CORTEX_LOG_LEVEL` 等用户可见配置项语义不变。
- **planify 独立运行**：`setup_logging()` 不再自行找 `.env`——独立运行时由
  `planify.core.config.get_config()` 走 `.planify/.env` 约定。
- **新增扩展点而非删除能力**：框架若将来需要宿主的别的能力（如工作目录），
  按同一模式再加一个 `register_*`，而不是再长一个 importlib 探测。

## 验证

- `tests/test_architecture.py`（8 passed）——含两条新守卫。
- `tests/test_planify_injection.py`（10 passed，新增）——注入契约：目录名
  注入/回退/覆盖、loader 幂等/异常 fail-open/未注册不加载、宿主侧注册内容
  与命名空间映射、宿主 loader 读两份 .env（项目覆盖全局）。
- 端到端实测：`import doclens.config` 后 `planify` 拿到 `.cortex` 目录名与
  loader；loader 能读出 `PLANIFY_MODEL_ID` / `CORTEX_WEB_PORT`；`CORTEX_LOG_LEVEL`
  能映射到 `PLANIFY_LOG_LEVEL` 并被 `_resolve_log_level` 正确解析。
