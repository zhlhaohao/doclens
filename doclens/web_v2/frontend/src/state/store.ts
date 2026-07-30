/** 轻量全局 store —— 基于 EventTarget + 订阅模式。
 *
 * 不引入 Redux/Zustand。组件通过 `store.subscribe(selector, cb)`
 * 订阅特定切片，状态变化时自动回调。
 */
import type {
  AppState,
  FileEntry,
  IndexedDocument,
  Session,
  SettingsFieldValues,
  SettingsScope,
  WatchChange,
} from "./types";

function computeDirty(
  original: SettingsFieldValues,
  values: SettingsFieldValues,
): boolean {
  const keys = new Set([...Object.keys(original), ...Object.keys(values)]);
  for (const k of keys) {
    if ((original[k] ?? "") !== (values[k] ?? "")) return true;
  }
  return false;
}

function dirtyFieldList(
  original: SettingsFieldValues,
  values: SettingsFieldValues,
): string[] {
  const keys = new Set([...Object.keys(original), ...Object.keys(values)]);
  const changed: string[] = [];
  for (const k of keys) {
    if ((original[k] ?? "") !== (values[k] ?? "")) changed.push(k);
  }
  return changed;
}

export const INITIAL_STATE: AppState = {
  view: "search",
  auth: { required: null, authenticated: false, hasPassword: false },
  search: {
    state: "initial",
    currentSession: null,
    query: "",
    queryWords: [],
    results: [],
    total: 0,
    source: "fts",
    offset: 0,
    limit: 20,
  },
  chat: {
    state: "initial",
    currentSession: null,
    messages: [],
    streaming: false,
  },
  detailStack: [],
  pendingSession: null,
  status: null,
  watcher: null,
  syncStatus: null,
  watchRecentChanges: [],
  reindex: { dialog: "closed", current_file: null, indexed_count: 0, result: null, error: null },
  error: null,
  settings: {
    scope: "global",
    values: {},
    original: {},
    dirty: false,
    exists: true,
    saving: false,
    error: null,
  },
  files: {
    treeCache: {},
    expandedPaths: [],
    currentDir: "",
    selectedPaths: [],
    lastSelectedAnchor: null,
    detail: null,
    detailLoading: false,
    listing: false,
    mobilePane: "tree",
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
};

type Listener = (state: AppState) => void;
type Selector<T> = (state: AppState) => T;

class CortexStore {
  private state: AppState = INITIAL_STATE;
  private listeners = new Set<Listener>();

  getState(): AppState {
    return this.state;
  }

  setState(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((cb) => cb(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 选择器订阅 —— 仅当 selector 返回值变化时回调 */
  subscribeSelector<T>(selector: Selector<T>, cb: (slice: T) => void): () => void {
    let last = selector(this.state);
    return this.subscribe((state) => {
      const next = selector(state);
      if (next !== last) {
        last = next;
        cb(next);
      }
    });
  }
}

export const store = new CortexStore();

// 便捷 action 工厂
export const actions = {
  setView(view: AppState["view"]) {
    store.setState({ view });
  },

  setAuthState(patch: Partial<AppState["auth"]>) {
    const cur = store.getState().auth;
    store.setState({ auth: { ...cur, ...patch } });
  },

  setSearchState(s: Partial<AppState["search"]>) {
    const cur = store.getState().search;
    store.setState({ search: { ...cur, ...s } });
  },

  setChatState(s: Partial<AppState["chat"]>) {
    const cur = store.getState().chat;
    store.setState({ chat: { ...cur, ...s } });
  },

  pushDetail(result: AppState["detailStack"][number]) {
    const cur = store.getState().detailStack;
    store.setState({ detailStack: [...cur, result] });
  },

  popDetail() {
    const cur = store.getState().detailStack;
    if (cur.length === 0) return;
    store.setState({ detailStack: cur.slice(0, -1) });
  },

  setError(error: string | null) {
    store.setState({ error });
  },

  setStatus(s: AppState["status"]) {
    store.setState({ status: s });
  },

  setPendingSession(session: Session | null) {
    store.setState({ pendingSession: session });
  },

  setWatcherStatus(w: AppState["watcher"]) {
    store.setState({ watcher: w });
  },

  setSyncStatus(s: AppState["syncStatus"]) {
    store.setState({ syncStatus: s });
  },

  setWatchRecentChanges(list: WatchChange[]) {
    store.setState({ watchRecentChanges: list });
  },

  openReindexConfirm() {
    const r = store.getState().reindex;
    store.setState({ reindex: { ...r, dialog: "confirm" } });
  },

  startReindex() {
    store.setState({
      reindex: {
        ...store.getState().reindex,
        dialog: "running", current_file: null, indexed_count: 0, result: null, error: null,
      },
    });
  },

  setReindexProgress(p: { current_file: string; indexed_count: number }) {
    const r = store.getState().reindex;
    if (r.dialog !== "running") return;
    store.setState({ reindex: { ...r, current_file: p.current_file, indexed_count: p.indexed_count } });
  },

  finishReindex(res: { success: boolean; doc_count: number; failed_count: number }) {
    store.setState({ reindex: { ...store.getState().reindex, dialog: "done", result: res } });
  },

  failReindex(msg: string) {
    store.setState({ reindex: { ...store.getState().reindex, dialog: "error", error: msg } });
  },

  closeReindex() {
    store.setState({
      reindex: { dialog: "closed", current_file: null, indexed_count: 0, result: null, error: null },
    });
  },

  setSettingsScope(_scope: SettingsScope) {
    // local config disabled, scope is always global
  },

  loadSettings(values: SettingsFieldValues, exists: boolean) {
    const cur = store.getState().settings;
    store.setState({
      settings: {
        ...cur,
        values: { ...values },
        original: { ...values },
        exists,
        dirty: false,
        error: null,
      },
    });
  },

  updateSetting(field: string, value: string) {
    const cur = store.getState().settings;
    const values = { ...cur.values, [field]: value };
    const dirty = computeDirty(cur.original, values);
    store.setState({ settings: { ...cur, values, dirty } });
  },

  revertSettings() {
    const cur = store.getState().settings;
    const values = { ...cur.original };
    store.setState({ settings: { ...cur, values, dirty: false } });
  },

  setSettingsSaving(saving: boolean) {
    const cur = store.getState().settings;
    store.setState({ settings: { ...cur, saving } });
  },

  setSettingsError(error: string | null) {
    const cur = store.getState().settings;
    store.setState({ settings: { ...cur, error } });
  },

  setFilesState(s: Partial<AppState["files"]>) {
    const cur = store.getState().files;
    store.setState({ files: { ...cur, ...s } });
  },

  expandDir(path: string) {
    const cur = store.getState().files;
    if (cur.expandedPaths.includes(path)) return;
    store.setState({ files: { ...cur, expandedPaths: [...cur.expandedPaths, path] } });
  },

  collapseDir(path: string) {
    const cur = store.getState().files;
    store.setState({ files: { ...cur, expandedPaths: cur.expandedPaths.filter(p => p !== path) } });
  },

  selectDir(path: string) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        currentDir: path,
        selectedPaths: [],
        lastSelectedAnchor: null,
        detail: null,
        mobilePane: cur.mobilePane === "tree" ? "list" : cur.mobilePane,
      },
    });
  },

  selectEntry(path: string, opts: { ctrl?: boolean; shift?: boolean } = {}) {
    const cur = store.getState().files;
    let next: string[];
    let anchor: string | null = cur.lastSelectedAnchor;
    if (opts.shift && anchor !== null) {
      const entries = cur.treeCache[cur.currentDir] || [];
      const paths = entries.map(e => e.path);
      const a = paths.indexOf(anchor);
      const b = paths.indexOf(path);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        next = paths.slice(lo, hi + 1);
      } else {
        next = [path];
        anchor = path;
      }
    } else if (opts.ctrl) {
      next = cur.selectedPaths.includes(path)
        ? cur.selectedPaths.filter(p => p !== path)
        : [...cur.selectedPaths, path];
      anchor = path;
    } else {
      next = [path];
      anchor = path;
    }
    store.setState({ files: { ...cur, selectedPaths: next, lastSelectedAnchor: anchor } });
  },

  clearSelection() {
    const cur = store.getState().files;
    store.setState({
      files: { ...cur, selectedPaths: [], lastSelectedAnchor: null, detail: null },
    });
  },

  invalidateDir(dirPath: string) {
    const cur = store.getState().files;
    const nextCache = { ...cur.treeCache };
    delete nextCache[dirPath];
    store.setState({ files: { ...cur, treeCache: nextCache } });
  },

  invalidateSubtree(prefix: string) {
    const cur = store.getState().files;
    const nextCache: Record<string, FileEntry[]> = {};
    for (const [k, v] of Object.entries(cur.treeCache)) {
      if (k !== prefix && !k.startsWith(prefix + "/")) {
        nextCache[k] = v;
      }
    }
    store.setState({ files: { ...cur, treeCache: nextCache } });
  },

  setMobilePane(pane: "tree" | "list" | "detail") {
    const cur = store.getState().files;
    store.setState({ files: { ...cur, mobilePane: pane } });
  },

  loadIndexedDocuments(docs: IndexedDocument[]) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          allDocs: docs,
          docsLoading: false,
          docsError: null,
        },
      },
    });
  },

  setFilenameSearchDocsError(message: string) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          docsLoading: false,
          docsError: message,
        },
      },
    });
  },

  setFilenameSearchQuery(payload: {
    query: string;
    results: IndexedDocument[];
    totalMatches: number;
  }) {
    const cur = store.getState().files;
    const isActive = payload.query.trim() !== "";
    const selectedPath = isActive
      ? (payload.results[0]?.path ?? null)
      : null;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          query: payload.query,
          results: payload.results,
          totalMatches: payload.totalMatches,
          isActive,
          selectedPath,
        },
      },
    });
  },

  clearFilenameSearch() {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: {
          ...cur.filenameSearch,
          query: "",
          results: [],
          totalMatches: 0,
          isActive: false,
          selectedPath: null,
        },
      },
    });
  },

  selectFilenameSearchResult(path: string | null) {
    const cur = store.getState().files;
    store.setState({
      files: {
        ...cur,
        filenameSearch: { ...cur.filenameSearch, selectedPath: path },
      },
    });
  },
};

export function selectSettingsDirtyFields(state: AppState): string[] {
  return dirtyFieldList(state.settings.original, state.settings.values);
}
