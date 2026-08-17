import { request } from "./client";

/** ask_user_question 单个问题的答案 */
export interface AskAnswer {
  question: string;
  selected: string[];
  other: string | null;
}

/** respond 超时（毫秒）：连接池排队/网络异常时把「永久提交中」变成明确报错 */
const RESPOND_TIMEOUT_MS = 10_000;

/** POST /api/ask/respond —— 回传悬置问题的答案。
 *  submitted=false 表示 request_id 已失效（超时/已答），前端据此置卡片为失效态。 */
export async function respondAsk(
  req: { request_id: string; answers: AskAnswer[]; session_id?: string },
): Promise<{ ok: boolean; submitted: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RESPOND_TIMEOUT_MS);
  try {
    return await request<{ ok: boolean; submitted: boolean }>("/api/ask/respond", {
      method: "POST",
      json: req,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** SSE ask 事件携带的 questions 结构（handler 校验后经 JSON 序列化下发） */
export interface AskQuestionPayload {
  question: string;
  header: string;
  multiSelect: boolean;
  options: { label: string; description: string }[];
}

/** 解析 SSE ask 事件的 questions_json；解析失败返回 null（事件作废）。 */
export function parseAskQuestions(questionsJson: string): AskQuestionPayload[] | null {
  try {
    const d = JSON.parse(questionsJson);
    if (!Array.isArray(d?.questions)) return null;
    const qs = d.questions as AskQuestionPayload[];
    if (qs.length === 0) return null;
    const valid = qs.every(
      (q) =>
        typeof q?.question === "string" &&
        typeof q?.header === "string" &&
        Array.isArray(q?.options) &&
        q.options.length >= 2 &&
        q.options.every((o) => typeof o?.label === "string"),
    );
    return valid ? qs : null;
  } catch {
    return null;
  }
}

/** 剥离推荐前缀（(Recommended) / （推荐）），返回 [净 label, 是否推荐]。 */
export function splitRecommended(label: string): [string, boolean] {
  const m = label.match(/^\((?:Recommended|推荐)\)\s*/);
  if (m) return [label.slice(m[0].length), true];
  if (label.endsWith("（推荐）")) return [label.slice(0, -4), true];
  if (label.endsWith("(推荐)")) return [label.slice(0, -4), true];
  return [label, false];
}
