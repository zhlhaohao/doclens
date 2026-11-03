---
theme: corporate-blue
size: "16:9"
title: 把方向盘拿回自己手里 — 自研 AI Coding Agent
author: 部门技术汇报
anim: none
transition: fade
---

<!-- slide: layout=title notes="各位领导好。今天我想用十五分钟，汇报一件我们已经做成的事——一套完全自主的 AI 编程助理。先说结论：它已经在我们团队的真实开发中跑起来了，今天不是来提方案的，是来展示成果的。在开始之前，请大家想三个问题：我们现在用的工具确实好用，但代码流向了哪里？会话记录能不能审计？如果明天它停服或者改价，我们怎么办？这三个问题，决定了我们能不能长期依赖一个工具。" -->

# 把方向盘拿回自己手里

### 自研 AI Coding Agent：本地优先，模型可插拔

部门技术汇报 · 2026-10

<!-- slide: layout=grid kicker="00 · 它是什么" takeaway="**对标 Claude Code 的自研编程代理，日常开发实测可替代**" notes="先花三十秒认识它。doclens 是一个个人编程助理，和 Claude Code 是同类产品，但形态完全不同——它是一个网页，不是黑色的终端窗口。这意味着不用记命令：测试、文档岗的同事打开浏览器就能用。它内置了代码仓库的文件管理，上传、重命名、看改动，全部图形化操作。它的前端从第一天就按手机适配来设计，桌面端有的功能手机上全都有。经过这段时间的真实使用，日常开发中的编码、调试、重构、写文档，它都能胜任。" -->

# doclens：给每个人的编程助理

| | |
|---|---|
| **网页界面** | 浏览器打开即用，不是黑色终端——多会话标签、贴图提问、diff 可视，PWA 可装桌面 |
| **内置文件管理** | 代码仓库在页面内可视管理：树状目录、上传/重命名/移动、未提交改动视图 |
| **生而手机友好** | 前端第一天按移动优先设计，桌面端功能手机全有：搜索/对话/预览/文件管理 |
| **实测可替代** | 编码、调试、重构、文档等日常开发场景实测覆盖；模型可插拔，可接内网 |

<!-- slide: layout=blank kicker="02 · 实貌" anim=none notes="接下来这一组都是我们产品的真实截图，不是设计稿。先看桌面端三个核心界面，再看手机端实拍——同一个应用，全端可用。" -->

<!-- block: x=5.6% y=4% w=88.8% h=16% -->

# 真实界面，不是设计稿

<!-- block: x=5.6% y=22% w=88.8% h=8% color=text anim=enter.fade trigger=after delay=0.4 -->

七页实拍：桌面主界面 · 文件管理 · AI 编码 · 手机端四连拍

<!-- slide: layout=blank bg=bg kicker="02 · 实貌 1/7" bg=#1e2229 anim=none notes="这一页是主界面：打开就是一个提问入口，下面是最近的工作会话——它像一个每天见面的助理，而不是一个冷冰冰的搜索引擎。" -->

<!-- block: x=13.75% y=5% w=72.5% h=85% fit=cover style=laptop anim=enter.fly-in direction=up trigger=after delay=0.3 -->

![P4-图1 主界面](images/shot1-main.png)


<!-- block: x=12% y=93% w=76% h=6% bg=bg anim=enter.fly-in direction=left trigger=after delay=1.0 banner=frag -->

**个人助手主界面**——中间提问入口，下方最近会话，打开即用

<!-- slide: layout=blank bg=bg kicker="02 · 实貌 2/7" bg=#1e2229 anim=none notes="文件管理页。整个代码仓库在浏览器里就能看：左边是目录树，右边点开任何一个文件，源码直接预览。您现在看到的，是我们项目真实的配置文件。日常的文件操作，不用切回终端。" -->

<!-- block: x=13.75% y=5% w=72.5% h=85% fit=cover style=laptop anim=enter.fly-in direction=up trigger=after delay=0.3 -->

![P5-图1 文件管理](images/shot2-files.png)


<!-- block: x=12% y=93% w=76% h=6% bg=bg anim=enter.fly-in direction=left trigger=after delay=1.0 banner=frag -->

**代码仓库可视管理**——树状目录、未提交改动、点击即预览源码

<!-- slide: layout=blank bg=bg kicker="02 · 实貌 3/7" bg=#1e2229 anim=none notes="这一页是 AI 编码的实况。屏幕上是一个真实任务——我们在开发一个文生图服务。可以看到 AI 的每一轮回答下面，它调用了什么工具、读了哪些文件，全部以可展开的记录呈现。AI 每一步做了什么，全程可见，不是黑箱。" -->

<!-- block: x=13.75% y=5% w=72.5% h=85% fit=cover style=laptop anim=enter.fly-in direction=up trigger=after delay=0.3 -->

![P6-图1 AI 编码](images/shot3-chat.png)


<!-- block: x=12% y=93% w=76% h=6% bg=bg anim=enter.fly-in direction=left trigger=after delay=1.0 banner=frag -->

**AI 编码实战**——真实任务：开发即梦文生图 MCP server，全程可追溯

<!-- slide: layout=blank bg=#1e2229 kicker="02 · 实貌 4/7" anim=none notes="手机实拍一：左边是助手首页，右边是真实开发会话——同一个应用，手机上完整可用。" -->

<!-- block: x=21% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=0.6 -->

![P7-图1 助手首页](images/mob-1-chat-initial.png)

<!-- block: x=56% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=1.0 -->

![P7-图2 会话聚焦](images/mob-2-chat-focus.png)

<!-- block: x=5% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.4 -->

助手首页

<!-- block: x=80% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.5 -->

会话聚焦

<!-- block: x=12% y=88% w=76% h=7% bg=bg anim=enter.fly-in direction=left trigger=after delay=1.6 banner=frag -->

**手机端完整可用**

<!-- slide: layout=blank bg=#1e2229 kicker="02 · 实貌 5/7" anim=none notes="手机实拍二：左边是会话信息对话框——上下文占用、缓存命中率一目了然；右边是模型配置，随时切换。" -->

<!-- block: x=21% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=0.6 -->

![P8-图1 会话信息](images/mob-8-session-info.png)

<!-- block: x=56% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=1.0 -->

![P8-图2 模型配置](images/mob-3-settings-model.png)

<!-- block: x=5% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.4 -->

会话信息

<!-- block: x=80% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.5 -->

模型配置

<!-- block: x=12% y=88% w=76% h=7% bg=bg anim=enter.fly-in direction=left trigger=after delay=1.6 banner=frag -->

**每一步都可量化**

<!-- slide: layout=blank bg=#1e2229 kicker="02 · 实貌 6/7" anim=none notes="手机实拍三：技能管理与 MCP 服务器配置——生态能力在手机上同样开放。" -->

<!-- block: x=21% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=0.6 -->

![P9-图1 技能管理](images/mob-4-settings-skills.png)

<!-- block: x=56% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=1.0 -->

![P9-图2 MCP 连接](images/mob-5-settings-mcp.png)

<!-- block: x=5% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.4 -->

技能管理

<!-- block: x=80% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.5 -->

MCP 连接

<!-- block: x=12% y=88% w=76% h=7% bg=bg anim=enter.fly-in direction=left trigger=after delay=1.6 banner=frag -->

**生态随身携带**

<!-- slide: layout=blank bg=#1e2229 kicker="02 · 实貌 7/7" anim=none notes="手机实拍四：文件管理与深色代码预览——移动优先是第一天的架构决策。" -->

<!-- block: x=21% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=0.6 -->

![P10-图1 文件管理](images/mob-6-files.png)

<!-- block: x=56% y=5% w=23% h=85% fit=cover style=device anim=enter.fly-in direction=up trigger=after delay=1.0 -->

![P10-图2 深色预览](images/mob-7-preview-dark.png)

<!-- block: x=5% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.4 -->

文件管理

<!-- block: x=80% y=43% w=15% h=7% bg=dark align=center anim=enter.fade trigger=after delay=1.5 -->

深色预览

<!-- block: x=12% y=88% w=76% h=7% bg=bg anim=enter.fly-in direction=left trigger=after delay=1.6 banner=frag -->

**文档随行阅读**

<!-- slide: layout=blank kicker="03 · 方案" takeaway="**四层全自有，唯一外联是可替换的模型接口**" notes="我们的答案是这张分层图：从上到下四层——界面、宿主、AI 框架、索引引擎——每一层都是我们自己写的，名字和职责都叫得出来、改得动。索引、会话、记忆全部落在本地磁盘。底下这条线就是内网边界：唯一穿过它的，是右下角这个可替换的模型接口——可以指向内网，可以换国产，也可以用 Anthropic。动画顺序：四层从上到下逐层落下，边界线最后划出，模型接口行最后飞入。" -->

<!-- block: x=5.6% y=6% w=88.8% h=9% -->

# 系统架构图



<!-- block: x=6% y=18% w=88% h=8.5% bg=#e3ecf6 anim=enter.fly-in direction=left trigger=after delay=0.3 -->

**Web 界面**——浏览器即用 · PWA 可装桌面与手机（Lit + Vite）

<!-- block: x=9% y=31.5% w=82% h=8.5% bg=#e3ecf6 anim=enter.fly-in direction=left trigger=after delay=0.55 -->

**宿主层**——会话 / 备份 / 文件管理 / 权限门禁（FastAPI + SSE）

<!-- block: x=12% y=41% w=76% h=8.5% bg=#e3ecf6 anim=enter.fly-in direction=left trigger=after delay=0.8 -->

**AI 框架**——agent 主循环 / 上下文压缩 / 技能（自研 planify）

<!-- block: x=15% y=50.5% w=70% h=8.5% bg=#e3ecf6 anim=enter.fly-in direction=left trigger=after delay=1.05 -->

**索引引擎**——全文检索 / 结构感知（自研 treesearch · SQLite FTS5）

<!-- block: x=6% y=60.5% w=88% h=2% bg=accent anim=enter.wipe trigger=after delay=1.4 -->

　

<!-- block: x=6% y=63.5% w=88% h=9.5% bg=dark anim=enter.fly-in direction=up trigger=after delay=1.7 -->

**模型接口**——唯一外联点 · 可替换：内网 / 国产 / Anthropic 任选

<!-- block: x=6% y=74.5% w=88% h=15% anim=enter.fade trigger=after delay=2.0 -->

索引、会话、记忆全部落在本地磁盘——这条线以内，数据不出你的电脑。

<!-- slide: layout=blank kicker="03 · 对等" takeaway="**先追平，再谈不同——迁移成本接近零**" anim=none source="功能项基于本仓源码逐项核对" notes="有人会问：自研的，会不会是个玩具？这面墙十二项一次回答——Claude Code 用户最熟悉的能力，我们全都有：对话改代码、深度代码库理解、任务清单、CLAUDE.md 兼容、子代理并行、MCP 生态、技能系统、斜杠命令、危险操作确认；还有 Checkpoint 改错回退、Plan 规划——在我们这是一个内置技能，追问打磨方案、产出架构决策记录；超长对话压缩。特别看第二行第一张：CLAUDE.md 兼容，团队沉淀的规范文件一个字不用改直接用。到这里只是追平，真正的不同在后面。" -->

<!-- block: x=5.6% y=6% w=88.8% h=9% -->

# Claude Code 有的，我们都有

<!-- block: x=3.5% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.30 -->

<i data-icon="message"/> **对话即编程**
说需求就动手

<!-- block: x=27% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.42 -->

<i data-icon="search"/> **深度代码库理解**
结构感知索引

<!-- block: x=50.5% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.54 -->

<i data-icon="list"/> **任务清单跟踪**
步骤看得见

<!-- block: x=74% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.66 -->

<i data-icon="users"/> **子代理并行**
大任务拆小

<!-- block: x=3.5% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.78 -->

<i data-icon="file-text"/> **CLAUDE.md 兼容**
存量直接用

<!-- block: x=27% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.90 -->

<i data-icon="network"/> **MCP 生态**
工具即插即用

<!-- block: x=50.5% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.02 -->

<i data-icon="package"/> **技能系统**
Markdown 即技能

<!-- block: x=74% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.14 -->

<i data-icon="zap"/> **斜杠命令**
调用对应技能

<!-- block: x=3.5% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.26 -->

<i data-icon="shield"/> **危险操作确认**
不点头不动手

<!-- block: x=27% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.38 -->

<i data-icon="repeat"/> **Checkpoint 回退**
改错随时退

<!-- block: x=50.5% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.50 -->

<i data-icon="target"/> **Plan 规划先行**
技能打磨方案

<!-- block: x=74% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.62 -->

<i data-icon="layers"/> **超长对话压缩**
不丢关键

<!-- slide: layout=blank kicker="04 · 差异" takeaway="**它结构性给不了的，我们天生就有**" anim=none notes="对等之外，这面墙是真正的不同——十二项，每一项都是 Claude Code 结构上给不了的。头两张连着讲：全端可用——手机浏览器里装上就像个 App，功能一个不少；工作接力——半路换到手机上接着干，进度不丢。数据侧：文件全在自己电脑里、没有任何上报代码，闭源云服务做不到；每一步做了什么都有记录、随时能查；自动备份，数据坏了能找回；聊天记录整个导出带走。AI 自动记忆——它真的记得你。模型随便换——国产模型填个地址就能用。技能两边通用、源码全自有、文档变技能、网页里直接改代码——自己的代码才做得出的自由。语气讲事实，不贬对方。" -->

<!-- block: x=5.6% y=6% w=88.8% h=9% -->

# CC 给不了的，我们有

<!-- block: x=3.5% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.30 -->

<i data-icon="globe"/> **全端可用**
手机装上像 App

<!-- block: x=27% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.42 -->

<i data-icon="refresh"/> **工作接力**
半路换手机接着干

<!-- block: x=50.5% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.54 -->

<i data-icon="lock"/> **数据不出本机**
文件全在自己电脑

<!-- block: x=74% y=18% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.66 -->

<i data-icon="eye"/> **过程全有记录**
做了什么都能查

<!-- block: x=3.5% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.78 -->

<i data-icon="database"/> **自动备份**
数据坏了能找回

<!-- block: x=27% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=0.90 -->

<i data-icon="package"/> **聊天记录可带走**
整个导出随时迁

<!-- block: x=50.5% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.02 -->

<i data-icon="lightbulb"/> **AI 自动记忆**
它真的记得你

<!-- block: x=74% y=43% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.14 -->

<i data-icon="zap"/> **模型随便换**
国产模型填地址就用

<!-- block: x=3.5% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.26 -->

<i data-icon="repeat"/> **技能两边通用**
社区技能直接装

<!-- block: x=27% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.38 -->

<i data-icon="code"/> **源码全自有**
需求变了自己改

<!-- block: x=50.5% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.50 -->

<i data-icon="file-text"/> **文档变技能**
写好说明书就能用

<!-- block: x=74% y=68% w=22.5% h=22% bg=#e3ecf6 align=center anim=enter.zoom trigger=after delay=1.62 -->

<i data-icon="code"/> **内置代码工作台**
网页里直接改代码

<!-- slide: layout=blank bg=bg kicker="04 · 差异 01/5" anim=none notes="第一项差异：全端可用。第一，它是一个 PWA——电脑和手机浏览器装的是同一个应用，手机上也是完整重排版的界面，不是缩窄的凑合版，底部四页签导航、刘海屏避让、触屏手势都做了专门适配。第二，工作接力：手机连的电脑上跑的那个服务，同一份会话库——办公室干到一半的任务，掏出手机打开就是同一个会话，上下文一点不丢。第三，最实在的一条：关掉页面任务照样跑——您切走了、断网了，服务端把任务跑完落库，回来一打开自动接管，中间完成的步骤都给您重建出来。第四，上次浏览现场也记得：当前目录、选中的文件、正在聊的会话，重开浏览器直接回到现场。" -->

<!-- block: x=5.6% y=6% w=38% h=9% -->

# 全端可用，接力不停

<!-- block: x=6% y=19% w=34% h=66% color=text anim=enter.fade trigger=after delay=0.6 -->

- <span class="primary">**电脑手机同一应用**</span>：PWA 可装主屏，功能一个不少
- 手机端<span class="primary">**完整重排版**</span>，非缩窄凑合：四页签导航、刘海屏避让
- <span class="primary">**同一份会话库**</span>：手机连电脑服务，半途任务接着干
- <span class="primary">**关页任务照跑**</span>：服务端续跑落库，回来自动接管现场
- 重开浏览器<span class="primary">**直接回到上次现场**</span>：目录、文件、会话全恢复
- <span class="primary">**上下文一点不丢**</span>，切换设备不丢进度

<!-- block: x=44% y=8% w=50% h=84% bg=bg anim=enter.fly-in direction=right trigger=after delay=1.2 -->

![P13-图1 全端可用，接力不停示意](images/art-all-platforms.png)

<!-- slide: layout=blank bg=bg kicker="04 · 差异 02/5" anim=none notes="这一页讲个人隐私。先说清定位：它是装在您个人办公电脑上的编程助理，不是 Workbuddy 那类公有云服务，也不是公司内部架的网站——没有服务器替您保管数据。落到实处的保护有六条：一，索引、会话、记忆、备份、日志全部落在您电脑磁盘上同一个可见目录，肉眼可查；二，检索引擎完全离线，一个本地文件装下全部索引，不需要向量库、不需要联网；三，唯一必然外联的是模型接口，可指向内网或自建端点，其余联网工具都能一键关停；四，凭据只存本机文件，界面上一律打码显示；访问服务默认只绑本机，手机连入才需要 PIN 密码，且密码不走明文传输；五，会话可整份导出带走，系统自动做十份环形备份；六，代码里没有任何遥测上报——我们全仓查过。隐私不是靠承诺，是结构性的。" -->

<!-- block: x=5.6% y=6% w=38% h=9% -->

# 数据不出你的电脑

<!-- block: x=6% y=19% w=34% h=66% color=text anim=enter.fade trigger=after delay=0.6 -->

- <span class="primary">**个人编程助理**</span>：非公有云、非内部网站，数据不经任何服务器
- 索引、会话、记忆、备份<span class="primary">**落在本机一个可见目录**</span>，肉眼可查
- 检索引擎<span class="primary">**完全离线**</span>：本地文件装下全部索引，无需联网
- 唯一外联是<span class="primary">**可替换模型接口**</span>（内网/自建任选），联网工具可关停
- 凭据只存本机、界面打码；服务<span class="primary">**默认只绑本机**</span>，密码不上线
- <span class="primary">**零遥测零上报**</span>：全仓无任何数据回传代码

<!-- block: x=44% y=8% w=50% h=84% bg=bg anim=enter.fly-in direction=right trigger=after delay=1.2 -->

![P14-图1 数据不出本机示意](images/art-data-local.png)

<!-- slide: layout=blank bg=bg kicker="04 · 差异 03/5" anim=none notes="这一页讲长期记忆，核心一句话：它真的记得你。跨对话、跨知识库持久生效——你交代过的偏好、纠正过的工作方式、定过的决策，一次说过，以后每次对话自动带上。记忆分四类，每类都有例子：你是谁——代码风格偏好简洁、多用类型注解；怎么干活——改完前端必须先跑构建再交付；做什么——上次那个崩溃的根因和修法，下次直接想起；资料在哪——部署文档在仓库哪个目录。而且控制权在你手里：说「记住这个」当场写入，说「不用记了」立即归档退役。" -->

<!-- block: x=5.6% y=6% w=38% h=9% -->

# 长期记忆：AI 真的记得你

<!-- block: x=6% y=19% w=34% h=62% color=text anim=enter.fade trigger=after delay=0.6 -->

- <span class="primary">**跨对话持久**</span>：偏好、纠错、决策一次交代永久生效
- **你是谁**：代码风格简洁，多用类型注解
- **怎么干活**：改完前端先跑构建再交付
- **做什么**：上次崩溃的根因，下次直接想起
- **资料在哪**：部署文档在仓库哪个目录
- 「记住这个」当场写入，「不用记了」立即退役

<!-- block: x=44% y=8% w=50% h=84% bg=bg anim=enter.fly-in direction=right trigger=after delay=1.2 -->

![P18-图1 AI 自动记忆示意](images/art-auto-memory.png)

<!-- slide: layout=blank bg=bg kicker="04 · 差异 04/5" anim=none notes="模型这一层，选择权全在我们手里。第一，对话模型原生支持 Anthropic 和 OpenAI 两大协议——智谱、DeepSeek、MiniMax、Kimi、通义千问，这些长任务智能体填个地址就开箱即用。第二，平台级接入：阿里云百炼、腾讯云、火山方舟、OpenRouter，还有公司自建的大模型池，都能直接接。第三，视觉模型是独立配置的——您在前几页看到的贴图提问、手机截图，背后都是它在看图判读。第四，文生图和语音合成原生对接——今天这份汇报里的插画和旁白，就是我们自己的系统生成的。工具链完整，不用东拼西凑。" -->

<!-- block: x=5.6% y=6% w=38% h=9% -->

# 模型随插随换

<!-- block: x=5% y=19% w=40% h=66% color=text anim=enter.fade trigger=after delay=0.6 -->

- 支持 <span class="primary">**Anthropic、OpenAI 双协议**</span>，智谱、DeepSeek、MiniMax、Kimi、通义千问等长任务智能体开箱接入
- 支持<span class="primary">**阿里云百炼、腾讯云、火山方舟、OpenRouter**</span>及公司自有大模型池接入
- 除文本模型外，还有<span class="primary">**独立视觉模型**</span>：图片上传、截图理解与判读
- 原生对接<span class="primary">**文生图、语音合成**</span>：快速生成汇报图文与 PPT 口播音频

<!-- block: x=46% y=8% w=48% h=84% bg=bg anim=enter.fly-in direction=right trigger=after delay=1.2 -->

![P16-图1 模型随插随换示意](images/art-model-swap.png)

<!-- slide: layout=blank bg=bg kicker="04 · 差异 05/5" anim=none notes="最后一项：代码工作台，这一页功能密度其实很高。看代码：几十种语言的语法高亮，行号点选、区间选择，选中直接带入提问——您问哪段代码，点一下就行。改代码：页面内就地编辑，Ctrl+S 落盘保存，保存后自动重建索引，不用切终端。看变更：git 未提交改动全列出，逐行 diff 新旧对照，改了什么一目了然。AI 写完当场看、当场改、当场验，浏览器里闭环。甚至 Markdown 公式渲染、PDF 原生预览、Office 文档都在同一个页面里看——不夸张地说，日常轻量场景可以不开编辑器。" -->

<!-- block: x=5.6% y=6% w=38% h=9% -->

# 内置代码工作台

<!-- block: x=6% y=19% w=34% h=62% color=text anim=enter.fade trigger=after delay=0.6 -->

- <span class="primary">**几十种语言高亮**</span>，行号点选区间选择，选中即入提问
- 页面内<span class="primary">**就地编辑，Ctrl+S 落盘**</span>，保存自动重建索引
- <span class="primary">**未提交改动逐行 diff**</span>，新旧对照，改了什么一目了然
- <span class="primary">**就地看图判图**</span>：Markdown 公式、PDF、Office 同页预览
- AI 写完<span class="primary">**当场看、当场改、当场验**</span>，全程不出浏览器

<!-- block: x=44% y=8% w=50% h=84% bg=bg anim=enter.fly-in direction=right trigger=after delay=1.2 -->

![P24-图1 内置代码工作台示意](images/art-code-workbench.png)

<!-- slide: layout=two-col kicker="09 · 生态" takeaway="**生态直接继承，团队知识可资产化**" notes="上半场讲继承：技能格式与主流 agent 同构，社区技能贴个链接就能装进来，不用从零建生态。下半场讲沉淀：repo-wiki 能把任意项目的架构文档一键生成，deep-read 能把一本规范手册变成技能。写技能就是写 Markdown，测试、运维、文档岗都能贡献。" -->

# 技能生态：社区继承，知识资产化

**社区技能直接继承**

- 格式与主流 agent 同构，直接套用
- 贴 GitHub 链接即装，免 git 依赖
- 改完热重载，无需重启
- 自建技能可反向同步给对方用

---

**内置精选**

- **code-explain** 点名函数即结构化讲解
- **repo-wiki** 一键生成项目架构文档
- **anti-patterns** 反模式审计出修复台账
- **deep-read** 深读规范手册提炼成技能

<!-- slide: layout=timeline kicker="11 · 上手" takeaway="**十分钟能跑起来，不需要运维介入**" notes="讲引入成本。唯一依赖是 Python，没有 Docker、没有数据库服务要架。四条命令走完就到浏览器界面。模型在设置页里点鼠标配。这页的目的是让试试看这件事变得没有心理负担。" -->

# 十分钟上手

| 步骤 | 动作 | 说明 |
|---|---|---|
| ① | **pip install doclens** | 唯一依赖 Python 3.10+ |
| ② | **doclens index** | 首次全量，之后自动增量 |
| ③ | **doclens gui** | 浏览器自动打开，PWA 可装桌面 |
| ④ | 设置页配模型 | 选协议、填地址，保存即用 |

<!-- slide: layout=closing kicker="12 · 收尾" takeaway="**方向盘已经造出来了，什么时候握上它，由您决定**" notes="收尾不要提要求。把决定权交回去：工具已经造好、能上手、能验证。需要我做的是随时可以演示真机，其余交给领导判断。停在这里，留白。" -->

# 方向盘已经造出来了

- **能看**：随时可以演示真机界面
- **能验**：数据不出本机，每步留痕可审计
- **能接**：贴 GitHub 链接即可导入社区技能
- **能改**：Python 全栈自有，需求变了我们自己改

什么时候握上它，由您决定。
