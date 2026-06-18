/** 前端全局状态类型定义。 */

export type ViewId = "search" | "chat" | "history";
export type FocusState = "initial" | "focus";

export interface SearchResult {
  path: string;
  snippet: string;
  score: number;
  line: number | null;
  highlights: [number, number][];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Session {
  id: string;
  type: "search" | "chat";
  title: string;
  preview: string;
  updated_at: string;
  message_count: number;
}

export interface SearchViewState {
  state: FocusState;
  currentSession: Session | null;
  query: string;
  results: SearchResult[];
  total: number;
  source: "fts" | "like" | "ripgrep";
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

export interface SystemStatus {
  indexed_docs: number;
  index_path: string;
  total_size_bytes: number;
  file_types: Record<string, number>;
}

export interface AppState {
  view: ViewId;
  search: SearchViewState;
  chat: ChatViewState;
  /** 详情推入栈（移动端整页推入） */
  detailStack: SearchResult[];
  /** 跨视图会话加载请求（history-view → search-view / chat-view） */
  pendingSession: Session | null;
  status: SystemStatus | null;
  error: string | null;
}
