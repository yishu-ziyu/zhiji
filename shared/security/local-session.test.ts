import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkLocalTrust,
  CSRF_COOKIE,
  CSRF_HEADER,
  ensureLocalSession,
  isAllowedOrigin,
  isLoopbackHost,
  SESSION_COOKIE,
  sessionCookieHeader,
} from "./local-session";

describe("local-session trust (PR-08 / P0 CSRF)", () => {
  let dataDir: string;
  let prev: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-trust-"));
    prev = process.env.KNOWLEDGE_DATA_DIR;
    process.env.KNOWLEDGE_DATA_DIR = dataDir;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = prev;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("only accepts loopback hosts", () => {
    expect(isLoopbackHost("127.0.0.1:3000")).toBe(true);
    expect(isLoopbackHost("localhost:3331")).toBe(true);
    expect(isLoopbackHost("evil.example.com")).toBe(false);
  });

  it("rejects non-local origins and cross-port loopback", () => {
    expect(isAllowedOrigin("https://evil.example", "127.0.0.1:3000")).toBe(
      false,
    );
    expect(isAllowedOrigin("http://127.0.0.1:3000", "127.0.0.1:3000")).toBe(
      true,
    );
    // P0: different loopback ports are not same-origin
    expect(isAllowedOrigin("http://127.0.0.1:3331", "127.0.0.1:3000")).toBe(
      false,
    );
    expect(isAllowedOrigin("http://localhost:3000", "127.0.0.1:3000")).toBe(
      false,
    );
  });

  it("blocks mutating requests without session", () => {
    const r = checkLocalTrust({
      method: "POST",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookieHeader: null,
      csrfHeader: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("allows GET on loopback without prior cookie", () => {
    const r = checkLocalTrust({
      method: "GET",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookieHeader: null,
      csrfHeader: null,
    });
    expect(r.ok).toBe(true);
  });

  it("cookie only without x-csrf-token header → 403", () => {
    const session = ensureLocalSession();
    const cookieOnly = sessionCookieHeader(session)
      .map((c) => c.split(";")[0])
      .join("; ");
    const r = checkLocalTrust({
      method: "POST",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookieHeader: cookieOnly,
      csrfHeader: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.error).toMatch(/x-csrf-token|CSRF|header/i);
    }
  });

  it("CSRF cookie cannot substitute for header", () => {
    const session = ensureLocalSession();
    const cookies = [
      `${SESSION_COOKIE}=${encodeURIComponent(session.sessionId)}`,
      `${CSRF_COOKIE}=${encodeURIComponent(session.csrfToken)}`,
    ].join("; ");
    const r = checkLocalTrust({
      method: "POST",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookieHeader: cookies,
      csrfHeader: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("session cookie + matching x-csrf-token header → ok", () => {
    const session = ensureLocalSession();
    const cookies = `${SESSION_COOKIE}=${encodeURIComponent(session.sessionId)}`;
    const r = checkLocalTrust({
      method: "POST",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookieHeader: cookies,
      csrfHeader: session.csrfToken,
    });
    expect(r.ok).toBe(true);
    expect(CSRF_HEADER).toBe("x-csrf-token");
  });

  it("cross loopback port Origin → 403", () => {
    const session = ensureLocalSession();
    const cookies = `${SESSION_COOKIE}=${encodeURIComponent(session.sessionId)}`;
    const r = checkLocalTrust({
      method: "POST",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3331",
      cookieHeader: cookies,
      csrfHeader: session.csrfToken,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.error).toMatch(/Origin|同源|端口/i);
    }
  });
});
