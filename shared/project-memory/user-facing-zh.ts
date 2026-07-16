/**
 * User-facing language helpers: keep product UI in Simplified Chinese.
 * Source quotes/paths may stay in original language.
 */

const EMPTY_EVENT_EN_RE =
  /no events|no current state|no prior state|cannot determine next action|no events have been recorded|no events have been provided|absence of any recorded events|recommend waiting for initial event|no events exist to define|establish the current state/i;

/** True when text is substantial Latin and has no Chinese characters. */
export function looksLikeEnglishOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  return /[A-Za-z]{3,}/.test(t);
}

export function countPdfPaths(paths: string[]): number {
  return paths.filter((p) => /\.pdf$/i.test(p.replace(/\\/g, "/"))).length;
}

function pdfProgressMessage(pdfCount: number): string {
  if (pdfCount <= 0) {
    return "我还没有读到足够可核对的文字内容，暂时无法判断这个项目现在怎样。";
  }
  return `已在授权文件夹里发现 ${pdfCount} 个 PDF。目前还不能从 PDF 抽出可核对的正文，所以暂时无法形成可靠理解；文件名已记录，后续会支持读取 PDF 正文。`;
}

/**
 * Map model/system filler (often English) to short Simplified Chinese for display.
 */
export function humanizeUserFacingText(
  text: string,
  options?: { pdfCount?: number },
): string {
  const t = text.trim();
  const pdfCount = options?.pdfCount ?? 0;
  if (!t) {
    return pdfCount > 0
      ? pdfProgressMessage(pdfCount)
      : "目前还没有可核对的文件变化。";
  }
  const lower = t.toLowerCase();
  if (
    lower.includes("no current state") ||
    lower.includes("no events have been recorded") ||
    lower.includes("no events have been provided") ||
    lower.includes("establish the current state")
  ) {
    return pdfCount > 0
      ? pdfProgressMessage(pdfCount)
      : "目前还没有可核对的文件变化。";
  }
  if (
    lower.includes("no prior state") ||
    lower.includes("no events exist to define")
  ) {
    return "还没有已确认的先前理解。";
  }
  if (
    lower.includes("cannot determine next action") ||
    lower.includes("recommend waiting for initial event") ||
    lower.includes("absence of any recorded events")
  ) {
    return pdfCount > 0
      ? pdfProgressMessage(pdfCount)
      : "在文件夹中放入或修改文件后，再点「再读一遍变化」。";
  }
  if (EMPTY_EVENT_EN_RE.test(t) || looksLikeEnglishOnly(t)) {
    return pdfCount > 0
      ? pdfProgressMessage(pdfCount)
      : "我还没有读到足够可核对的文字内容，暂时无法判断这个项目现在怎样。";
  }
  // Strip accidental internal jargon if model echoed field names in English
  if (
    /\b(candidate|accepted revision|OwnerDecisionWriter|HTTP memory|matterId|projectId)\b/i.test(
      t,
    ) &&
    !/[\u4e00-\u9fff]/.test(t)
  ) {
    return "我还没有读到足够可核对的文字内容，暂时无法判断这个项目现在怎样。";
  }
  return t;
}

export function humanizeUserFacingList(
  items: string[] | undefined,
  options?: { pdfCount?: number },
): string[] {
  return (items ?? [])
    .map((item) => humanizeUserFacingText(item, options))
    .filter(Boolean);
}

/** Detect empty / no-event filler that must not be a real Owner decision. */
export function isEmptyEventUnderstandingBody(body: {
  now?: { text?: string; evidence?: unknown[]; gaps?: string[] };
  then?: { text?: string; gaps?: string[] };
  nextDecision?: string;
  changed?: Array<{ eventIds?: string[]; after?: string }>;
  evidenceRevisionIds?: string[];
} | null | undefined): boolean {
  if (!body) return true;
  const bag = [
    body.now?.text ?? "",
    ...(body.now?.gaps ?? []),
    body.then?.text ?? "",
    ...(body.then?.gaps ?? []),
    body.nextDecision ?? "",
  ]
    .join("\n")
    .trim();
  if (!bag) return true;
  if (EMPTY_EVENT_EN_RE.test(bag)) return true;
  if (
    bag.includes("目前还没有可核对的文件变化") ||
    bag.includes("暂无新的可核对") ||
    bag.includes("未发现新的文件变化") ||
    bag.includes("还不能从 PDF 抽出")
  ) {
    return true;
  }
  const hasEvidence = (body.now?.evidence?.length ?? 0) > 0;
  const hasQuotes = (body.now?.evidence ?? []).some(
    (a) =>
      a &&
      typeof a === "object" &&
      typeof (a as { quote?: string }).quote === "string" &&
      (a as { quote: string }).quote.trim().length > 0,
  );
  const hasChangedEvents = (body.changed ?? []).some(
    (c) => (c.eventIds?.length ?? 0) > 0,
  );
  const hasPins = (body.evidenceRevisionIds?.length ?? 0) > 0;
  // Binary-only pins without quotes still count as "no readable understanding"
  if (hasPins && !hasQuotes && !hasEvidence) return true;
  if (hasPins && !hasQuotes) {
    // pins with empty evidence quotes → treat as empty for decision UI
    const anyQuote = (body.now?.evidence ?? []).some(
      (a) =>
        a &&
        typeof a === "object" &&
        String((a as { quote?: string }).quote ?? "").trim(),
    );
    if (!anyQuote && looksLikeEnglishOnly(body.now?.text ?? "")) return true;
  }
  return !hasEvidence && !hasChangedEvents && !hasPins && !hasQuotes;
}
