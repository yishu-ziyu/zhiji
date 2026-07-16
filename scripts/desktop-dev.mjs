#!/usr/bin/env node
/**
 * Dev: Next on 127.0.0.1:3331 + Electron after health check.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runtime = require("../desktop/runtime.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const DEV_URL = "http://127.0.0.1:3331";
const PORT = 3331;

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function cleanup(code = 0) {
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));

async function main() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const next = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(PORT)],
    {
      cwd: root,
      env: { ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1" },
      stdio: "inherit",
    },
  );
  children.push(next);
  next.on("exit", (code) => {
    console.error("[desktop:dev] next exited", code);
    cleanup(code ?? 1);
  });

  const health = runtime.healthCheckUrl(PORT);
  const ready = await runtime.waitForHttpOk(health, {
    timeoutMs: 60_000,
    intervalMs: 400,
  });
  if (!ready.ok) {
    console.error("[desktop:dev] health failed", ready.reason);
    cleanup(1);
  }

  const electron = require("electron");
  const elec = spawn(electron, [path.join(root, "desktop", "main.cjs")], {
    cwd: root,
    env: {
      ...process.env,
      FC_OPC_DESKTOP_DEV_URL: DEV_URL,
    },
    stdio: "inherit",
  });
  children.push(elec);
  elec.on("exit", (code) => {
    console.error("[desktop:dev] electron exited", code);
    cleanup(code ?? 0);
  });
}

main().catch((e) => {
  console.error(e);
  cleanup(1);
});
