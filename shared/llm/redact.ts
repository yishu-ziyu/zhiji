/**
 * Exact secret redaction for LLM paths.
 * Prefer exact Key replacement over pattern-only matching.
 */

export type RedactContext = {
  /** Active API key(s) to scrub exactly. */
  secrets?: string[];
};

const PATTERN_FALLBACKS = [
  /Bearer\s+\S+/gi,
  /(x-api-key|api[_-]?key|authorization)\s*[:=]\s*["']?[^\s"',}]+/gi,
  /sk-[a-zA-Z0-9_-]{8,}/g,
];

/**
 * Redact known secrets exactly first, then fall back to common patterns.
 */
export function redactSecrets(
  text: string,
  ctx: RedactContext = {},
): string {
  let out = String(text ?? "");
  const secrets = (ctx.secrets || [])
    .map((s) => String(s || "").trim())
    .filter((s) => s.length >= 4);

  // Longest first to avoid partial overlaps.
  secrets.sort((a, b) => b.length - a.length);
  for (const secret of secrets) {
    if (!secret) continue;
    // Split into chunks for exact global replace without regex meta issues.
    out = out.split(secret).join("[redacted]");
  }

  for (const re of PATTERN_FALLBACKS) {
    out = out.replace(re, (m) => {
      if (/Bearer/i.test(m)) return "Bearer [redacted]";
      if (/x-api-key|api[_-]?key|authorization/i.test(m)) {
        return m.replace(/[:=]\s*["']?[^\s"',}]+/i, "=[redacted]");
      }
      return "sk-[redacted]";
    });
  }
  return out;
}

/** Safe error message for UI / receipts / logs. */
export function safeErrorMessage(
  err: unknown,
  ctx: RedactContext = {},
): string {
  const msg = err instanceof Error ? err.message : String(err);
  return redactSecrets(msg, ctx);
}
