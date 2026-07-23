import { describe, it, expect, beforeEach } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/welcome-pane";
import type { WelcomePane } from "../src/components/welcome-pane";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { SystemStatus, WatcherStatus } from "../src/state/types";

const STATUS: SystemStatus = {
  workdir: "C:/a/b/c/test_work_dir",
  indexed_docs: 69,
  index_path: "x",
  total_size_bytes: 12 * 1024 * 1024,
  file_types: { ".md": 30, ".pdf": 12, ".docx": 8, ".py": 3 },
};
const WATCHER: WatcherStatus = {
  running: true, reindexing: false, changed_count: 0,
  last_reindex_at: Date.now() / 1000 - 180, last_doc_count: 69, last_success: true,
};

describe("<welcome-pane> status area", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE });
  });

  async function mount(): Promise<WelcomePane> {
    const el = await fixture<WelcomePane>(html`<welcome-pane></welcome-pane>`);
    await elementUpdated(el);
    return el;
  }

  it("renders 1 status row with path, monitor, count", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus(WATCHER);
    const el = await mount();
    const text = el.shadowRoot?.querySelector(".status-area")?.textContent ?? "";
    expect(text).toContain("…/c/test_work_dir");
    expect(text).toContain("69");
    expect(text).toContain("监控中");
  });

  it("watcher reindexing → ⟳ 更新中", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus({ ...WATCHER, reindexing: true });
    const el = await mount();
    expect(el.shadowRoot?.querySelector(".status-area")?.textContent).toContain("更新中");
  });

  it("watcher running + changed → 待更新 N", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus({ ...WATCHER, changed_count: 4 });
    const el = await mount();
    expect(el.shadowRoot?.querySelector(".status-area")?.textContent).toContain("待更新 4");
  });

  it("watcher !running → ○ 未启用", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus({ ...WATCHER, running: false });
    const el = await mount();
    expect(el.shadowRoot?.querySelector(".status-area")?.textContent).toContain("未启用");
  });

  it("watcher null → monitor segment —", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus(null);
    const el = await mount();
    const line = el.shadowRoot?.querySelector(".status-value[data-kind='line1']");
    expect(line?.textContent).toContain("👁 —");
  });

  it("status null → all values —", async () => {
    const el = await mount();
    const text = el.shadowRoot?.querySelector(".status-area")?.textContent ?? "";
    expect(text).toContain("—");
  });

  it("line1 title attr holds full path", async () => {
    actions.setStatus(STATUS);
    actions.setWatcherStatus(WATCHER);
    const el = await mount();
    const line1 = el.shadowRoot?.querySelector(".status-value[data-kind='line1']") as HTMLElement | null;
    expect(line1?.title).toBe(STATUS.workdir);
  });
});
