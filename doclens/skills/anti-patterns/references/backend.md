# 后端栈反模式清单（Python 系 + MySQL/SQLite）

> 附件 B（references/backend.md）。**技术栈专属主判据·后端域**（含数据库层）。
> 两大典型栈组合（用户项目常见形态，按实际探测结果选用对应小节）：
> ① Python Web 框架栈（FastAPI/Flask/Django）+ SQLite
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
>
> 2026-10-25 增补「数据通路与规模」「外部调用与背压」两节并扩充
> Python/SQLite 节：来源为本仓提交史复盘（2026-10-16~25 共 95 项
> fix/perf/refactor 的根因归类），实证库 28.5 万文档——demo 语料上
> 增补条目全部隐形（规模盲区实证，见附件 A 横切层）。

## Python 语言层（所有 Python 后端通用）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| Mutable Default Argument | 默认参数在函数定义时求值一次并被所有调用共享——`def f(x, arr=[])` 的 arr 跨调用累积状态 | 签名里 `=[]`/`={}`/`=set()`；正确形态是 `=None` + 函数体内建 |
| 裸 except / 吞异常 | `except:` 连 KeyboardInterrupt 都吞，错误现场消失 | `except Exception: pass`；仅打 log 不上抛不处理 |
| 失败伪装成空结果 | 吞异常后返回 None/[] 继续走——上层无法区分「没数据」与「读失败」，降级决策建立在谎言上（Error Hiding 的数据层变体） | except 分支 return None/[]/默认值；调用方拿结果直接判空分支 |
| 循环 import（延迟 import 掩盖） | 模块环依赖用函数体内 import 绕开——环还在，只是藏进运行时 | 函数体内 `from x import y` 大量出现 |
| 全局可变单例当传参通道 | 模块级 dict/list 被多处读写——Action at a Distance 的 Python 形态 | module-level `cache = {}` 被非本模块改写 |
| `== None` / `is` 混用误判 | `==` 可被 `__eq__` 重载；身份判定必须 `is None` | `x == None` 出现于判空分支 |
| 字符串拼 SQL | SQL 注入面 + 无缓存计划 | f-string/% 拼 SQL 语句（参数化才是正道） |

## Web 框架层（FastAPI 为主，Flask/Django 同理项标注）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| Blocking the Event Loop | `async def` 端点内同步 I/O（文件读写/DB/CPU 重活）独占事件循环，整个服务冻结；sync `def` 端点反而自动进 threadpool | `async def` + 函数体无 await 但有同步 read/write/DB 调用；对照：最重的活（如图片处理）写了 def 而轻活写 async 即信号 |
| 形式 async 语义 sync | 端点声明 async 但函数体全同步——比真同步 def 更糟：不进 threadpool 还占事件循环。**audit 线索：一个 handler 的「声明形态」与「实际负载」相反即中招**（本仓实证：preview 端点 async def 读 10MB 文件+分词全同步，最重的 PIL rotate 反而因 def 正确） | `async def` 定义行与函数体之间无任何 await；机械扫描可先 grep async def 列表再逐个看体 |
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

## 数据通路与规模（数据搬运路径——demo 隐形、大库致命）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 全量拉取 + 客户端过滤 | 后端倒全表给前端、前端本地过滤——传输/内存/延迟随数据量线性爆炸，而消费方只要 top N（本仓实证：28.5 万条清单全量拉到前端，唯一消费方是搜索框本地过滤，110s 转圈 + 79MB 重复传输；服务端 LIKE 下推后 2s/29KB） | 列表端点无分页无 LIMIT；前端 store 收全量数组后再 `.filter()`；response 体积与库大小成正比 |
| 计算零消费方的数据 | 接口算出根本没人渲染的字段（pay for what you don't use）——计算成本照付、延迟照涨（实证：/status 每次全量 stat 28.5 万文件算 total_size，前端零渲染消费，冷启动 24s） | 响应字段在前端 grep 零消费；重计算字段无缓存也无降级 |
| 分页前全量加工 | 先对整个集合逐条构建完整对象（stat/resolve/权限），排序分页后只用当页 20-200 条——99% 计算花在丢弃的数据上（实证：16,898 条目录 3.7s，99% 花在当页 200 条以外） | 排序/分页之前出现 per-item 构建（stat+resolve+access）循环 |
| 逐条 syscall/点查代替批量 | 循环内逐条 stat/fetchone/单行 SELECT——N 次往返或 N 次 syscall（N+1 的文件系统形态；实证：57 万次 is_file+stat ~110s，scandir 按父目录批量化后 20.8s） | for 循环体内 `os.stat`/`fetchone`/单行 query；N+1 数据库条目是本条 SQL 形态 |
| 成本与整库成正比的「小查询」 | 看似点查实则全库扫（DISTINCT 子树徽标 ∝ 子树总行数；无覆盖索引的 COUNT 全表扫 + 大 blob 拖累页扫描） | EXPLAIN QUERY PLAN 出现 SCAN；「徽标/计数」类辅助查询无覆盖索引 |
| 冗余权威重验 | 写路径已保证的数据（DB 为权威），读路径每次重跑全量审计/全库 hash 比对——结论恒为「无变化」的纯浪费（实证：每次重载重跑全库审计，500k 文件分钟级） | reload/refresh 路径调用 full-audit/hash-scan；审计与写入无状态位区分 |
| 阻塞式冷启动信息 | 轻量状态接口为凑齐重字段挂起等分钟级初始化——首屏胶囊等 24s（正解：占位降级 + 后台预热 + 完成后补齐） | status 类端点内联等待 index/DB 全量 ready；无超时占位分支 |

## 外部调用与背压（LLM/网络/事件风暴）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 无墙钟上限的外部调用 | 只配了 SDK 默认 read 超时（按**字节间隔**计）——端点不关连接就永不触发，200 OK 后静默数十分钟，整轮对话/请求被钉死（实证：LLM 调用静默 24.7min，SDK read=600s 未触发） | httpx/openai/anthropic client 未显式设 timeout；流式调用无 asyncio.wait_for 墙钟；「挂死才暴露」的历史 issue |
| 旁路调用可钉死主流程 | 汇报/通知/埋点等旁路信息与主任务共用同步等待——旁路挂了主任务陪葬（正解：旁路超时即放弃 + 记 warning，主任务继续） | 主循环内对非关键汇报类 LLM/HTTP 调用无独立超时；超时后无「放弃汇报继续主任务」分支 |
| 无节流事件广播 | 文件变更/状态事件按原始粒度全量广播——git checkout 类风暴数千事件直接打满下游队列 | broadcast/emit 无 debounce/throttle；下游 asyncio.Queue/Channel 无界 |
| 无界队列缓冲 | 生产快于消费时队列无上限增长——内存缓慢上涨，长驻进程最终 OOM（背压缺失） | `asyncio.Queue()` 无 maxsize；channel/队列声明无容量参数 |
| 单一解析口径硬编码 | 外部响应归一化只认一个厂商的字段名/语义——换端点即恒错且**错得像正常**（实证：缓存命中率恒 0%，实为字段名不认 + 总数当增量双计，真实 96% 显示 48%） | 归一化函数只读一种字段名；换 provider 无兼容层；观测指标「恒定异常值」是本形态指纹 |

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

## SQLite / FTS5

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 每请求开关连接 | 连接建立 + PRAGMA 重放成本在热路径反复支付 | 请求处理函数内 `FTS5Index(db_path)` → close 模式 |
| 共享连接零锁串行化 | 单连接 `check_same_thread=False` 被多线程共享——隐式事务交叉提交/回滚出脏数据，游标消费期间连接状态变更抛 InterfaceError（本仓 AP-3：连接级 RLock 贯穿 + _LockedCursor 消费即释放） | 多线程共享同一 conn 对象且无锁；并发压测偶发 InterfaceError |
| `with conn:` 只 commit 不 close | sqlite3 连接上下文管理器是**事务**语义不是生命周期——32 处 with 全部把句柄留给 GC，WAL 残留 -wal/-shm 句柄随请求涨（本仓 AP-44：@contextmanager 包装 enter 连/exit commit+close） | `with self._conn() as conn` 底层是裸 Connection；进程句柄数缓慢上涨 |
| NOCASE 使前缀索引失效 | `LIKE 'prefix%'` 本可走索引范围扫，但 NOCASE 排序规则与 BINARY 索引不匹配，规划器弃用索引退化全表扫（实证：28.5 万行 500ms/次，改 GLOB 后 15-50ms） | EXPLAIN QUERY PLAN 显示 SCAN 而非 SEARCH ... USING INDEX；NOCASE 列上的 LIKE 前缀查询 |
| 同库多套连接生命周期并存 | 请求级开关、全局单例、模块自持三套并存——全局单例 close 时其他持有者凭空断连（本仓 AP-10：收敛为两套——请求级读 + TreeSearch 写自持） | 同一 db_path 存在 get_fts_index 类全局单例 + 请求级新开连接两种形态；单例 rebuild 时旧持有者断连 |
| 缺 WAL 模式 | 默认 journal 阻塞并发读写 | 连接处无 `PRAGMA journal_mode=WAL` |
| FTS5 大结果集 ORDER BY rank 全扫 | 百万行 rank 排序秒级 | 无 LIMIT 的 rank 查询；EXPLAIN QUERY PLAN 全表扫 |
| 写路径无事务包裹 | 逐条 autocommit = 每条一个 fsync | 批量插入未用 with/begin |
| 忽略 row factory | 手工元组下标取列，schema 变更即错位 | `row[3]` 类魔法下标 |

## 域内通用（后端批同时装载）

后端域分析同时装载附件 A 的「系统架构层 + 后端模块层」两节作兜底归类。

