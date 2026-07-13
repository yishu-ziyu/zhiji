import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, transition } from "./state-machine";

describe("delivery state machine", () => {
  it("allows captured → in_progress", () => {
    expect(canTransition("captured", "in_progress")).toBe(true);
    expect(transition("captured", "in_progress")).toEqual({
      ok: true,
      next: "in_progress",
    });
  });

  it("allows in_progress → delivered", () => {
    expect(transition("in_progress", "delivered").ok).toBe(true);
  });

  it("allows delivered → confirmed", () => {
    expect(transition("delivered", "confirmed").ok).toBe(true);
  });

  it("allows delivered → in_progress rework", () => {
    expect(transition("delivered", "in_progress")).toEqual({
      ok: true,
      next: "in_progress",
    });
  });

  it("forbids skipping captured → confirmed", () => {
    const result = transition("captured", "confirmed");
    expect(result.ok).toBe(false);
    expect(result.next).toBe("captured");
  });

  it("forbids confirmed → anything", () => {
    expect(canTransition("confirmed", "delivered")).toBe(false);
    expect(canTransition("confirmed", "in_progress")).toBe(false);
  });

  it("forbids same-status transition", () => {
    expect(canTransition("captured", "captured")).toBe(false);
  });

  it("marks confirmed as terminal", () => {
    expect(isTerminal("confirmed")).toBe(true);
    expect(isTerminal("delivered")).toBe(false);
  });
});
