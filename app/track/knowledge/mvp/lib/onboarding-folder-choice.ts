/**
 * D-50 / F-06 pure onboarding contract helpers.
 * Product entry is folder choice, not internal IDs / path syntax / watch prefixes.
 */

export type OnboardingPhase = "entry" | "review";

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
  | { selectionId: string }
  | { projectId: string; grantId: string };

/** Labels that must never appear as required onboarding inputs. */
export const ONBOARDING_FORBIDDEN_FIELD_LABELS = [
  "项目 ID",
  "本地 rootPath",
  "关注路径（逗号分隔）",
] as const;

export const DEFAULT_PERMISSION_COPY =
  "仅授权当前所选文件夹。系统使用安全默认排除规则（如生成物与私有内部路径）；高级关注范围可在连接后调整。";

export function folderNameFromPath(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || rootPath;
}

export function connectPayloadForNewSelection(
  selectionId: string,
): ConnectConnectionBody {
  const id = selectionId.trim();
  if (!id) throw new Error("缺少文件夹选择标识");
  return { selectionId: id };
}

export function connectPayloadForContinue(
  recent: Pick<RecentConnection, "projectId" | "grantId">,
): ConnectConnectionBody {
  const projectId = recent.projectId.trim();
  const grantId = recent.grantId.trim();
  if (!projectId || !grantId) throw new Error("缺少已保存连接标识");
  return { projectId, grantId };
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
