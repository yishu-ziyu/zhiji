/**
 * ProjectAgentRuntime — multi-step tool loop then model propose.
 * Implements D-51/D-52 surface: tools + receipts + budget + finish.
 */
import { randomUUID } from "node:crypto";
import {
  buildDeterministicUnderstandingBody,
  createAgentModelLoop,
  sanitizeModelBody,
} from "./agent-model-loop";
import {
  enforceSourceBackedBody,
  isUsableEvidenceAnchor,
} from "./agent-evidence";
import {
  executeProjectAgentTool,
  planBootstrapToolCalls,
  planForceReadsFromMap,
  planReadFollowupsFromSearch,
} from "./agent-tools";
import { complete, extractJson } from "@/shared/llm/adapter";
import {
  filterEventsForMatter,
  runStateReconstruction,
  type RunAnalysisInput,
} from "./reconstruct";
import {
  getSharedAgentMemoryService,
  getSharedProjectMemoryStore,
} from "./runtime";
import type {
  AgentLoopContext,
  AgentLoopDecision,
  AgentModelCallReceipt,
  AgentRunBudget,
  AnalysisRun,
  EvidenceAnchor,
  MatterStateReconstructionInput,
  ProjectAgentModelLoop,
  ProjectAgentRuntime,
  ProjectAgentToolCall,
  ToolReceipt,
  UnderstandingBody,
} from "./types";
import { DEFAULT_AGENT_RUN_BUDGET as BUDGET_DEFAULT } from "./types";

export type CreateProjectAgentRuntimeOptions = {
  /** Force deterministic model path (tests). */
  modelMode?: "model" | "deterministic";
  /** Skip multi-step tools (legacy single-shot). */
  toolsEnabled?: boolean;
  /**
   * When modelMode=model: allow silent deterministic finish after LLM failure.
   * Product default is false (env AGENT_ALLOW_DETERMINISTIC_FALLBACK=1 to enable).
   */
  allowDeterministicFallback?: boolean;
  /** Injection seam for tests (e.g. forced gateway failure). */
  modelLoop?: ProjectAgentModelLoop;
};

function resolveAllowDeterministicFallback(
  modelMode: "model" | "deterministic",
  explicit?: boolean,
): boolean {
  if (modelMode === "deterministic") return true;
  if (typeof explicit === "boolean") return explicit;
  return process.env.AGENT_ALLOW_DETERMINISTIC_FALLBACK === "1";
}

function mergeBudget(partial?: Partial<AgentRunBudget>): AgentRunBudget {
  return { ...BUDGET_DEFAULT, ...partial };
}

function classifyLlmError(err: unknown): NonNullable<
  Extract<AgentModelCallReceipt["fallback"], { used: true }>["errorClass"]
> {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout|abort/i.test(msg)) return "timeout";
  if (/401|403|auth/i.test(msg)) return "auth";
  if (/429|rate/i.test(msg)) return "rate_limit";
  if (/4\d\d/.test(msg)) return "provider_4xx";
  if (/5\d\d/.test(msg)) return "provider_5xx";
  if (/network|fetch|ECONN/i.test(msg)) return "network";
  if (/JSON|No valid/i.test(msg)) return "invalid_response";
  return "unknown";
}

/**
 * Model step: given tool receipts, either request more tools or finish with body.
 * Product default: LLM failure does NOT silently finish as "understood".
 */
export function createProjectAgentModelLoop(options?: {
  mode?: "model" | "deterministic";
  allowDeterministicFallback?: boolean;
}): ProjectAgentModelLoop {
  const mode = options?.mode ?? "model";
  const allowFallback = resolveAllowDeterministicFallback(
    mode,
    options?.allowDeterministicFallback,
  );
  return {
    async nextStep(input, signal) {
      if (signal.aborted) {
        throw new Error("aborted");
      }
      const receiptBase: AgentModelCallReceipt = {
        provider: "stepfun",
        model: process.env.LLM_MODEL || "step-3.7-flash",
        effort: "high",
        calls: 1,
        fallback: { used: false },
      };

      if (mode === "deterministic") {
        const body = buildDeterministicUnderstandingBody({
          projectId: input.projectId,
          matterId: input.matterId,
          events: [],
          evidenceSnippets: input.toolReceiptSummaries.map((t) => ({
            revisionId: "quote:unpinned",
            text: t.summary,
          })),
        });
        return {
          decision: {
            kind: "finish",
            proposedStop: "unknown",
            body,
          },
          receipt: receiptBase,
        };
      }

      const { formatAgentChatContextForPrompt } = await import(
        "@/shared/agent-memory/chat-context"
      );
      const chatBlock = formatAgentChatContextForPrompt(input.chat);
      const styleHint =
        input.chat?.writingStyle === "detailed"
          ? "回答偏好：detailed（可稍展开，仍须有证据）。"
          : "回答偏好：concise（短句优先）。";
      const prompt = [
        "你是「项目理解」Agent：只能使用已授权文件夹内的工具结果，禁止编造路径与原文。",
        "只输出一个 JSON 对象，且 kind 只能是 tools | finish | confirmation_required。",
        'A) {"kind":"tools","calls":[{"id":"t1","name":"project_map|read_revision|read_path|search_text|query_project_memory|git_status|git_log|set_canvas_view","input":{...}}]}',
        'B) {"kind":"finish","proposedStop":"evidence_sufficient|unknown","body":{...UnderstandingBody}}',
        'C) {"kind":"confirmation_required","reason":"expand_scope|sensitive_source|write_action","summary":"..."}',
        "UnderstandingBody 必填: now{text,evidence}, then{text,evidence}, changed[], why[{text,status,evidence}], depends[], evidenceRevisionIds[], nextDecision{text,evidence}。",
        "中文写 now/why/nextDecision。why[].status=supported 时 evidence 必须含 revisionId+relativePath+quote+lastVerifiedAt（来自 toolReceipts）。",
        "工具已读到材料时优先 finish；证据不足就 proposedStop=unknown，并诚实说明不知道什么。",
        "finish 时 now.evidence / why[].evidence 必须引用 toolReceipts 里真实读到的文件，禁止空 evidence 装懂。",
        "画布：若 Owner 在问「现在怎样/证据/阻塞/关系类型/昨天项目」，必须先 tools 调用 set_canvas_view（view=now|by_kind|decision|evidence，可选 focus/highlightNodeKeys/reason/intentId）；禁止只口述图不调工具。",
        "若有 ownerUtterance 或 recentDialogue，优先回答其中的问题，仍须用工具证据。",
        "若有 ownerStatements：那是人对项目的说法，必须进入 now/depends；与文件冲突写 conflicts，禁止当没听见。",
        styleHint,
        `projectId=${input.projectId} matterId=${input.matterId} grantId=${input.grantId}`,
        `eventIds=${JSON.stringify(input.eventIds)}`,
        `toolReceipts=${JSON.stringify(input.toolReceiptSummaries)}`,
        `budgetRemainingTurns≈${input.budget.maxModelTurns}`,
        chatBlock,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const text = await complete(
          prompt,
          "只输出一个 JSON 对象（AgentLoopDecision），不要 Markdown 围栏，不要解释。",
          { maxRetries: 2, timeout: 60_000 },
        );
        if (signal.aborted) throw new Error("aborted");
        const raw = extractJson(text) as Record<string, unknown>;
        const decision = coerceDecision(raw, input);
        return { decision, receipt: receiptBase };
      } catch (err) {
        if (!allowFallback) {
          // Propagate: runtime marks run failed — no fake "understood" candidate.
          throw err instanceof Error
            ? err
            : new Error(String(err ?? "model step failed"));
        }
        const body = buildDeterministicUnderstandingBody({
          projectId: input.projectId,
          matterId: input.matterId,
          events: [],
          evidenceSnippets: input.toolReceiptSummaries.map((t) => ({
            revisionId: "quote:unpinned",
            text: t.summary,
          })),
        });
        return {
          decision: {
            kind: "finish",
            proposedStop: "unknown",
            body: {
              ...body,
              now: {
                ...body.now,
                text: `${body.now.text}（模型步骤失败，已用工具摘要）`,
              },
            },
          },
          receipt: {
            ...receiptBase,
            fallback: {
              used: true,
              kind: "deterministic",
              errorClass: classifyLlmError(err),
            },
          },
        };
      }
    },
  };
}

function coerceDecision(
  raw: Record<string, unknown>,
  ctx: AgentLoopContext,
): AgentLoopDecision {
  const kind = raw.kind;
  if (kind === "tools" && Array.isArray(raw.calls)) {
    const calls = (raw.calls as unknown[])
      .map((c, i) => coerceToolCall(c, i))
      .filter((c): c is ProjectAgentToolCall => Boolean(c))
      .slice(0, 6);
    if (calls.length) return { kind: "tools", calls };
  }
  if (kind === "confirmation_required") {
    return {
      kind: "confirmation_required",
      reason:
        raw.reason === "sensitive_source" || raw.reason === "write_action"
          ? raw.reason
          : "expand_scope",
      summary: String(raw.summary ?? "需要你确认权限"),
    };
  }
  // finish or fallback
  const bodyRaw =
    raw.body && typeof raw.body === "object"
      ? (raw.body as Record<string, unknown>)
      : raw;
  const det = buildDeterministicUnderstandingBody({
    projectId: ctx.projectId,
    matterId: ctx.matterId,
    events: [],
    evidenceSnippets: [],
  });
  const body = coerceBodyLoose(bodyRaw, det);
  return {
    kind: "finish",
    proposedStop:
      raw.proposedStop === "evidence_sufficient"
        ? "evidence_sufficient"
        : "unknown",
    body,
  };
}

function coerceToolCall(
  raw: unknown,
  index: number,
): ProjectAgentToolCall | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "");
  const id = String(o.id ?? `m-tool-${index}`);
  const input =
    o.input && typeof o.input === "object"
      ? (o.input as Record<string, unknown>)
      : {};
  switch (name) {
    case "project_map":
      return {
        id,
        name: "project_map",
        input: {
          scope: input.scope === "matter" ? "matter" : "initial_root",
          maxDepth: typeof input.maxDepth === "number" ? input.maxDepth : 3,
        },
      };
    case "read_revision":
      if (typeof input.revisionId !== "string") return null;
      return {
        id,
        name: "read_revision",
        input: {
          revisionId: input.revisionId,
          startLine:
            typeof input.startLine === "number" ? input.startLine : undefined,
          endLine: typeof input.endLine === "number" ? input.endLine : undefined,
        },
      };
    case "read_path":
      if (typeof input.relativePath !== "string") return null;
      return {
        id,
        name: "read_path",
        input: {
          relativePath: input.relativePath,
          startLine:
            typeof input.startLine === "number" ? input.startLine : undefined,
          endLine: typeof input.endLine === "number" ? input.endLine : undefined,
        },
      };
    case "search_text":
      if (typeof input.query !== "string") return null;
      return {
        id,
        name: "search_text",
        input: {
          query: input.query,
          pathPrefix:
            typeof input.pathPrefix === "string" ? input.pathPrefix : undefined,
          limit: typeof input.limit === "number" ? input.limit : 12,
        },
      };
    case "query_project_memory":
      return {
        id,
        name: "query_project_memory",
        input: {
          include:
            input.include === "accepted" || input.include === "events"
              ? input.include
              : "both",
          limit: typeof input.limit === "number" ? input.limit : 12,
        },
      };
    case "set_canvas_view": {
      const view = String(input.view ?? "");
      if (
        view !== "now" &&
        view !== "by_kind" &&
        view !== "decision" &&
        view !== "evidence"
      ) {
        return null;
      }
      return {
        id,
        name: "set_canvas_view",
        input: {
          view,
          focus:
            input.focus && typeof input.focus === "object"
              ? (input.focus as { kind: string; id: string })
              : undefined,
          highlightNodeKeys: Array.isArray(input.highlightNodeKeys)
            ? (input.highlightNodeKeys as string[])
            : undefined,
          fold: input.fold === "path" ? "path" : "1hop",
          reason:
            typeof input.reason === "string" ? input.reason : undefined,
          intentId:
            typeof input.intentId === "string" ? input.intentId : undefined,
          menuVersion:
            typeof input.menuVersion === "string"
              ? input.menuVersion
              : undefined,
        },
      };
    }
    case "git_status":
      return { id, name: "git_status", input: {} };
    case "git_log":
      return {
        id,
        name: "git_log",
        input: {
          limit: typeof input.limit === "number" ? input.limit : 10,
          relativePath:
            typeof input.relativePath === "string"
              ? input.relativePath
              : undefined,
        },
      };
    default:
      return null;
  }
}

function coerceBodyLoose(
  raw: Record<string, unknown>,
  fallback: UnderstandingBody,
): UnderstandingBody {
  const pickText = (value: unknown, fb: string): string => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "text" in value) {
      const t = (value as { text?: unknown }).text;
      if (typeof t === "string") return t;
    }
    return fb;
  };
  const now =
    raw.now && typeof raw.now === "object"
      ? {
          ...fallback.now,
          text: pickText((raw.now as { text?: unknown }).text, fallback.now.text),
          evidence: Array.isArray((raw.now as { evidence?: unknown }).evidence)
            ? ((raw.now as { evidence: EvidenceAnchor[] }).evidence)
            : fallback.now.evidence,
        }
      : fallback.now;
  return {
    ...fallback,
    now,
    why: Array.isArray(raw.why) ? (raw.why as UnderstandingBody["why"]) : fallback.why,
    changed: Array.isArray(raw.changed)
      ? (raw.changed as UnderstandingBody["changed"])
      : fallback.changed,
    evidenceRevisionIds: Array.isArray(raw.evidenceRevisionIds)
      ? (raw.evidenceRevisionIds as string[])
      : fallback.evidenceRevisionIds,
    nextDecision: pickText(raw.nextDecision, fallback.nextDecision),
  };
}

export function createProjectAgentRuntime(
  options: CreateProjectAgentRuntimeOptions = {},
): ProjectAgentRuntime {
  const toolsEnabled = options.toolsEnabled !== false;
  const modelMode = options.modelMode ?? "model";
  const allowDeterministicFallback = resolveAllowDeterministicFallback(
    modelMode,
    options.allowDeterministicFallback,
  );
  const modelLoop =
    options.modelLoop ??
    createProjectAgentModelLoop({
      mode: modelMode,
      allowDeterministicFallback,
    });
  const legacyLoop = createAgentModelLoop({ mode: modelMode });

  return {
    async start(input) {
      const store = getSharedProjectMemoryStore();
      const service = getSharedAgentMemoryService();
      const budget = mergeBudget(input.budget);

      let state;
      try {
        state = await service.getMatterState(input.projectId, input.matterId);
      } catch {
        throw new Error("事项不存在");
      }

      const grantId =
        state.watchSet?.grantId ||
        (await service.listEvents(input.projectId))[0]?.grantId;
      if (!grantId) {
        // Fall back to legacy reconstruction (no grant yet)
        const legacy = await runStateReconstruction(service, legacyLoop, {
          projectId: input.projectId,
          matterId: input.matterId,
          eventIds: input.eventIds,
          trigger: input.trigger,
        });
        return legacy.run;
      }

      const grant = store.getGrant(input.projectId, grantId);
      if (!grant) {
        const legacy = await runStateReconstruction(service, legacyLoop, {
          projectId: input.projectId,
          matterId: input.matterId,
          eventIds: input.eventIds,
          trigger: input.trigger,
        });
        return legacy.run;
      }

      const allEvents = await service.listEvents(input.projectId);
      const grantEvents = allEvents.filter((e) => e.grantId === grantId);
      const events = filterEventsForMatter(
        allEvents,
        state,
        input.eventIds,
        undefined,
      );
      // Bootstrap tips: matter-relevant first; if empty, grant tips so tools still read.
      const tipEvents = events.length > 0 ? events : grantEvents;

      const now = new Date().toISOString();
      const reuseId = input.runId?.trim();
      let run: AnalysisRun;
      if (reuseId) {
        const existing = await store.getRun(input.projectId, reuseId);
        if (!existing) {
          throw new Error(`async run not found for reuse: ${reuseId}`);
        }
        if (existing.matterId !== input.matterId) {
          throw new Error("async run matterId mismatch");
        }
        run = {
          ...existing,
          grantId: existing.grantId ?? grantId,
          trigger: input.trigger,
          eventIds:
            existing.eventIds.length > 0
              ? existing.eventIds
              : events.map((e) => e.id),
          status: "running",
          interruptRequested: false,
          progressSummary: "开始工具环",
          updatedAt: now,
        };
        try {
          run = await store.updateRun(run);
        } catch {
          /* continue with in-memory */
        }
      } else {
        run = {
          id: randomUUID(),
          projectId: input.projectId,
          matterId: input.matterId,
          grantId,
          trigger: input.trigger,
          eventIds: events.map((e) => e.id),
          status: "running",
          attempt: 1,
          createdAt: now,
          updatedAt: now,
          progressSummary: "开始工具环",
        };
      }

      // Persist run if new; reuse path already updateRun'd
      if (!reuseId) {
        try {
          await store.createRun(run);
        } catch {
          /* createRun may already exist in older stores — ignore */
        }
      }

      // Dialogue: chat survives as session-only. Never auto-elevate to project truth (PR-06).
      let dialogueSessionId: string | undefined;
      const utteranceForDialogue = input.ownerUtterance?.trim();
      if (utteranceForDialogue) {
        try {
          const dialogue = await import("@/shared/agent-memory/dialogue-store");
          const open =
            dialogue
              .listDialogueSessions(input.projectId)
              .find((s) => s.status === "open") ??
            dialogue.openDialogueSession({
              projectId: input.projectId,
              matterId: input.matterId,
              title: "与 Agent 对话",
            });
          dialogueSessionId = open.id;
          dialogue.appendDialogueMessage({
            sessionId: open.id,
            role: "user",
            content: utteranceForDialogue,
          });
          // Intentionally NOT calling recordOwnerProjectStatement here.
          // Chat stays session-scoped until Owner explicitly confirms a candidate.
        } catch {
          /* dialogue best-effort */
        }
      }

      // Path index from full grant observation (not only matter-filtered).
      const pathByRev = new Map<string, string>();
      for (const e of grantEvents) {
        if (e.afterRevisionId) {
          pathByRev.set(
            e.afterRevisionId,
            e.relativePath.replace(/\\/g, "/"),
          );
        }
        if (e.beforeRevisionId) {
          pathByRev.set(
            e.beforeRevisionId,
            e.relativePath.replace(/\\/g, "/"),
          );
        }
      }

      const toolCtx = {
        projectId: input.projectId,
        grant,
        reader: service,
        pathByRevisionId: pathByRev,
      };

      let sequence = 0;
      let toolCalls = 0;
      let filesRead = 0;
      const startedWall = Date.now();
      const allPins: EvidenceAnchor[] = [];
      const receiptSummaries: AgentLoopContext["toolReceiptSummaries"] = [];
      const searchHitPaths: string[] = [];
      const mapPaths: string[] = [];
      const alreadyReadRevisionIds = new Set<string>();
      const alreadyReadPaths = new Set<string>();

      const appendReceipt = async (
        call: ProjectAgentToolCall,
        result: Awaited<ReturnType<typeof executeProjectAgentTool>>,
      ) => {
        sequence += 1;
        toolCalls += 1;
        if (call.name === "read_revision") {
          filesRead += 1;
          if (call.input.revisionId) {
            alreadyReadRevisionIds.add(call.input.revisionId);
          }
          for (const p of result.relativePaths ?? []) {
            alreadyReadPaths.add(p.replace(/\\/g, "/"));
          }
        }
        if (call.name === "read_path") {
          filesRead += 1;
          const p = call.input.relativePath?.replace(/\\/g, "/");
          if (p) alreadyReadPaths.add(p);
          for (const rp of result.relativePaths ?? []) {
            alreadyReadPaths.add(rp.replace(/\\/g, "/"));
          }
        }
        if (call.name === "project_map" && result.relativePaths?.length) {
          mapPaths.push(...result.relativePaths);
        }
        if (call.name === "search_text" && result.relativePaths?.length) {
          searchHitPaths.push(...result.relativePaths);
        }
        const receipt: ToolReceipt = {
          id: randomUUID(),
          runId: run.id,
          sequence,
          tool: call.name,
          projectId: input.projectId,
          grantId,
          scope: {
            mode: "initial_root",
            relativePaths: result.relativePaths,
            reason: call.name,
          },
          outcome: result.outcome,
          summary: result.summary,
          pins: result.pins,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          errorClass: result.errorClass,
        };
        allPins.push(...result.pins);
        receiptSummaries.push({
          sequence,
          tool: call.name,
          summary: `${result.summary}\n${result.detail.slice(0, 800)}`,
        });
        try {
          await store.appendToolReceipt(receipt);
        } catch {
          /* best-effort */
        }
        run = {
          ...run,
          progressSummary: result.summary,
          updatedAt: new Date().toISOString(),
        };
        try {
          await store.updateRun(run);
        } catch {
          /* */
        }
      };

      if (toolsEnabled) {
        const bootstrap = planBootstrapToolCalls({
          eventRevisionIds: tipEvents.flatMap((e) => {
            const rel = e.relativePath.replace(/\\/g, "/");
            // Skip VCS noise; agent still can search/git tools if needed.
            if (
              rel === ".git" ||
              rel.startsWith(".git/") ||
              rel.startsWith("node_modules/")
            ) {
              return [];
            }
            const out: Array<{ revisionId: string; relativePath: string }> =
              [];
            if (e.afterRevisionId) {
              out.push({
                revisionId: e.afterRevisionId,
                relativePath: e.relativePath,
              });
            }
            return out;
          }),
        });
        for (const call of bootstrap) {
          if (toolCalls >= budget.maxToolCalls) break;
          if (
            filesRead >= budget.maxFilesRead &&
            (call.name === "read_revision" || call.name === "read_path")
          ) {
            continue;
          }
          if (Date.now() - startedWall > budget.maxWallMs) break;
          const result = await executeProjectAgentTool(call, toolCtx, {
            matterId: input.matterId,
          });
          await appendReceipt(call, result);
        }

        // After map: always try high-signal path reads (README/TODO/…) even without
        // event tips — this is what makes the loop an actual Agent, not map-only.
        const forceReads = planForceReadsFromMap({
          mapRelativePaths: mapPaths,
          pathByRevisionId: pathByRev,
          alreadyReadRevisionIds,
          alreadyReadPaths,
          maxReads: Math.max(0, budget.maxFilesRead - filesRead),
        });
        for (const call of forceReads) {
          if (toolCalls >= budget.maxToolCalls) break;
          if (filesRead >= budget.maxFilesRead) break;
          if (Date.now() - startedWall > budget.maxWallMs) break;
          const result = await executeProjectAgentTool(call, toolCtx, {
            matterId: input.matterId,
          });
          await appendReceipt(call, result);
        }

        // Force map→search→read closure: read files that search hit but bootstrap skipped.
        const followReads = planReadFollowupsFromSearch({
          searchRelativePaths: searchHitPaths,
          pathByRevisionId: pathByRev,
          alreadyReadRevisionIds,
          alreadyReadPaths,
          maxReads: Math.max(0, budget.maxFilesRead - filesRead),
        });
        for (const call of followReads) {
          if (toolCalls >= budget.maxToolCalls) break;
          if (filesRead >= budget.maxFilesRead) break;
          if (Date.now() - startedWall > budget.maxWallMs) break;
          const result = await executeProjectAgentTool(call, toolCtx, {
            matterId: input.matterId,
          });
          await appendReceipt(call, result);
        }

        // Canvas-menu-v1: Owner utterance → force set_canvas_view (UI applies).
        const utterance = input.ownerUtterance?.trim();
        if (utterance && toolCalls < budget.maxToolCalls) {
          const { planSetCanvasViewFromUtterance } = await import(
            "@/shared/knowledge/set-canvas-view"
          );
          const plan = planSetCanvasViewFromUtterance(utterance, {
            projectFocus: {
              kind: "project",
              id: input.projectId,
            },
          });
          if (plan.toolCall) {
            const result = await executeProjectAgentTool(
              plan.toolCall,
              toolCtx,
              { matterId: input.matterId },
            );
            await appendReceipt(plan.toolCall, result);
          }
        }
      }

      // Model iterative steps
      let modelTurns = 0;
      let body: UnderstandingBody | null = null;
      let modelReceipt: AgentModelCallReceipt | undefined;
      const abort = new AbortController();

      while (modelTurns < budget.maxModelTurns) {
        if (Date.now() - startedWall > budget.maxWallMs) {
          run = {
            ...run,
            stopReason: "budget",
            progressSummary: "时间预算用尽",
          };
          break;
        }

        // Honor Owner interrupt mid-loop (DB flag → abort signal).
        try {
          const latest = await store.getRun(input.projectId, run.id);
          if (latest?.interruptRequested) {
            abort.abort();
            run = {
              ...run,
              status: "interrupted",
              stopReason: "owner_interrupt",
              progressSummary: "你已中断本次分析",
              modelReceipt,
              updatedAt: new Date().toISOString(),
            };
            try {
              await store.updateRun(run);
            } catch {
              /* */
            }
            return run;
          }
        } catch {
          /* best-effort */
        }

        modelTurns += 1;
        // Dual memory: load dialogue + prefs every model turn (project memory stays separate).
        let chatPack: AgentLoopContext["chat"];
        try {
          const {
            buildAgentChatContext,
            toAgentChatContextPack,
          } = await import("@/shared/agent-memory/chat-context");
          chatPack = toAgentChatContextPack(
            buildAgentChatContext(input.projectId),
            input.ownerUtterance,
          );
        } catch {
          chatPack = undefined;
        }
        const ctx: AgentLoopContext = {
          projectId: input.projectId,
          matterId: input.matterId,
          grantId,
          runId: run.id,
          eventIds: events.map((e) => e.id),
          accepted: state.accepted,
          toolReceiptSummaries: receiptSummaries.slice(-16),
          budget,
          chat: chatPack,
        };
        let step: {
          decision: AgentLoopDecision;
          receipt: AgentModelCallReceipt;
        };
        try {
          step = await modelLoop.nextStep(ctx, abort.signal);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          modelReceipt = {
            provider: "stepfun",
            model: process.env.LLM_MODEL || "step-3.7-flash",
            effort: "high",
            calls: modelTurns,
            fallback: {
              used: true,
              kind: "deterministic",
              errorClass: classifyLlmError(err),
            },
          };
          run = {
            ...run,
            status: "failed",
            stopReason: "error",
            error: msg,
            progressSummary: "模型不可用，已拒绝假装读懂",
            modelReceipt,
            candidateRevisionId: undefined,
            updatedAt: new Date().toISOString(),
          };
          try {
            run = await store.updateRun(run);
          } catch {
            /* */
          }
          return run;
        }
        modelReceipt = step.receipt;

        // Fallback finish that still marked used — refuse as product failure.
        if (
          step.receipt.fallback?.used === true &&
          !allowDeterministicFallback
        ) {
          run = {
            ...run,
            status: "failed",
            stopReason: "error",
            error: "真模型失败且未允许降级",
            progressSummary: "模型不可用，已拒绝假装读懂",
            modelReceipt: step.receipt,
            candidateRevisionId: undefined,
            updatedAt: new Date().toISOString(),
          };
          try {
            run = await store.updateRun(run);
          } catch {
            /* */
          }
          return run;
        }

        if (step.decision.kind === "tools") {
          for (const call of step.decision.calls) {
            if (toolCalls >= budget.maxToolCalls) break;
            const result = await executeProjectAgentTool(call, toolCtx, {
              matterId: input.matterId,
            });
            await appendReceipt(call, result);
            // Re-check interrupt between tools
            try {
              const mid = await store.getRun(input.projectId, run.id);
              if (mid?.interruptRequested) {
                abort.abort();
                run = {
                  ...run,
                  status: "interrupted",
                  stopReason: "owner_interrupt",
                  progressSummary: "你已中断本次分析",
                  modelReceipt,
                  updatedAt: new Date().toISOString(),
                };
                try {
                  await store.updateRun(run);
                } catch {
                  /* */
                }
                return run;
              }
            } catch {
              /* */
            }
          }
          continue;
        }
        if (step.decision.kind === "confirmation_required") {
          run = {
            ...run,
            status: "confirmation_required",
            stopReason:
              step.decision.reason === "expand_scope"
                ? "confirm_expand"
                : step.decision.reason === "sensitive_source"
                  ? "confirm_sensitive"
                  : "confirm_write",
            progressSummary: step.decision.summary,
            modelReceipt,
            updatedAt: new Date().toISOString(),
          };
          try {
            await store.updateRun(run);
          } catch {
            /* */
          }
          return run;
        }
        // finish
        body = step.decision.body;
        run = {
          ...run,
          stopReason: step.decision.proposedStop,
          modelReceipt,
        };
        break;
      }

      // Enrich recon input with tool quotes for sanitize
      const evidenceSnippets = allPins
        .filter((p) => p.quote?.trim())
        .map((p) => ({ revisionId: p.revisionId, text: p.quote }));
      for (const s of receiptSummaries.slice(0, 8)) {
        evidenceSnippets.push({
          revisionId: "quote:unpinned",
          text: s.summary.slice(0, 200),
        });
      }

      const reconInput: MatterStateReconstructionInput = {
        projectId: input.projectId,
        matterId: input.matterId,
        events,
        accepted: state.accepted,
        evidenceSnippets,
      };

      // Last interrupt check before writing a candidate (finish window).
      try {
        const beforeSave = await store.getRun(input.projectId, run.id);
        if (beforeSave?.interruptRequested) {
          run = {
            ...run,
            status: "interrupted",
            stopReason: "owner_interrupt",
            progressSummary: "你已中断本次分析",
            modelReceipt,
            updatedAt: new Date().toISOString(),
          };
          try {
            run = await store.updateRun(run);
          } catch {
            /* */
          }
          return run;
        }
      } catch {
        /* best-effort */
      }

      if (!body) {
        if (modelMode === "model" && !allowDeterministicFallback) {
          // Do not invent a candidate via legacy silent path.
          run = {
            ...run,
            status: "failed",
            stopReason: "error",
            error: "模型未给出可验收结论",
            progressSummary: "模型不可用，已拒绝假装读懂",
            modelReceipt,
            candidateRevisionId: undefined,
            updatedAt: new Date().toISOString(),
          };
          try {
            run = await store.updateRun(run);
          } catch {
            /* */
          }
          return run;
        }
        // Final propose via legacy loop using tool-enriched input
        body = await legacyLoop.propose(reconInput);
      }
      let finalBody: UnderstandingBody = sanitizeModelBody(body, reconInput);

      const elevateOwnerStatements = async (bodyIn: UnderstandingBody) => {
        try {
          const {
            listOwnerProjectStatements,
            mergeOwnerStatementsIntoUnderstandingBody,
          } = await import("@/shared/agent-memory/owner-statements");
          return mergeOwnerStatementsIntoUnderstandingBody(
            bodyIn,
            listOwnerProjectStatements(input.projectId, { limit: 24 }),
          ) as UnderstandingBody;
        } catch {
          return bodyIn;
        }
      };
      finalBody = await elevateOwnerStatements(finalBody);

      // Merge tool pins into understanding when model ignored tool evidence.
      if (allPins.length > 0) {
        const pin = allPins.find(isUsableEvidenceAnchor) ?? allPins[0];
        const emptyNow =
          !finalBody.now?.text?.trim() ||
          (/没有可核对的文件变化|no file changes/i.test(finalBody.now.text) &&
            !/你对这个项目说过/.test(finalBody.now.text));
        const weakWhy = finalBody.why.every(
          (w) => w.status === "unknown" || !w.evidence?.length,
        );
        if (emptyNow || weakWhy) {
          const pathHint = pin.relativePath?.replace(/\\/g, "/") || "原文";
          const quote = pin.quote.trim().slice(0, 200);
          const baseNow = finalBody.now;
          finalBody = {
            ...finalBody,
            now: emptyNow
              ? {
                  text:
                    quote ||
                    `已从授权夹读到 ${pathHint} 等材料，整理如下。`,
                  evidence: isUsableEvidenceAnchor(pin)
                    ? [pin]
                    : baseNow?.evidence ?? [],
                  gaps: baseNow?.gaps ?? [],
                  conflicts: baseNow?.conflicts ?? [],
                }
              : {
                  ...baseNow,
                  evidence:
                    baseNow.evidence?.length > 0
                      ? baseNow.evidence
                      : isUsableEvidenceAnchor(pin)
                        ? [pin]
                        : baseNow.evidence,
                },
            why: weakWhy
              ? [
                  {
                    text: quote || finalBody.why[0]?.text || "见原文摘录",
                    status: isUsableEvidenceAnchor(pin)
                      ? ("supported" as const)
                      : ("unknown" as const),
                    evidence: isUsableEvidenceAnchor(pin) ? [pin] : [],
                  },
                  ...finalBody.why.filter((w) => w.text !== pin.quote),
                ]
              : finalBody.why,
            evidenceRevisionIds: [
              ...new Set([
                ...finalBody.evidenceRevisionIds,
                ...allPins.map((p) => p.revisionId),
              ]),
            ],
          };
        } else {
          finalBody = {
            ...finalBody,
            evidenceRevisionIds: [
              ...new Set([
                ...finalBody.evidenceRevisionIds,
                ...allPins.map((p) => p.revisionId),
              ]),
            ],
          };
        }
      }

      // Hard product gate: usable in-grant file evidence required.
      finalBody = enforceSourceBackedBody(finalBody, allPins);
      // PR-12: structured Claim demotion — supports only with verified revision text.
      try {
        const { buildClaimBundleFromWhy } = await import(
          "@/shared/project-memory/claims/claim-service"
        );
        const revisionTexts: Record<string, string> = {};
        for (const pin of allPins) {
          if (!pin.revisionId || pin.revisionId.startsWith("path:")) continue;
          if (revisionTexts[pin.revisionId]) continue;
          try {
            const bytes = await store.readRevision(pin.revisionId);
            if (bytes) {
              revisionTexts[pin.revisionId] = new TextDecoder("utf-8", {
                fatal: false,
              }).decode(bytes);
            }
          } catch {
            /* missing revision → claim-service refuses supports */
          }
        }
        const bundle = buildClaimBundleFromWhy(finalBody, allPins, {
          projectId: input.projectId,
          matterId: input.matterId,
          runId: run.id,
          revisionTexts,
        });
        if (bundle.claims.length > 0 && finalBody.why?.length) {
          finalBody = {
            ...finalBody,
            why: finalBody.why.map((w, i) => {
              const c = bundle.claims[i];
              if (!c) return w;
              const status =
                c.status === "supported"
                  ? ("supported" as const)
                  : c.status === "conflicted"
                    ? ("conflicted" as const)
                    : c.status === "unknown"
                      ? ("unknown" as const)
                      : ("unknown" as const);
              // unsupported / partially / owner_stated → not "supported"
              if (
                c.status === "unsupported" ||
                c.status === "partially_supported"
              ) {
                return { ...w, status: "unknown" as const, evidence: w.evidence ?? [] };
              }
              return { ...w, status };
            }),
          };
        }
      } catch {
        /* claim service optional if types drift */
      }
      // Re-apply after evidence gate so pin/unknown paths do not erase Owner speech.
      finalBody = await elevateOwnerStatements(finalBody);
      const usablePins = allPins.filter(isUsableEvidenceAnchor);
      if (usablePins.length === 0) {
        run = {
          ...run,
          status: "failed",
          stopReason: "error",
          error: "未能在授权夹内读到可引用原文",
          progressSummary: "没有可引用原文，拒绝假装读懂",
          modelReceipt,
          candidateRevisionId: undefined,
          updatedAt: new Date().toISOString(),
        };
        try {
          run = await store.updateRun(run);
        } catch {
          /* */
        }
        return run;
      }

      const candidate = await service.saveCandidate(run, finalBody);

      // Knowledge workbench footprint: timeline + work item + re-seed drafts.
      try {
        const { writeAgentRunToKnowledge } = await import(
          "@/shared/knowledge/agent-run-writeback"
        );
        writeAgentRunToKnowledge({
          projectId: input.projectId,
          runId: run.id,
          nowText: finalBody.now?.text,
          nextDecisionText:
            typeof finalBody.nextDecision === "string"
              ? finalBody.nextDecision
              : "",
          toolSummaries: receiptSummaries.slice(0, 8).map((r) => r.summary),
          filesRead,
          toolCalls,
        });
      } catch {
        /* knowledge writeback best-effort */
      }

      // Dialogue memory: agent milestone turn + feed writeback (dual memory close loop).
      try {
        const dialogue = await import("@/shared/agent-memory/dialogue-store");
        const { writeDialogueMilestoneToKnowledge } = await import(
          "@/shared/agent-memory/dialogue-writeback"
        );
        let sessionId = dialogueSessionId;
        if (!sessionId) {
          const open =
            dialogue
              .listDialogueSessions(input.projectId)
              .find((s) => s.status === "open") ??
            dialogue.openDialogueSession({
              projectId: input.projectId,
              matterId: input.matterId,
              title: "与 Agent 对话",
            });
          sessionId = open.id;
        }
        const nextDecisionText =
          typeof finalBody.nextDecision === "string"
            ? finalBody.nextDecision
            : "";
        const agentText = [
          finalBody.now?.text?.trim() || "已整理一段项目理解，请确认。",
          nextDecisionText ? `下一步：${nextDecisionText}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        const agentMsg = dialogue.appendDialogueMessage({
          sessionId,
          role: "agent",
          content: agentText.slice(0, 1200),
          analysisRunId: run.id,
          milestone: true,
        });
        writeDialogueMilestoneToKnowledge(agentMsg);
      } catch {
        /* dialogue best-effort */
      }

      const modelNote =
        modelReceipt?.fallback?.used === true
          ? " · 模型失败已降级"
          : modelMode === "deterministic"
            ? " · 确定性"
            : " · 真模型";
      run = {
        ...run,
        status: "awaiting_owner",
        candidateRevisionId: candidate.id,
        modelReceipt,
        progressSummary: `候选已生成（工具 ${toolCalls} 次 · 模型 ${modelTurns} 轮${modelNote}）`,
        updatedAt: new Date().toISOString(),
      };
      try {
        // Prefer store return so interrupt preservation is reflected to caller.
        run = await store.updateRun(run);
      } catch {
        /* */
      }
      return run;
    },

    async get(projectId, runId) {
      const store = getSharedProjectMemoryStore();
      try {
        return await store.getRunView(projectId, runId);
      } catch {
        return null;
      }
    },

    async interrupt(projectId, runId) {
      const store = getSharedProjectMemoryStore();
      return store.requestInterrupt(projectId, runId);
    },
  };
}

/**
 * Prefer tool-augmented runtime; returns same shape as runStateReconstruction
 * plus durable tool receipts for Owner-visible process UI.
 */
export async function runToolAugmentedAnalysis(
  input: RunAnalysisInput,
  options?: CreateProjectAgentRuntimeOptions,
): Promise<{
  run: AnalysisRun;
  candidate: import("./types").UnderstandingRevision | null;
  toolReceipts: ToolReceipt[];
}> {
  const runtime = createProjectAgentRuntime(options);
  const service = getSharedAgentMemoryService();
  const store = getSharedProjectMemoryStore();
  const ownerUtterance =
    input.ownerUtterance?.trim() ||
    (input.whySourceQuotes?.length
      ? input.whySourceQuotes.join("\n")
      : undefined);
  const run = await runtime.start({
    projectId: input.projectId,
    matterId: input.matterId,
    trigger: input.trigger ?? "source_change",
    eventIds: input.eventIds,
    ownerUtterance,
    runId: input.runId,
  });

  let toolReceipts: ToolReceipt[] = [];
  try {
    const view = await runtime.get(input.projectId, run.id);
    if (view?.toolReceipts?.length) {
      toolReceipts = view.toolReceipts;
    } else {
      toolReceipts = await store.listToolReceipts(run.id);
    }
  } catch {
    /* best-effort */
  }

  // Terminal statuses first: never overwrite with legacy or stale candidates.
  const noLegacyStatuses = new Set([
    "confirmation_required",
    "interrupted",
    "failed",
  ]);
  if (noLegacyStatuses.has(run.status)) {
    return { run, candidate: null, toolReceipts };
  }

  // Load candidate from matter state if saveCandidate ran for THIS run.
  const state = await service.getMatterState(input.projectId, input.matterId);
  if (state.candidate) {
    const matchesRun =
      !run.candidateRevisionId ||
      state.candidate.id === run.candidateRevisionId;
    if (matchesRun || run.status === "awaiting_owner") {
      return { run, candidate: state.candidate, toolReceipts };
    }
  }

  // Only fall back to legacy when tools ran but no candidate was saved
  // (e.g. empty grant path edge cases) — still surface tool receipts.
  if (toolReceipts.length === 0) {
    const legacy = await runStateReconstruction(
      service,
      createAgentModelLoop({ mode: options?.modelMode ?? "model" }),
      input,
    );
    return { ...legacy, toolReceipts };
  }

  return { run, candidate: null, toolReceipts };
}
