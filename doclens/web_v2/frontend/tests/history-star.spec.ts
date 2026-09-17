import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { Session } from "../src/state/types";
import "../src/components/history-list";
import "../src/components/history-item";

function sess(id: string, title: string, updated: string, starred = false): Session {
  return { id, type: "chat", title, preview: "", updated_at: updated, message_count: 1, starred } as Session;
}

/** 复现 2026-09-17 报障：点最后一项 star，倒数第二项被加星。
 *  链路：history-list（无 key map 渲染）→ history-item toggle-star →
 *  父组件 _sortedWithStar 重排 → 重渲染。 */
describe("history star toggle 事件与重排后状态", () => {
  it("点最后一项的 star：detail 携带最后一项", async () => {
    const sessions = [
      sess("s1", "第一条", "2026-09-17T10:00:00Z"),
      sess("s2", "第二条", "2026-09-17T11:00:00Z"),
      sess("s3", "第三条", "2026-09-17T12:00:00Z"),
    ];
    const onStar = vi.fn();
    const list = await fixture(
      html`<history-list .sessions=${sessions} @toggle-star=${onStar}></history-list>`
    );
    await (list as any).updateComplete;
    const items = list.shadowRoot!.querySelectorAll("history-item");
    expect(items.length).toBe(3);
    items[2]!.shadowRoot!.querySelector("button.star-btn")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(onStar).toHaveBeenCalledTimes(1);
    expect(onStar.mock.calls[0][0].detail.session.id).toBe("s3");
    expect(onStar.mock.calls[0][0].detail.starred).toBe(true);
  });

  it("加星重排（s3 置顶）后：每行组件持有的 session 与显示数据一致，再点最后一项 star 命中 s2", async () => {
    // 模拟 _sortedWithStar：s3 加星置顶 → [s3*, s1, s2]
    const sorted = [
      sess("s3", "第三条", "2026-09-17T12:00:00Z", true),
      sess("s1", "第一条", "2026-09-17T10:00:00Z"),
      sess("s2", "第二条", "2026-09-17T11:00:00Z"),
    ];
    const onStar = vi.fn();
    const list = await fixture(
      html`<history-list .sessions=${sorted} @toggle-star=${onStar}></history-list>`
    );
    await (list as any).updateComplete;
    const items = list.shadowRoot!.querySelectorAll("history-item");
    // 显示与数据一致
    expect((items[0] as any).session.id).toBe("s3");
    expect((items[2] as any).session.id).toBe("s2");
    items[2]!.shadowRoot!.querySelector("button.star-btn")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(onStar.mock.calls[0][0].detail.session.id).toBe("s2");
  });

  it("同一列表实例：乐观更新重排（原序 → s3 置顶）后组件状态跟手", async () => {
    // 关键场景：同一 history-list 实例上先渲染原序，再更新为重排序——
    // 无 key 复用下组件属性是否正确跟随新位置的数据
    const original = [
      sess("s1", "第一条", "2026-09-17T10:00:00Z"),
      sess("s2", "第二条", "2026-09-17T11:00:00Z"),
      sess("s3", "第三条", "2026-09-17T12:00:00Z"),
    ];
    const onStar = vi.fn();
    const list = await fixture(
      html`<history-list .sessions=${original} @toggle-star=${onStar}></history-list>`
    );
    await (list as any).updateComplete;

    // 点 s3 的 star → 父组件重排后回写 sessions 属性（乐观更新路径）
    let items = list.shadowRoot!.querySelectorAll("history-item");
    items[2]!.shadowRoot!.querySelector("button.star-btn")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(onStar.mock.calls[0][0].detail.session.id).toBe("s3");

    // _sortedWithStar 等价重排（s3 换新对象置顶，其余保持原引用）
    (list as any).sessions = [
      { ...original[2], starred: true },
      original[0],
      original[1],
    ];
    await (list as any).updateComplete;

    // 重排后：末位组件应持有 s2；它的星点击应命中 s2
    items = list.shadowRoot!.querySelectorAll("history-item");
    expect((items[0] as any).session.id).toBe("s3");
    expect((items[0] as any).session.starred).toBe(true);
    expect((items[2] as any).session.id).toBe("s2");
    const onStar2 = vi.fn();
    list.addEventListener("toggle-star", onStar2);
    items[2]!.shadowRoot!.querySelector("button.star-btn")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(onStar2.mock.calls[0][0].detail.session.id).toBe("s2");
    expect(onStar2.mock.calls[0][0].detail.starred).toBe(true);
  });
});
