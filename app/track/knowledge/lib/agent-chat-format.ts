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
      // Strip footer line if model stuffed it into the decision body.
      decision = stripCandidateFooterLine(body) || undefined;
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

const CANDIDATE_FOOTER_RE =
  /候选判断\s*[·•．.]\s*未自动写入项目事实/;

function stripCandidateFooterLine(body: string): string {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !CANDIDATE_FOOTER_RE.test(l))
    .join("\n")
    .trim();
}

/** Prefer human-readable evidence; demote tooling/test path noise in the rail. */
function isWeakEvidencePath(pathStr: string): boolean {
  const p = pathStr.toLowerCase();
  return (
    /\.(test|spec)\.[a-z0-9]+$/.test(p) ||
    p.includes("node_modules/") ||
    p.includes("__pycache__") ||
    p.includes("/.git/") ||
    p.startsWith("未知/") ||
    p.includes("未知/限制")
  );
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
    if (CANDIDATE_FOOTER_RE.test(cleaned)) continue;
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
  // Strong paths first; keep weak ones only if nothing else (honesty).
  const strong = chips.filter((c) => !isWeakEvidencePath(c.path));
  return strong.length > 0 ? strong : chips.slice(0, 3);
}

/** Short label for chip face; full path stays on title. */
export function evidenceChipLabel(pathStr: string): string {
  const base = pathStr.split(/[/\\]/).filter(Boolean).pop() ?? pathStr;
  return base.length > 28 ? `${base.slice(0, 26)}…` : base;
}

export const CANVAS_VIEW_LABELS: Record<string, string> = {
  now: "现在怎样",
  by_kind: "关系类型",
  decision: "决策通路",
  evidence: "证据链",
};

/**
 * Quick actions that also drive the center canvas (NL → set_canvas_view).
 * Labels are short; text is the exact utterance sent to Agent.
 */
export const AGENT_CHAT_QUICK_PROMPTS: ReadonlyArray<{
  id: string;
  label: string;
  text: string;
  /** Optional hint shown under the chip row */
  canvasHint?: string;
}> = [
  {
    id: "now",
    label: "现在怎样",
    text: "项目现在怎样",
    canvasHint: "画布 → 现在怎样",
  },
  {
    id: "logic",
    label: "业务逻辑",
    text: "展示业务逻辑",
    canvasHint: "读材料 → 串联 → 画布呈现",
  },
  {
    id: "why-direction",
    label: "为何改方向",
    text: "我们为什么改了方向",
    canvasHint: "发散候选判断 · 画布钉依据",
  },
  {
    id: "decisions",
    label: "只看决策",
    text: "只看决策",
    canvasHint: "画布 → 决策通路",
  },
  {
    id: "evidence",
    label: "证据链",
    text: "结论的依据是什么",
    canvasHint: "画布 → 证据链",
  },
  {
    id: "kinds",
    label: "关系类型",
    text: "按关系类型看画布",
    canvasHint: "画布 → 关系类型",
  },
  {
    id: "blocked",
    label: "阻塞在哪",
    text: "卡点在哪",
    canvasHint: "画布 → 决策通路",
  },
];
