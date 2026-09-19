/** 会话 items → 渲染时间线的纯函数集（ADR-0027：回退即事实）。

 * mapSessionItemsToMessages：items → 活消息（store.messages 口径）；
 * buildChatTimeline：items → 活消息 + 回退折叠条（dividers）；
 * mergeTimeline：折叠条与（流式中的）消息数组合成渲染节点序列。
 *
 * 死段语义与后端 project_live_items 一一对应：每条 rewound 边界的死段 =
 * 闭区间 [point_seq, boundary_seq]，多条边界取并集；锚点消息本身也在死段
 * （内容已回填输入框，折叠条展开时仍可查看）。
 */
import type { ChatMessage } from "../state/types";
import type { ToolStep, Reference } from "../state/types";

/** 单条回退折叠条（展示层消费；纯查看，无恢复入口）。 */
export interface RewindDivider {
  /** 锚点 message_user 的 seq（回填输入框的那条） */
  pointSeq: number;
  /** rewound 边界条目自身的 seq（时间线插入位置） */
  boundarySeq: number;
  /** 该边界折叠的消息（映射后的 ChatMessage，含锚点） */
  dead: ChatMessage[];
}

/** chat-stream 的渲染节点：活消息或折叠条。 */
export type TimelineNode =
  | { type: "message"; message: ChatMessage }
  | ({ type: "rewind-divider" } & RewindDivider);

interface RawItem {
  kind: string;
  payload: string;
  seq?: number;
}

/** 单条 item → ChatMessage（message_user 带锚点 seq）；非消息条目返回 null。 */
function mapItem(it: RawItem): ChatMessage | null {
  let payload: any;
  try {
    payload = JSON.parse(it.payload);
  } catch {
    return null;
  }
  if (it.kind === "message_user") {
    const msg: ChatMessage = { role: "user", content: payload.content ?? "" };
    if (typeof it.seq === "number") msg.seq = it.seq;
    return msg;
  }
  if (it.kind === "message_ai") {
    const tool_steps: ToolStep[] = (payload.tool_calls ?? []).map((tc: any) => ({
      tool_use_id: tc.tool_use_id ?? "",
      name: tc.name ?? "",
      input: tc.input ?? {},
      output: tc.output,
      is_error: tc.is_error,
      duration_ms: tc.duration_ms,
      status: tc.is_error ? ("error" as const) : ("done" as const),
    }));
    const references: Reference[] = (payload.references ?? [])
      .map((r: any) => ({ path: String(r?.path ?? "") }))
      .filter((r: Reference) => r.path.length > 0);
    const msg: ChatMessage = { role: "assistant", content: payload.content ?? "" };
    if (tool_steps.length) msg.tool_steps = tool_steps;
    if (references.length) msg.references = references;
    // assistant 也带 seq：折叠数统计（含 AI 回答）与 mergeTimeline 插入定位都依赖
    if (typeof it.seq === "number") msg.seq = it.seq;
    return msg;
  }
  return null;
}

/** 把后端 session_items 映射为 ChatMessage[]（活消息）；tool_calls →
 *  tool_steps，老数据向后兼容。user 消息携带 seq（回退锚点定位）。 */
export function mapSessionItemsToMessages(items: RawItem[]): ChatMessage[] {
  return buildChatTimeline(items).messages;
}

/** items → { messages: 活消息, dividers: 回退折叠条 }。

 * 死段内条目全部折叠（含 compacted/usage 等非消息条目——它们本就不渲染，
 * 自然消失）；每条边界的折叠桶 = 其区间内消息中**未被更早边界认领**的部分
 * （区间可重叠，归属最早边界，避免同一条消息出现在两个折叠条里）。
 */
export function buildChatTimeline(items: RawItem[]): {
  messages: ChatMessage[];
  dividers: RewindDivider[];
} {
  // 边界区间（按 boundary seq 升序，与 items 顺序一致）
  const intervals: Array<{ point: number; boundary: number }> = [];
  for (const it of items) {
    if (it.kind !== "rewound" || typeof it.seq !== "number") continue;
    try {
      const p = JSON.parse(it.payload);
      if (typeof p?.point_seq === "number") {
        intervals.push({ point: p.point_seq, boundary: it.seq });
      }
    } catch {
      // 坏 payload 边界忽略（与后端容错一致）
    }
  }
  const dead = (seq: number): number => {
    for (let i = 0; i < intervals.length; i++) {
      if (intervals[i].point <= seq && seq <= intervals[i].boundary) return i;
    }
    return -1;
  };

  const buckets: ChatMessage[][] = intervals.map(() => []);
  const messages: ChatMessage[] = [];
  for (const it of items) {
    const msg = mapItem(it);
    if (msg === null) continue;
    const owner = typeof it.seq === "number" ? dead(it.seq) : -1;
    if (owner >= 0) buckets[owner].push(msg);
    else messages.push(msg);
  }
  const dividers: RewindDivider[] = intervals.map((iv, i) => ({
    pointSeq: iv.point,
    boundarySeq: iv.boundary,
    dead: buckets[i],
  }));
  return { messages, dividers };
}

/** 折叠条 × 消息数组 → 渲染节点序列：折叠条插在首条 seq > boundarySeq 的
 *  消息之前；无 seq 的消息（流式中的新消息）排在所有折叠条之后。 */
export function mergeTimeline(
  dividers: RewindDivider[],
  messages: ChatMessage[],
): TimelineNode[] {
  if (dividers.length === 0) {
    return messages.map((message) => ({ type: "message", message }));
  }
  const nodes: TimelineNode[] = [];
  let di = 0;
  for (const message of messages) {
    // 先吐出所有位于本消息之前的折叠条（boundarySeq < 消息 seq）
    while (
      di < dividers.length &&
      (message.seq === undefined || dividers[di].boundarySeq < message.seq)
    ) {
      nodes.push({ type: "rewind-divider", ...dividers[di] });
      di++;
    }
    nodes.push({ type: "message", message });
  }
  while (di < dividers.length) {
    nodes.push({ type: "rewind-divider", ...dividers[di] });
    di++;
  }
  return nodes;
}
