import { describe, it, expect, vi, beforeEach } from "vitest";
import { getConfig, putConfig, type ConfigResponse, type ConfigSaveResult, ConfigApiError } from "../src/api/config";

describe("config api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("getConfig builds GET /api/config?scope=... and parses response", async () => {
    const mock: ConfigResponse = {
      scope: "local",
      values: { CORTEX_MAX_RESULTS: "20" },
      exists: true,
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    });

    const result = await getConfig("local");
    expect(result).toEqual(mock);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/config?scope=local",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("putConfig builds PUT /api/config?scope=... with JSON body", async () => {
    const mock: ConfigSaveResult = {
      ok: true,
      saved_path: "/tmp/.env",
      needs_restart: true,
      restart_fields: ["PLANIFY_API_KEY"],
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    });

    const result = await putConfig("global", { PLANIFY_API_KEY: "sk-new" });
    expect(result.needs_restart).toBe(true);
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("/api/config?scope=global");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ values: { PLANIFY_API_KEY: "sk-new" } });
  });

  it("getConfig throws ConfigApiError on non-ok response", async () => {
    const errorResponse = {
      ok: false,
      status: 404,
      json: async () => ({ code: "GLOBAL_ENV_MISSING", detail: "not found" }),
    };
    (globalThis.fetch as any)
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(errorResponse);
    await expect(getConfig("weird" as any)).rejects.toThrow();
    await expect(getConfig("weird" as any)).rejects.toBeInstanceOf(ConfigApiError);
  });

  it("putConfig surfaces validation error body on 400", async () => {
    const errBody = {
      code: "VALIDATION_FAILED",
      detail: "1 field failed",
      fields: [{ field: "max_results", error: "bad int" }],
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => errBody,
    });
    await expect(putConfig("local", { CORTEX_MAX_RESULTS: "x" })).rejects.toMatchObject({
      status: 400,
      body: errBody,
    });
  });
});
