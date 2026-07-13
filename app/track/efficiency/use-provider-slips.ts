"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CommitmentSlip } from "@/shared/delivery/types";

export type ProviderAction = "update" | "send" | "deliver";

const PROVIDER_TOKEN_KEY = "fc-opc-provider-client-tokens";

export function clientUrl(slip: CommitmentSlip): string | null {
  if (!slip.clientToken || typeof window === "undefined") return null;
  return `${window.location.origin}/c/${slip.clientToken}`;
}

function loadProviderTokens(): Record<string, string> {
  try {
    return JSON.parse(
      localStorage.getItem(PROVIDER_TOKEN_KEY) ?? "{}",
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberProviderToken(slip: CommitmentSlip): void {
  if (!slip.clientToken) return;
  localStorage.setItem(
    PROVIDER_TOKEN_KEY,
    JSON.stringify({ ...loadProviderTokens(), [slip.id]: slip.clientToken }),
  );
}

function providerPayload(slip: CommitmentSlip, action: ProviderAction) {
  return {
    action,
    id: slip.id,
    title: slip.title,
    acceptanceCriteria: slip.acceptanceCriteria,
    dueAt: slip.dueAt,
    priority: slip.priority,
  };
}

export async function submitProviderAction(
  slip: CommitmentSlip,
  action: ProviderAction,
): Promise<CommitmentSlip> {
  const response = await fetch("/api/efficiency/slips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(providerPayload(slip, action)),
  });
  const data = (await response.json()) as {
    slip?: CommitmentSlip;
    error?: string;
  };
  if (!response.ok || !data.slip) {
    throw new Error(data.error || "操作失败");
  }
  return data.slip;
}

function sameSlips(left: CommitmentSlip[], right: CommitmentSlip[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useProviderSlips(
  setError: Dispatch<SetStateAction<string | null>>,
) {
  const [slips, setSlips] = useState<CommitmentSlip[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const editingIds = useRef(new Set<string>());

  const refreshSlips = useCallback(async () => {
    const response = await fetch("/api/efficiency/slips", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { slips: CommitmentSlip[] };
    const tokens = loadProviderTokens();
    setSlips((current) => {
      const local = new Map(current.map((slip) => [slip.id, slip]));
      const next = data.slips.map((slip) => {
        const withToken = tokens[slip.id]
          ? { ...slip, clientToken: tokens[slip.id] }
          : slip;
        const editing = local.get(slip.id);
        return editingIds.current.has(slip.id) && editing
          ? {
              ...withToken,
              title: editing.title,
              acceptanceCriteria: editing.acceptanceCriteria,
              dueAt: editing.dueAt,
              priority: editing.priority,
            }
          : withToken;
      });
      return sameSlips(current, next) ? current : next;
    });
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshSlips(), 0);
    const timer = window.setInterval(() => void refreshSlips(), 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshSlips]);

  const updateLocalSlip = useCallback(
    (id: string, patch: Partial<CommitmentSlip>) => {
      editingIds.current.add(id);
      setSlips((current) =>
        current.map((slip) =>
          slip.id === id ? { ...slip, ...patch } : slip,
        ),
      );
    },
    [],
  );

  const providerAction = useCallback(
    async (slip: CommitmentSlip, action: ProviderAction) => {
      setError(null);
      try {
        const updated = await submitProviderAction(slip, action);
        rememberProviderToken(updated);
        editingIds.current.delete(slip.id);
        await refreshSlips();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "操作失败");
      }
    },
    [refreshSlips, setError],
  );

  const copyClientLink = useCallback(async (slip: CommitmentSlip) => {
    const url = clientUrl(slip);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedId(slip.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return {
    slips,
    copiedId,
    refreshSlips,
    updateLocalSlip,
    providerAction,
    copyClientLink,
  };
}
