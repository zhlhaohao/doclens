# 后端栈反模式清单（FastAPI + Pydantic v2 + uvicorn + SQLite/FTS5）

> 附件 B of anti-patterns 技能。**技术栈专属主判据·后端域**（含数据库层）。
> 来源（检索于 2026-10-20，复检时按 SKILL.md 第 2 步重新检索并更新本表）：
> - zhanymkanov/fastapi-best-practices（GitHub, 8k+★，含 AGENTS.md 反模式 checklist）
> - auth0《FastAPI Best Practices》(2026-01)
> - FastAPI 官方文档（async 路由 / 依赖注入 / response 序列化）
> - Pydantic v2 性能清单（TypeAdapter 复用/strict union/discriminator）
> - SQLite 官方 PRAGMA 指南、WAL 模式陷阱、FTS5 rank 性能讨论
>
> **用途纪律**：与附件 A 分域装载——审后端域时装载本表（先于通用透镜）；
> 每条发现必须绑定项目证据。栈清单是**起点不是全集**，开放式诊断允许
> 发现表外形态（归入台账新型态节）。

## FastAPI / uvicorn

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| Blocking the Event Loop | `async def` 端点内同步 I/O（文件读写/DB/CPU 重活）独占事件循环，整个服务冻结；sync `def` 端点反而自动进 threadpool | `async def` + 函数体无 await 但有同步 read/write/DB 调用；对照：最重的活（如图片处理）写了 def 而轻活写 async 即信号 |
| Endpoint calling Endpoint | 端点内 HTTP 自请求或 import 另一端点函数复用逻辑——绕过 service 层，测试/事务/鉴权全部错位 | httpx 指向自身；`from ..api.x import <endpoint fn>` |
| response_model 双重序列化 | 返回 Pydantic 对象再经 response_model 验证 → 模型构造两次（jsonable_encoder → 再 validate） | 端点显式构造 Response 模型对象返回；热路径上模型体积大 |
| Pydantic 逐字段手搬 | 用 `.dict()`/逐字段复制做转换——丢失验证与类型安全，正是 Pydantic 该干的活被手写 | `UserOut(**user.dict())` 模式散布 |
| BackgroundTasks 当任务队列 | 进程死即丢、无重试无可见性；秒级以上任务/需重试的任务不配 | 长任务/关键任务挂 bg.add_task |
| sync SDK 直调 | 异步路由内直接调同步 SDK（DB driver/HTTP client）阻塞循环 | 未用 run_in_threadpool / asyncio.to_thread 包裹 |
| 依赖滥用/缺依赖 | 每端点手写重复校验（存在性/权限），不用 Depends 链复用 | 同一 `get_x_or_404` 逻辑在 N 个端点复制 |
| 全局单 BaseSettings | 单一巨型配置类跨域混装；应按域拆分 | config.py 单类 >30 字段 |

## Pydantic v2

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 热路径反复构造 TypeAdapter/model_validate | 每次调用重编译 schema；应模块级缓存 adapter | 循环/每请求内 TypeAdapter(...) |
| union 无 discriminator | Pydantic 逐分支 try 验证，慢且报错模糊 | `Field(discriminator=...)` 缺失的多态 union |
| 压平 union 响应模型 | 多形态响应塞一个模型全 Optional——消费方靠判空理解，类型系统失效 | 响应模型 6+ 可选字段；判别逻辑散在 N 个消费方 |
| 内部数据搬运也过验证 | 内部已信任数据的转换/操作走完整验证——性能白付 | 内层循环 model_validate 已验证对象 |

## SQLite / FTS5

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 每请求开关连接 | 连接建立 + PRAGMA 重放成本在热路径反复支付 | 请求处理函数内 `FTS5Index(db_path)` → close 模式（本仓已知形态） |
| 缺 WAL 模式 | 默认 journal 阻塞并发读写（读阻塞写） | 启动/连接处无 `PRAGMA journal_mode=WAL` |
| FTS5 大结果集 ORDER BY rank 全扫 | 百万行 rank 排序秒级；应 LIMIT + 索引辅助 | 无 LIMIT 的 rank 查询；EXPLAIN QUERY PLAN 全表扫 |
| N+1 查询 | 循环内逐条查询（每邮件查附件）而非一次 IN/join | for 循环体内 execute |
| 写路径无事务包裹 | 逐条 autocommit = 每条一个事务一个 fsync | 批量插入未用 with/begin |
| 忽略 row factory | 手工元组下标取列，schema 变更即错位 | `row[3]` 类魔法下标 |

## 域内通用（后端批同时装载）

后端域分析同时装载附件 A 的「系统架构层 + 后端模块层」两节作兜底归类。
