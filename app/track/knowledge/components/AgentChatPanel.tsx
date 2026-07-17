"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENT_CHAT_QUICK_PROMPTS,
  parseAgentMessage,
  type ParsedAgentMessage,
} from "../lib/agent-chat-format";
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
  /** Opens the real folder picker + preflight confirmation flow. */
  onAuthorize?: () => void;
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
  const csrf = (window as Window & { __FC_OPC_CSRF?: string })
    .__FC_OPC_CSRF;
  const res = await fetch(
    `/api/knowledge/projects/${encodeURIComponent(projectId)}/dialogue`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(csrf ? { "x-csrf-token": csrf } : {}),
      },
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

function AgentStructuredBody({ parsed }: { parsed: ParsedAgentMessage }) {
  return (
    <div className={styles.agentChatStructured}>
      {parsed.lead ? (
        <p className={styles.agentChatLead}>{parsed.lead}</p>
      ) : null}

      {parsed.judgment ||
      (parsed.evidence && parsed.evidence.length > 0) ||
      parsed.decision ? (
        <div className={styles.agentChatStructCard}>
          {parsed.judgment ? (
            <section className={styles.agentChatStructSection}>
              <h4>当前判断</h4>
              <p>{parsed.judgment}</p>
            </section>
          ) : null}

          {parsed.evidence && parsed.evidence.length > 0 ? (
            <section className={styles.agentChatStructSection}>
              <h4>依据</h4>
              <ul className={styles.agentChatEvidenceList}>
                {parsed.evidence.map((chip, i) => (
                  <li key={`${chip.path}-${i}`}>
                    <span className={styles.agentChatEvidenceChip}>
                      <span className={styles.agentChatEvidenceIcon} aria-hidden>
                        📄
                      </span>
                      <span className={styles.agentChatEvidencePath}>
                        {chip.path}
                        {chip.rev ? ` @ ${chip.rev}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {parsed.decision ? (
            <section className={styles.agentChatStructSection}>
              <h4>你现在只要决定</h4>
              <p className={styles.agentChatDecision}>{parsed.decision}</p>
            </section>
          ) : null}
        </div>
      ) : null}

      {parsed.showCandidateFooter ? (
        <p className={styles.agentChatCandidateNote}>
          候选判断 · 未自动写入项目事实
        </p>
      ) : null}
    </div>
  );
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
  onAuthorize,
  focusKey,
}: Props) {
  const [turns, setTurns] = useState<AgentChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

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
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [focusKey]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, loading]);

  const sendText = async (raw: string) => {
    const text = raw.trim();
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

  const handleSubmit = async () => {
    await sendText(draft);
  };

  const handleQuick = (text: string) => {
    if (!canSend || busy || loading) {
      setDraft(text);
      inputRef.current?.focus();
      return;
    }
    void sendText(text);
  };

  const emptyCopy = canSend
    ? "还没有对话。直接问「这个项目现在最该决定什么」或「凭什么这么判断」。"
    : blockedHint ||
      "对话入口在这里。先授权项目文件夹，Agent 才能在夹里查依据。";

  const statusLabel = canSend
    ? "在线 · 已授权本地文件夹"
    : "待授权 · 文件夹未连接";

  return (
    <section
      ref={panelRef}
      className={styles.agentChatPanel}
      data-testid="agent-chat-panel"
      data-can-send={canSend ? "true" : "false"}
      aria-label="与 Agent 对话"
    >
      <header className={styles.agentChatHeader}>
        <div className={styles.agentChatHeaderMain}>
          <div className={styles.agentChatTitleRow}>
            <h3>问 Agent</h3>
            {!canSend ? (
              <span
                className={styles.agentChatBadge}
                data-testid="agent-chat-blocked-badge"
              >
                待授权
              </span>
            ) : null}
          </div>
          <p
            className={styles.agentChatStatus}
            data-online={canSend ? "true" : "false"}
            data-testid="agent-chat-status"
          >
            <span className={styles.agentChatStatusDot} aria-hidden />
            {statusLabel}
          </p>
          <p className={styles.agentChatSubtitle}>
            用自然语言问项目态势，不闲聊
          </p>
        </div>
      </header>

      <div
        ref={logRef}
        className={styles.agentChatLog}
        data-testid="agent-chat-log"
      >
        {turns.length === 0 ? (
          <p className={styles.agentChatEmpty}>{emptyCopy}</p>
        ) : (
          turns.map((t) => {
            if (t.role === "user") {
              return (
                <div
                  key={t.id}
                  className={styles.agentChatTurn}
                  data-role="user"
                  data-testid="agent-chat-turn-user"
                >
                  <div className={styles.agentChatUserBubble}>
                    <span className={styles.agentChatRole}>你</span>
                    <p>{t.content}</p>
                  </div>
                </div>
              );
            }
            if (t.role === "system") {
              return (
                <div
                  key={t.id}
                  className={styles.agentChatTurn}
                  data-role="system"
                  data-testid="agent-chat-turn-system"
                >
                  <p className={styles.agentChatSystemLine}>{t.content}</p>
                </div>
              );
            }
            const parsed = parseAgentMessage(t.content);
            return (
              <div
                key={t.id}
                className={styles.agentChatTurn}
                data-role="agent"
                data-testid="agent-chat-turn-agent"
                data-structured={parsed.kind === "structured" ? "true" : "false"}
              >
                <span className={styles.agentChatRole}>知几</span>
                {parsed.kind === "structured" ? (
                  <AgentStructuredBody parsed={parsed} />
                ) : (
                  <div className={styles.agentChatStructured}>
                    <p className={styles.agentChatLead}>{parsed.lead}</p>
                    {parsed.showCandidateFooter ? (
                      <p className={styles.agentChatCandidateNote}>
                        候选判断 · 未自动写入项目事实
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        )}
        {loading || busy ? (
          <p className={styles.agentChatThinking} data-testid="agent-chat-thinking">
            检索证据中…
          </p>
        ) : null}
      </div>

      {!canSend && onAuthorize ? (
        <button
          type="button"
          className={styles.agentChatAuthorize}
          data-testid="agent-chat-authorize"
          onClick={onAuthorize}
          disabled={busy || loading}
        >
          选择并授权文件夹
        </button>
      ) : null}

      {error ? (
        <p className={styles.agentChatError} data-testid="agent-chat-error">
          {error}
        </p>
      ) : null}

      <div
        className={styles.agentChatQuickRow}
        data-testid="agent-chat-quick-prompts"
      >
        {AGENT_CHAT_QUICK_PROMPTS.map((q) => (
          <button
            key={q.id}
            type="button"
            className={styles.agentChatQuickChip}
            disabled={busy || loading}
            data-testid={`agent-chat-quick-${q.id}`}
            onClick={() => handleQuick(q.text)}
          >
            {q.label}
          </button>
        ))}
      </div>

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
          rows={3}
          disabled={busy || loading}
          data-testid="agent-chat-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />
        <div className={styles.agentChatComposerBar}>
          <span className={styles.agentChatComposerHint}>
            Enter 发送 · Shift+Enter 换行
          </span>
          <button
            type="button"
            className={styles.agentChatSend}
            disabled={busy || loading || !draft.trim() || !canSend}
            data-testid="agent-chat-send"
            onClick={() => void handleSubmit()}
          >
            {loading || busy ? "思考中…" : "发送"}
          </button>
        </div>
      </div>
    </section>
  );
}
