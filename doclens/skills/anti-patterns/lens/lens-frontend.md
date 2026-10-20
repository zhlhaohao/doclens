# 前端栈反模式清单（Lit + 原生 H5/JS 两形态）

> 附件 C（lens/lens-frontend.md）。**技术栈专属主判据·前端域**。
> 两大典型形态（按实际探测结果选用对应小节）：
> ① Lit + Vite 组件工程
> ② 原生 H5 + vanilla JavaScript（无框架/轻框架项目——用户其他项目常见形态）
> 来源（检索于 2026-10-20，复检时按 SKILL.md 第 2 步重新检索并更新本表）：
> - Lit 官方文档（reactive properties / controllers / shadow DOM）
> - LogRocket《Patterns for efficient DOM manipulation with vanilla JS》
> - 语义 HTML 与 WCAG 可访问性高频错误清单（Level Access / Wallyax）
> - Vite 构建产物纪律（chunk/code-split）
>
> **用途纪律**：审前端域时装载本表（后端域完成后才装载——SKILL.md 第 3
> 步分域顺序）；每条发现必须绑定项目证据。

## Lit 组件（组件工程形态）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 受控属性与内部 @state 双真相源 | 同一状态两份（宿主 prop + 组件 state），靠手工同步与时序技巧维持——"闪回"类 bug 温床 | "先清空再等宿主回填"类注释；prop 变化钩里与内部 state 对账 |
| ReactiveController 挂/卸不对称 | connectedCallback 里加的监听/订阅 disconnectedCallback 忘摘 → 泄漏 + 幽灵回调 | 对照组件两个钩子的 add/remove 配对 |
| Controller 跨组件共享误解 | ReactiveController 不是全局状态方案；跨组件共享应走 store/事件 | 一个 controller 实例 attach 多个组件 |
| shadow DOM 穿透打洞 | `element.shadowRoot.querySelector + as any` 直捣子组件内部——绕过封装 | 宿主代码里链式 `.shadowRoot?.querySelector` |
| 模板内重计算 | render() 里每次都跑昂贵计算/排序/过滤 | 模板表达式内 `.filter/.sort/.map` 链 + 大数组 |
| 属性监听过度 | @property 全开 attribute 反射/深比较 | 大对象属性未设 `attribute: false` |
| unsafeHTML 注入面 | 标记内容未消毒直接 unsafeHTML/innerHTML | sanitize 步骤缺失处用 unsafeHTML |

## 原生 H5 + vanilla JavaScript（无框架形态）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| Layout Thrashing（读写交错） | 循环内交替读 offsetHeight（强制同步 layout）再写 style——每次读写都触发重排，页面级卡顿 | for 循环内 `offset*/client*/getComputedStyle` 与 `style.* =` 混杂；应批量读→批量写（或 rAF 合帧） |
| 循环内逐个 appendChild | 每次插入都触发重排/重绘 | for + appendChild 直接插 documentFragment 之外；应 DocumentFragment 批插或 innerHTML 一次成型 |
| 查询结果不缓存 | 循环/高频回调里反复 querySelector（每次走 DOM 树） | 同一 selector 在 timer/scroll 回调内重复查询 |
| 全局函数命名空间 | window 上挂一堆函数互相调用——Big Ball of Mud 的 JS 形态 | `function xxx()` 全局声明、onclick 字符串引用 |
| 事件监听不清理（SPA 场景） | 页面切换/组件销毁后监听仍在——重复绑定与内存泄漏 | addEventListener 无对应 remove；timer 未 clear |
| this 指向丢失用 that/self 别名 | 未用箭头函数/bind，散布 `var that = this` | `that.`/`self.` 别名引用 |
| innerHTML 拼接用户输入 | XSS 注入面 | 字符串拼接含用户数据后 innerHTML 赋值 |
| 内联事件与结构耦合 | HTML 属性里写 onclick="fn()"——行为与结构纠缠 | onclick=/onchange= 出现于模板字符串 |

## 语义 HTML / 可访问性（H5 通用）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| div/span 当按钮 | 可点击触发动作却用非交互元素——键盘不可达、无焦点、无语义 | `<div onclick>` / `<span class="btn">`；应 button |
| Div Soup | 全 div 布局无语义结构——屏幕阅读器/SEO 全废 | 大量嵌套 div 无 header/nav/main/article 等语义标签 |
| 表单控件缺 label | 输入框无关联标签——可访问性高频违规之首 | input 无 `<label for>` 也无 aria-label |
| 图片缺 alt | 纯装饰与信息图不分，alt 缺失 | `<img>` 无 alt 属性 |
| 超链接当按钮（或反之） | `<a>` 无 href 只当点击目标 / `<a href="#">` 跳顶 | href="#" 或缺 href 的 a 上挂 onclick |
| 标题层级跳跃 | h1→h4 跳级、多个 h1——文档大纲混乱 | 语义标注工具报层级断档 |
| 表格当布局工具 | HTML5 时代仍用 table 排版 | table 的子元素是布局 div/宽度撑格 |
| 过度 ARIA | 该用原生元素处硬造 ARIA 角色（原生 button 比 role="button" 可靠） | role="button"/tabindex 手造交互组件 |

## 构建与资源（组件工程形态）

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 巨型主 bundle | 未 code-split，首屏全量下载 | 主 chunk >1MB 且含按需功能（如 pdf.js） |
| SW 缓存策略一刀切 | 全 cache-first 会劫持 API；静态/动态未分流 | sw.js 无路径区分策略 |

## 域内通用（前端批同时装载）

前端域分析同时装载附件 A 的「前端模块层 + 组件层 + 功能层」三节作兜底归类。
