import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, selectSettingsDirtyFields, INITIAL_STATE } from "../src/state/store";
import { SETTINGS_FIELDS } from "../src/views/settings-fields";

describe("settings store slice", () => {
  beforeEach(() => {
    // Reset the store singleton to INITIAL_STATE before each test to avoid
    // cross-test contamination from the module-level state.
    store.setState({ ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings } });
  });

  it("starts with scope=local and empty values", () => {
    // sanity: SETTINGS_FIELDS placeholder is exported (filled in Task 6)
    expect(Array.isArray(SETTINGS_FIELDS)).toBe(true);
    const s = store.getState();
    expect(s.settings.scope).toBe("local");
    expect(s.settings.values).toEqual({});
    expect(s.settings.dirty).toBe(false);
  });

  it("updateSetting mutates a single field and marks dirty", () => {
    store.setState({
      ...store.getState(),
      settings: {
        ...store.getState().settings,
        original: { CORTEX_MAX_RESULTS: "20" },
        values: { CORTEX_MAX_RESULTS: "20" },
      },
    });
    actions.updateSetting("CORTEX_MAX_RESULTS", "99");
    const s = store.getState();
    expect(s.settings.values.CORTEX_MAX_RESULTS).toBe("99");
    expect(s.settings.dirty).toBe(true);
  });

  it("revertSettings restores values from original and clears dirty", () => {
    store.setState({
      ...store.getState(),
      settings: {
        scope: "local",
        original: { CORTEX_MAX_RESULTS: "20" },
        values: { CORTEX_MAX_RESULTS: "99" },
        dirty: true,
        exists: true,
        saving: false,
        error: null,
      },
    });
    actions.revertSettings();
    const s = store.getState();
    expect(s.settings.values.CORTEX_MAX_RESULTS).toBe("20");
    expect(s.settings.dirty).toBe(false);
  });

  it("setSettingsScope changes scope", () => {
    actions.setSettingsScope("global");
    expect(store.getState().settings.scope).toBe("global");
  });

  it("selectSettingsDirtyFields counts changed fields", () => {
    store.setState({
      ...store.getState(),
      settings: {
        scope: "local",
        original: { A: "1", B: "2", C: "3" },
        values: { A: "1", B: "9", C: "8" },
        dirty: true,
        exists: true,
        saving: false,
        error: null,
      },
    });
    expect(selectSettingsDirtyFields(store.getState())).toEqual(["B", "C"]);
  });
});
