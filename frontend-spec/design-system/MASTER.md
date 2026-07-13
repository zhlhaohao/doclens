# Doclens 设计系统 · SaaS Boutique（MASTER）

> 选定风格：**SaaS Boutique**（Stripe / Linear / Vercel 移动端精致 SaaS 风）。
> 本文件是全局设计真相源。各页 spec / 组件 CSS 以此为准。tokens 落地在 `doclens/web_v2/frontend/src/styles/tokens.css`。

## 设计原则

1. **精致专业**：双层阴影、hairline 分割、克制留白——像 Stripe/Linear 产品截图
2. **Electric Blue 活力**：主操作用蓝色渐变 + glow，是视觉锚点
3. **数据等宽**：路径 / 数字 / meta 用 JetBrains Mono，精确感
4. **克制配色**：Slate 中性色为主，蓝色仅用于主操作/强调，状态色（绿/橙/红）仅用于语义
5. **圆润现代**：16px 大圆角卡片，触控友好

## Color Tokens

### 主色 · Electric Blue
| Token | 值 | 用途 |
|------|-----|------|
| `--cortex-primary` | `#0052FF` | 主色（链接 / active / 强调） |
| `--cortex-primary-hover` | `#003ECC` | hover |
| `--cortex-primary-2` | `#4D7CFF` | 渐变终点 |
| `--cortex-primary-soft` | `#EFF4FF` | 浅蓝背景 / soft 高亮 |
| `--cortex-primary-gradient` | `linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)` | 主按钮 / 重点 CTA |
| `--cortex-primary-glow` | `0 4px 14px rgba(0,82,255,0.25)` | 主按钮 glow 阴影 |

### 中性色 · Slate
| Token | 值 | 用途 |
|------|-----|------|
| `--cortex-bg` | `#FAFAFA` | 页面底（暖白） |
| `--cortex-surface` | `#FFFFFF` | 卡片 / 面板 |
| `--cortex-surface-muted` | `#F8FAFC` | 次级面板 / hover 底 |
| `--cortex-border` | `#E2E8F0` | hairline 边框 |
| `--cortex-border-muted` | `#F1F5F9` | 弱分隔 |

### 文字
| Token | 值 | 用途 |
|------|-----|------|
| `--cortex-text` | `#0F172A` | 主文字（slate-900） |
| `--cortex-text-muted` | `#64748B` | 副文字（slate-500） |
| `--cortex-text-subtle` | `#94A3B8` | 弱文字 / placeholder（slate-400） |

### 状态色
| Token | 值 | 语义 |
|------|-----|------|
| `--cortex-success` | `#10B981` | 成功 / 已索引 / 监控中 |
| `--cortex-warning` | `#F59E0B` | 警告 / 待更新 |
| `--cortex-danger` | `#DC2626` | 错误 / 失败 / 删除 |

### Chat 专用（SaaS Boutique 调整）
| Token | 值 |
|------|-----|
| `--cortex-chat-bg` | `#F8FAFC` |
| `--cortex-chat-bubble-user` | `#0052FF`（蓝气泡，白文字） |
| `--cortex-chat-bubble-user-border` | `#003ECC` |
| `--cortex-chat-bubble-user-text` | `#FFFFFF` |
| `--cortex-chat-bubble-ai` | `#FFFFFF` |
| `--cortex-chat-bubble-ai-border` | `#E2E8F0` |
| `--cortex-chat-section` | `#0052FF` |
| `--cortex-chat-input-bg` | `#FFFFFF` |
| `--cortex-chat-input-border` | `#E2E8F0` |
| `--cortex-chat-footer` | `#94A3B8` |

## Typography

- **字体族**：
  - `--cortex-font`: `"Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
  - `--cortex-font-mono`: `"JetBrains Mono", "Cascadia Code", Consolas, monospace`（数据 / 路径 / meta）
- **权重层级**：标题 600/700；正文 400；标签 500
- **字间距**：标题 `-0.01em` ~ `-0.02em`（紧凑精致）
- **字号**（移动默认，桌面 breakpoints.css 缩小 1px）：xs 12 / sm 13 / base 14 / md 15 / lg 17 / xl 30
- **行高**：正文 1.5–1.6

> 字体加载：`index.html` 加 Google Fonts preconnect + Inter / JetBrains Mono link（PWA 离线时降级系统字体）。

## Spacing（4px 基线）

`--cortex-space-1` 4 / `--cortex-space-2` 8 / `--cortex-space-3` 12 / `--cortex-space-4` 16 / `--cortex-space-6` 24 / `--cortex-space-8` 32

## Radius（圆润现代）

| Token | 值 | 用途 |
|------|-----|------|
| `--cortex-radius-sm` | `6px` | 小按钮 / badge |
| `--cortex-radius-md` | `10px` | 输入 / 中按钮 |
| `--cortex-radius-lg` | `16px` | 卡片 / 面板 / 主按钮 |
| `--cortex-radius-xl` | `20px` | 大卡 / dialog |

## Shadow（双层精致）

| Token | 值 | 用途 |
|------|-----|------|
| `--cortex-shadow-sm` | `0 1px 3px rgba(0,0,0,0.04)` | 轻微浮起 |
| `--cortex-shadow-md` | `0 4px 12px rgba(15,23,42,0.08), 0 1px 3px rgba(0,0,0,0.04)` | 卡片 / 面板（默认） |
| `--cortex-shadow-lg` | `0 8px 24px rgba(15,23,42,0.12), 0 2px 6px rgba(0,0,0,0.04)` | 浮层 / dropdown / dialog |
| `--cortex-primary-glow` | `0 4px 14px rgba(0,82,255,0.25)` | 主按钮 glow |

## 组件规范（阶段 B 落地的依据）

- **主按钮**：`background: var(--cortex-primary-gradient)` + `box-shadow: var(--cortex-primary-glow)` + `color:#fff` + `border:none` + `border-radius: var(--cortex-radius-lg)` + hover 变亮 + disabled 降透明度
- **次按钮**：`background: var(--cortex-surface)` + `border: 1px solid var(--cortex-border)` + `color: var(--cortex-text)`
- **卡片 / 面板**：`background: var(--cortex-surface)` + `border: 1px solid var(--cortex-border)` + `border-radius: var(--cortex-radius-lg)` + `box-shadow: var(--cortex-shadow-md)`
- **输入框**：`background: var(--cortex-surface)` + `border: 1px solid var(--cortex-border)` + `border-radius: var(--cortex-radius-md)` + focus `border-color: var(--cortex-primary)` + focus ring
- **active 导航项**：`color: var(--cortex-primary)` + soft 底 `var(--cortex-primary-soft)` 或左条 `var(--cortex-primary)`
- **数据 / 路径 / meta**：`font-family: var(--cortex-font-mono)` + `color: var(--cortex-text-muted)` + `font-size: var(--cortex-fs-xs)`

## 落地范围

- **阶段 A（已完成）**：全局 `tokens.css` 替换 → 全 app 配色（teal→蓝）/ 字体（Plus Jakarta→Inter）/ 圆角（加大）/ chat 气泡（蓝）立刻变样。
- **阶段 B（待确认）**：组件级 CSS 细化——主按钮用 `--cortex-primary-gradient`、卡片用 `--cortex-shadow-md`、数据用 `--cortex-font-mono` 等。需逐个 shadow DOM 改（app-bar / input-box / welcome-pane / result-card / chat-message / file-row / 各 dialog 等）。
