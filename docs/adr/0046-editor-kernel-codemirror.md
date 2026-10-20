# ADR-0046: 编辑器内核迁移到 CodeMirror 6（文本编辑器从 textarea 换编辑器）

- 状态：已接受
- 日期：2026-10-20
- 关联决议：ADR-0032（服务端分词）、ADR-0036 / ADR-0043（代码主题与应用主题）

## 背景

文本文件编辑（`md-editor`）用裸 `<textarea>` 实现，四个问题在实测中坐实：

1. **大文件慢**：打开即把全文灌进 textarea（浏览器为每行建文本节点）；且每次按键触发 `_updateDirty` 的 `_text !== this.originalContent`——**全字符串逐字符比较**。现有写入上限是 5MB（`preview.py` 的 `_MAX_SAVE_BYTES`），即 4MB 文件每敲一键就做一次 4MB 比较。
2. **无语法高亮**：编辑态是纯白文本。高亮只存在于**预览态**——由后端 Pygments 分词、经 ADR-0032 的 token 流下发。
3. **不能改主题色**：编辑器只消费 `--cortex-*` 通用变量，不消费代码主题（`code-theme.ts` 的三态），也不消费 ADR-0032 的 8 类 `--code-tok-*` 语义色。
4. **对 Markdown 不友好**：只有 12 个手搓按钮（标题/粗体/斜体/围栏/行内码/三种列表/引用/链接/表格/分割线），无折叠、无搜索、无多光标、无括号补全、无自动缩进。

## 决策

**编辑器内核换成 CodeMirror 6（CM6），`md-editor` 组件整体删除。**

### 1. 内核选型：CM6，非 Monaco

Monaco（VS Code 同款）能力最全，但 **100MB unpacked**——对本地 PWA 是不可接受的。CM6 实测：

| 产物 | raw | gzip |
|---|---|---|
| 核心（view+state+language+commands+search+autocomplete） | 419KB | 105KB |
| `lang-markdown` 懒加载 chunk | 35–97KB | 14–31KB |
| 其余语言包（各） | 9–64KB | 6–14KB |

`legacy-modes` 另计 1.9MB unpacked（懒加载）。CM6 核心 105KB gzip 相对现有 339KB gzip 主 bundle 是可接受增量，且**懒加载 chunk 不进首屏**。

CM6 只渲染视口（viewport 虚拟化），这是「大文件慢」的结构性解法——不是把阈值调小，是让大文件可编辑。实测 Lezer 解析 4.9MB Python 约 1.1s（一次性），markdown 143ms。

es2015 target 编译通过（194KB gzip），旧 WebView 内核不构成阻塞。

**CM6 核心本身也懒加载**（`utils/cm-core.ts` 动态 import）——编辑是可选功能，只读会话不该为它付首屏代价。实现要点：`cm-langs.ts` 必须**零静态依赖 CM6**（legacy-modes 的 `StreamParser` → 扩展的转换需要 `@codemirror/language` 的 `StreamLanguage`，而该包是单文件 2517 行，静态 import 会把整个 language 包拖进主 bundle，抵消懒加载的意义），故转换下沉到懒加载的 `cm-core.ts`。

实测结果：**主 bundle gzip 338KB（基线 339KB，实质不变）**，CM6 核心成为独立懒加载 chunk（305KB raw / 99KB gzip），语言包各自独立 chunk。

### 2. md 形态：只做语法着色，不做实时渲染

不做 Typora 式的内联渲染（编辑区里直接把 `#` 渲染成真标题）。内联渲染要自己处理光标定位、IME 组合、撤销栈——收益不抵成本。CM6 的 `lang-markdown` 提供源码态着色（标题符号、强调标记有颜色），**渲染预览仍在预览态看**。

### 3. 分词双轨并存（不废 ADR-0032）

**后端 Pygments 分词完整保留**，1MB 上限保留。原因：后端 token 流的**唯一消费方是预览态行号视图**（`preview-pane.ts` 的非 md 分支），而行号视图不变。

于是形成两套并行的分词，各管一段：

| 场景 | 分词位置 | 词表 | 色板 |
|---|---|---|---|
| 预览态行号视图 | 后端 Pygments | 8 类（`c/k/s/n/f/t/o/p`） | 现有 `code-palette.ts` |
| 编辑态 | 前端 Lezer（CM6 内置） | 细粒度 Lezer tag | 映射到同一 8 类 |

**编辑态高亮与预览态高亮观感可能不同**——这是接受的成本，换来的是「行选择」术语（点行号选行、`path:12-40` 协议）不被破坏。

### 4. 色板：两套，从现有色板派生

8 类（`c/k/s/n/f/t/o/p`）是**代码**词表；Markdown 结构（标题/粗体/斜体/行内码/链接/引用/列表）是**另一套**词表，两者不互相覆盖。故：

- **代码文件**：Lezer tag 映射到现有 8 类色板（`code-palette.ts` 的浅/深两套），零新增色值。
- **Markdown 文件**：新增一套「结构色」（标题/粗体/斜体/行内码/链接/引用/列表等），**从现有色板派生**（标题取关键字色、粗体取函数紫、斜体取操作符色等），不引入新色相。

编辑器背景与前景消费**代码主题三态**（跟随应用主题 / 强制浅 / 强制深，`code-theme.ts`），与预览态行号视图同一套切换入口。

### 5. 语言包：全量

`@codemirror/lang-markdown` + 主力语言包（python/javascript/json/html/css/rust/go/yaml）+ `@codemirror/legacy-modes`（覆盖 shell/sql/ruby/lua/perl/r/swift/kotlin/scala/clojure/haskell/toml/powershell/c-family/vb/groovy/dart/julia/erlang/xml/yaml/dockerfile 等），**全部懒加载**。

**已知覆盖缺口**：`legacy-modes` 不覆盖 PHP、Elixir、Nim、Zig、Terraform、GraphQL——这些文件在**编辑态**降级为无高亮纯文本（预览态不受影响，仍由 Pygments 高亮）。

### 6. 大文件：超阈值禁编辑，不截断传输

文件超过 **5MB**（与现有写入上限对齐）时：仍全文加载 + 只读预览，但「编辑」入口不可用，提示「文件过大，无法编辑」。

不采用「只传前 N 行」：那需要后端补「总行数」元信息 + 前端管理虚拟文档映射，复杂度显著更高，而用户实际诉求是「别卡」——禁编辑即可。

### 7. 对外契约不变，`preview-pane` 不动

`cm-editor` 保持 `md-editor` 的事件契约（`save` / `cancel` / `dirty-change`）与公共方法名（`topLine` / `scrollToLine` / `selectionOffsets` / `selectOffsets` / `isAtBottom` / `scrollToBottom` / `discard` / `setError`），`preview-pane` 只改 import 与元素标签名。

API 映射（已逐个验证语义）：

| md-editor | CM6 |
|---|---|
| `topLine()` | `state.doc.lineAt(view.viewport.from).number` |
| `scrollToLine(n)` | 选区移到 `doc.line(n).from` + `scrollIntoView` |
| `selectionOffsets()` | `state.selection.main` → `{anchor, head}` |
| `selectOffsets(s,e)` | `EditorSelection.range(s,e)` |
| `isAtBottom()` | `viewport.to` 与文档尾部比较 |

### 8. 12 个 Markdown 格式化按钮全部重写

CM6 的 `lang-markdown` **不提供**加粗/标题/列表等命令（只有续行、删标记、粘贴转链接）。现有 5 类原语（`_applyEdit` / `_linePrefixAction` / `_wrapAction` / `_blockInsert` / `_listAction`）改写为 CM6 的 `EditorSelection` + `replaceSelection` 操作。**这是迁移中工作量最大的一块。**

### 9. 一次性完全替换

不留双轨、不分期。现有 14 个 `md-editor.spec.ts` 测试全部重写为 `cm-editor.spec.ts`。中间态（格式化按钮缺失）不接受。

## 后果与风险

- **主 bundle 实质不变**（338KB gzip vs 基线 339KB）——CM6 核心与全部语言包均为懒加载 chunk，仅在进入编辑态时拉取。代价：首次进入编辑态有一次网络往返（本地回环，可忽略）。
- **移动端 WebView 内存**：5MB 阈值下 CM6 需持多份文档副本，有 OOM 风险——这是阈值定在 5MB 而非更大的原因。
- **编辑态与预览态高亮观感不一致**（两套词表、两套分词器）。
- **PHP / Elixir / Nim / Zig / Terraform / GraphQL 编辑态无高亮**。
- **ADR-0032 保留**，但其「前端零高亮库 bundle」的前提**仅对预览态成立**；编辑态引入了前端解析器。
- 现有 `md-editor` 的镜像 div 行高测量内核（WebView 行高校准、整数取整、互逆二分反查）**整体废弃**——CM6 自己管布局与滚动，不再需要这套补偿。相关测试一并删除。
- **锚点恢复需等内核就绪**：核心懒加载意味着切到编辑态的那一瞬视图尚不存在，`preview-pane` 必须等 `cm-editor.whenReady()` 才能恢复位置/选区，否则锚点静默丢失（实现时踩过一次）。

## Considered Options

- **Monaco Editor**——否决：100MB unpacked，PWA 缓存与 WebView 内存不可接受。
- **继续手写 textarea，补齐能力**——否决：语法高亮/折叠/搜索/多光标/括号补全逐项自研是无底洞，且大文件的视口虚拟化无法靠 textarea 实现。
- **Typora 式内联渲染**——否决：光标定位/IME/撤销栈成本过高，收益不抵。
- **废掉后端分词，全改前端**——否决：行号视图的行选择功能（CONTEXT.md 已定义术语）需自实现，且会同时改动预览态（超出本次范围）。
- **分两步交付**——否决：中间态存在功能缺失，两套编辑器并存期反而更贵。
- **大文件只传前 N 行（GitHub 式行窗口）**——否决：需后端补总行数元信息 + 前端虚拟文档映射，复杂度显著更高。
