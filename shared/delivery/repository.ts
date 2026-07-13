import { randomUUID } from "node:crypto";
import { transition } from "./state-machine";
import type {
  CommitmentSlip,
  DeliveryAction,
  Priority,
} from "./types";

type NewSlip = {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  dueAt?: string;
  priority?: Priority;
  sourceExcerpt?: string;
};

type ProviderAction = "send" | "deliver";
type ClientAction = "confirm" | "request_changes" | "accept" | "reject";

const globalStore = globalThis as typeof globalThis & {
  __fcOpcDeliverySlips?: Map<string, CommitmentSlip>;
};

const slips =
  globalStore.__fcOpcDeliverySlips ??
  (globalStore.__fcOpcDeliverySlips = new Map<string, CommitmentSlip>());

function copy(slip: CommitmentSlip): CommitmentSlip {
  return structuredClone(slip);
}

function requireSlip(id: string): CommitmentSlip {
  const slip = slips.get(id);
  if (!slip) throw new Error("承诺单不存在");
  return slip;
}

function saveTransition(
  slip: CommitmentSlip,
  next: CommitmentSlip["status"],
  actor: "provider" | "client",
  action: DeliveryAction,
  note?: string,
): CommitmentSlip {
  const result = transition(slip.status, next, actor);
  if (!result.ok) throw new Error(result.reason);
  const at = new Date().toISOString();
  const updated: CommitmentSlip = {
    ...slip,
    status: result.next,
    updatedAt: at,
    history: [...slip.history, { actor, action, at, note }],
  };
  slips.set(updated.id, updated);
  return copy(updated);
}

export function createSlips(input: NewSlip[]): CommitmentSlip[] {
  const now = new Date().toISOString();
  return input.map((item) => {
    const title = item.title.trim();
    if (!title) throw new Error("承诺标题不能为空");
    const slip: CommitmentSlip = {
      ...item,
      id: randomUUID(),
      title,
      priority: item.priority ?? "中",
      status: "draft",
      history: [{ actor: "provider", action: "create", at: now }],
      createdAt: now,
      updatedAt: now,
    };
    slips.set(slip.id, slip);
    return copy(slip);
  });
}

export function listSlips(): CommitmentSlip[] {
  return [...slips.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(copy);
}

export function updateSlip(
  id: string,
  patch: Pick<
    Partial<CommitmentSlip>,
    "title" | "description" | "acceptanceCriteria" | "dueAt" | "priority"
  >,
): CommitmentSlip {
  const slip = requireSlip(id);
  if (slip.status !== "draft" && slip.status !== "client_requested_changes") {
    throw new Error("只有草稿或待修改承诺单可以编辑");
  }
  const title = patch.title?.trim() ?? slip.title;
  if (!title) throw new Error("承诺标题不能为空");
  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as typeof patch;
  const updated = {
    ...slip,
    ...definedPatch,
    title,
    updatedAt: new Date().toISOString(),
  };
  slips.set(id, updated);
  return copy(updated);
}

export function applyProviderAction(
  id: string,
  action: ProviderAction,
): CommitmentSlip {
  const slip = requireSlip(id);
  if (action === "send") {
    const withToken = slip.clientToken
      ? slip
      : { ...slip, clientToken: randomUUID() };
    return saveTransition(
      withToken,
      "pending_client_confirm",
      "provider",
      slip.status === "client_requested_changes" ? "resend" : "send",
    );
  }
  return saveTransition(
    slip,
    "provider_delivered",
    "provider",
    "deliver",
  );
}

export function getSlipByToken(token: string): CommitmentSlip | null {
  const slip = [...slips.values()].find((item) => item.clientToken === token);
  return slip ? copy(slip) : null;
}

export function applyClientAction(
  token: string,
  action: ClientAction,
  note?: string,
): CommitmentSlip {
  const slip = getSlipByToken(token);
  if (!slip) throw new Error("客户链接无效或已失效");
  const cleanNote = note?.trim();
  if (
    (action === "request_changes" || action === "reject") &&
    !cleanNote
  ) {
    throw new Error(action === "reject" ? "请填写拒收说明" : "请填写修改说明");
  }
  const target = {
    confirm: "client_confirmed",
    request_changes: "client_requested_changes",
    accept: "client_accepted",
    reject: "client_rejected",
  } as const;
  return saveTransition(slip, target[action], "client", action, cleanNote);
}

export function resetSlipStore(): void {
  slips.clear();
}
