import { describe, expect, it } from "vitest";
import { mergeProjectsForA6Enter, pickA6EnterProjectId } from "./a6-enter";

describe("A6 enter-new-project rule", () => {
  it("picks the first successfully created project in the batch", () => {
    expect(pickA6EnterProjectId([])).toBeNull();
    expect(pickA6EnterProjectId(["p-scion", "p-other"])).toBe("p-scion");
  });

  it("lists batch projects first so left nav can select the new one", () => {
    const merged = mergeProjectsForA6Enter(
      [
        { id: "new-1", name: "scion" },
        { id: "new-2", name: "beta" },
      ],
      [
        { id: "old", name: "奕枢" },
        { id: "new-1", name: "scion-dup" },
      ],
    );
    expect(merged.map((p) => p.id)).toEqual(["new-1", "new-2", "old"]);
  });
});
