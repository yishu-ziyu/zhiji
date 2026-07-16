import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("./collab-events.mjs", import.meta.url));
const tempRoots = [];

test.afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

async function git(cwd, ...args) {
  return execFileAsync("git", args, { cwd, encoding: "utf8" });
}

async function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "collab-events-test-"));
  tempRoots.push(root);
  const repo = join(root, "repo");
  mkdirSync(repo);
  await git(repo, "init", "-b", "main");
  await git(repo, "config", "user.name", "Collab Test");
  await git(repo, "config", "user.email", "collab-test@example.invalid");
  writeFileSync(join(repo, "README.md"), "test repository\n");
  await git(repo, "add", "README.md");
  await git(repo, "commit", "-m", "test: initialize repository");
  return { root, repo };
}

async function runCli(cwd, ...args) {
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, COLLAB_LOCK_TIMEOUT_MS: "2000" },
  });
}

async function publish(cwd, { agent, session, summary }) {
  const { stdout } = await runCli(
    cwd,
    "publish",
    "--agent",
    agent,
    "--session",
    session,
    "--summary",
    summary,
  );
  return JSON.parse(stdout);
}

async function waitFor(predicate, message, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

test("publish shares one common-dir log across linked worktrees and status keeps the latest session event", async () => {
  const { root, repo } = await createRepository();
  const lane = join(root, "lane");
  await git(repo, "worktree", "add", "-b", "lane", lane);

  const first = await publish(repo, {
    agent: "codex",
    session: "root",
    summary: "coordinate lanes",
  });
  const laneEvent = await publish(lane, {
    agent: "codex",
    session: "story-03",
    summary: "write Story 03 UI",
  });
  const latest = await publish(repo, {
    agent: "codex",
    session: "root",
    summary: "coordinate lanes again",
  });

  const { stdout: commonDirOutput } = await git(
    repo,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  );
  const logPath = join(commonDirOutput.trim(), "collab", "events.jsonl");
  const stored = readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(stored.length, 3);
  assert.equal(first.worktree, realpathSync(repo));
  assert.equal(first.branch, "main");
  assert.equal(laneEvent.worktree, realpathSync(lane));
  assert.equal(laneEvent.branch, "lane");
  assert.equal(first.sha, laneEvent.sha);
  assert.match(first.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(first.id);

  const { stdout } = await runCli(lane, "status", "--json");
  const status = JSON.parse(stdout);
  assert.equal(status.length, 2);
  assert.equal(
    status.find((event) => event.session === "root")?.id,
    latest.id,
  );
  assert.equal(
    status.find((event) => event.session === "story-03")?.id,
    laneEvent.id,
  );
});

test("concurrent publish calls append complete JSON records without loss", async () => {
  const { repo } = await createRepository();
  const count = 16;

  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      publish(repo, {
        agent: "parallel-agent",
        session: `session-${index}`,
        summary: `event ${index}`,
      }),
    ),
  );

  const { stdout: commonDirOutput } = await git(
    repo,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  );
  const lines = readFileSync(
    join(commonDirOutput.trim(), "collab", "events.jsonl"),
    "utf8",
  )
    .trim()
    .split("\n");

  assert.equal(lines.length, count);
  const events = lines.map((line) => JSON.parse(line));
  assert.equal(new Set(events.map((event) => event.id)).size, count);
  assert.equal(new Set(events.map((event) => event.session)).size, count);
});

test("follow emits events published after the follower starts", async () => {
  const { repo } = await createRepository();
  const child = spawn(process.execPath, [cliPath, "follow", "--json"], {
    cwd: repo,
    env: { ...process.env, COLLAB_POLL_MS: "20" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });

  try {
    await waitFor(
      () => stderr.includes("following "),
      `follower did not become ready; stderr=${stderr}`,
    );
    const event = await publish(repo, {
      agent: "grok",
      session: "window-3",
      summary: "received shared context",
    });
    await waitFor(
      () => stdout.trim().length > 0,
      `follower did not emit an event; stderr=${stderr}`,
    );
    assert.equal(JSON.parse(stdout.trim()).id, event.id);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }
});
