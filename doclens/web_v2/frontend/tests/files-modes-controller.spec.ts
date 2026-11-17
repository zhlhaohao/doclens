import { describe, it, expect, vi, beforeEach } from "vitest";
import { FilesModesController } from "../src/utils/files-modes-controller";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

/** 最小宿主替身：controller 只需 requestUpdate + addController。 */
function makeHost() {
  let updates = 0;
  const host = {
    requestUpdate: () => { updates++; },
    addController: () => {},
    updateComplete: Promise.resolve(true),
    get updateCount() { return updates; },
  } as never as import("lit").ReactiveControllerHost & { updateCount: number };
  return host;
}

describe("FilesModesController（AP-3 拆分件）", () => {
  beforeEach(() => {
    resetStore(store);
    vi.clearAllMocks();
  });

  it("改动模式与深读模式互斥：进深读先退改动", () => {
    const host = makeHost();
    const c = new FilesModesController(host, {
      probeGitRoot: async () => true,
      probeBooks: async () => true,
      restoreNormalPreview: () => {},
    });
    c.toggleChangesMode();
    expect(c.changesMode).toBe(true);
    c.toggleDeepReadMode();
    expect(c.deepReadMode).toBe(true);
    expect(c.changesMode).toBe(false);
    expect(c.middleMode).toBe("deep-read");
  });

  it("退出改动模式恢复常规预览（dirty 编辑同律）", () => {
    let restored = 0;
    const host = makeHost();
    const c = new FilesModesController(host, {
      probeGitRoot: async () => true,
      probeBooks: async () => true,
      restoreNormalPreview: () => { restored++; },
    });
    c.toggleChangesMode();
    c.toggleChangesMode();
    expect(restored).toBe(1);
    expect(c.middleMode).toBe("list");
  });

  it("目录变化退出改动模式（Q15：点 file-tree 即退出）", () => {
    const host = makeHost();
    const c = new FilesModesController(host, {
      probeGitRoot: async () => true,
      probeBooks: async () => true,
      restoreNormalPreview: () => {},
    });
    c.hostConnected();
    c.toggleChangesMode();
    expect(c.changesMode).toBe(true);
    actions.selectDir("sub/dir");
    expect(c.changesMode).toBe(false);
    c.hostDisconnected();
  });

  it("退出改动模式清空 diff 状态", () => {
    const host = makeHost();
    const c = new FilesModesController(host, {
      probeGitRoot: async () => true,
      probeBooks: async () => true,
      restoreNormalPreview: () => {},
    });
    c.diffPath = "a.md";
    c.diffResp = { diff: "x" } as never;
    c.toggleChangesMode();
    c.toggleChangesMode();
    expect(c.diffPath).toBe("");
    expect(c.diffResp).toBeNull();
  });
});
