/**
 * D-50 / F-06 pure onboarding + first-use contract helpers.
 * Product entry is folder choice; Agent then produces source-backed understanding.
 */

export type OnboardingPhase = "entry" | "review";

/** Real progress steps — advance only after the matching API completes. */
export type FirstUseProgressStep = "authorize" | "reconcile" | "reconstruct";

export type FolderSelection = {
  selectionId: string;
  folderName: string;
  rootPath: string;
  permissionBoundary: string;
};

export type RecentConnection = {
  projectId: string;
  grantId: string;
  folderName: string;
  rootPath: string;
};

export type ConnectConnectionBody =
  | { mode: "connect"; selectionId: string; confirmToken: string }
  | { mode: "continue"; projectId: string; grantId: string };

/** Labels that must never appear as required onboarding inputs. */
export const ONBOARDING_FORBIDDEN_FIELD_LABELS = [
  "项目 ID",
  "本地 rootPath",
  "关注路径（逗号分隔）",
] as const;

export const DEFAULT_PERMISSION_COPY =
  "只会读你选中的这个文件夹。生成物等默认会跳过；需要时再细调范围。";

export const FIRST_USE_PROGRESS_STEPS: FirstUseProgressStep[] = [
  "authorize",
  "reconcile",
  "reconstruct",
];

export const FIRST_USE_PROGRESS_LABELS: Record<FirstUseProgressStep, string> = {
  authorize: "接上文件夹",
  reconcile: "浏览项目内容",
  reconstruct: "整理当前理解",
};

export function folderNameFromPath(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || rootPath;
}

export function connectPayloadForNewSelection(
  selectionId: string,
  confirmToken: string,
): ConnectConnectionBody {
  const id = selectionId.trim();
  const token = confirmToken.trim();
  if (!id) throw new Error("缺少文件夹选择标识");
  if (!token) throw new Error("缺少预检确认令牌；请先完成预检");
  return { mode: "connect", selectionId: id, confirmToken: token };
}

export function connectPayloadForContinue(
  recent: Pick<RecentConnection, "projectId" | "grantId">,
): ConnectConnectionBody {
  const projectId = recent.projectId.trim();
  const grantId = recent.grantId.trim();
  if (!projectId || !grantId) throw new Error("缺少已保存连接标识");
  return { mode: "continue", projectId, grantId };
}

export function phaseAfterPickerCancel(): OnboardingPhase {
  return "entry";
}

export function phaseAfterPickerSelected(): OnboardingPhase {
  return "review";
}

export function fixtureModeFromSearch(
  search: string | URLSearchParams,
): boolean {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search,
        )
      : search;
  return params.get("fixture") === "1";
}

export function onboardingExposesInternalFields(
  labelsPresent: string[],
): boolean {
  return ONBOARDING_FORBIDDEN_FIELD_LABELS.some((label) =>
    labelsPresent.includes(label),
  );
}

type EventIdCarrier = {
  id?: string;
  matched?: boolean;
  event?: { id?: string };
};

/**
 * Prefer matched/reconciled ids from the connection bootstrap.
 * Backend may send `matchedEventIds` and/or alias `eventIds` (same content).
 * Never invent projectId/rootPath; only pass through server-provided event ids.
 */
export function matchedEventIdsFromBootstrap(payload: {
  matchedEventIds?: string[];
  eventIds?: string[];
  reconciledEventIds?: string[];
  events?: EventIdCarrier[];
  relevantEvents?: EventIdCarrier[];
}): string[] {
  if (payload.matchedEventIds?.length) {
    return uniqueIds(payload.matchedEventIds);
  }
  if (payload.eventIds?.length) {
    return uniqueIds(payload.eventIds);
  }
  if (payload.reconciledEventIds?.length) {
    return uniqueIds(payload.reconciledEventIds);
  }
  if (payload.relevantEvents?.length) {
    return uniqueIds(
      payload.relevantEvents.map((item) => item.event?.id ?? item.id ?? ""),
    );
  }
  if (payload.events?.length) {
    const matched = payload.events.filter((event) => event.matched !== false);
    return uniqueIds(matched.map((event) => event.id ?? event.event?.id ?? ""));
  }
  return [];
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

/** True when memory already has an Owner-visible understanding revision. */
export function hasPersistedUnderstanding(memory: {
  candidate?: { body?: unknown } | null;
  accepted?: { body?: unknown } | null;
}): boolean {
  return Boolean(memory.candidate?.body || memory.accepted?.body);
}

export {
  humanizeUserFacingText as humanizeUnderstandingText,
  isEmptyEventUnderstandingBody as isEmptyEventUnderstanding,
  countPdfPaths,
  looksLikeEnglishOnly,
} from "@/shared/project-memory/user-facing-zh";

/**
 * Initial analysis runs only when there is no accepted/candidate yet.
 * Continue with existing understanding must not force analysis.
 */
export function shouldRunInitialAnalysis(memory: {
  candidate?: { body?: unknown } | null;
  accepted?: { body?: unknown } | null;
}): boolean {
  return !hasPersistedUnderstanding(memory);
}

/** @deprecated use shouldRunInitialAnalysis — kept for tests naming clarity. */
export function memoryNeedsReconstruction(memory: {
  candidate?: { body?: unknown } | null;
  accepted?: { body?: unknown } | null;
  head?: { reviewState?: string };
}): boolean {
  return shouldRunInitialAnalysis(memory);
}

export type UnderstandingUnknowns = {
  nowText: string;
  unknowns: string[];
  hasEvidence: boolean;
};

/** First meaningful output: source-backed now + explicit unknown/conflict gaps. */
export function extractUnderstandingLead(body: {
  now: { text: string; gaps: string[]; conflicts: string[]; evidence: unknown[] };
  then: { gaps: string[]; conflicts: string[] };
  why: Array<{ status: string; text: string }>;
}): UnderstandingUnknowns {
  const unknowns: string[] = [];
  for (const gap of body.now.gaps) unknowns.push(gap);
  for (const conflict of body.now.conflicts) unknowns.push(conflict);
  for (const gap of body.then.gaps) unknowns.push(gap);
  for (const conflict of body.then.conflicts) unknowns.push(conflict);
  for (const why of body.why) {
    if (why.status === "unknown" || why.status === "conflicted") {
      unknowns.push(why.text);
    }
  }
  return {
    nowText: body.now.text,
    unknowns: [...new Set(unknowns.map((item) => item.trim()).filter(Boolean))],
    hasEvidence: body.now.evidence.length > 0,
  };
}

export function progressStepIndex(step: FirstUseProgressStep | null): number {
  if (!step) return -1;
  return FIRST_USE_PROGRESS_STEPS.indexOf(step);
}

export function isProgressStepDone(
  current: FirstUseProgressStep | null,
  step: FirstUseProgressStep,
): boolean {
  const currentIndex = progressStepIndex(current);
  const stepIndex = FIRST_USE_PROGRESS_STEPS.indexOf(step);
  if (current === null) return true;
  return stepIndex < currentIndex;
}
