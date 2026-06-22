import { store } from "../src/state/store";

export function resetStore(target: typeof store) {
  // 重置 store 到初始 state；具体字段由各测试自己 setXxxState 设置
  target.setState({
    view: "search",
    search: { state: "initial", currentSession: null, query: "", results: [], total: 0, source: "fts", offset: 0, limit: 20 },
    chat: { state: "initial", currentSession: null, messages: [], streaming: false },
    settings: { scope: "local", values: {}, original: {}, dirty: false, exists: true, saving: false, error: null },
    files: { treeCache: {}, expandedPaths: [], currentDir: "", selectedPaths: [], lastSelectedAnchor: null, detail: null, detailLoading: false, listing: false, mobilePane: "tree", pendingAction: null, error: null },
    detailStack: [],
    pendingSession: null,
    status: null,
    error: null,
  });
}