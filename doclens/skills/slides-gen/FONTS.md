# 字体

HTML deck 的字体由**打开它的那台电脑**渲染，所以选字体首要是「到处都装得到」。

## 默认配置

| 角色 | 回退链 | 说明 |
|---|---|---|
| 正文/标题（无衬线） | `微软雅黑 → PingFang SC → Microsoft YaHei → Source Han Sans SC → system-ui → sans-serif` | Windows/WPS 自带微软雅黑；macOS 落到苹方 |
| 无衬线 + 杂志感（serif） | `思源宋体 → Songti SC → SimSun → 宋体 → serif` | **SimSun 是 Windows 保底**，一定在；思源宋体只是优先项 |
| 等宽/代码 | `Consolas → Cascadia Code → JetBrains Mono → monospace` | Windows 自带 Consolas |

**为什么写成链**：任何单一字体都可能没装。链的作用是「首选没有就退到次选」，
最后一档是 CSS 通用族（`serif` / `sans-serif` / `monospace`），浏览器一定能给。

## 主题里怎么声明

```json
"fonts": {
  "family": "微软雅黑",                          // 单值时自动补通用兜底
  "stack": ["思源宋体", "Songti SC", "SimSun", "宋体", "_serif"],   // 需要精确控制时用
  "mono": "Consolas"
}
```

- `stack` 是**有序候选**，优先于 `family`
- 下划线前缀（如 `_serif`）表示 CSS 通用族关键字，渲染时不加引号
- 不写 `stack` 时：`family` + 到通用族的默认补齐

## 各主题字体选择理由

| 主题 | 中文 | 理由 |
|---|---|---|
| clean-white / corporate-blue / dark-tech / mint-fresh / warm-orange / swiss-grid / warm-paper | 微软雅黑 | 通用、中性、投影清晰 |
| **ink-magazine** | 宋体链（SimSun 保底） | 杂志气质需要衬线；**不要写死「思源宋体」**——多数机器没装会静默回退黑体，衬线感全失 |

## 兼容性须知（交付时要跟用户讲）

1. **首选项缺失不会报错，只会静默回退**——所以衬线/特殊字体要么写完整链，要么在交付说明里提醒
2. 用户机器上若字体不同，**换行位置可能微变**；HTML 用流式布局，不会重叠，最多是某页行数多一行
3. 想确保效果一致 → 用系统自带字体（雅黑/宋体/Consolas），不要依赖需另装的字体
4. 若要精致排版（思源黑体/宋体、阿里巴巴普惠体等），交付时明确说「需安装 xx 字体，否则回退到系统字体」

## 关于「预览与实际不同」

本项目 HTML 即最终产物，**不存在 luobo 那种「LibreOffice 预览 vs PowerPoint 实际」的偏差**——
浏览器渲染什么，用户打开就是什么（前提是字体可用）。

## 自定义字体

主题 JSON 的 `stack` 支持任意本机字体名：

```json
"stack": ["HarmonyOS Sans SC", "微软雅黑", "_sans-serif"]
```

跨机器分发时仍建议保留系统字体的兜底项。
