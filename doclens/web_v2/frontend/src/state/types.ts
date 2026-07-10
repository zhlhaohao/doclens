/** 前端全局状态类型定义。 */

export type ViewId = "search" | "chat" | "settings" | "files";
export type FocusState = "initial" | "focus";
export type SearchMode = "keyword" | "grep";

export interface SearchResult {
  path: string;
  snippet: string;
  score: number;
  line: number | null;
  highlights: [number, number][];
  kind?: "content" | "path";
}

export type ToolStepStatus = "running" | "done" | "error";

export interface ToolStep {
  tool_use_id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  is_error?: boolean;
  duration_ms?: number;
  status: ToolStepStatus;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_steps?: ToolStep[];
}

export interface Session {
  id: string;
  type: "search" | "chat";
  title: string;
  preview: string;
  updated_at: string;
  message_count: number;
  mode?: "keyword" | "grep";
}

export interface SearchViewState {
  state: FocusState;
  currentSession: Session | null;
  query: string;
  /** 后端分词结果，用于预览 pane 高亮（空数组时降级回 query 原文）。 */
  queryWords: string[];
  results: SearchResult[];
  total: number;
  source: "fts" | "like" | "ripgrep" | "grep";
  offset: number;
  limit: number;
}

export interface ChatViewState {
  state: FocusState;
  currentSession: Session | null;
  messages: ChatMessage[];
  streaming: boolean;
}

export interface HistoryEntry {
  session: Session;
}

export interface WatcherStatus {
  enabled?: boolean;            // 仅 /api/status 返回；/api/watch/status 顶层才有
  running: boolean;
  reindexing: boolean;
  changed_count: number;
  last_reindex_at: number | null;
  last_doc_count: number | null;
  last_success: boolean | null;
}

export interface ReindexResult {
  success: boolean;
  doc_count: number;
  failed_count: number;
}

export interface ReindexState {
  dialog: "closed" | "confirm" | "running" | "done" | "error";
  current_file: string | null;
  indexed_count: number;
  result: ReindexResult | null;
  error: string | null;
}

export interface SystemStatus {
  indexed_docs: number;
  index_path: string;
  total_size_bytes: number;
  file_types: Record<string, number>;
  watcher?: WatcherStatus | null;
}

/** Settings page */
export type SettingsScope = "local" | "global";
export type SettingsFieldValues = Record<string, string>;

export interface SettingsViewState {
  scope: SettingsScope;
  values: SettingsFieldValues;
  original: SettingsFieldValues;   // snapshot at load / last save
  dirty: boolean;                   // recomputed on every action for convenience
  exists: boolean;                  // does the target .env exist on disk?
  saving: boolean;
  error: string | null;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_at: string;
  indexed: boolean;
  writable: boolean;
  has_child_dirs: boolean;
}

export interface FileAttrs extends FileEntry {
  created_at: string;
  extension: string | null;
  is_protected: boolean;
}

export interface IndexedDocument {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;  // ISO8601
}

export interface FilenameSearchState {
  query: string;
  allDocs: IndexedDocument[];
  docsLoading: boolean;
  docsError: string | null;
  results: IndexedDocument[];
  selectedPath: string | null;
  isActive: boolean;
  totalMatches: number;
}

export interface FileExplorerViewState {
  treeCache: Record<string, FileEntry[]>;
  expandedPaths: string[];
  currentDir: string;
  selectedPaths: string[];
  lastSelectedAnchor: string | null;
  detail: FileAttrs | null;
  detailLoading: boolean;
  listing: boolean;
  mobilePane: "tree" | "list" | "detail";
  pendingAction: "mkdir" | "delete" | "move" | "rename" | "upload" | null;
  error: string | null;
  filenameSearch: FilenameSearchState;
}

export interface AppState {
  view: ViewId;
  search: SearchViewState;
  chat: ChatViewState;
  /** 详情推入栈（移动端整页推入） */
  detailStack: SearchResult[];
  /** 跨视图会话加载请求（search-view ↔ chat-view） */
  pendingSession: Session | null;
  status: SystemStatus | null;
  watcher: WatcherStatus | null;   // 来自 /api/watch/status 的轮询
  reindex: ReindexState;
  error: string | null;
  settings: SettingsViewState;
  files: FileExplorerViewState;
}
