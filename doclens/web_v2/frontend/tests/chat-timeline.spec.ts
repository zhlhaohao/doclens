/** chat-timeline 纯函数测试（ADR-0027：回退即事实 / 死段折叠）。 */
import { describe, it, expect } from "vitest";

import {
  mapSessionItemsToMessages,
  buildChatTimeline,
  mergeTimeline,
} from "../src/views/chat-timeline";
import type { ChatMessage } from "../src/state/types";

function item(seq: number, kind: string, payload: Record<string, unknown>) {
  return { kind, seq, payload: JSON.stringify(payload) };
}

function user(seq: number, content: string) {
  return item(seq, "message_user", { content });
}

function ai(seq: number, content: string) {
  return item(seq, "message_ai", { content });
}

function rewound(seq: number, pointSeq: number) {
  return item(seq, "rewound", { point_seq: pointSeq });
}

describe("mapSessionItemsToMessages（迁移后再导出兼容）", () => {
  it("user / assistant 消息都携带条目 seq（折叠数与折叠条定位依赖）", () => {
    const msgs = mapSessionItemsToMessages([user(0, "q1"), ai(1, "a1")]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].seq).toBe(0);
    expect(msgs[1].seq).toBe(1);
  });
});

describe("buildChatTimeline", () => {
  it("无边界：全部消息为活消息，无折叠条", () => {
    const { messages, dividers } = buildChatTimeline([user(0, "q1"), ai(1, "a1")]);
    expect(messages.map((m) => m.content)).toEqual(["q1", "a1"]);
    expect(dividers).toEqual([]);
  });

  it("回退后：锚点及其后死段折叠进折叠条（含锚点），活前缀保留", () => {
    const { messages, dividers } = buildChatTimeline([
      user(0, "q1"), ai(1, "a1"), user(2, "q2"), ai(3, "a2"),
      rewound(4, 2),
      user(5, "q3"), ai(6, "a3"),
    ]);
    expect(messages.map((m) => m.content)).toEqual(["q1", "a1", "q3", "a3"]);
    expect(dividers).toHaveLength(1);
    expect(dividers[0].pointSeq).toBe(2);
    expect(dividers[0].boundarySeq).toBe(4);
    // 死段含锚点 q2 + a2（锚点回填输入框，折叠条展开仍可查看）
    expect(dividers[0].dead.map((m) => m.content)).toEqual(["q2", "a2"]);
  });

  it("重叠区间归属最早边界（同一条消息不进两个折叠桶）", () => {
    const { dividers } = buildChatTimeline([
      user(0, "q1"), user(1, "q2"), ai(2, "a2"),
      rewound(3, 1),      // 边界1：死段 [1,3]
      user(4, "q3"),
      rewound(5, 0),      // 边界2：死段 [0,5]（更早锚点）
      user(6, "q4"),
    ]);
    expect(dividers).toHaveLength(2);
    // 边界1 桶 = [1,3] 内消息；边界2 桶 = 其余死消息（q1、q3）
    expect(dividers[0].dead.map((m) => m.content)).toEqual(["q2", "a2"]);
    expect(dividers[1].dead.map((m) => m.content)).toEqual(["q1", "q3"]);
  });

  it("非消息条目（usage/compacted 等）自然消失", () => {
    const { messages, dividers } = buildChatTimeline([
      user(0, "q1"),
      item(1, "usage", { input_tokens: 10 }),
      item(2, "compacted", { messages: [] }),
      rewound(3, 0),
    ]);
    expect(messages).toEqual([]);
    expect(dividers).toHaveLength(1);
    // 死段 [0,3] 内只有 q1 是消息；usage/compacted 不进折叠桶
    expect(dividers[0].dead.map((m) => m.content)).toEqual(["q1"]);
  });
});

describe("mergeTimeline", () => {
  const q = (content: string, seq?: number): ChatMessage =>
    seq === undefined ? { role: "user", content } : { role: "user", content, seq };

  it("无折叠条 = 纯消息序列", () => {
    const nodes = mergeTimeline([], [q("a", 0), q("b", 2)]);
    expect(nodes.map((n) => n.type)).toEqual(["message", "message"]);
  });

  it("折叠条插在首条 seq > boundarySeq 的消息之前", () => {
    const divider = { pointSeq: 2, boundarySeq: 4, dead: [q("q2", 2)] };
    const nodes = mergeTimeline([divider], [q("q1", 0), q("q3", 5)]);
    expect(nodes.map((n) => n.type)).toEqual(["message", "rewind-divider", "message"]);
  });

  it("无 seq 的流式新消息排在所有折叠条之后", () => {
    const divider = { pointSeq: 2, boundarySeq: 4, dead: [q("q2", 2)] };
    const nodes = mergeTimeline([divider], [q("q1", 0), q("流式新", undefined)]);
    // 无 seq 消息不能吞掉折叠条：divider 先于其渲染
    expect(nodes.map((n) => n.type)).toEqual(["message", "rewind-divider", "message"]);
  });

  it("尾部折叠条（其后无消息）排在末尾", () => {
    const divider = { pointSeq: 5, boundarySeq: 7, dead: [q("q5", 5)] };
    const nodes = mergeTimeline([divider], [q("q1", 0)]);
    expect(nodes.map((n) => n.type)).toEqual(["message", "rewind-divider"]);
  });
});
