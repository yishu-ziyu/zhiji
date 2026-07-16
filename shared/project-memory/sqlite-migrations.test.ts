import { describe, expect, it } from "vitest";
import {
  applyMigrations,
  CORE_MIGRATIONS,
  planMigrations,
} from "./sqlite-migrations";

describe("sqlite migrations (PR-11 skeleton)", () => {
  it("plans only unapplied migrations and is idempotent", () => {
    expect(planMigrations([]).map((m) => m.id)).toEqual(
      CORE_MIGRATIONS.map((m) => m.id),
    );
    expect(planMigrations(["001_schema_migrations"]).map((m) => m.id)).toEqual(
      CORE_MIGRATIONS.slice(1).map((m) => m.id),
    );

    const applied: string[] = [];
    const sqlLog: string[] = [];
    const runner = {
      exec(sql: string) {
        sqlLog.push(sql);
      },
      allApplied() {
        return [...applied];
      },
      markApplied(id: string) {
        applied.push(id);
      },
    };
    const first = applyMigrations(runner);
    const second = applyMigrations(runner);
    expect(first).toEqual(CORE_MIGRATIONS.map((m) => m.id));
    expect(second).toEqual([]);
    expect(applied).toEqual(CORE_MIGRATIONS.map((m) => m.id));
  });
});
