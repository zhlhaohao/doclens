/** 导航条目 + 选中派发（单一真相源，AP-31）：tab-bar（移动端底部）/ activity-bar
 *  （桌面左侧）此前各自复制一份 _items 数组与 _select/navigate 派发——新增视图
 *  要同步改两处的 Shotgun Surgery 入口。布局/样式仍由两个壳组件各自持有。 */

import type { ViewId } from "../state/types";

export interface NavItem {
  id: ViewId;
  icon: string;
  label: string;
}

/** 主导航五视图（icon 名对齐 icon.ts ICONS 注册表）。「团队」(ADR-0060)：
 *  icon "bot" 已被「个人助手」占用，用 "users"。 */
export const NAV_ITEMS: NavItem[] = [
  { id: "search", icon: "search", label: "全库搜索" },
  { id: "chat", icon: "bot", label: "个人助手" },
  { id: "diary", icon: "book-open", label: "岁月微笺" },
  { id: "files", icon: "folder", label: "文件管理" },
  { id: "team", icon: "users", label: "团队" },
];

/** 日记 tab 显隐（ADR-0030）：diaryEnabled=false 时过滤 diary 项（未知按显示）。 */
export function navItems(diaryEnabled: boolean): NavItem[] {
  return diaryEnabled ? NAV_ITEMS : NAV_ITEMS.filter((it) => it.id !== "diary");
}

/** 派发 navigate 事件（宿主 app.ts 监听切视图）。 */
export function emitNavigate(el: HTMLElement, view: ViewId): void {
  el.dispatchEvent(new CustomEvent("navigate", {
    detail: { view },
    bubbles: true, composed: true,
  }));
}
