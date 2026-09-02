/** 前端全局状态类型定义。 */

export type ViewId = "search" | "chat" | "settings" | "files" | "diary" | "login";
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

export interface Reference {
  path: string;
}

/** 技能对话待发送请求（files 工具箱确认后写入，chat-view 消费一次）。 */
export interface PendingSkillChat {
  /** 完整拼好的用户消息（技能标记 + 文件清单 + 补充 prompt） */
  message: string;
  /** 新会话标题（技能名 + 首文件名） */
  title: string;
  /** 技能会话声明：创建 session 时写 mode="skill"（后端据此切换提取式引文策展） */
  isSkill: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_steps?: ToolStep[];
  /** 结构化引用：后端从检索工具结果提取，前端渲染为可点击的引用卡片 */
  references?: Reference[];
}

/** ask_user_question 悬置问题（SSE ask 事件 → store → ask-card 组件） */
export interface PendingAsk {
  requestId: string;
  questions: {
    question: string;
    header: string;
    multiSelect: boolean;
    options: { label: string; description: string }[];
  }[];
}

export interface Session {
  id: string;
  type: "search" | "chat";
  title: string;
  preview: string;
  updated_at: string;
  message_count: number;
  /** search: "keyword" | "grep"；chat 技能会话: "skill" */
  mode?: "keyword" | "grep" | "skill";
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
  /** ask_user_question 悬置问题（null = 无）；悬置期间禁用发送 */
  pendingAsk: PendingAsk | null;
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

/** 近期文件变化条目（来自 FileWatcher 的 on_change 回调，经 SSE status 快照下发）。 */
export interface WatchChange {
  path: string;   // 相对 workdir 的路径
  name: string;   // 文件名
  ts: number;     // unix 秒
}

export interface ReindexResult {
  success: boolean;
  doc_count: number;
  failed_count: number;
}

/** Git 同步状态快照（ADR-0006，后端 doclens/git_sync.py）。
 *  经 /api/status 与 SSE status 快照下发；message 非空 = 状态栏弱提醒。 */
export interface GitSyncStatus {
  running: boolean;
  /** 未启动原因："" | "not_git_root" | "no_remote" */
  reason: string;
  last_sync_at: number | null;
  last_success: boolean | null;
  /** 弱提醒文案（"" = 无提醒） */
  message: string;
  fail_count: number;
}

export interface ReindexState {
  dialog: "closed" | "confirm" | "running" | "done" | "error";
  current_file: string | null;
  indexed_count: number;
  sub_label: string | null;
  result: ReindexResult | null;
  error: string | null;
}

export interface SystemStatus {
  indexed_docs: number;
  index_path: string;
  /** 工作目录（绝对路径），welcome-pane 用以展示当前检索范围 */
  workdir?: string;
  total_size_bytes: number;
  file_types: Record<string, number>;
  /** 当前 AI 模型 id（后端从 CortexConfig.planify_model_id 读）。空字符串表示未配置。 */
  model_name?: string;
  watcher?: WatcherStatus | null;
  /** Git 同步快照；null/undefined = 同步循环未注册 */
  sync?: GitSyncStatus | null;
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
  mobilePane: "list" | "detail";
  pendingAction: "mkdir" | "delete" | "move" | "rename" | "upload" | null;
  error: string | null;
  filenameSearch: FilenameSearchState;
}

/** 登录态：required=null 表示尚未向后端探测（启动瞬间）。 */
export interface AuthState {
  required: boolean | null;
  authenticated: boolean;
  hasPassword: boolean;
}

/** Diary page（日记：记录 / 回顾 两个子页，ADR-0007） */
export interface DiaryFragment {
  fid: string;
  time: string;                 // HH:MM
  kind: "text" | "photo";
  text: string;                 // 文字内容，或图片备注
  image_url: string | null;     // 可直接用于 <img src>（仅 photo）
}

export interface DiaryEntry {
  date: string;                 // YYYY-MM-DD
  state: "raw" | "summarized" | "empty";
  fragments: DiaryFragment[];
  /** 成品 md（图片引用已被后端重写为 /api/preview/raw URL） */
  content: string;
  /** 当日城市（md 标题 📍city） */
  city: string;
}

export interface DiaryViewState {
  tab: "record" | "review";
  /** 服务器本地今天（记录页的录入归属日） */
  today: string;
  todayEntry: DiaryEntry | null;
  recordLoading: boolean;
  submitting: boolean;
  reviewDate: string;
  reviewEntry: DiaryEntry | null;
  reviewLoading: boolean;
  /** 日历打点面板：当前展示月份 + 该月有内容的日期 */
  calendarMonth: string;        // YYYY-MM
  calendarDates: string[];
  calendarOpen: boolean;
  /** 城市选择对话框（录入时当天无城市则弹） */
  cityDialogOpen: boolean;
  error: string | null;
}

export interface AppState {
  view: ViewId;
  auth: AuthState;
  search: SearchViewState;
  chat: ChatViewState;
  /** 详情推入栈（移动端整页推入） */
  detailStack: SearchResult[];
  /** 跨视图会话加载请求（search-view ↔ chat-view） */
  pendingSession: Session | null;
  /** 跨视图技能对话发送请求（files 工具箱 → chat-view 自动新建会话并发送） */
  pendingSkillChat: PendingSkillChat | null;
  status: SystemStatus | null;
  watcher: WatcherStatus | null;   // 来自 SSE /api/watch/events 的 status 快照
  /** Git 同步状态（SSE status 快照 / /api/status 携带；null = 未注册） */
  syncStatus: GitSyncStatus | null;
  /** 近期文件变化（SSE status 快照携带，watch-changes-dialog 展示） */
  watchRecentChanges: WatchChange[];
  reindex: ReindexState;
  error: string | null;
  settings: SettingsViewState;
  files: FileExplorerViewState;
  diary: DiaryViewState;
}
