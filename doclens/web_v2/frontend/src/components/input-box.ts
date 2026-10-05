import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { SearchMode } from "../state/types";
import type { ChatImage } from "../api/chat";

/** 对话图片上限与白名单（ADR-0034，与后端 ChatRequest 校验同口径） */
const MAX_IMAGES = 4;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
/** 压缩参数：最长边 1600px / JPEG q80（对齐日记照片口径；GIF 动图转 JPEG 丢动画——
 *  粘贴场景可接受，静态帧仍可看） */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/** File/Blob → 压缩 base64（不含 data: 前缀）。GIF 直接原样 base64（canvas
 *  解码 GIF 取首帧 + 透明通道变黑，原样更保真且尺寸通常可接受）。 */
async function compressImage(file: Blob): Promise<ChatImage | null> {
  const mediaType = file.type || "image/png";
  if (!ALLOWED_TYPES.has(mediaType)) return null;
  if (mediaType === "image/gif") {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return { data: btoa(bin), media_type: mediaType };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), media_type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

@customElement("input-box")
export class InputBox extends LitElement {
  static styles = css`
    :host {
      display: block;
      /* 输入框高度基准（= fs-md 行高 + 2×上下留白；随字号缩放。
         消费方可用 --min-h 覆盖为更紧凑的值，如日记记录页 36px） */
      --min-h: calc(var(--cortex-fs-md) * 1.5 + 26px);   /* ≈48px */
    }
    .wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      /* 边框效果：绿色渐变描边（padding-box 白心 + border-box 渐变），跟随 pill 圆角 */
      border: 2px solid transparent;
      border-radius: var(--cortex-radius-pill);
      background:
        linear-gradient(var(--cortex-chat-input-bg), var(--cortex-chat-input-bg)) padding-box,
        linear-gradient(135deg, #16a34a, #22c55e) border-box;
      min-height: var(--min-h);
      padding: 0 3px 0 18px;
      /* 强化：绿色调 elevation 阴影——静止即浮起，作为主动作区 */
      box-shadow: 0 6px 18px rgba(22, 163, 74, 0.12), 0 1px 2px rgba(20, 22, 26, 0.05);
      transition: box-shadow var(--cortex-duration-fast), background var(--cortex-duration-fast);
    }
    /* 有缩略图行时改为大圆角（pill 上沿套缩略图视觉突兀） */
    .wrapper:has(.thumbs) { border-radius: var(--cortex-radius-xl, 20px); }
    .wrapper.drag-over {
      border-color: #16a34a;
      background:
        linear-gradient(var(--cortex-surface-muted), var(--cortex-surface-muted)) padding-box,
        linear-gradient(135deg, #16a34a, #22c55e) border-box;
    }
    .row { display: flex; align-items: center; min-height: var(--min-h); }
    /* 附件模式：左侧 18px 让位给 📎 钮 */
    .wrapper:has(button.attach) .row { padding-left: 0; }
    .wrapper:has(button.attach) { padding-left: 4px; }
    /* 📎 附件按钮：灰 subtle 图标钮（绿色留给发送主键） */
    button.attach {
      flex: 0 0 auto;
      background: transparent;
      color: var(--cortex-text-subtle);
      border: none;
      border-radius: 50%;
      width: calc(var(--min-h) - 10px);
      height: calc(var(--min-h) - 10px);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      margin-right: 2px;
    }
    button.attach:hover:not(:disabled) { background: var(--cortex-surface-muted); color: var(--cortex-text-muted); }
    button.attach:disabled { opacity: 0.4; cursor: not-allowed; }
    /* 缩略图暂存行 */
    .thumbs {
      display: flex;
      gap: 8px;
      padding: 10px 12px 2px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .thumbs::-webkit-scrollbar { display: none; }
    .thumb {
      position: relative;
      flex: 0 0 auto;
      width: 64px;
      height: 64px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface-muted);
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb-loading { animation: cortex-thumb-pulse 1s ease-in-out infinite; }
    @keyframes cortex-thumb-pulse { 0%,100% { opacity: .4 } 50% { opacity: .8 } }
    .thumb-x {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 12px;
      line-height: 18px;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wrapper:focus-within {
      /* 聚焦：绿色渐变描边加深为满色 + 更强 elevation + 绿色光晕环 */
      background:
        linear-gradient(var(--cortex-surface), var(--cortex-surface)) padding-box,
        linear-gradient(135deg, #16a34a, #22c55e) border-box;
      box-shadow: 0 10px 30px rgba(22, 163, 74, 0.20), 0 0 0 4px rgba(22, 163, 74, 0.14);
    }
    input {
      flex: 1;
      /* flex 项默认 min-width:auto——input 会被固有宽度（size=20 ≈ 163px）顶住，
         窄屏移动端（≈300 CSS px，如安卓调大显示大小）把右侧分裂按钮挤出 wrapper。
         显式 min-width:0 允许收缩到固有宽度以下。 */
      min-width: 0;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      /* Shadow DOM 不继承全局 box-sizing，必须显式声明，否则 padding 会把
         height 撑大 2 倍（44px height + 22px padding = 66px 高，移动端 ≈ 2.5 字）。 */
      box-sizing: border-box;
      /* 单行输入框：显式 height + 等高 line-height → 文字 100% 垂直居中 */
      height: var(--min-h);
      line-height: var(--min-h);
      padding: 0;
    }
    textarea {
      flex: 1;
      /* 同 input：允许收缩到固有宽度（cols=20）以下，防窄屏挤出右侧按钮 */
      min-width: 0;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      resize: none;
      /* Shadow DOM 内必须显式声明 box-sizing，否则 min-height 是 content-box
         高度，padding 会叠加在外部导致总高度 = min-height + padding。 */
      box-sizing: border-box;
      /* 多行输入框：min-height 保证 1 行时总高度（含 padding）= wrapper 高度；
         line-height + padding 组合让单行文本视觉上居中（22.5px 文字在 24px
         内容区里 ≈ 完美居中）。实际高度由 _autoResize 按 scrollHeight 撑开。 */
      min-height: var(--min-h);
      line-height: 1.5;
      padding: var(--cortex-input-pad-y, 11px) 0;
    }
    /* multiline 自动扩充：默认单行高度，换行后随内容增高，超出上限内部滚动 */
    textarea {
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    textarea::-webkit-scrollbar {
      display: none;
    }
    input::placeholder, textarea::placeholder { color: var(--cortex-text-subtle); }
    button {
      /* 文档流内按钮：flex: 0 保证不收缩，文本区域（flex:1）自动让位——
         换行点自然落在按钮前，长文不再钻到按钮底下 */
      flex: 0 0 auto;
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-pill);
      /* 上下左右各留 3px（wrapper padding 右 3px，按钮自身贴齐） */
      min-width: calc(var(--min-h) - 6px);
      height: calc(var(--min-h) - 6px);
      padding: 0 14px;
      font-size: var(--cortex-fs-md);
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: filter 0.15s, transform 0.1s;
    }
    button:disabled { filter: saturate(0.4); cursor: not-allowed; box-shadow: none; }
    button:hover:not(:disabled) { filter: brightness(1.05); }
    button:active:not(:disabled) { transform: scale(0.96); }
    /* 停止态：流式中发送键原地变身为「停止」（红色方形图标钮，区别于绿色发送），始终可点 */
    button.stop { background: #dc2626; padding: 0; }
    /* 停止态动画：白色方块呼吸 + 红色光晕扩散，错开节奏传达"正在思考/输出" */
    button.stop { animation: cortex-stop-glow 1.4s ease-in-out infinite; }
    button.stop doclens-icon { animation: cortex-stop-pulse 0.9s ease-in-out infinite; }
    @keyframes cortex-stop-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
      50% { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.28); }
    }
    @keyframes cortex-stop-pulse {
      0%, 100% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      button.stop, button.stop doclens-icon { animation: none; }
    }
    /* 分裂按钮：主体 + caret 拼成单一控件（模式选择器/技能菜单）——文档流内右对齐 */
    .actions.split {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
      margin-left: 8px;
    }
    .actions.split .primary {
      border-radius: var(--cortex-radius-pill) 0 0 var(--cortex-radius-pill);
      /* 分裂按钮：primary 与 caret 拼成单一控件，必须共享同一 elevation；
         抑制主按钮的 glow，避免左半 "漂浮" 而右半扁平的不对称视觉。 */
      box-shadow: none;
    }
    .actions.split .primary:active:not(:disabled) { transform: scale(0.96); }
    .caret {
      box-sizing: border-box;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 0 var(--cortex-radius-pill) var(--cortex-radius-pill) 0;
      box-shadow: none;
      /* 与主按钮同高：上下各留 3px，对齐 wrapper 边缘 */
      height: calc(var(--min-h) - 6px);
      min-width: 28px;
      padding: 0 10px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caret:hover:not(:disabled) { background: var(--cortex-surface-muted); filter: none; }
    .caret:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu {
      position: absolute;
      /* 向上展开：input-box（带模式选择器）只用在 search 初始态，位于页面底端，
         向下展开会落到视口之外不可见。 */
      bottom: calc(100% + 4px);
      right: 6px;
      z-index: 20;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      overflow: hidden;
    }
    .menu-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item-title { font-size: var(--cortex-fs-md); color: var(--cortex-text); font-weight: 500; white-space: nowrap;
      display: inline-flex; align-items: center; gap: var(--cortex-space-2); }
    .menu-item-desc { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); white-space: nowrap; }
    /* 菜单分隔线：技能菜单的「选择技能…」与最近技能之间 */
    .menu-divider { border-top: 1px solid var(--cortex-border-muted); margin: 2px 0; }
    .menu-item.active { background: var(--cortex-primary-soft); }
    .menu-item.active:hover { background: var(--cortex-primary-soft); }
    .menu-item.active .menu-item-title { color: var(--cortex-primary); font-weight: 600; }
    /* 斜杠技能下拉：候选多时限高滚动；左右撑满输入行（继承 .menu 向上展开） */
    .menu.slash-menu { left: 6px; max-height: 320px; overflow-y: auto; }
    @media (max-width: 1023px) {
      /* 移动端稍矮（≈44px），仍随字号缩放 */
      :host { --min-h: calc(var(--cortex-fs-md) * 1.5 + 20px); }
      /* 触屏命中区 ≥44px（ADR-0016 §5 移动端适配） */
      .caret { min-width: 44px; }
      .menu-item { min-height: 44px; justify-content: center; }
    }
  `;

  @property() value = "";
  @property() placeholder = "";
  @property() buttonLabel = "搜索";
  @property() buttonIcon = "";
  /** 图标放在文字右侧（true = 文字在前、图标在后） */
  @property({ type: Boolean }) iconAfter = false;
  @property({ type: Boolean }) multiline = false;
  @property({ type: Boolean }) disabled = false;
  /** 流式中：按钮原地变身为「停止」（发 stop 事件），输入框禁用。仅 chat 用。 */
  @property({ type: Boolean }) streaming = false;

  /** 对话图片附件（ADR-0034）：true 时启用粘贴/📎/拖拽三入口 + 缩略图暂存行。
   *  仅 chat 输入框开启；文字仍是消息主体（必填），图是附件。 */
  @property({ type: Boolean }) attachments = false;
  /** 暂存图片（压缩后 base64，不含 data: 前缀）。宿主只读（经 submit 事件带出，
   *  经 images-restored 事件回填）；增删由组件内部入口驱动。 */
  @property({ attribute: false }) images: ChatImage[] = [];

  /** 模式选择器：提供 .mode + .modes 时渲染分裂按钮 + caret 下拉；
   *  不提供时为遗留单一按钮（chat/files 等消费者不受影响）。 */
  @property() mode: SearchMode = "keyword";
  @property({ attribute: false }) modes: Record<SearchMode, { label: string; icon?: string; description?: string }> | null = null;

  /** 技能菜单（ADR-0016）：非 null 时渲染分裂按钮 + caret 技能菜单（与 modes 互斥，modes 优先）。
   *  数组 = 最近技能（可为空，菜单只显示「选择技能…」）；null = 不启用（普通单按钮）。
   *  caret 在输入为空时禁用（先输入问题才能选技能）；点技能项发 skill-pick，点「选择技能…」发 skill-browse。 */
  @property({ attribute: false }) skillItems: { name: string; icon?: string }[] | null = null;

  /** 斜杠技能引导（chat 专属）：非 null 时，输入以 "/" 开头且仍是纯技能名片段
   *  （/^\/[A-Za-z0-9_.-]*$/）显示过滤下拉；↑↓ 导航、Enter 补全为 "/name "
   *  （不发送）、Esc 关闭。候选由宿主注入（chat-view 的对话技能候选白名单：
   *  启用 ∧ 未删除 ∧ 用户可调用）。 */
  @property({ attribute: false }) slashItems: { name: string; description?: string; icon?: string }[] | null = null;
  @state() private _menuOpen = false;
  @state() private _slashIndex = 0;
  /** Esc 关闭斜杠下拉后的驳回标记：输入变化即复位（再敲字符重新出现） */
  @state() private _slashDismissed = false;

  @query("input, textarea") private inputEl!: HTMLInputElement | HTMLTextAreaElement;
  /** 隐藏文件选择器（📎 入口；移动端主路径） */
  @query("#img-input") private fileInputEl!: HTMLInputElement;
  /** 拖拽悬停高亮 */
  @state() private _dragOver = false;
  /** 压缩进行中（粘贴大图时缩略图延迟出现，给个细条占位） */
  @state() private _compressing = false;

  /** Focus the inner input/textarea element. */
  focus(): void {
    this.inputEl?.focus();
  }

  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    // value 外部更新（如提交后清空）或多行态切换时，重新计算高度
    if (changedProps.has("value") || changedProps.has("multiline")) {
      this._autoResize();
    }
  }

  /** textarea 按内容自动扩充高度：单行起步，换行后增高，超上限内部滚动 */
  private _autoResize() {
    const ta = this.renderRoot.querySelector("textarea");
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  private get trimmed() {
    return this.value.trim();
  }

  private _onInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this.value = target.value;
    this._slashDismissed = false; // 输入变化即复位 Esc 驳回
    this._slashIndex = 0;
    this.dispatchEvent(new CustomEvent("input-change", { detail: { value: this.value } }));
    // 同步更新按钮 disabled 状态，避免 Lit 异步渲染期间 disabled 按钮拦截 click 事件
    const btn = this.renderRoot.querySelector("button");
    if (btn) btn.disabled = !this.trimmed || this.disabled;
    this._autoResize();
  }

  /** 斜杠下拉可见 = 启用（slashItems 非 null）∧ 输入仍是纯技能名片段（斜杠 +
   *  名字字符，无空格——名字敲定即进入问题输入阶段，菜单隐去）∧ 未被 Esc 驳回。 */
  private get _slashMenuOpen(): boolean {
    return (
      this.slashItems !== null &&
      !this._slashDismissed &&
      /^\/[A-Za-z0-9_.-]*$/.test(this.value)
    );
  }

  /** 按已输入片段过滤候选：名字前缀优先段，其次名字含片段段（保持候选原序）。 */
  private get _slashFiltered(): { name: string; description?: string; icon?: string }[] {
    const items = this.slashItems ?? [];
    const token = this.value.slice(1).toLowerCase();
    if (!token) return items;
    const prefix = items.filter((s) => s.name.toLowerCase().startsWith(token));
    const infix = items.filter(
      (s) => !s.name.toLowerCase().startsWith(token) && s.name.toLowerCase().includes(token),
    );
    return [...prefix, ...infix];
  }

  /** 补全选中项：置为 "/name "（尾随空格），菜单随空格自动隐去。 */
  private _completeSlash(item: { name: string }) {
    this.value = `/${item.name} `;
    this._slashIndex = 0;
    this.dispatchEvent(new CustomEvent("input-change", { detail: { value: this.value } }));
    const btn = this.renderRoot.querySelector("button");
    if (btn) btn.disabled = !this.trimmed || this.disabled;
    this._autoResize();
    this.focus();
  }

  private _onKeydown(e: KeyboardEvent) {
    // 斜杠下拉打开时的菜单导航：↑↓ 移动、Enter 补全（不发送）、Esc 驳回
    if (this._slashMenuOpen) {
      const items = this._slashFiltered;
      if (e.key === "ArrowDown" && items.length > 0) {
        e.preventDefault();
        this._slashIndex = (this._slashIndex + 1) % items.length;
        return;
      }
      if (e.key === "ArrowUp" && items.length > 0) {
        e.preventDefault();
        this._slashIndex = (this._slashIndex - 1 + items.length) % items.length;
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this._slashDismissed = true;
        return;
      }
      if (e.key === "Enter" && items.length > 0) {
        e.preventDefault();
        this._completeSlash(items[Math.min(this._slashIndex, items.length - 1)]!);
        return;
      }
    }
    if (e.key !== "Enter") return;
    // multiline：Enter 发送、Shift+Enter 换行；非 multiline：Enter 始终发送
    if (e.shiftKey && this.multiline) return;
    e.preventDefault();
    this._submit();
  }

  private _submit() {
    // 流式中由停止键接管，submit 不触发（textarea 已禁用，此为双保险）
    if (this.streaming || !this.trimmed || this.disabled) return;
    const images = this.attachments && this.images.length > 0 ? this.images : undefined;
    this.dispatchEvent(
      new CustomEvent("submit", { detail: { value: this.trimmed, images } }),
    );
    // 发送即清空暂存（文字由宿主清；图在这里清——submit 后组件自动复位）
    if (images) {
      this.images = [];
      this.dispatchEvent(new CustomEvent("images-change", { detail: { images: [] } }));
    }
  }

  /** ---------- 对话图片附件（ADR-0034） ---------- */

  /** 接收一批待压缩图片文件：白名单外拒收 toast、超上限拒收、GIF 原样透传。 */
  private async _addFiles(files: File[]) {
    if (!this.attachments || this.disabled || this.streaming) return;
    for (const f of files) {
      if (!f.type || !ALLOWED_TYPES.has(f.type)) {
        this.dispatchEvent(new CustomEvent("image-reject", {
          detail: { reason: `不支持的图片格式: ${f.type || "未知"}（支持 png/jpg/webp/gif）` },
        }));
        continue;
      }
      if (this.images.length >= MAX_IMAGES) {
        this.dispatchEvent(new CustomEvent("image-reject", {
          detail: { reason: `最多 ${MAX_IMAGES} 张图片` },
        }));
        break;
      }
      this._compressing = true;
      try {
        const img = await compressImage(f);
        if (img) this._setImages([...this.images, img]);
      } catch {
        this.dispatchEvent(new CustomEvent("image-reject", { detail: { reason: "图片解码失败" } }));
      } finally {
        this._compressing = false;
      }
    }
  }

  /** 更新暂存图并通知宿主（宿主 .images 绑定回组件 → 受控往返）。 */
  private _setImages(images: ChatImage[]) {
    this.images = images;
    this.dispatchEvent(new CustomEvent("images-change", { detail: { images } }));
  }

  private _removeImage(i: number) {
    this._setImages(this.images.filter((_, idx) => idx !== i));
  }

  private _onPaste(e: ClipboardEvent) {
    if (!this.attachments) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgFiles = items
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (imgFiles.length > 0) {
      e.preventDefault(); // 阻止把图片占位符粘进文本框
      void this._addFiles(imgFiles);
    }
  }

  private _onDrop(e: DragEvent) {
    if (!this.attachments) return;
    e.preventDefault();
    this._dragOver = false;
    const files = Array.from(e.dataTransfer?.files ?? []).filter(
      (f) => f.type.startsWith("image/"),
    );
    if (files.length > 0) void this._addFiles(files);
  }

  /** 流式中按钮变身停止键：发 stop 事件（不 submit），始终可点。 */
  private _emitStop() {
    this.dispatchEvent(new CustomEvent("stop"));
  }

  private get _hasModes(): boolean {
    return !!this.modes && this.mode in this.modes;
  }

  /** 技能菜单启用 = skillItems 非 null 且非 modes 模式（modes 优先，两者不共存）。 */
  private get _hasSkillMenu(): boolean {
    return !this._hasModes && this.skillItems !== null;
  }

  private _pickSkill(item: { name: string; icon?: string }) {
    if (!this.trimmed || this.disabled || this.streaming) return;
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("skill-pick", { detail: { name: item.name } }));
  }

  private _browseSkills() {
    if (!this.trimmed || this.disabled || this.streaming) return;
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("skill-browse"));
  }

  private _toggleMenu(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
    if (this._menuOpen) {
      document.addEventListener("click", this._onDocClick);
      // 技能菜单打开时通知宿主刷新候选（设置页可能刚改过启用状态）
      if (this._hasSkillMenu) this.dispatchEvent(new CustomEvent("skill-menu-open"));
    }
  }

  private _onDocClick = () => {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
  };

  private _selectMode(key: SearchMode) {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("mode-change", { detail: { mode: key } }));
  }

  private _renderButton() {
    // 停止态：流式中按钮原地变身为「停止」（红色方形 + 白色实心方块），始终可点
    if (this.streaming) {
      return html`
        <button class="stop" @click=${this._emitStop} aria-label="停止生成">
          <doclens-icon class="filled" name="square" aria-hidden="true"></doclens-icon>
        </button>`;
    }
    if (!this._hasModes && !this._hasSkillMenu) {
      const icon = this.buttonIcon
        ? html`<doclens-icon class="thick" name=${this.buttonIcon} aria-hidden="true"></doclens-icon>`
        : null;
      const label = html`<span>${this.buttonLabel}</span>`;
      return html`
        <button @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${this.iconAfter ? html`${label}${icon}` : html`${icon}${label}`}
        </button>`;
    }
    if (this._hasSkillMenu) {
      // 技能菜单分裂按钮：主键 = 普通发送；caret 弹出技能菜单（空输入禁用——先输入问题才能选技能）
      const icon = this.buttonIcon
        ? html`<doclens-icon class="thick" name=${this.buttonIcon} aria-hidden="true"></doclens-icon>`
        : null;
      const label = html`<span>${this.buttonLabel}</span>`;
      return html`
        <div class="actions split">
          <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
            ${this.iconAfter ? html`${label}${icon}` : html`${icon}${label}`}
          </button>
          <button class="caret" @click=${this._toggleMenu} ?disabled=${!this.trimmed || this.disabled}
                  aria-label="选择技能" aria-expanded=${this._menuOpen}><doclens-icon name="chevron-down"></doclens-icon></button>
        </div>`;
    }
    const cur = this.modes![this.mode];
    return html`
      <div class="actions split">
        <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${cur?.icon ? html`<doclens-icon name=${cur.icon} aria-hidden="true"></doclens-icon>` : null}
          <span>${cur?.label ?? this.buttonLabel}</span>
        </button>
        <button class="caret" @click=${this._toggleMenu} ?disabled=${this.disabled}
                aria-label="切换搜索模式" aria-expanded=${this._menuOpen}><doclens-icon name="chevron-down"></doclens-icon></button>
      </div>`;
  }

  private _renderMenu() {
    if (this._hasSkillMenu) return this._renderSkillMenu();
    if (!this._hasModes || !this._menuOpen) return null;
    return html`
      <div class="menu" role="menu">
        ${(Object.keys(this.modes!) as SearchMode[]).map((key) => {
          const m = this.modes![key];
          return html`
            <div class="menu-item ${key === this.mode ? "active" : ""}" role="menuitem"
                 @click=${() => this._selectMode(key)}>
              <span class="menu-item-title">
                ${m.icon ? html`<span aria-hidden="true">${m.icon}</span>` : null}${m.label}
              </span>
              ${m.description ? html`<span class="menu-item-desc">${m.description}</span>` : null}
            </div>`;
        })}
      </div>`;
  }

  /** 技能菜单：第 1 项固定「选择技能…」（弹对话框），其下为最近 ≤3 个技能。 */
  private _renderSkillMenu() {
    if (!this._menuOpen) return null;
    const items = this.skillItems ?? [];
    return html`
      <div class="menu" role="menu">
        <div class="menu-item" role="menuitem" @click=${this._browseSkills}>
          <span class="menu-item-title"><doclens-icon name="sparkles" aria-hidden="true"></doclens-icon>选择技能…</span>
          <span class="menu-item-desc">从全部启用技能中选择</span>
        </div>
        ${items.length > 0 ? html`<div class="menu-divider" role="separator"></div>` : null}
        ${items.map((item) => html`
          <div class="menu-item" role="menuitem" @click=${() => this._pickSkill(item)}>
            <span class="menu-item-title">
              ${item.icon ? html`<doclens-icon name=${item.icon} aria-hidden="true"></doclens-icon>` : null}${item.name}
            </span>
          </div>`)}
      </div>`;
  }

  /** 斜杠技能引导下拉：输入 "/片段" 时浮现，↑↓/Enter/Esc 由 _onKeydown 处理。 */
  private _renderSlashMenu() {
    if (!this._slashMenuOpen) return null;
    const items = this._slashFiltered;
    if (items.length === 0) return null; // 无匹配：不渲染（提交由宿主阻断提示）
    const idx = Math.min(this._slashIndex, items.length - 1);
    return html`
      <div class="menu slash-menu" role="listbox" aria-label="技能候选">
        ${items.map((item, i) => html`
          <div class="menu-item ${i === idx ? "active" : ""}" role="option"
               aria-selected=${i === idx}
               @click=${() => this._completeSlash(item)}
               @mousemove=${() => (this._slashIndex = i)}>
            <span class="menu-item-title">
              ${item.icon ? html`<doclens-icon name=${item.icon} aria-hidden="true"></doclens-icon>` : null}/${item.name}
            </span>
            ${item.description ? html`<span class="menu-item-desc">${item.description}</span>` : null}
          </div>`)}
      </div>
    `;
  }

  render() {
    // 流式期间禁用输入（不能打字/回车），由停止键接管
    const fieldDisabled = this.disabled || this.streaming;
    const field = this.multiline
      ? html`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${fieldDisabled} @input=${this._onInput} @keydown=${this._onKeydown}
          @paste=${this._onPaste}></textarea>`
      : html`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${fieldDisabled} @input=${this._onInput} @keydown=${this._onKeydown}
          @paste=${this._onPaste} />`;
    return html`
      <div class="wrapper ${this._dragOver ? "drag-over" : ""}"
           @dragover=${(e: DragEvent) => { if (this.attachments) { e.preventDefault(); this._dragOver = true; } }}
           @dragleave=${() => (this._dragOver = false)}
           @drop=${this._onDrop}>
        ${this.attachments ? this._renderThumbRow() : null}
        <div class="row">
          ${this.attachments ? this._renderAttachButton(fieldDisabled) : null}
          ${field}
          ${this._renderButton()}
        </div>
        ${this._renderMenu()}
        ${this._renderSlashMenu()}
      </div>
    `;
  }

  /** 📎 附件按钮（文档流内左侧；图片 icon，灰色 subtle 样式）。 */
  private _renderAttachButton(fieldDisabled: boolean) {
    return html`
      <button class="attach" @click=${() => this.fileInputEl?.click()}
              ?disabled=${fieldDisabled} aria-label="添加图片" title="添加图片">
        <doclens-icon name="image" aria-hidden="true"></doclens-icon>
      </button>
      <input id="img-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
             multiple hidden @change=${(e: Event) => {
               const inp = e.target as HTMLInputElement;
               void this._addFiles(Array.from(inp.files ?? []));
               inp.value = ""; // 允许重复选同一文件
             }} />`;
  }

  /** 缩略图暂存行（输入框上方）：每张 × 删除；压缩中细条占位。 */
  private _renderThumbRow() {
    if (this.images.length === 0 && !this._compressing) return null;
    return html`
      <div class="thumbs">
        ${this.images.map((img, i) => html`
          <div class="thumb">
            <img src="data:${img.media_type};base64,${img.data}" alt="待发送图片 ${i + 1}" />
            <button class="thumb-x" @click=${() => this._removeImage(i)} aria-label="删除图片">×</button>
          </div>`)}
        ${this._compressing ? html`<div class="thumb thumb-loading"></div>` : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "input-box": InputBox;
  }
}
