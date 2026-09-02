import { store } from "../src/state/store";

export function resetStore(target: typeof store) {
  // 重置 store 到初始 state；具体字段由各测试自己 setXxxState 设置
  target.setState({
    view: "search",
    search: { state: "initial", currentSession: null, query: "", queryWords: [], results: [], total: 0, source: "fts", offset: 0, limit: 20 },
    chat: { state: "initial", currentSession: null, messages: [], streaming: false, pendingAsk: null },
    settings: { scope: "local", values: {}, original: {}, dirty: false, exists: true, saving: false, error: null },
    files: {
      treeCache: {},
      expandedPaths: [],
      currentDir: "",
      selectedPaths: [],
      lastSelectedAnchor: null,
      detail: null,
      detailLoading: false,
      listing: false,
      mobilePane: "list",
      pendingAction: null,
      error: null,
      filenameSearch: {
        query: "",
        allDocs: [],
        docsLoading: true,
        docsError: null,
        results: [],
        selectedPath: null,
        isActive: false,
        totalMatches: 0,
      },
    },
    detailStack: [],
    pendingSession: null,
    status: null,
    error: null,
  });
}

/** 设置 jsdom 的 innerWidth 为移动端尺寸（390px，模拟 iPhone 13）。 */
export function setMobileViewport() {
  Object.defineProperty(window, "innerWidth", {
    writable: true, configurable: true, value: 390,
  });
}

/** 恢复 jsdom 的 innerWidth 为桌面端尺寸（1280px）。 */
export function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", {
    writable: true, configurable: true, value: 1280,
  });
}