/** 阅读书签控制器（AP-4 拆分件）：preview-pane 内嵌的书签域——显隐态、
 *  当前文件书签列表、收藏动作（锚点捕获 + 自动标签 + 幂等/满员反馈）、
 *  跳转/删除——此前全部内联在 preview-pane（God Object 职责域之一，
 *  2026-10-01 决议引入，2026-11-15 迁出）。
 *
 *  宿主注入三个环境参数（每次 render 前同步）：
 *  - available：入口可用判定（预览模式 + 扩展名 + 非 PST）
 *  - captureAnchor：当前锚点 + 链路类型（md=源行号 / pdf=页号编码值）
 *  - labelFor：锚点 → 自动标签（md 走 heading 口径）
 *  跳转与 toast 反馈经回调/事件上抛宿主（与原行为一致）。 */

import { ReactiveController, ReactiveControllerHost } from "lit";
import { html, nothing } from "lit";
import {
  addBookmark,
  bookmarksFor,
  removeBookmark,
  type ReadingBookmark,
} from "./bookmarks";
import "../components/bookmark-drawer";

export class BookmarksController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _show = false;
  private _items: ReadingBookmark[] = [];
  private _path = "";

  /** 入口可用（宿主注入）。 */
  available = false;
  /** 当前阅读锚点捕获（宿主注入：返回 null 表示无活跃 viewer）。 */
  captureAnchor: () => { kind: "md" | "pdf"; anchor: number } | null = () => null;
  /** 锚点 → 自动标签（宿主注入；md 走 activeTocIndex heading 口径）。 */
  labelFor: (kind: "md" | "pdf", anchor: number) => string = (kind, anchor) =>
    kind === "pdf" ? `第 ${Math.max(1, Math.floor(anchor / 10000))} 页` : `第 ${anchor} 行`;
  /** 跳转回调（宿主注入：md 滚源行号 / pdf restore 页号编码值）。 */
  onJump: ((b: ReadingBookmark) => void) | null = null;
  /** toast 反馈事件派发（bookmark-added/duplicate/full，冒泡+穿透）。 */
  onFeedback: ((kind: "added" | "duplicate" | "full") => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected?(): void {
    this._show = false;
  }

  /** 换文档：收起抽屉并重读列表（宿主 willUpdate path 变化时调用）。 */
  onPathChanged(path: string): void {
    this._show = false;
    this._path = path;
    this._items = bookmarksFor(path);
    this.host.requestUpdate();
  }

  get open(): boolean {
    return this._show;
  }

  /** 抽屉开关（打开前重读列表）。 */
  toggle(): void {
    if (!this._show) {
      this._items = bookmarksFor(this._path);
    }
    this._show = !this._show;
    this.host.requestUpdate();
  }

  /** 收藏当前位置：捕获锚点 + 自动标签；幂等/满员经 onFeedback。 */
  add(): void {
    if (!this.available) return;
    const captured = this.captureAnchor();
    if (!captured) return;
    const anchor = Math.max(1, Math.floor(captured.anchor));
    const label = this.labelFor(captured.kind, anchor);
    const result = addBookmark({ path: this._path, anchor, kind: captured.kind, label });
    if (!result.ok) {
      this.onFeedback?.("full");
      return;
    }
    this._items = bookmarksFor(this._path);
    this.host.requestUpdate();
    this.onFeedback?.(result.duplicate ? "duplicate" : "added");
  }

  /** 删除书签（抽屉不关，可连续删）。 */
  remove(b: ReadingBookmark): void {
    removeBookmark(b.path, b.anchor);
    this._items = bookmarksFor(this._path);
    this.host.requestUpdate();
  }

  /** 点击书签：关闭抽屉 + 宿主跳转。 */
  jump(b: ReadingBookmark): void {
    this._show = false;
    this.host.requestUpdate();
    this.onJump?.(b);
  }

  /** 抽屉渲染（关闭态 nothing）。 */
  renderDrawer() {
    if (!this._show) return nothing;
    return html`<bookmark-drawer
      .items=${this._items}
      .canAdd=${this.available}
      @add=${() => this.add()}
      @jump=${(e: CustomEvent<{ bookmark: ReadingBookmark }>) => this.jump(e.detail.bookmark)}
      @remove=${(e: CustomEvent<{ bookmark: ReadingBookmark }>) => this.remove(e.detail.bookmark)}
      @close=${() => { this._show = false; this.host.requestUpdate(); }}
    ></bookmark-drawer>`;
  }
}
