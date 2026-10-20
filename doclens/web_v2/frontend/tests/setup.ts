/**
 * Vitest (jsdom) 全局 setup：补齐 jsdom 缺失的浏览器 API。
 *
 * - ResizeObserver：jsdom 未实现，md-viewer 的 ScrollJumpController 依赖它。
 * - IntersectionObserver：jsdom 未实现，password-section 的可见性刷新依赖它。
 * - HTMLDialogElement.showModal/close：jsdom 29 未实现 <dialog> 模态 API
 *   （happy-dom 有）。files-view 的 updated() 对所有对话框调 showModal()，
 *   缺失时 "dlg.showModal is not a function" 会让整个组件渲染炸掉。
 *   polyfill：showModal 置 open=true（jsdom 不渲染 top-layer，视觉语义无关紧要）。
 * - Document.execCommand：jsdom 未实现。CodeMirror 6 的 Safari 选区兼容
 *   hack（shadow DOM 下的 Selection 读取）会调 execCommand("indent")，
 *   缺失时抛 "execCommand is not a function" 让 cm-editor 的选区操作炸掉。
 *   polyfill：返回 false（不执行任何命令），仅让 CM6 的兼容路径能走完。
 */
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverMock {
  private callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  /** observe 即同步回调 isIntersecting=true：md-viewer 分页懒渲染在测试环境
   *  保持「全部页立即渲染」语义（真实浏览器走原生 IntersectionObserver）。 */
  observe(target: Element): void {
    this.callback(
      [{ target, isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

(globalThis as Record<string, unknown>).ResizeObserver ??= ResizeObserverMock;
(globalThis as Record<string, unknown>).IntersectionObserver ??= IntersectionObserverMock;

if (typeof HTMLDialogElement !== "undefined" &&
    typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom 未实现 execCommand：CM6 的 Safari 选区兼容 hack 会调用它。
// 桩成恒返回 false（不执行命令），让兼容路径能走完而不炸。
if (typeof Document !== "undefined" &&
    typeof Document.prototype.execCommand !== "function") {
  Document.prototype.execCommand = function () {
    return false;
  };
}

// jsdom 未实现 Range.getClientRects：CM6 的文本测量（measureTextSize）
// 会调用它，缺失时抛 "getClientRects is not a function"（异步，发生在
// requestAnimationFrame 里 → vitest 记为 unhandled error）。
// 桩成空列表：CM6 拿不到矩形时走默认行高估算，测试不依赖真实布局。
if (typeof Range !== "undefined" &&
    typeof Range.prototype.getClientRects !== "function") {
  Range.prototype.getClientRects = function () {
    return [] as unknown as DOMRectList;
  };
}
if (typeof Range !== "undefined" &&
    typeof Range.prototype.getBoundingClientRect !== "function") {
  Range.prototype.getBoundingClientRect = function () {
    return {
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}
