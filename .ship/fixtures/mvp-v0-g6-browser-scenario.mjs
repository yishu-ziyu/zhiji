/**
 * MVP-V0 G6 · ONE browser scenario (Task 7)
 *
 * Execute only after G2 posts integrated SHA + worktree + port.
 *
 *   export MVP_V0_BASE_URL=http://localhost:<port>
 *   export MVP_V0_PROJECT_ID=<projectId>   # optional if UI creates/selects project
 *   export MVP_V0_FIXTURE_ROOT=/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/fixtures/mvp-v0-g6-owner-project
 *   node .ship/fixtures/mvp-v0-g6-browser-scenario.mjs
 *
 * Evidence: .ship/evidence/g6-mvp-v0/  (screenshots + short log only)
 * No exhaustive visual matrix.
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.MVP_V0_BASE_URL || "http://localhost:3000";
const FIXTURE =
  process.env.MVP_V0_FIXTURE_ROOT ||
  "/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/fixtures/mvp-v0-g6-owner-project";
const PROJECT_ID = process.env.MVP_V0_PROJECT_ID || "";
const PRIMARY = "/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot";
const EV = path.join(PRIMARY, ".ship/evidence/g6-mvp-v0");
const LOG = path.join(EV, "scenario-log.txt");
const MUTATE = path.join(PRIMARY, ".ship/fixtures/mvp-v0-g6-mutate.sh");

fs.mkdirSync(EV, { recursive: true });
const lines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  lines.push(line);
  console.log(line);
}
function shot(page, name) {
  const p = path.join(EV, name);
  return page.screenshot({ path: p, fullPage: true }).then(() => log(`screenshot ${p}`));
}

async function main() {
  log(`BASE=${BASE}`);
  log(`FIXTURE=${FIXTURE}`);
  log(`PROJECT_ID=${PROJECT_ID || "(unset — UI path)"}`);
  log(`SHA_ENV=${process.env.MVP_V0_INTEGRATED_SHA || "(await G2)"}`);

  if (!process.env.MVP_V0_INTEGRATED_SHA) {
    log("HOLD: set MVP_V0_INTEGRATED_SHA after G2 unlock; abort execute");
    fs.writeFileSync(LOG, lines.join("\n") + "\n");
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const entry = PROJECT_ID
    ? `${BASE}/track/knowledge?projectId=${PROJECT_ID}`
    : `${BASE}/track/knowledge`;
  log(`open ${entry}`);
  await page.goto(entry, { waitUntil: "networkidle" });
  await shot(page, "01-entry.png");

  // --- 1 authorize fixture root (selectors may match integrated UI copy) ---
  // Prefer visible Owner language: 连接本地项目 / 授权 / 选择文件夹
  const connect =
    page.getByRole("button", { name: /连接本地项目|授权|选择.*项目|Connect/i }).first();
  if (await connect.count()) {
    await connect.click();
    log("clicked connect/authorize control");
  } else {
    log("WARN: no connect button — fill API grant via eval if UI differs");
  }
  // Path field if present
  const pathInput = page.locator('input[name="rootPath"], input[placeholder*="路径"], input[type="text"]').first();
  if (await pathInput.count()) {
    await pathInput.fill(FIXTURE);
    log(`filled rootPath=${FIXTURE}`);
  }
  const confirmGrant = page.getByRole("button", { name: /确认授权|开始观察|连接|Authorize|Grant/i }).first();
  if (await confirmGrant.count()) {
    await confirmGrant.click();
    log("confirmed grant");
  }
  await page.waitForTimeout(1500);
  await shot(page, "02-authorized.png");
  log(`url_after_auth=${page.url()}`);

  // --- 2 mutate: modify / rename / delete ---
  const mut = spawnSync("bash", [MUTATE], { encoding: "utf8" });
  log(`mutate_exit=${mut.status}`);
  log((mut.stdout || mut.stderr || "").trim().split("\n").slice(-8).join(" | "));

  // --- 3 wait ≤5s for three clickable changes ---
  const deadline = Date.now() + 5000;
  let changeCount = 0;
  while (Date.now() < deadline) {
    changeCount = await page.locator('[data-testid="change-event"], [data-kind="change"], text=/modified|renamed|deleted|修改|重命名|删除/i').count();
    if (changeCount >= 3) break;
    await page.waitForTimeout(200);
  }
  const elapsed = 5000 - (deadline - Date.now());
  log(`changes_visible_count≈${changeCount} elapsed_ms≈${Math.max(0, elapsed)}`);
  await shot(page, "03-changes-within-5s.png");

  // --- 4 open before/after + deleted prior version ---
  const mod = page.getByText(/NOTES|modified|修改/i).first();
  if (await mod.count()) {
    await mod.click();
    await page.waitForTimeout(400);
    await shot(page, "04-modify-before-after.png");
    log("opened modify change");
  }
  const del = page.getByText(/DECISIONS|deleted|删除/i).first();
  if (await del.count()) {
    await del.click();
    await page.waitForTimeout(400);
    await shot(page, "05-delete-tombstone.png");
    log("opened delete/tombstone");
  }

  // --- 5 Agent / six questions ---
  const runAgent = page.getByRole("button", { name: /运行|重建|分析|Agent|状态/i }).first();
  if (await runAgent.count()) {
    await runAgent.click();
    log("triggered analysis/agent");
    await page.waitForTimeout(2000);
  }
  await shot(page, "06-six-questions.png");
  const body = await page.locator("body").innerText();
  for (const q of ["现在", "当时", "变了", "为什么", "影响", "依据"]) {
    log(`six_q_has_${q}=${body.includes(q)}`);
  }

  // --- 6 Owner confirm ---
  const accept = page.getByRole("button", { name: /确认|接受|Accept|accept/i }).first();
  if (await accept.count()) {
    await accept.click();
    log("owner accepted understanding");
    await page.waitForTimeout(800);
  }
  await shot(page, "07-owner-accepted.png");

  // --- 7 change evidence again → review_needed ---
  fs.appendFileSync(
    path.join(FIXTURE, "NOTES.md"),
    `\n## evidence bump ${new Date().toISOString()}\n`,
  );
  log("appended NOTES.md for review_needed trigger");
  await page.waitForTimeout(3000);
  await shot(page, "08-review-needed.png");
  const body2 = await page.locator("body").innerText();
  log(`has_review_needed=${/review_needed|待复查|需复查/i.test(body2)}`);

  // --- 8 restart persistence ---
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await shot(page, "09-after-reload.png");
  log(`url_after_reload=${page.url()}`);
  const body3 = await page.locator("body").innerText();
  log(`after_reload_has_matter_or_change=${/事项|变化|understanding|review|NOTES|候选|已确认/i.test(body3)}`);

  await browser.close();
  fs.writeFileSync(LOG, lines.join("\n") + "\n");
  log(`DONE log=${LOG}`);
}

main().catch((err) => {
  console.error(err);
  lines.push(String(err));
  fs.mkdirSync(EV, { recursive: true });
  fs.writeFileSync(LOG, lines.join("\n") + "\n");
  process.exit(1);
});
