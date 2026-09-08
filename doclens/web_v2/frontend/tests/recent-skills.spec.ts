import { describe, it, expect, beforeEach } from "vitest";
import { getRecentSkillNames, recordSkillUse, RECENT_SKILLS_MENU_CAP } from "../src/state/recent-skills";

describe("recent-skills", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("empty by default", () => {
    expect(getRecentSkillNames()).toEqual([]);
  });

  it("records newest first", () => {
    recordSkillUse("a");
    recordSkillUse("b");
    expect(getRecentSkillNames()).toEqual(["b", "a"]);
  });

  it("dedupes: re-picking moves the skill to the head", () => {
    recordSkillUse("a");
    recordSkillUse("b");
    recordSkillUse("a");
    expect(getRecentSkillNames()).toEqual(["a", "b"]);
  });

  it("caps the cache beyond the menu display count", () => {
    for (let i = 0; i < 15; i++) recordSkillUse(`s${i}`);
    const names = getRecentSkillNames();
    expect(names.length).toBe(10);
    expect(names.length).toBeGreaterThan(RECENT_SKILLS_MENU_CAP);
    expect(names[0]).toBe("s14");
  });

  it("ignores empty names", () => {
    recordSkillUse("");
    expect(getRecentSkillNames()).toEqual([]);
  });

  it("survives corrupt localStorage content", () => {
    localStorage.setItem("cortex.recentSkills", "{bad json");
    expect(getRecentSkillNames()).toEqual([]);
    localStorage.setItem("cortex.recentSkills", JSON.stringify([1, "ok", null]));
    expect(getRecentSkillNames()).toEqual(["ok"]);
  });
});
