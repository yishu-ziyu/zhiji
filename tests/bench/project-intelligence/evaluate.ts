/**
 * Pure evaluators for Project Intelligence Bench (no network).
 */
import { parseAgentMessage } from "@/app/track/knowledge/lib/agent-chat-format";
import { formatAgentDialogueReply } from "@/shared/project-memory/agent-dialogue-reply";
import { extractOwnerSearchQueries } from "@/shared/project-memory/agent-tools";
import type { UnderstandingBody } from "@/shared/project-memory/types";
import type {
  BenchCheck,
  BenchCheckResult,
  BenchReport,
  BenchScenario,
  BenchScenarioResult,
} from "./schema";

function asBody(raw: Record<string, unknown> | undefined): UnderstandingBody | null {
  if (!raw || typeof raw !== "object") return null;
  const now = raw.now as UnderstandingBody["now"] | undefined;
  if (!now || typeof now.text !== "string") return null;
  return {
    now: {
      text: now.text,
      evidence: Array.isArray(now.evidence) ? now.evidence : [],
      gaps: Array.isArray(now.gaps) ? now.gaps : [],
      conflicts: Array.isArray(now.conflicts) ? now.conflicts : [],
    },
    then: {
      text:
        typeof (raw.then as { text?: string } | undefined)?.text === "string"
          ? (raw.then as { text: string }).text
          : "先前无确认理解",
      at:
        typeof (raw.then as { at?: string } | undefined)?.at === "string"
          ? (raw.then as { at: string }).at
          : "unknown",
      evidence: [],
      gaps: [],
      conflicts: [],
    },
    changed: Array.isArray(raw.changed)
      ? (raw.changed as UnderstandingBody["changed"])
      : [],
    why: Array.isArray(raw.why) ? (raw.why as UnderstandingBody["why"]) : [],
    depends: Array.isArray(raw.depends)
      ? (raw.depends as UnderstandingBody["depends"])
      : [],
    evidenceRevisionIds: Array.isArray(raw.evidenceRevisionIds)
      ? (raw.evidenceRevisionIds as string[])
      : [],
    nextDecision:
      typeof raw.nextDecision === "string" ? raw.nextDecision : "",
  };
}

function resolveDialogue(scenario: BenchScenario): string {
  if (scenario.agentDialogue?.trim()) return scenario.agentDialogue.trim();
  const body = asBody(scenario.body);
  if (!body) return "";
  return formatAgentDialogueReply(body, {
    ownerUtterance: scenario.ownerUtterance,
  });
}

export function evaluateCheck(
  scenario: BenchScenario,
  check: BenchCheck,
): BenchCheckResult {
  const kind = check.kind;
  try {
    switch (kind) {
      case "search_queries_contain": {
        const qs = extractOwnerSearchQueries(scenario.ownerUtterance);
        const needle = (check.value ?? "").toLowerCase();
        const pass = qs.some((q) => q.toLowerCase().includes(needle));
        return {
          kind,
          pass,
          detail: pass
            ? `queries include ~${check.value}: ${JSON.stringify(qs)}`
            : `missing ~${check.value} in ${JSON.stringify(qs)}`,
        };
      }
      case "search_queries_exclude": {
        const qs = extractOwnerSearchQueries(scenario.ownerUtterance);
        const needle = (check.value ?? "").toLowerCase();
        const hit = qs.some((q) => q.toLowerCase() === needle);
        return {
          kind,
          pass: !hit,
          detail: hit
            ? `unexpected exact query ${check.value}`
            : `ok exclude ${check.value}`,
        };
      }
      case "dialogue_structured": {
        const text = resolveDialogue(scenario);
        const parsed = parseAgentMessage(text);
        return {
          kind,
          pass: parsed.kind === "structured",
          detail: `kind=${parsed.kind}`,
        };
      }
      case "dialogue_has_section": {
        const text = resolveDialogue(scenario);
        const section = check.value ?? "";
        const pass = text.includes(section);
        return {
          kind,
          pass,
          detail: pass ? `has ${section}` : `missing ${section}`,
        };
      }
      case "dialogue_evidence_path": {
        const text = resolveDialogue(scenario);
        const path = check.value ?? "";
        const pass = Boolean(path) && text.includes(path);
        return {
          kind,
          pass,
          detail: pass ? `evidence mentions ${path}` : `no path ${path}`,
        };
      }
      case "dialogue_candidate_footer": {
        const text = resolveDialogue(scenario);
        const pass = /候选判断|未自动写入/.test(text);
        return {
          kind,
          pass,
          detail: pass ? "footer present" : "footer missing",
        };
      }
      case "dialogue_no_fake_path": {
        const text = resolveDialogue(scenario);
        const fake = check.value ?? "/etc/passwd";
        const pass = !text.includes(fake);
        return {
          kind,
          pass,
          detail: pass ? `no fake ${fake}` : `leaked fake path ${fake}`,
        };
      }
      case "body_has_now": {
        const body = asBody(scenario.body);
        const pass = Boolean(body?.now?.text?.trim());
        return {
          kind,
          pass,
          detail: pass ? "now.text ok" : "now.text empty",
        };
      }
      case "body_next_decision_single": {
        const body = asBody(scenario.body);
        const d = body?.nextDecision?.trim() ?? "";
        const multi = (d.match(/[？?]/g) ?? []).length > 1;
        const pass = d.length > 0 && !multi;
        return {
          kind,
          pass,
          detail: pass
            ? "single decision question"
            : `bad nextDecision: ${JSON.stringify(d.slice(0, 80))}`,
        };
      }
      case "body_why_max": {
        const body = asBody(scenario.body);
        const max = check.max ?? 3;
        const n = body?.why?.length ?? 0;
        const pass = n <= max;
        return {
          kind,
          pass,
          detail: `why.length=${n} max=${max}`,
        };
      }
      case "format_roundtrip_structured": {
        const body = asBody(scenario.body);
        if (!body) {
          return { kind, pass: false, detail: "no body" };
        }
        const text = formatAgentDialogueReply(body, {
          ownerUtterance: scenario.ownerUtterance,
        });
        const parsed = parseAgentMessage(text);
        return {
          kind,
          pass: parsed.kind === "structured" && Boolean(parsed.judgment),
          detail: `kind=${parsed.kind} judgment=${Boolean(parsed.judgment)}`,
        };
      }
      default: {
        const _exhaustive: never = kind;
        return {
          kind: _exhaustive,
          pass: false,
          detail: "unknown check",
        };
      }
    }
  } catch (err) {
    return {
      kind,
      pass: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function evaluateScenario(scenario: BenchScenario): BenchScenarioResult {
  const checks = scenario.checks.map((c) => evaluateCheck(scenario, c));
  return {
    id: scenario.id,
    family: scenario.family,
    difficulty: scenario.difficulty,
    title: scenario.title,
    pass: checks.every((c) => c.pass),
    checks,
  };
}

export function runBench(
  scenarios: BenchScenario[],
  meta?: { name?: string; version?: string },
): BenchReport {
  const results = scenarios.map(evaluateScenario);
  const byFamily: BenchReport["byFamily"] = {};
  for (const r of results) {
    const slot = byFamily[r.family] ?? { total: 0, passed: 0 };
    slot.total += 1;
    if (r.pass) slot.passed += 1;
    byFamily[r.family] = slot;
  }
  const passed = results.filter((r) => r.pass).length;
  return {
    name: meta?.name ?? "project-intelligence-bench",
    version: meta?.version ?? "0.1.0",
    ranAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    byFamily,
    results,
  };
}
