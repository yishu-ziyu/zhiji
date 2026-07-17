/**
 * Format UnderstandingBody → Agent chat dialogue text.
 * Must match parseAgentMessage sections in the right-rail UI:
 * lead + 当前判断 / 依据 / 你现在只要决定 + candidate footer.
 */
import type { EvidenceAnchor, UnderstandingBody } from "./types";

export type FormatAgentDialogueReplyOptions = {
  /** Owner question that triggered this turn (optional lead framing). */
  ownerUtterance?: string;
  /** Max evidence chips. */
  maxEvidence?: number;
  /** Max total characters. */
  maxChars?: number;
};

function shortRev(revisionId: string | undefined): string | undefined {
  if (!revisionId?.trim()) return undefined;
  const id = revisionId.trim();
  if (/^r\d+$/i.test(id)) return id.toLowerCase();
  // orev:<hex> → r + first 6 hex
  const m = id.match(/^orev:([a-f0-9]+)/i);
  if (m) return `r${m[1].slice(0, 6)}`;
  // bare hex-ish
  if (/^[a-f0-9]{6,}$/i.test(id)) return `r${id.slice(0, 6)}`;
  return `r${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "0"}`;
}

function collectEvidence(body: UnderstandingBody): EvidenceAnchor[] {
  const out: EvidenceAnchor[] = [];
  const seen = new Set<string>();
  const push = (list: EvidenceAnchor[] | undefined) => {
    for (const a of list ?? []) {
      const path = (a.relativePath ?? "").replace(/\\/g, "/").trim();
      if (!path) continue;
      const key = `${path}::${a.revisionId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
  };
  push(body.now?.evidence);
  for (const w of body.why ?? []) push(w.evidence);
  for (const c of body.changed ?? []) push(c.evidence);
  return out;
}

function oneLine(text: string, max = 280): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Build the default agent chat message body for dialogue memory.
 */
export function formatAgentDialogueReply(
  body: UnderstandingBody,
  options: FormatAgentDialogueReplyOptions = {},
): string {
  const maxEvidence = options.maxEvidence ?? 4;
  const maxChars = options.maxChars ?? 1600;

  const nowText = oneLine(body.now?.text ?? "", 320);
  const lead =
    nowText ||
    (options.ownerUtterance?.trim()
      ? "已根据授权夹材料整理回答，请核对依据。"
      : "已整理一段项目理解，请确认。");

  // Prefer a supported why as "当前判断"; fall back to now.
  const supportedWhy = (body.why ?? []).find(
    (w) => w.status === "supported" && w.text?.trim(),
  );
  const judgment = oneLine(
    supportedWhy?.text?.trim() || nowText || "尚不能从材料中形成有证据的判断。",
    360,
  );

  const evidenceLines = collectEvidence(body)
    .slice(0, maxEvidence)
    .map((a) => {
      const path = a.relativePath.replace(/\\/g, "/");
      const rev = shortRev(a.revisionId);
      return rev ? `${path} @ ${rev}` : path;
    });

  // Gaps as soft evidence note when no pins
  if (evidenceLines.length === 0) {
    const gap = body.now?.gaps?.[0]?.trim();
    if (gap) evidenceLines.push(`（限制）${oneLine(gap, 120)}`);
  }

  const decisionRaw =
    typeof body.nextDecision === "string" ? body.nextDecision.trim() : "";
  const decision =
    oneLine(decisionRaw, 280) ||
    "还需要补充哪份材料，才能把下一步决定做掉？";

  const unknowns = [
    ...(body.now?.gaps ?? []),
    ...(body.why ?? [])
      .filter((w) => w.status === "unknown")
      .map((w) => w.text)
      .filter(Boolean),
  ]
    .map((t) => oneLine(t, 100))
    .filter(Boolean)
    .slice(0, 2);

  const parts: string[] = [
    lead,
    "",
    "当前判断",
    judgment,
    "",
    "依据",
  ];
  if (evidenceLines.length > 0) {
    parts.push(...evidenceLines);
  } else {
    parts.push("（本轮未钉上可引用文件 · 请扩大授权或补充材料）");
  }
  if (unknowns.length > 0) {
    parts.push(`未知/限制：${unknowns.join("；")}`);
  }
  parts.push("", "你现在只要决定", decision, "", "候选判断 · 未自动写入项目事实");

  return parts.join("\n").slice(0, maxChars);
}
