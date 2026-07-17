#!/usr/bin/env node
/**
 * BYOK helper: create userData .env.local template for the user to fill.
 *
 * Default: write an empty template (no secrets). User edits the file themselves.
 * Does NOT copy process.env or repo .env.local into the file.
 * Does NOT embed anything into the .app package.
 *
 * Usage:
 *   node scripts/install-desktop-env.mjs
 *   node scripts/install-desktop-env.mjs --force   # overwrite existing with blank template
 *   node scripts/install-desktop-env.mjs --print-path
 *   open "$(node scripts/install-desktop-env.mjs --print-path)"  # then fill keys
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runtime = require("../desktop/runtime.cjs");

const PRODUCT_USER_DATA = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "知几",
);

function parseArgs(argv) {
  /** @type {{ force?: boolean, printPath?: boolean, userData?: string, help?: boolean }} */
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") out.force = true;
    else if (a === "--print-path") out.printPath = true;
    else if (a === "--user-data" && argv[i + 1]) out.userData = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Bring Your Own Key (BYOK)

  node scripts/install-desktop-env.mjs
      Create empty template at userData/.env.local (mode 0600) if missing.
      You fill LLM_BASE_URL / LLM_API_KEY / LLM_MODEL yourself.

  node scripts/install-desktop-env.mjs --force
      Replace existing file with a blank template (does not keep old keys).

  node scripts/install-desktop-env.mjs --print-path
      Print the target path only (for "open $(…)" editors).

Allowlist: ${runtime.ALLOWED_ENV_KEYS.join(", ")}
Never pre-fills from process.env. Never bundles into .app.
Docs: docs/product/DESKTOP_ENV_SETUP.md
`);
    process.exit(0);
  }

  const userData = args.userData
    ? path.resolve(args.userData)
    : PRODUCT_USER_DATA;
  const dest = path.join(userData, ".env.local");

  if (args.printPath) {
    console.log(dest);
    process.exit(0);
  }

  fs.mkdirSync(userData, { recursive: true });

  if (fs.existsSync(dest) && !args.force) {
    console.log("[install-desktop-env] already exists (not overwritten):", dest);
    console.log(
      "[install-desktop-env] Edit this file yourself (BYOK). Use --force only to reset to a blank template.",
    );
    console.log(
      "[install-desktop-env] Open with: open -e \"" + dest + "\"",
    );
    process.exit(0);
  }

  const body = runtime.desktopEnvTemplateBody();
  fs.writeFileSync(dest, body, { mode: 0o600 });
  try {
    fs.chmodSync(dest, 0o600);
  } catch {
    // best-effort
  }

  console.log("[install-desktop-env] wrote blank BYOK template:", dest);
  console.log("[install-desktop-env] Fill LLM_BASE_URL / LLM_API_KEY / LLM_MODEL yourself.");
  console.log("[install-desktop-env] Open: open -e \"" + dest + "\"");
  console.log("[install-desktop-env] Then fully quit and reopen the .app.");
}

main();
