import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import {
  CSRF_HEADER,
  ensureLocalSession,
  SESSION_COOKIE,
} from "@/shared/security/local-session";

const oldDataDir = process.env.KNOWLEDGE_DATA_DIR;
const oldAllowNonLoopback = process.env.FC_OPC_ALLOW_NON_LOOPBACK;

afterEach(() => {
  if (oldDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
  else process.env.KNOWLEDGE_DATA_DIR = oldDataDir;
  if (oldAllowNonLoopback === undefined) delete process.env.FC_OPC_ALLOW_NON_LOOPBACK;
  else process.env.FC_OPC_ALLOW_NON_LOOPBACK = oldAllowNonLoopback;
});

function writeRequest(init?: {
  origin?: string;
  cookie?: string;
  csrf?: string;
  host?: string;
}) {
  const host = init?.host ?? "127.0.0.1:3331";
  return new NextRequest(`http://${host}/api/knowledge/state`, {
    method: "POST",
    headers: {
      host,
      origin: init?.origin ?? "http://127.0.0.1:3331",
      ...(init?.cookie ? { cookie: init.cookie } : {}),
      ...(init?.csrf ? { [CSRF_HEADER]: init.csrf } : {}),
    },
  });
}

describe("local API proxy trust boundary", () => {
  it("rejects a mutating API request that skips the route-level guard", async () => {
    process.env.KNOWLEDGE_DATA_DIR = `/tmp/fc-opc-proxy-${crypto.randomUUID()}`;
    const response = proxy(writeRequest());
    expect(response.status).toBe(401);
  });

  it("rejects a different loopback port even with a valid local session", async () => {
    process.env.KNOWLEDGE_DATA_DIR = `/tmp/fc-opc-proxy-${crypto.randomUUID()}`;
    const session = ensureLocalSession();
    const response = proxy(
      writeRequest({
        origin: "http://127.0.0.1:3000",
        cookie: `${SESSION_COOKIE}=${session.sessionId}`,
        csrf: session.csrfToken,
      }),
    );
    expect(response.status).toBe(403);
  });

  it("allows a same-origin write with the server-issued session and CSRF", async () => {
    process.env.KNOWLEDGE_DATA_DIR = `/tmp/fc-opc-proxy-${crypto.randomUUID()}`;
    const session = ensureLocalSession();
    const response = proxy(
      writeRequest({
        cookie: `${SESSION_COOKIE}=${session.sessionId}`,
        csrf: session.csrfToken,
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("has no environment-variable bypass that can expose mutating APIs", () => {
    process.env.FC_OPC_ALLOW_NON_LOOPBACK = "1";
    const response = proxy(
      writeRequest({
        host: "example.test",
        origin: "http://example.test",
      }),
    );
    expect(response.status).toBe(403);
  });
});
