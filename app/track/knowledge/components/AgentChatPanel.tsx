"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../workbench-entry.module.css";

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
 * Right-rail chat entry: loads Dialogue Memory and sends Owner questions
 * into the model loop (via parent onSend → analysis with ownerUtterance).
 */
export function AgentChatPanel({
  projectId,
  matterId: _matterId,
  busy = false,
  onSend,
  refreshKey,
}: Props) {
  const [turns, setTurns] = useState<AgentChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || busy || loading) return;
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

  return (
    <section
      className={styles.agentChatPanel}
      data-testid="agent-chat-panel"
      aria-label="与 Agent 对话"
    >
      <header className={styles.agentChatHeader}>
        <h3>问 Agent</h3>
        <span>你说的项目理解会记入真源</span>
      </header>

      <div className={styles.agentChatLog} data-testid="agent-chat-log">
        {turns.length === 0 ? (
          <p className={styles.agentChatEmpty}>
            还没有对话。直接问「现在重点是什么」或「README 说了什么」。
          </p>
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="问项目里的事…"
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
          className={styles.entryPrimaryButton}
          disabled={busy || loading || !draft.trim()}
          data-testid="agent-chat-send"
          onClick={() => void handleSubmit()}
        >
          {loading || busy ? "思考中…" : "发送"}
        </button>
      </div>
    </section>
  );
}
