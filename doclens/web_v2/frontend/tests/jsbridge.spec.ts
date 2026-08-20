import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isNexBoxWebview,
  jsbridgePhotoAvailable,
  takePhotoAsFile,
  pickPhotoAsFile,
  JsbridgePhotoError,
} from "../src/utils/jsbridge";

/** jsbridge.js 注入的假 takePhoto/pickPhotos（按文档契约回调） */
interface FakeHandlers {
  success?: (res: unknown) => void;
  fail?: (res: unknown) => void;
  cancel?: (res: unknown) => void;
}

function installBridge(impl: {
  takePhoto?: (h: FakeHandlers) => void;
  pickPhotos?: (h: FakeHandlers) => void;
}) {
  (window as unknown as { jsbridge: unknown }).jsbridge = {
    takePhoto: vi.fn(impl.takePhoto),
    pickPhotos: vi.fn(impl.pickPhotos),
  };
}

function installAndroid() {
  (window as unknown as { Android: unknown }).Android = {
    messageSend: vi.fn(),
  };
}

function stubUA(ua: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
}

afterEach(() => {
  delete (window as unknown as { jsbridge?: unknown }).jsbridge;
  delete (window as unknown as { Android?: unknown }).Android;
  vi.restoreAllMocks();
});

// 1x1 红色像素 JPEG 的 base64（无 data: 前缀，NO_WRAP 单行）
const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

describe("isNexBoxWebview", () => {
  it("true when UA carries NexBox flag", () => {
    stubUA("Mozilla/5.0 (Linux; Android 13) ... NexBox/1.0");
    expect(isNexBoxWebview()).toBe(true);
  });

  it("true when window.Android injected even without UA flag", () => {
    stubUA("Mozilla/5.0 (Linux; Android 13) Chrome/120");
    installAndroid();
    expect(isNexBoxWebview()).toBe(true);
  });

  it("false in plain browser", () => {
    stubUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126");
    expect(isNexBoxWebview()).toBe(false);
  });
});

describe("jsbridgePhotoAvailable", () => {
  it("true only when Android + jsbridge methods both present", () => {
    stubUA("Mozilla/5.0 NexBox/1.0");
    installAndroid();
    installBridge({ takePhoto: () => {}, pickPhotos: () => {} });
    expect(jsbridgePhotoAvailable()).toBe(true);
  });

  it("false when jsbridge.js failed to load (App too old)", () => {
    stubUA("Mozilla/5.0 NexBox/1.0");
    installAndroid();
    expect(jsbridgePhotoAvailable()).toBe(false);
  });

  it("false in browser where only jsbridge.js loaded (no injection)", () => {
    stubUA("Mozilla/5.0 Chrome/126");
    installBridge({ takePhoto: () => {}, pickPhotos: () => {} });
    expect(jsbridgePhotoAvailable()).toBe(false);
  });
});

describe("takePhotoAsFile", () => {
  it("resolves File from base64 success payload", async () => {
    installAndroid();
    installBridge({
      takePhoto: (h) => h.success?.({
        code: 0, base64: TINY_JPEG_B64, mimeType: "image/jpeg",
        width: 1, height: 1, size: 631,
      }),
    });
    const file = await takePhotoAsFile();
    expect(file).toBeInstanceOf(File);
    expect(file!.type).toBe("image/jpeg");
    expect(file!.name).toMatch(/^photo_\d+\.jpg$/);  // 时间戳名
    expect(file!.size).toBeGreaterThan(0);
  });

  it("resolves null on user cancel", async () => {
    installAndroid();
    installBridge({ takePhoto: (h) => h.cancel?.({ reason: "user canceled" }) });
    await expect(takePhotoAsFile()).resolves.toBeNull();
  });

  it("rejects with friendly message on permission denied (code=2)", async () => {
    installAndroid();
    installBridge({ takePhoto: (h) => h.fail?.({ code: 2, error: "denied" }) });
    const err = await takePhotoAsFile().catch((e) => e);
    expect(err).toBeInstanceOf(JsbridgePhotoError);
    expect((err as JsbridgePhotoError).code).toBe(2);
    expect((err as JsbridgePhotoError).message).toContain("权限");
  });

  it("rejects when success payload has no base64", async () => {
    installAndroid();
    installBridge({ takePhoto: (h) => h.success?.({ code: 0 }) });
    await expect(takePhotoAsFile()).rejects.toBeInstanceOf(JsbridgePhotoError);
  });
});

describe("pickPhotoAsFile", () => {
  it("resolves File from photos[0]", async () => {
    installAndroid();
    installBridge({
      pickPhotos: (h) => h.success?.({
        code: 0, count: 1, pickedCount: 1, truncated: false,
        photos: [{ base64: TINY_JPEG_B64, mimeType: "image/jpeg", width: 1, height: 1, size: 631 }],
      }),
    });
    const file = await pickPhotoAsFile();
    expect(file).toBeInstanceOf(File);
    expect(file!.name).toMatch(/^gallery_\d+\.jpg$/);
  });

  it("requests maxCount=1 (单选 UI)", async () => {
    installAndroid();
    const bridge = { pickPhotos: vi.fn() };
    (window as unknown as { jsbridge: unknown }).jsbridge = bridge;
    void pickPhotoAsFile();
    expect(bridge.pickPhotos).toHaveBeenCalledWith(
      expect.objectContaining({ maxCount: 1 }),
    );
  });

  it("rejects when first photo item is an error item", async () => {
    installAndroid();
    installBridge({
      pickPhotos: (h) => h.success?.({
        code: 0, count: 0, pickedCount: 1, truncated: false,
        photos: [{ error: "decode failed" }],
      }),
    });
    await expect(pickPhotoAsFile()).rejects.toBeInstanceOf(JsbridgePhotoError);
  });

  it("resolves null on user cancel", async () => {
    installAndroid();
    installBridge({ pickPhotos: (h) => h.cancel?.({ reason: "user canceled" }) });
    await expect(pickPhotoAsFile()).resolves.toBeNull();
  });
});
