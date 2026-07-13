import { describe, expect, it } from "vitest";
import { canTransition, transition } from "./state-machine";

describe("bilateral commitment slip state machine", () => {
  it("lets the provider send a draft and mark confirmed work delivered", () => {
    expect(transition("draft", "pending_client_confirm", "provider")).toEqual({
      ok: true,
      next: "pending_client_confirm",
    });
    expect(
      transition("client_confirmed", "provider_delivered", "provider"),
    ).toEqual({ ok: true, next: "provider_delivered" });
  });

  it("lets the client confirm, request changes, accept, or reject at its seams", () => {
    expect(
      canTransition("pending_client_confirm", "client_confirmed", "client"),
    ).toBe(true);
    expect(
      canTransition(
        "pending_client_confirm",
        "client_requested_changes",
        "client",
      ),
    ).toBe(true);
    expect(
      canTransition("provider_delivered", "client_accepted", "client"),
    ).toBe(true);
    expect(
      canTransition("provider_delivered", "client_rejected", "client"),
    ).toBe(true);
  });

  it("prevents the provider from faking client-owned states", () => {
    expect(
      transition("pending_client_confirm", "client_confirmed", "provider"),
    ).toMatchObject({ ok: false, next: "pending_client_confirm" });
    expect(
      transition("provider_delivered", "client_accepted", "provider"),
    ).toMatchObject({ ok: false, next: "provider_delivered" });
  });

  it("supports correction loops without skipping role ownership", () => {
    expect(
      canTransition(
        "client_requested_changes",
        "pending_client_confirm",
        "provider",
      ),
    ).toBe(true);
    expect(
      canTransition("client_rejected", "provider_delivered", "provider"),
    ).toBe(true);
  });

  it("rejects same-state and invalid-order transitions", () => {
    expect(canTransition("draft", "draft", "provider")).toBe(false);
    expect(canTransition("draft", "provider_delivered", "provider")).toBe(
      false,
    );
    expect(
      canTransition("pending_client_confirm", "client_accepted", "client"),
    ).toBe(false);
  });

});
