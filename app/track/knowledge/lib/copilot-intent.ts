/**
 * AI Copilot intent — product innovation: true folder-reading Agent.
 * Not "jump to a random material / HTML card".
 */

export type CopilotIntent =
  | { kind: "need_project"; message: string }
  | { kind: "need_folder_grant"; message: string }
  | {
      kind: "show_agent";
      /** Kick analysis when no candidate is waiting and not already running. */
      rerun: boolean;
      message: string;
    };

export function resolveCopilotIntent(input: {
  projectId: string | null | undefined;
  hasFolderAgent: boolean;
  hasCandidate: boolean;
  hasAccepted: boolean;
  runStatus?: string | null;
}): CopilotIntent {
  if (!input.projectId?.trim()) {
    return {
      kind: "need_project",
      message: "先选一个项目，再让 Agent 读文件夹。",
    };
  }
  if (!input.hasFolderAgent) {
    return {
      kind: "need_folder_grant",
      message: "当前项目还没有授权文件夹。授权后 Agent 才能真读。",
    };
  }
  if (input.runStatus === "running" || input.runStatus === "queued") {
    return {
      kind: "show_agent",
      rerun: false,
      message: "Agent 正在阅读授权夹，请看右侧过程。",
    };
  }
  if (input.hasCandidate) {
    return {
      kind: "show_agent",
      rerun: false,
      message: "有一段理解等你确认，请看右侧。",
    };
  }
  if (input.hasAccepted) {
    return {
      kind: "show_agent",
      rerun: true,
      message: "已有确认理解；再读一遍授权夹看有无变化。",
    };
  }
  return {
    kind: "show_agent",
    rerun: true,
    message: "开始阅读授权夹…",
  };
}

/** Upload / import progress copy — always user-visible. */
export function formatUploadProgress(input: {
  index: number;
  total: number;
  fileName?: string;
}): string {
  const { index, total, fileName } = input;
  if (total <= 0) return "正在处理…";
  if (fileName?.trim()) {
    return `正在上传 ${index}/${total}：${fileName.trim()}`;
  }
  return `正在上传 ${index}/${total}…`;
}

export function formatFolderImportProgress(input: {
  index: number;
  total: number;
  folderName?: string;
}): string {
  const { index, total, folderName } = input;
  if (total <= 0) return "正在接入文件夹…";
  if (folderName?.trim()) {
    return `正在接入项目 ${index}/${total}：${folderName.trim()}`;
  }
  return `正在接入项目 ${index}/${total}…`;
}
