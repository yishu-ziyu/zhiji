/**
 * Desktop runtime boundary (competition shell).
 * Imports pure helpers from desktop/runtime.cjs — no Electron.
 */
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// CommonJS module under test
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtime = require("../../desktop/runtime.cjs") as {
  chooseLoopbackPort: () => Promise<number>;
  createWindowOptions: (preloadPath: string) => {
    show: boolean;
    webPreferences: {
      preload: string;
      nodeIntegration: boolean;
      contextIsolation: boolean;
      sandbox: boolean;
    };
  };
  isAllowedAppUrl: (candidate: string, port: number) => boolean;
  parseDesktopEnv: (raw: string) => Record<string, string>;
  resolveDesktopPaths: (input: {
    userDataDir: string;
    appPath: string;
  }) => {
    knowledgeDir: string;
    envFile: string;
    logFile: string;
    serverEntry: string;
    runtimeDir: string;
  };
  waitForHttpOk: (
    url: string,
    options?: { timeoutMs?: number; intervalMs?: number },
  ) => Promise<{ ok: true; status: number } | { ok: false; reason: string }>;
  redactForLog: (line: string) => string;
  ALLOWED_ENV_KEYS: readonly string[];
  FORBIDDEN_PARENT_ENV_HINTS: readonly string[];
  resolveAllowedEnvironment: (
    processEnv: Record<string, string | undefined>,
    fileContents?: string,
  ) => Record<string, string>;
  buildUtilityProcessEnv: (input: {
    allowedEnv: Record<string, string>;
    port: number;
    knowledgeDir: string;
    pathEnv?: string;
    homeEnv?: string;
    tmpDir?: string;
    lang?: string;
  }) => Record<string, string>;
  assertEnvHasNoForbiddenKeys: (
    env: Record<string, string>,
    extra?: string[],
  ) => void;
  decideWindowOpen: (url: string) => {
    action: "deny";
    blockedUrlSafe: string;
  };
  formatConfigPresence: (allowedEnv: Record<string, string>) => string;
  loadDesktopSecrets: (input: {
    isPackaged: boolean;
    processEnv?: Record<string, string | undefined>;
    fileContents?: string;
  }) => Record<string, string>;
  desktopEnvTemplateBody: () => string;
};

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("resolveDesktopPaths", () => {
  it("does not depend on process.cwd(); knowledgeDir is under userDataDir", () => {
    const userDataDir = path.join(os.tmpdir(), `fc-opc-ud-${Date.now()}`);
    const appPath = path.join(os.tmpdir(), `fc-opc-app-${Date.now()}`);
    tmpDirs.push(userDataDir, appPath);
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(appPath, { recursive: true });

    const cwdBefore = process.cwd();
    const paths = runtime.resolveDesktopPaths({ userDataDir, appPath });

    expect(paths.knowledgeDir).toBe(path.join(userDataDir, "knowledge"));
    expect(paths.envFile).toBe(path.join(userDataDir, ".env.local"));
    expect(paths.logFile).toBe(path.join(userDataDir, "logs", "desktop.log"));
    expect(paths.serverEntry).toBe(path.join(appPath, "runtime", "server.js"));
    expect(paths.runtimeDir).toBe(path.join(appPath, "runtime"));
    // Still same cwd — helper must not chdir
    expect(process.cwd()).toBe(cwdBefore);
    // Paths must not be resolved via relative cwd fragments alone
    expect(paths.knowledgeDir.startsWith(userDataDir)).toBe(true);
  });
});

describe("createWindowOptions", () => {
  it("disables Node, enables isolation and sandbox", () => {
    const preload = "/abs/path/preload.cjs";
    const opts = runtime.createWindowOptions(preload);
    expect(opts.show).toBe(false);
    expect(opts.webPreferences.preload).toBe(preload);
    expect(opts.webPreferences.nodeIntegration).toBe(false);
    expect(opts.webPreferences.contextIsolation).toBe(true);
    expect(opts.webPreferences.sandbox).toBe(true);
  });
});

describe("isAllowedAppUrl", () => {
  const port = 41789;

  it("allows only loopback knowledge entry and same-origin api/static", () => {
    expect(
      runtime.isAllowedAppUrl(`http://127.0.0.1:${port}/track/knowledge`, port),
    ).toBe(true);
    expect(
      runtime.isAllowedAppUrl(
        `http://127.0.0.1:${port}/track/knowledge?x=1`,
        port,
      ),
    ).toBe(true);
    expect(
      runtime.isAllowedAppUrl(
        `http://127.0.0.1:${port}/api/local-session`,
        port,
      ),
    ).toBe(true);
    expect(
      runtime.isAllowedAppUrl(
        `http://127.0.0.1:${port}/_next/static/chunks/app.js`,
        port,
      ),
    ).toBe(true);
  });

  it("rejects localhost alias, other ports, file, https, external", () => {
    expect(
      runtime.isAllowedAppUrl(`http://localhost:${port}/track/knowledge`, port),
    ).toBe(false);
    expect(
      runtime.isAllowedAppUrl(`http://127.0.0.1:9999/track/knowledge`, port),
    ).toBe(false);
    expect(runtime.isAllowedAppUrl("file:///tmp/x", port)).toBe(false);
    expect(
      runtime.isAllowedAppUrl(
        `https://127.0.0.1:${port}/track/knowledge`,
        port,
      ),
    ).toBe(false);
    expect(
      runtime.isAllowedAppUrl("http://example.com/track/knowledge", port),
    ).toBe(false);
    expect(runtime.isAllowedAppUrl(`http://0.0.0.0:${port}/`, port)).toBe(
      false,
    );
  });
});

describe("parseDesktopEnv", () => {
  it("keeps only allowlisted keys; ignores comments, blanks, unknown", () => {
    const raw = `
# comment
LLM_BASE_URL=https://api.example.com
LLM_API_KEY=secret-key-value
LLM_MODEL=gpt-test
AGENT_RUN_MODE=deterministic
AGENT_ALLOW_DETERMINISTIC_FALLBACK=0
UNKNOWN_KEY=nope
RANDOM=1

LLM_BASE_URL=https://override.example.com
`;
    const parsed = runtime.parseDesktopEnv(raw);
    expect(parsed.LLM_BASE_URL).toBe("https://override.example.com");
    expect(parsed.LLM_API_KEY).toBe("secret-key-value");
    expect(parsed.LLM_MODEL).toBe("gpt-test");
    expect(parsed.AGENT_RUN_MODE).toBe("deterministic");
    expect(parsed.AGENT_ALLOW_DETERMINISTIC_FALLBACK).toBe("0");
    expect(parsed).not.toHaveProperty("UNKNOWN_KEY");
    expect(parsed).not.toHaveProperty("RANDOM");
  });
});

describe("waitForHttpOk", () => {
  it("returns ok on 2xx", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no addr");
    const url = `http://127.0.0.1:${addr.port}/api/local-session`;
    const result = await runtime.waitForHttpOk(url, {
      timeoutMs: 3000,
      intervalMs: 50,
    });
    server.close();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe(200);
  });

  it("fails on timeout when nothing listens", async () => {
    const result = await runtime.waitForHttpOk(
      "http://127.0.0.1:1/api/local-session",
      { timeoutMs: 400, intervalMs: 50 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/timeout|ECONNREFUSED|fail/i);
  });

  it("fails on non-2xx", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(500);
      res.end("no");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no addr");
    const url = `http://127.0.0.1:${addr.port}/api/local-session`;
    const result = await runtime.waitForHttpOk(url, {
      timeoutMs: 2000,
      intervalMs: 50,
    });
    server.close();
    expect(result.ok).toBe(false);
  });
});

describe("chooseLoopbackPort", () => {
  it("returns a free port bound for 127.0.0.1 only (number > 0)", async () => {
    const port = await runtime.chooseLoopbackPort();
    expect(typeof port).toBe("number");
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65536);
  });
});

describe("redactForLog", () => {
  it("never echoes secret values", () => {
    const line = "LLM_API_KEY=sk-secret-abc env set";
    const out = runtime.redactForLog(line);
    expect(out).not.toContain("sk-secret-abc");
    expect(out.toLowerCase()).toMatch(/redact|configured|\*\*\*/i);
  });

  it("keeps presence markers while redacting configured values", () => {
    const presence = runtime.redactForLog(
      "LLM_API_KEY=configured ANYSEARCH_API_KEY=missing",
    );
    expect(presence).toContain("LLM_API_KEY=configured");
    expect(presence).toContain("ANYSEARCH_API_KEY=missing");

    const secret = runtime.redactForLog(
      "LLM_API_KEY=actual-secret ANYSEARCH_API_KEY=search-secret",
    );
    expect(secret).not.toContain("actual-secret");
    expect(secret).not.toContain("search-secret");
  });
});

describe("buildUtilityProcessEnv (no parent credential leak)", () => {
  it("does not include sentinel parent secrets even if present in process.env", () => {
    const parentWithSentinels: Record<string, string | undefined> = {
      ...process.env,
      ANTHROPIC_AUTH_TOKEN: "sentinel-anthropic-must-not-leak",
      OPENAI_API_KEY: "sentinel-openai-must-not-leak",
      AWS_SECRET_ACCESS_KEY: "sentinel-aws-must-not-leak",
      LLM_API_KEY: "allowlisted-model-key",
      LLM_BASE_URL: "https://example.invalid/v1",
      LLM_MODEL: "test-model",
      RANDOM_JUNK: "nope",
    };

    const allowed = runtime.resolveAllowedEnvironment(parentWithSentinels, "");
    expect(allowed.LLM_API_KEY).toBe("allowlisted-model-key");
    expect(allowed).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN");
    expect(allowed).not.toHaveProperty("OPENAI_API_KEY");
    expect(allowed).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");

    const utilEnv = runtime.buildUtilityProcessEnv({
      allowedEnv: allowed,
      port: 4242,
      knowledgeDir: "/tmp/fc-opc-knowledge-test",
      pathEnv: parentWithSentinels.PATH || "/usr/bin:/bin",
      homeEnv: "/tmp/home-test",
    });

    expect(utilEnv.NODE_ENV).toBe("production");
    expect(utilEnv.HOSTNAME).toBe("127.0.0.1");
    expect(utilEnv.HOST).toBe("127.0.0.1");
    expect(utilEnv.PORT).toBe("4242");
    expect(utilEnv.KNOWLEDGE_DATA_DIR).toBe("/tmp/fc-opc-knowledge-test");
    expect(utilEnv.LLM_API_KEY).toBe("allowlisted-model-key");
    expect(utilEnv.PATH).toBeTruthy();

    // Sentinel must be absent from utility env keys
    for (const key of runtime.FORBIDDEN_PARENT_ENV_HINTS) {
      expect(utilEnv).not.toHaveProperty(key);
    }
    expect(utilEnv).not.toHaveProperty("RANDOM_JUNK");
    expect(utilEnv).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN");
    expect(utilEnv).not.toHaveProperty("OPENAI_API_KEY");
    expect(utilEnv).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");

    // Values must not appear either
    const blob = JSON.stringify(utilEnv);
    expect(blob).not.toContain("sentinel-anthropic-must-not-leak");
    expect(blob).not.toContain("sentinel-openai-must-not-leak");
    expect(blob).not.toContain("sentinel-aws-must-not-leak");

    expect(() => runtime.assertEnvHasNoForbiddenKeys(utilEnv)).not.toThrow();
  });

  it("formatConfigPresence never embeds secret values", () => {
    const line = runtime.formatConfigPresence({
      LLM_API_KEY: "super-secret-value-xyz",
      LLM_BASE_URL: "https://example.invalid",
    });
    expect(line).toContain("LLM_API_KEY=configured");
    expect(line).not.toContain("super-secret-value-xyz");
  });
});

describe("decideWindowOpen (deny all new windows)", () => {
  it("always denies, including same-origin knowledge URLs", () => {
    const same = runtime.decideWindowOpen(
      "http://127.0.0.1:4242/track/knowledge?token=secret-query",
    );
    expect(same.action).toBe("deny");
    expect(same.blockedUrlSafe).toBe(
      "http://127.0.0.1:4242/track/knowledge",
    );
    expect(same.blockedUrlSafe).not.toContain("token");
    expect(same.blockedUrlSafe).not.toContain("secret");

    const external = runtime.decideWindowOpen("https://evil.example/x");
    expect(external.action).toBe("deny");
  });
});

describe("loadDesktopSecrets (BYOK)", () => {
  it("packaged mode ignores process env secrets; only userData file", () => {
    const file = [
      "LLM_BASE_URL=https://user-filled.example/v1",
      "LLM_API_KEY=user-own-key",
      "LLM_MODEL=user-model",
      "",
    ].join("\n");
    const processEnv = {
      LLM_API_KEY: "parent-process-must-not-win-when-packaged",
      ANTHROPIC_AUTH_TOKEN: "sentinel-must-not-appear",
      OPENAI_API_KEY: "sentinel-must-not-appear",
    };
    const secrets = runtime.loadDesktopSecrets({
      isPackaged: true,
      processEnv,
      fileContents: file,
    });
    expect(secrets.LLM_API_KEY).toBe("user-own-key");
    expect(secrets.LLM_BASE_URL).toBe("https://user-filled.example/v1");
    expect(secrets).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN");
    expect(Object.values(secrets).join(" ")).not.toContain(
      "parent-process-must-not-win",
    );
    expect(Object.values(secrets).join(" ")).not.toContain("sentinel-must-not-appear");
  });

  it("packaged with empty file yields no keys (user has not filled BYOK yet)", () => {
    const secrets = runtime.loadDesktopSecrets({
      isPackaged: true,
      processEnv: {
        LLM_API_KEY: "should-not-leak-from-parent",
      },
      fileContents: runtime.desktopEnvTemplateBody(),
    });
    // template has empty values → parse drops them
    expect(secrets.LLM_API_KEY).toBeUndefined();
    expect(secrets.LLM_BASE_URL).toBeUndefined();
  });

  it("desktopEnvTemplateBody has no secret material", () => {
    const t = runtime.desktopEnvTemplateBody();
    expect(t).toMatch(/Bring Your Own Key|BYOK/i);
    expect(t).toContain("LLM_API_KEY=");
    expect(t).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    expect(t).not.toContain("sentinel");
  });
});
