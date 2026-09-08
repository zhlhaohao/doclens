import type { WatcherStatus } from "../state/types";

/** watch 状态文案/色调：app-bar 顶栏徽标与控制面板文件监控行共用。
 *  cls 语义色由消费方 CSS 定义（.dot 绿 / .busy 蓝 / .warn 橙）。 */
export function watchStatusLabel(
  w: WatcherStatus | null,
): { cls: string; label: string } {
  const n = w?.last_doc_count;
  const nStr = n != null ? ` ${n}` : "";
  if (!w || !w.running) return { cls: "", label: `${nStr} ○监控关` };
  if (w.reindexing) return { cls: "busy", label: `${nStr} ⟳更新中…` };
  if (w.changed_count > 0) return { cls: "warn", label: `${nStr} ·待更新 ${w.changed_count}` };
  return {
    cls: w.last_success === false ? "warn" : "dot",
    label: `${nStr} ●监控`,
  };
}
