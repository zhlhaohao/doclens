# 后端栈反模式清单（Python 系 + MySQL/SQLite）

> 附件 B of anti-patterns 技能。**技术栈专属主判据·后端域**（含数据库层）。
> 两大典型栈组合（用户项目常见形态，按实际探测结果选用对应小节）：
> ① Python Web 框架栈（FastAPI/Flask/Django）+ SQLite（本仓 doclens 形态）
> ② Python + MySQL + SQLAlchemy（用户其他项目常见形态）
> 来源（检索于 2026-10-20，复检时按 SKILL.md 第 2 步重新检索并更新本表）：
> - zhanymkanov/fastapi-best-practices（GitHub, 8k+★）；auth0《FastAPI Best Practices》
> - Python 官方 gotchas（python-guide《Common Gotchas》）；SQLAlchemy 2.x 官方 pooling/session 文档
> - PlanetScale《MySQL for Developers》（indexing joins）；SQL 反模式合集（N+1/NULL/SELECT *）
> - SQLite 官方 PRAGMA 指南、WAL 模式陷阱、FTS5 rank 性能讨论
>
> **用途纪律**：与附件 A 分域装载——审后端域时装载本表（先于通用透镜）；
> 每条发现必须绑定项目证据。栈清单是**起点不是全集**，开放式诊断允许
> 发现表外形态（归入台账新型态节）。

## Python 语言层（所有 Python 后端通用）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| Mutable Default Argument | 默认参数在函数定义时求值一次并被所有调用共享——`def f(x, arr=[])` 的 arr 跨调用累积状态 | 签名里 `=[]`/`={}`/`=set()`；正确形态是 `=None` + 函数体内建 |
| 裸 except / 吞异常 | `except:` 连 KeyboardInterrupt 都吞，错误现场消失 | `except Exception: pass`；仅打 log 不上抛不处理 |
| 循环 import（延迟 import 掩盖） | 模块环依赖用函数体内 import 绕开——环还在，只是藏进运行时 | 函数体内 `from x import y` 大量出现 |
| 全局可变单例当传参通道 | 模块级 dict/list 被多处读写——Action at a Distance 的 Python 形态 | module-level `cache = {}` 被非本模块改写 |
| `== None` / `is` 混用误判 | `==` 可被 `__eq__` 重载；身份判定必须 `is None` | `x == None` 出现于判空分支 |
| 字符串拼 SQL | SQL 注入面 + 无缓存计划 | f-string/% 拼 SQL 语句（参数化才是正道） |

## Web 框架层（FastAPI 为主，Flask/Django 同理项标注）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| Blocking the Event Loop | `async def` 端点内同步 I/O（文件读写/DB/CPU 重活）独占事件循环，整个服务冻结；sync `def` 端点反而自动进 threadpool | `async def` + 函数体无 await 但有同步 read/write/DB 调用；对照：最重的活（如图片处理）写了 def 而轻活写 async 即信号 |
| Endpoint calling Endpoint | 端点内 HTTP 自请求或 import 另一端点函数复用逻辑——绕过 service 层，测试/事务/鉴权全部错位 | httpx 指向自身；`from ..api.x import <endpoint fn>` |
| response_model 双重序列化 | 返回 Pydantic 对象再经 response_model 验证 → 模型构造两次 | 端点显式构造 Response 模型对象返回；热路径上模型体积大 |
| BackgroundTasks 当任务队列 | 进程死即丢、无重试无可见性 | 长任务/关键任务挂 bg.add_task（Django 同理：delay 到死循环脚本） |
| sync SDK 直调 | 异步路由内直接调同步 DB driver/HTTP client 阻塞循环 | 未用 run_in_threadpool / asyncio.to_thread 包裹 |
| 依赖滥用/缺依赖 | 每端点手写重复校验（存在性/权限），不用 DI 链复用 | 同一 `get_x_or_404` 逻辑在 N 个端点复制 |
| 全局单 BaseSettings | 单一巨型配置类跨域混装 | config.py 单类 >30 字段 |

## Pydantic v2

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 热路径反复构造 TypeAdapter | 每次调用重编译 schema；应模块级缓存 | 循环/每请求内 TypeAdapter(...) |
| union 无 discriminator | 逐分支 try 验证，慢且报错模糊 | 多态 union 缺 `Field(discriminator=...)` |
| 压平 union 响应模型 | 多形态响应塞一个模型全 Optional——类型系统失效 | 响应模型 6+ 可选字段；判别逻辑散在 N 个消费方 |
| 内部数据搬运也过验证 | 已信任数据走完整验证——性能白付 | 内层循环 model_validate 已验证对象 |

## MySQL + SQLAlchemy（用户常见栈）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| Session 泄漏 | session 不关闭 → 连接池耗尽，三周后才以随机 500 爆出（FastAPI+SQLAlchemy 最难诊断的失败模式） | 手动 Session() 无 with/finally；依赖注入缺 yield 清理 |
| 每请求新建 engine | engine 含连接池应进程级单例；每请求建 = 池失效 + 连接风暴 | 模块函数内 create_engine() |
| N+1 查询 | 取 N 行循环内逐条查关联——N+1 次往返 | for 循环体内 session.query/execute（ORM 的 lazy load 隐式触发同理） |
| SELECT * 生产环境 | 拉全列：payload 大、覆盖索引失效、schema 变更即断 | `SELECT *` 无明确列清单 |
| 索引列上包函数 | `WHERE DATE(created)=...` 使索引失效（index obfuscation），全表扫 | WHERE/JOIN 条件对列套函数/运算 |
| JOIN 键无索引 | 驱动表逐行探测被join表全扫 | EXPLAIN 出现 type=ALL 的被驱动表 |
| LEFT JOIN 当 INNER 用 / 用 JOIN 判存在 | 只需判存在却 join 全表（应 EXISTS 半连接）；多余的 LEFT 丢行 | `LEFT JOIN ... WHERE 右表.id IS NOT NULL` 模式 |
| NULL 当普通值 | `= NULL` 永假（须 IS NULL）；NULL 参与索引/统计的坑 | 判空用 `= NULL`；唯一索引列可多 NULL |
| 隐式类型转换 | 字符串列与数字比较 → 每行 CAST，索引失效 | WHERE str_col = 123（列是 varchar） |
| 循环逐条 INSERT | 每条一个事务一个 fsync | 批量导入走 for + 单条 insert（应 executemany/bulk） |

## SQLite / FTS5（本仓 doclens 形态）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 每请求开关连接 | 连接建立 + PRAGMA 重放成本在热路径反复支付 | 请求处理函数内 `FTS5Index(db_path)` → close 模式（本仓已知形态） |
| 缺 WAL 模式 | 默认 journal 阻塞并发读写 | 连接处无 `PRAGMA journal_mode=WAL` |
| FTS5 大结果集 ORDER BY rank 全扫 | 百万行 rank 排序秒级 | 无 LIMIT 的 rank 查询；EXPLAIN QUERY PLAN 全表扫 |
| 写路径无事务包裹 | 逐条 autocommit = 每条一个 fsync | 批量插入未用 with/begin |
| 忽略 row factory | 手工元组下标取列，schema 变更即错位 | `row[3]` 类魔法下标 |

## 域内通用（后端批同时装载）

后端域分析同时装载附件 A 的「系统架构层 + 后端模块层」两节作兜底归类。

