/**
 * Demo readiness · one live golden path against real snapshot.
 * Not a fixture, not deterministic. Requires .env.local LLM_*.
 *
 * Usage:
 *   node --import tsx .ship/evidence/demo-golden-path-live.mjs
 * or via package: NODE_OPTIONS=... npx tsx .ship/evidence/demo-golden-path-live.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHORT = "1cbfa244";
const SNAP =
  process.env.DEMO_SNAPSHOT ||
  `/Users/mahaoxuan/Desktop/黑客松/fc-opc-demo-snapshot-${SHORT}`;
const RUNTIME =
  process.env.DEMO_RUNTIME ||
  `/Users/mahaoxuan/Desktop/黑客松/fc-opc-demo-runtime-${SHORT}`;
const EV = path.join(RUNTIME, "evidence");
const COMMIT = fs
  .readFileSync(path.join(SNAP, "SOURCE.txt"), "utf8")
  .match(/commit: (\S+)/)?.[1];

function loadEnvLocal() {
  const p = path.join(REPO, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2] ?? "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnvLocal();
delete process.env.AGENT_RUN_MODE;
process.env.KNOWLEDGE_DATA_DIR = path.join(RUNTIME, "knowledge");
process.env.PROJECT_MEMORY_DATA_DIR = path.join(RUNTIME, "pm");
// some code uses only KNOWLEDGE for both
fs.mkdirSync(process.env.KNOWLEDGE_DATA_DIR, { recursive: true });
fs.mkdirSync(process.env.PROJECT_MEMORY_DATA_DIR, { recursive: true });
fs.mkdirSync(EV, { recursive: true });

const logLines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logLines.push(line);
  console.log(line);
}

function writeEvidence(name, data) {
  const p = path.join(EV, name);
  fs.writeFileSync(
    p,
    typeof data === "string" ? data : JSON.stringify(data, null, 2),
    "utf8",
  );
  log(`wrote ${p}`);
  return p;
}

async function main() {
  log(`REPO=${REPO}`);
  log(`SNAP=${SNAP}`);
  log(`RUNTIME=${RUNTIME}`);
  log(`COMMIT=${COMMIT}`);
  if (!fs.existsSync(SNAP)) throw new Error(`snapshot missing: ${SNAP}`);
  if (!process.env.LLM_API_KEY) throw new Error("LLM_API_KEY missing");

  // Dynamic import after env is set
  const { resetSharedProjectMemoryStoreForTests, getSharedProjectMemoryStore } =
    await import(pathToFileURL(path.join(REPO, "shared/project-memory/runtime.ts")).href);
  const { runToolAugmentedAnalysis } = await import(
    pathToFileURL(path.join(REPO, "shared/project-memory/agent-runtime.ts")).href
  );
  const { complete, getLLMConfig } = await import(
    pathToFileURL(path.join(REPO, "shared/llm/adapter.ts")).href
  );
  const { selectBriefSelection } = await import(
    pathToFileURL(
      path.join(REPO, "shared/project-memory/brief/assemble-brief.ts"),
    ).href
  );
  const {
    hydrateClaimsFromCandidateBody,
    resolveClaimDecision,
    loadRevisionTextsFromCas,
  } = await import(
    pathToFileURL(
      path.join(REPO, "shared/project-memory/claims/resolve-claim.ts"),
    ).href
  );
  const { getProjectMemoryReader, getOwnerDecisionWriter } = await import(
    pathToFileURL(
      path.join(REPO, "shared/project-memory/reconstruct.ts"),
    ).href
  );
  const repo = await import(
    pathToFileURL(path.join(REPO, "shared/knowledge/repository.ts")).href
  );

  resetSharedProjectMemoryStoreForTests(process.env.PROJECT_MEMORY_DATA_DIR);
  const store = getSharedProjectMemoryStore({
    dataDir: process.env.PROJECT_MEMORY_DATA_DIR,
  });

  const cfg = getLLMConfig();
  log(`LLM base=${cfg.baseUrl} model=${cfg.model} keyLen=${cfg.apiKey?.length}`);
  const ping = await complete(
    "Reply with exactly: LLM_OK",
    "You are a connectivity probe. Output only LLM_OK.",
    { maxRetries: 1, timeout: 20_000 },
  );
  log(`LLM ping=${ping.slice(0, 40)}`);
  if (!/LLM_OK/i.test(ping)) throw new Error("LLM ping failed");

  const projectId = "demo-reentry-fc-opc";
  const matterId = "matter-demo-reentry";
  const grantId = "grant-demo-reentry";
  const now = new Date().toISOString();

  // Knowledge project (work item counting)
  try {
    repo.resetKnowledgeStoreForTests?.();
  } catch {
    /* */
  }
  // ensure project via ensureProject if available
  if (typeof repo.ensureProject === "function") {
    repo.ensureProject({
      id: projectId,
      name: "fc-opc 演示快照",
      summary: "重新进入项目 Demo",
    });
  } else if (typeof repo.addProject === "function") {
    try {
      repo.addProject({
        id: projectId,
        name: "fc-opc 演示快照",
        summary: "重新进入项目 Demo",
      });
    } catch {
      /* exists */
    }
  }

  const workItemsBefore = (repo.listActions?.({ projectId }) || []).length;
  log(`workItemsBefore=${workItemsBefore}`);

  store.upsertGrant({
    id: grantId,
    projectId,
    kind: "local_folder",
    rootPath: SNAP,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  store.upsertMatter({
    id: matterId,
    projectId,
    title: "重新进入项目：工程状态是否可称为 accepted",
    goal: "恢复态势并完成一个有依据的下一步决定",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  const files = fs
    .readdirSync(SNAP)
    .filter((f) => f.endsWith(".md") || f === "package.json" || f === "SOURCE.txt");
  store.upsertWatchSet({
    id: "watch-demo",
    projectId,
    matterId,
    grantId,
    includePathPrefixes: files,
    excludePathPrefixes: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  for (const name of files) {
    const content = fs.readFileSync(path.join(SNAP, name));
    await store.ingest({
      projectId,
      grantId,
      kind: "added",
      relativePath: name,
      content: new Uint8Array(content),
      observedAt: now,
    });
  }
  log(`ingested files=${files.join(",")}`);

  log("starting runToolAugmentedAnalysis (live model)…");
  const result = await runToolAugmentedAnalysis(
    { projectId, matterId, trigger: "source_change" },
    {
      modelMode: "model",
      toolsEnabled: true,
      allowDeterministicFallback: false,
    },
  );

  const tools = result.toolReceipts.map((r) => r.tool);
  const toolDetail = result.toolReceipts.map((r) => ({
    sequence: r.sequence,
    tool: r.tool,
    outcome: r.outcome,
    summary: r.summary,
  }));
  writeEvidence("tool-receipts.json", toolDetail);
  log(`runId=${result.run.id} status=${result.run.status}`);
  log(`tools=${tools.join(",")}`);

  const hasMap = tools.includes("project_map");
  const hasSearch = tools.includes("search_text");
  const hasRead =
    tools.includes("read_revision") || tools.includes("read_path");
  if (!hasMap || !hasSearch || !hasRead) {
    writeEvidence("FAILURE.txt", {
      reason: "missing map/search/read",
      tools,
      toolDetail,
      run: result.run,
    });
    throw new Error(
      `grounded gate fail map=${hasMap} search=${hasSearch} read=${hasRead}`,
    );
  }
  if (result.run.modelReceipt?.fallback?.used) {
    throw new Error("deterministic fallback used — not live");
  }
  if (!result.candidate) throw new Error("no candidate");

  const briefSel = selectBriefSelection({
    matterId,
    candidate: {
      id: result.candidate.id,
      body: result.candidate.body,
    },
    runId: result.run.id,
    runStatus: result.run.status,
    runCandidateRevisionId: result.run.candidateRevisionId || result.candidate.id,
    toolNames: tools,
  });
  writeEvidence("brief-selection.json", {
    status: briefSel.status,
    brief:
      briefSel.status === "candidate" || briefSel.status === "accepted_restore"
        ? briefSel.brief
        : null,
    insufficient:
      briefSel.status === "insufficient" ? briefSel : null,
  });
  if (briefSel.status !== "candidate") {
    throw new Error(`expected candidate brief, got ${briefSel.status}`);
  }
  log(`brief judgment=${briefSel.brief.currentJudgment.slice(0, 120)}`);
  log(`brief decision=${briefSel.brief.decisionPrompt.slice(0, 120)}`);
  log(`suggestion=${briefSel.brief.suggestion?.status}`);

  const reader = getProjectMemoryReader();
  const revisionTexts = await loadRevisionTextsFromCas(
    reader,
    result.candidate.body,
  );
  const claims = hydrateClaimsFromCandidateBody({
    projectId,
    matterId,
    candidateRevisionId: result.candidate.id,
    body: result.candidate.body,
    revisionTexts,
    runId: result.run.id,
  });
  writeEvidence("claims.json", {
    count: claims.length,
    claims: claims.map((c) => ({
      id: c.id,
      text: c.text,
      status: c.status,
      linkIds: c.linkIds,
    })),
    revisionTextKeys: Object.keys(revisionTexts),
  });
  if (claims.length === 0) {
    throw new Error("no claims to resolve");
  }

  // Pick first claim with support link if any
  const claim0 = claims[0];
  const claim1 = claims[1] || claims[0];
  const decisionStore = store;
  const writer = getOwnerDecisionWriter();

  // accept or accept_edited on first
  const editText = `${claim0.text}（Owner 补充：packaged/tested 不等于 accepted）`;
  const r0 = await resolveClaimDecision({
    projectId,
    matterId,
    candidateRevisionId: result.candidate.id,
    claimId: claim0.id,
    decision: claims.length > 1 ? "accept_edited" : "accept",
    editedText: claims.length > 1 ? editText : undefined,
    reader,
    writer,
    decisionStore,
  });
  log(
    `claim0 decision=${r0.audit.decision} finalized=${r0.finalized} remaining=${r0.remaining}`,
  );

  let r1 = null;
  if (claims.length > 1 && claim1.id !== claim0.id) {
    r1 = await resolveClaimDecision({
      projectId,
      matterId,
      candidateRevisionId: result.candidate.id,
      claimId: claim1.id,
      decision: "defer",
      reader,
      writer,
      decisionStore,
    });
    log(
      `claim1 decision=${r1.audit.decision} finalized=${r1.finalized} remaining=${r1.remaining}`,
    );
  }

  // Evidence for claim / revision
  const anchorsFromBody = [];
  for (const w of result.candidate.body.why || []) {
    for (const e of w.evidence || []) {
      anchorsFromBody.push({
        revisionId: e.revisionId,
        relativePath: e.relativePath || e.path,
        quote: (e.quote || "").slice(0, 200),
      });
    }
  }
  writeEvidence("claim-revision-evidence.json", {
    claim0: {
      id: claim0.id,
      decision: r0.audit.decision,
      editedText: r0.audit.editedText,
      text: claim0.text,
    },
    claim1: r1
      ? { id: claim1.id, decision: r1.audit.decision }
      : null,
    anchorsFromBody,
    evidenceRevisionIds: result.candidate.body.evidenceRevisionIds,
  });

  // Refresh / re-enter: new reader state
  const stateAfter = await reader.getMatterState(projectId, matterId);
  const resolutions = store.listClaimResolutionRecords(projectId, {
    candidateRevisionId: result.candidate.id,
  });
  writeEvidence("after-resolve-state.json", {
    hasCandidate: Boolean(stateAfter.candidate),
    hasAccepted: Boolean(stateAfter.accepted),
    acceptedId: stateAfter.accepted?.id,
    head: stateAfter.head,
    resolutions: resolutions.map((r) => ({
      claimId: r.claimId,
      decision: r.decision,
      editedText: r.editedText,
    })),
  });

  // Second open of store (simulate re-entry)
  resetSharedProjectMemoryStoreForTests(process.env.PROJECT_MEMORY_DATA_DIR);
  const store2 = getSharedProjectMemoryStore({
    dataDir: process.env.PROJECT_MEMORY_DATA_DIR,
  });
  const reader2 = getProjectMemoryReader();
  const state2 = await reader2.getMatterState(projectId, matterId);
  const res2 = store2.listClaimResolutionRecords(projectId, {
    candidateRevisionId: result.candidate.id,
  });
  writeEvidence("reentry-state.json", {
    hasAccepted: Boolean(state2.accepted),
    hasCandidate: Boolean(state2.candidate),
    acceptedNow: state2.accepted?.body?.now?.text?.slice(0, 200),
    resolutions: res2.map((r) => ({
      claimId: r.claimId,
      decision: r.decision,
    })),
  });
  const deferSurvived = res2.some((r) => r.decision === "defer");
  const acceptSurvived = res2.some(
    (r) => r.decision === "accept" || r.decision === "accept_edited",
  );
  log(`reentry acceptSurvived=${acceptSurvived} deferSurvived=${deferSurvived}`);

  const workItemsAfter = (repo.listActions?.({ projectId }) || []).length;
  log(`workItemsAfter=${workItemsAfter}`);
  if (workItemsAfter > workItemsBefore) {
    throw new Error(
      `Work Item count increased ${workItemsBefore} → ${workItemsAfter}`,
    );
  }

  const summary = {
    status: "live-verified",
    commit: COMMIT,
    snapshot: SNAP,
    runtime: RUNTIME,
    runId: result.run.id,
    runStatus: result.run.status,
    tools: { hasMap, hasSearch, hasRead, list: tools },
    toolReceipts: toolDetail,
    candidateId: result.candidate.id,
    brief: {
      currentJudgment: briefSel.brief.currentJudgment,
      whyNow: briefSel.brief.whyNow,
      decisionPrompt: briefSel.brief.decisionPrompt,
      suggestion: briefSel.brief.suggestion,
      unknowns: briefSel.brief.unknowns,
      contraryOrLimits: briefSel.brief.contraryOrLimits,
    },
    claims: {
      count: claims.length,
      claim0: r0.audit,
      claim1: r1?.audit ?? null,
    },
    reentry: {
      acceptSurvived,
      deferSurvived,
      hasAccepted: Boolean(state2.accepted),
      resolutionCount: res2.length,
    },
    workItems: { before: workItemsBefore, after: workItemsAfter },
    modelReceipt: result.run.modelReceipt
      ? {
          provider: result.run.modelReceipt.provider,
          model: result.run.modelReceipt.model,
          fallbackUsed: result.run.modelReceipt.fallback?.used,
        }
      : null,
  };
  writeEvidence("GOLDEN_PATH_SUMMARY.json", summary);
  writeEvidence("demo-golden-path-log.txt", logLines.join("\n") + "\n");
  console.log("\n=== GOLDEN PATH OK ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("GOLDEN PATH FAILED", err);
  try {
    fs.writeFileSync(
      path.join(EV, "FAILURE.txt"),
      String(err?.stack || err),
      "utf8",
    );
  } catch {
    /* */
  }
  process.exit(1);
});
