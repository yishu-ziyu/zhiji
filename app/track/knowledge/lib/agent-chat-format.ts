/**
 * Presentational parse for Agent chat turns.
 * Best-effort: structured sections when the model (or product) uses
 * 当前判断 / 依据 / 你现在只要决定 markers; otherwise plain body.
 */

export type AgentEvidenceChip = {
  raw: string;
  path: string;
  rev?: string;
};

export type ParsedAgentMessage = {
  kind: "structured" | "plain";
  /** Opening prose above sections (structured) or full body (plain). */
  lead: string;
  judgment?: string;
  evidence?: AgentEvidenceChip[];
  decision?: string;
  /** Footer hint when content mentions candidate / not written as fact. */
  showCandidateFooter: boolean;
};

const SECTION_KEYS = [
  "当前判断",
  "依据",
  "你现在只要决定",
  "你现在只需决定",
] as const;

const EVIDENCE_LINE =
  /^(?:[-*•]\s*)?(?:📄\s*|📎\s*)?[`'"]?([^\s`'"]+?\.[a-zA-Z0-9]+)[`'"]?(?:\s*@\s*(r?\d+))?/i;

/**
 * Parse one agent message body into optional structured UI blocks.
 */
export function parseAgentMessage(content: string): ParsedAgentMessage {
  const text = (content ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { kind: "plain", lead: "", showCandidateFooter: false };
  }

  const showCandidateFooter =
    /候选判断|未自动写入|不会?自动写成?项目事实|未写入项目事实/.test(text);

  const hasSection = SECTION_KEYS.some((k) => text.includes(k));
  if (!hasSection) {
    return { kind: "plain", lead: text, showCandidateFooter };
  }

  // Split on section headers (line-start or after blank line).
  const headerRe =
    /(?:^|\n)[ \t]*(当前判断|依据|你现在只要决定|你现在只需决定)[ \t]*[:：]?[ \t]*(?=\n|$)/g;
  const parts: Array<{ key: string; start: number; headerEnd: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    parts.push({
      key: m[1],
      start: m.index + (m[0].startsWith("\n") ? 1 : 0),
      headerEnd: m.index + m[0].length,
    });
  }

  if (parts.length === 0) {
    return { kind: "plain", lead: text, showCandidateFooter };
  }

  const lead = text.slice(0, parts[0].start).trim();
  let judgment: string | undefined;
  let decision: string | undefined;
  let evidence: AgentEvidenceChip[] | undefined;

  for (let i = 0; i < parts.length; i++) {
    const bodyStart = parts[i].headerEnd;
    const bodyEnd = i + 1 < parts.length ? parts[i + 1].start : text.length;
    const body = text.slice(bodyStart, bodyEnd).trim();
    const key = parts[i].key;
    if (key === "当前判断") {
      judgment = body || undefined;
    } else if (key === "依据") {
      evidence = parseEvidenceBody(body);
    } else if (key === "你现在只要决定" || key === "你现在只需决定") {
      decision = body || undefined;
    }
  }

  // If we only found headers with empty bodies, fall back to plain.
  if (!judgment && !decision && (!evidence || evidence.length === 0)) {
    return { kind: "plain", lead: text, showCandidateFooter };
  }

  return {
    kind: "structured",
    lead,
    judgment,
    evidence,
    decision,
    showCandidateFooter,
  };
}

function parseEvidenceBody(body: string): AgentEvidenceChip[] {
  if (!body) return [];
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const chips: AgentEvidenceChip[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[\[\(]|[\]\)]$/g, "").trim();
    const em = cleaned.match(EVIDENCE_LINE);
    if (em) {
      chips.push({
        raw: cleaned,
        path: em[1],
        rev: em[2] ? (em[2].startsWith("r") ? em[2] : `r${em[2]}`) : undefined,
      });
      continue;
    }
    // Bare path@rev without extension (e.g. "会议纪要/07-16.md @ r3" already covered)
    const loose = cleaned.match(
      /^([^\s@]+)\s*@\s*(r?\d+)\s*$/i,
    );
    if (loose) {
      chips.push({
        raw: cleaned,
        path: loose[1],
        rev: loose[2].startsWith("r") ? loose[2] : `r${loose[2]}`,
      });
      continue;
    }
    chips.push({ raw: cleaned, path: cleaned });
  }
  return chips;
}

export const AGENT_CHAT_QUICK_PROMPTS: ReadonlyArray<{
  id: string;
  label: string;
  text: string;
}> = [
  { id: "decisions", label: "只看决策", text: "只看决策" },
  { id: "conflicts", label: "冲突在哪", text: "冲突在哪" },
  { id: "reentry", label: "重进后变化", text: "重进后变化" },
];
