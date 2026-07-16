import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("User preferences", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "user-prefs-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
  });

  afterEach(async () => {
    const p = await import("./user-preferences");
    p.resetUserPreferencesForTests();
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("defaults then patches and reloads", async () => {
    const prefs = await import("./user-preferences");
    prefs.resetUserPreferencesForTests();
    const initial = prefs.getUserPreferences();
    expect(initial.writingStyle).toBe("concise");
    expect(initial.confirmStyle).toBe("always");
    expect(initial.favoritePathPrefixes).toEqual([]);

    const updated = prefs.patchUserPreferences({
      writingStyle: "detailed",
      confirmStyle: "auto_low_risk",
      favoritePathPrefixes: ["docs/", "app/track/"],
    });
    expect(updated.writingStyle).toBe("detailed");
    expect(updated.favoritePathPrefixes).toEqual(["docs/", "app/track/"]);
    expect(prefs.getUserPreferences().confirmStyle).toBe("auto_low_risk");
  });
});
