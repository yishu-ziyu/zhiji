/**
 * Local single-user preferences — separate from project truth and dialogue turns.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  ConfirmStyle,
  UserPreferences,
  WritingStyle,
} from "./types";

const DEFAULTS: Omit<UserPreferences, "updatedAt"> = {
  writingStyle: "concise",
  confirmStyle: "always",
  favoritePathPrefixes: [],
};

function dataDir(): string {
  if (process.env.KNOWLEDGE_DATA_DIR) {
    return path.resolve(process.env.KNOWLEDGE_DATA_DIR);
  }
  return path.join(process.cwd(), "data", "knowledge");
}

function prefsPath(): string {
  return path.join(dataDir(), "user-preferences.json");
}

function normalize(raw: Partial<UserPreferences> | null | undefined): UserPreferences {
  const writingStyle: WritingStyle =
    raw?.writingStyle === "detailed" ? "detailed" : "concise";
  const confirmStyle: ConfirmStyle =
    raw?.confirmStyle === "auto_low_risk" ? "auto_low_risk" : "always";
  const favoritePathPrefixes = Array.isArray(raw?.favoritePathPrefixes)
    ? raw!.favoritePathPrefixes
        .map((p) => String(p).trim())
        .filter(Boolean)
        .slice(0, 32)
    : [];
  return {
    writingStyle,
    confirmStyle,
    favoritePathPrefixes,
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
  };
}

export function getUserPreferences(): UserPreferences {
  try {
    if (!fs.existsSync(prefsPath())) {
      return normalize({ ...DEFAULTS, updatedAt: new Date().toISOString() });
    }
    const raw = JSON.parse(fs.readFileSync(prefsPath(), "utf8")) as Partial<UserPreferences>;
    return normalize(raw);
  } catch {
    return normalize({ ...DEFAULTS, updatedAt: new Date().toISOString() });
  }
}

export function patchUserPreferences(
  patch: Partial<Pick<UserPreferences, "writingStyle" | "confirmStyle" | "favoritePathPrefixes">>,
): UserPreferences {
  const current = getUserPreferences();
  const next = normalize({
    writingStyle: patch.writingStyle ?? current.writingStyle,
    confirmStyle: patch.confirmStyle ?? current.confirmStyle,
    favoritePathPrefixes:
      patch.favoritePathPrefixes ?? current.favoritePathPrefixes,
    updatedAt: new Date().toISOString(),
  });
  fs.mkdirSync(path.dirname(prefsPath()), { recursive: true });
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function resetUserPreferencesForTests(): void {
  try {
    if (fs.existsSync(prefsPath())) fs.unlinkSync(prefsPath());
  } catch {
    // ignore
  }
}
