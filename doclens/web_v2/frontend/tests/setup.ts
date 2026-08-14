/**
 * Vitest (jsdom) 全局 setup：补齐 jsdom 缺失的浏览器 API。
 *
 * - ResizeObserver：jsdom 未实现，md-viewer 的 ScrollJumpController 依赖它。
 */
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

(globalThis as Record<string, unknown>).ResizeObserver ??= ResizeObserverMock;
