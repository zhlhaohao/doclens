# 前端栈反模式清单（Lit + Vite + marked/pdf.js）

> 附件 C of anti-patterns 技能。**技术栈专属主判据·前端域**。
> 来源（检索于 2026-10-20，复检时按 SKILL.md 第 2 步重新检索并更新本表）：
> - Lit 官方文档（reactive properties / controllers / shadow DOM）
> - Lit 社区最佳实践与 StackOverflow 高票陷阱（controller 嵌套
>   requestUpdate、shadow DOM 穿透）
> - Vite 构建产物纪律（chunk/code-split）
>
> **用途纪律**：审前端域时装载本表（后端域完成后才装载——SKILL.md
> 第 3 步分域顺序）；每条发现必须绑定项目证据。

## Lit 组件

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 受控属性与内部 @state 双真相源 | 同一状态两份（宿主 prop + 组件 state），靠手工同步与时序技巧维持一致——"闪回"类 bug 温床 | "先清空再等宿主回填"类注释；prop 变化钩里与内部 state 对账 |
| ReactiveController 挂/卸不对称 | connectedCallback 里加的监听/订阅 disconnectedCallback 忘摘 → 泄漏 + 幽灵回调 | 对照组件两个钩子的 add/remove 配对 |
| Controller 跨组件共享误解 | ReactiveController 不是全局状态方案（requestUpdate 只到宿主）；跨组件共享状态应走 store/事件 | 一个 controller 实例 attach 多个组件 |
| shadow DOM 穿透打洞 | `element.shadowRoot.querySelector + as any` 直捣子组件内部——绕过封装，重构即碎 | 宿主代码里链式 `.shadowRoot?.querySelector`；`as any` 后调子组件方法 |
| 模板内重计算 | render() 里每次都跑昂贵计算/排序/过滤，未用缓存或派生 state | 模板表达式内 `.filter/.sort/.map` 链 + 大数组 |
| 属性监听过度 | @property 全开 attribute 反射/深比较，热属性走昂贵路径 | 大对象属性未设 `attribute: false` |
| unsafeHTML 注入面 | 标记内容未消毒直接 unsafeHTML/innerHTML | sanitize 步骤缺失处用 unsafeHTML |

## 视图/状态组织

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 视图直连 fetch 绕过 api 层 | api/ 封装存在但视图裸 fetch——URL 拼装/错误归一/类型散布 N 处 | 视图文件内 `fetch(\`/api` 出现 |
| 事件未清理的 setInterval/listener | 组件销毁后仍在跑——轮询打空/内存泄漏 | addEventListener/addInterval 无对应清理 |
| 状态复制粘贴（多视图同构样板） | N 份取数-回填-错误处理样板各自漂移 | 同名私有方法在多个视图文件逐字重复 |
| localStorage 键散布无命名空间 | 多模块键冲突/清理遗漏；键清单无人能列全 | 逐字字符串键直接读写，无集中常量 |

## 构建与资源

| 反模式 | 为什么是问题 | 检测线索 |
|---|---|---|
| 巨型主 bundle | 未 code-split（动态 import），首屏全量下载 | 主 chunk >1MB 且含按需功能（如 pdf.js） |
| SW 缓存策略一刀切 | 全部 cache-first 会劫持 API；静态/动态未分流 | sw.js 无路径区分策略 |

## 域内通用（前端批同时装载）

前端域分析同时装载附件 A 的「前端模块层 + 组件层 + 功能层」三节作兜底归类。
