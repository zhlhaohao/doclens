/**
 * Vitest (jsdom) 全局 setup：补齐 jsdom 缺失的浏览器 API。
 *
 * - ResizeObserver：jsdom 未实现，md-viewer 的 ScrollJumpController 依赖它。
 * - IntersectionObserver：jsdom 未实现，password-section 的可见性刷新依赖它。
 * - HTMLDialogElement.showModal/close：jsdom 29 未实现 <dialog> 模态 API
 *   （happy-dom 有）。files-view 的 updated() 对所有对话框调 showModal()，
 *   缺失时 "dlg.showModal is not a function" 会让整个组件渲染炸掉。
 *   polyfill：showModal 置 open=true（jsdom 不渲染 top-layer，视觉语义无关紧要）。
 */
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverMock {
  observe(): void {}
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
