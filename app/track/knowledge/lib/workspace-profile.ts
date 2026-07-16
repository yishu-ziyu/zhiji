/**
 * Local personalization only (name + avatar). Not an account / multi-user system.
 */

export type WorkspaceProfile = {
  displayName: string;
  /** data URL or /public path */
  avatarUrl: string;
};

export const WORKSPACE_PROFILE_KEY = "fc-opc-knowledge-workspace-profile";

export const DEFAULT_WORKSPACE_PROFILE: WorkspaceProfile = {
  displayName: "我",
  avatarUrl: "/project-canvas/avatar-source.png",
};

const MAX_NAME = 32;
const MAX_AVATAR_BYTES = 512 * 1024;

/** In-memory fallback when localStorage is missing (tests / private mode). */
let memoryProfile: WorkspaceProfile | null = null;

function normalizeProfile(profile: Partial<WorkspaceProfile>): WorkspaceProfile {
  const displayName =
    typeof profile.displayName === "string" && profile.displayName.trim()
      ? profile.displayName.trim().slice(0, MAX_NAME)
      : DEFAULT_WORKSPACE_PROFILE.displayName;
  const avatarUrl =
    typeof profile.avatarUrl === "string" && profile.avatarUrl.trim()
      ? profile.avatarUrl.trim()
      : DEFAULT_WORKSPACE_PROFILE.avatarUrl;
  return { displayName, avatarUrl };
}

export function readWorkspaceProfile(): WorkspaceProfile {
  if (typeof window === "undefined") {
    return memoryProfile ? { ...memoryProfile } : { ...DEFAULT_WORKSPACE_PROFILE };
  }
  try {
    const raw = window.localStorage.getItem(WORKSPACE_PROFILE_KEY);
    if (!raw) {
      return memoryProfile
        ? { ...memoryProfile }
        : { ...DEFAULT_WORKSPACE_PROFILE };
    }
    return normalizeProfile(JSON.parse(raw) as Partial<WorkspaceProfile>);
  } catch {
    return memoryProfile
      ? { ...memoryProfile }
      : { ...DEFAULT_WORKSPACE_PROFILE };
  }
}

export function writeWorkspaceProfile(profile: WorkspaceProfile): void {
  const next = normalizeProfile(profile);
  memoryProfile = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — memory still holds it for this session */
  }
}

/** Test helper only. */
export function resetWorkspaceProfileForTests(): void {
  memoryProfile = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKSPACE_PROFILE_KEY);
  } catch {
    /* */
  }
}

export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      reject(new Error("头像请小于 512KB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("读取头像失败"));
    };
    reader.onerror = () => reject(new Error("读取头像失败"));
    reader.readAsDataURL(file);
  });
}
