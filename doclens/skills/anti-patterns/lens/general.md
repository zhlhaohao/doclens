# 通用反模式形态透镜（兜底词汇表）

> 附件 A（lens/general.md）。跨技术栈经典形态，来源：Wikipedia《List
> of software anti-patterns》/ Fowler《Refactoring》（refactoring.guru）/
> microservices.io / Node.js 官方事件循环指南。
>
> **用途纪律**（同 SKILL.md 第 2 步）：这是**透镜与归类词汇表，不是
> checklist**——主判据是技术栈专属清单（见 lens/ 下栈清单附件），本表用于归类
> 栈清单未覆盖的发现。每条发现必须绑定项目证据（文件:行号 + 为什么
> 在此架构中构成问题）。**分域装载**：审后端域时只读后端/架构两节，
> 审前端域时只读前端/组件两节——不整表灌入。

## 系统架构层

| 形态 | 定义 | 检测线索 |
|---|---|---|
| Big Ball of Mud | 无清晰结构的系统整体，边界随意穿透 | 模块间调用无规律；"哪都能 import 哪" |
| Circular Dependency | 模块互引成环 | import 图谱成环；构建工具告警 |
| Distributed Monolith | 拆了进程/服务却保留单体耦合（同步链路、共享库、共库表） | 服务间同步调用链；共享数据库（Data Monolith） |
| Stovepipe System | 各子系统自成孤岛、互不复用、集成靠点对点 | 同类能力多处各造；集成点碎片化 |
| Abstraction Inversion | 高层被迫重新实现/内联底层细节 | 高层代码复制底层逻辑绕过接口 |
| Inner-Platform Effect | 系统复刻了它运行平台的既有能力 | 自研配置系统/查询语言/调度器，重造平台轮子 |

## 后端模块层

| 形态 | 定义 | 检测线索 |
|---|---|---|
| Long Method | 单函数集过多职责，内部有可各自命名的阶段（校验/取数/变换/组装） | 函数体需滚动或分段注释才读懂；Fowler Bloaters 家族；重构手法 = Extract Method |
| Long Parameter List | 参数表臃肿，调用方难以正确组装 | 参数 ≥5 且多为同型 primitive（与 Primitive Obsession 互为表里） |
| God Object | 单类/单文件集过多职责，什么都知道什么都管 | 行数 + 公共方法数 + "改任何功能都 touch 它"（Fowler: Divergent Change 的变体） |
| Shotgun Surgery | 一个改动要同时散改多处 | git log 里同一 feature 的 commit 横跨 N 个不相关文件 |
| Divergent Change | 一个类因多种不同原因被反复改 | 类的变更原因数 >1（与 Shotgun Surgery 互为镜像） |
| Blocking the Event Loop | 异步运行时内在事件循环线程执行同步阻塞调用 | `async def` 内同步文件 I/O / 重 CPU / 长锁；Node.js/uvicorn 单线程全员冻结 |
| Anemic Domain Model | 数据与行为分离：对象只有字段，逻辑全在过程式服务里 | model 层纯 getter/setter；业务规则堆在 util/service |
| Error Hiding | 捕获后吞掉、返回默认值或空 catch | `except: pass`；`catch {}`；失败被缓存（Caching Failure） |
| Magic Numbers / Magic Strings | 未命名的裸字面量散布逻辑含义 | 同一数字/字符串多处硬编码；Soft Code（过度配置化）是其反面 |
| Lava Flow | 死代码无人敢删，凝固成"历史的一部分" | "不知道为什么在这但删了怕炸"；无测试覆盖的遗留块 |

## 前端模块层

| 形态 | 定义 | 检测线索 |
|---|---|---|
| Prop Drilling | 数据穿过多层不关心的中间组件层层下传 | 中间组件只为转发而存在的 props |
| Copy-and-Paste Programming | 同构代码多份复制而非抽象，各自演化漂移 | 同名方法 N 文件重复；已现行为分裂即实证 |
| Smart/Dumb Component Imbalance | 展示组件内混业务/数据逻辑，或容器组件反复手搓取数 | dumb 组件里 fetch/store 访问；同类样板 N 份（业务逻辑泄漏） |
| Duplicated State Source | 同一状态多处持有，靠手工同步 | 本地 state 与全局 store/URL 各存一份；"闪回"类历史 bug |
| Yo-yo Problem | 继承/组合层级过深，理解一处要上下横跳 N 层 | 追一个调用穿过 >3 层抽象 |
| Hard Code | 该外置的环境/配置值写死在源码 | URL/路径/魔法阈值散布；与配置体系脱节 |

## 组件层

| 形态 | 定义 | 检测线索 |
|---|---|---|
| Interface Bloat | 组件/接口暴露面过大，多数调用方只用小半 | props/参数 ≥10；多数用法只传 2-3 个 |
| Feature Envy | 组件对别的组件/模块的数据比对自己的更感兴趣 | 大量读他人内部状态再本地计算 |
| Primitive Obsession | 该建领域类型处全用裸 string/int/bool 传参 | 状态用裸枚举串表示；参数表一串同型 primitive |
| Dead Props / Dead Styles | 声明存在但无任何调用方传值/无匹配元素 | prop 链路三层断中段；CSS 选择器无匹配 |
| Poltergeist | 仅为传一手而存在的短命中间组件 | 创建→转发→销毁，无自身逻辑 |

## 功能层

| 形态 | 定义 | 检测线索 |
|---|---|---|
| Busy Waiting | 轮询检查条件而非事件驱动 | setInterval 轮询本可由事件/回调触发的状态 |
| Action at a Distance | 一处改动在意料之外的远处产生效果 | 隐式全局联动；调试要全仓搜"谁还监听了它" |
| Race Hazard | 行为正确性取决于不可控时序 | 未防护的并发写；先发请求后到响应的时序假设 |
| Premature Optimization | 无 profile 依据的猜测性优化 | 无实测数据的"性能"代码；以可读性换不可证收益 |
| DRY Misuse (Wrong Abstraction) | 为消除重复把偶然相似的本质不同强行合一 | 错误抽象；改 A 坏 B（wrong abstraction 比 duplication 贵） |

## 演进纪律

**新型态**：项目特有、上表无法归类的形态，在审计台账单列「新型态」节
描述（形态名自拟 + 定义 + 证据）——这是开放式诊断的出口。新形态被多次
实证后可晋升入本表（条目须标注来源与首次实证的台账路径）。
