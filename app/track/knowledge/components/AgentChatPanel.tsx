"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../project-canvas.module.css";

export type AgentChatTurn = {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  createdAt: string;
};

type Props = {
  projectId: string;
  matterId?: string | null;
  busy?: boolean;
  /** Send Owner question through dual-memory chat path. */
  onSend: (text: string) => Promise<void>;
  /** Optional external refresh token (e.g. after analysis). */
  refreshKey?: string | number;
  /**
   * When false, composer stays visible but send is blocked
   * (e.g. no folder grant yet).
   */
  canSend?: boolean;
  /** Shown under header / empty state when canSend is false. */
  blockedHint?: string | null;
  /** Bump to scroll this panel into view and focus the input. */
  focusKey?: number;
};

async function fetchSessions(projectId: string): Promise<
  Array<{ id: string; status: string }>
> {
  const res = await fetch(
    `/api/knowledge/projects/${encodeURIComponent(projectId)}/dialogue`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    sessions?: Array<{ id: string; status: string }>;
  };
  return data.sessions ?? [];
}

async function fetchMessages(
  projectId: string,
  sessionId: string,
): Promise<AgentChatTurn[]> {
  const res = await fetch(
    `/api/knowledge/projects/${encodeURIComponent(projectId)}/dialogue`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "list_messages", sessionId }),
    },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    messages?: Array<{
      id: string;
      role: "user" | "agent" | "system";
      content: string;
      createdAt: string;
    }>;
  };
  return (data.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }));
}

/**
 * Right-rail chat entry: always visible when a project is open.
 * Loads Dialogue Memory when available; sends via parent onSend.
 */
export function AgentChatPanel({
  projectId,
  matterId: _matterId,
  busy = false,
  onSend,
  refreshKey,
  canSend = true,
  blockedHint = null,
  focusKey,
}: Props) {
  const [turns, setTurns] = useState<AgentChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const reload = useCallback(async () => {
    if (!projectId) {
      setTurns([]);
      return;
    }
    try {
      const sessions = await fetchSessions(projectId);
      const open = sessions.find((s) => s.status === "open") ?? sessions[0];
      if (!open) {
        setTurns([]);
        return;
      }
      const messages = await fetchMessages(projectId, open.id);
      setTurns(messages);
    } catch {
      /* keep prior */
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    if (focusKey == null || focusKey === 0) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // Slight delay so layout settles after rail mount.
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [focusKey]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || busy || loading) return;
    if (!canSend) {
      setError(blockedHint || "先授权项目文件夹，再和 Agent 对话。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSend(text);
      setDraft("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  const emptyCopy = canSend
    ? "还没有对话。直接问「昨天考察的项目」或「凭什么这么判断」。"
    : blockedHint ||
      "对话入口在这里。先授权项目文件夹，Agent 才能在夹里查依据。";

  return (
    <section
      ref={panelRef}
      className={styles.agentChatPanel}
      data-testid="agent-chat-panel"
      data-can-send={canSend ? "true" : "false"}
      aria-label="与 Agent 对话"
    >
      <header className={styles.agentChatHeader}>
        <div className={styles.agentChatTitleRow}>
          <h3>问 Agent</h3>
          {!canSend ? (
            <span className={styles.agentChatBadge} data-testid="agent-chat-blocked-badge">
              待授权
            </span>
          ) : null}
        </div>
        <span>用自然语言驱动画布与理解</span>
      </header>

      <div className={styles.agentChatLog} data-testid="agent-chat-log">
        {turns.length === 0 ? (
          <p className={styles.agentChatEmpty}>{emptyCopy}</p>
        ) : (
          turns.map((t) => (
            <div
              key={t.id}
              className={styles.agentChatTurn}
              data-role={t.role}
              data-testid={`agent-chat-turn-${t.role}`}
            >
              <span className={styles.agentChatRole}>
                {t.role === "user" ? "你" : t.role === "agent" ? "Agent" : "系统"}
              </span>
              <p>{t.content}</p>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className={styles.agentChatError} data-testid="agent-chat-error">
          {error}
        </p>
      ) : null}

      <div className={styles.agentChatComposer}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            canSend
              ? "问项目里的事，例如「只看决策」…"
              : "先授权文件夹后即可发送…"
          }
          rows={2}
          disabled={busy || loading}
          data-testid="agent-chat-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        <button
          type="button"
          className={styles.agentChatSend}
          disabled={busy || loading || !draft.trim()}
          data-testid="agent-chat-send"
          onClick={() => void handleSubmit()}
        >
          {loading || busy ? "思考中…" : canSend ? "发送" : "需先授权"}
        </button>
      </div>
    </section>
  );
}
