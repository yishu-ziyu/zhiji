"use client";

import { useEffect } from "react";

/**
 * PR-08: establish HttpOnly session + CSRF cookie for local Owner UI.
 * Stores csrf token on window for mutating fetch helpers.
 */
export function LocalSessionBootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/local-session", {
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { csrfToken?: string };
        if (data.csrfToken && typeof window !== "undefined") {
          (window as unknown as { __FC_OPC_CSRF?: string }).__FC_OPC_CSRF =
            data.csrfToken;
        }
      } catch {
        /* offline / first paint — non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
