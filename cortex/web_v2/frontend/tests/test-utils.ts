import { store } from "../src/state/store";

export function resetStore(target: typeof store) {
  // 重置 store 到初始 state；具体字段由各测试自己 setXxxState 设置
  target.setState({
    view: "search",
    search: { state: "initial", query: "", results: [], total: 0, source: "fts" },
    chat: { messages: [], sessions: [] },
    history: { sessions: [] },
    settings: { scope: "local", values: {}, original: {}, dirty: false, saving: false, error: null },
    detailStack: [],
    pendingSession: null,
  });
}