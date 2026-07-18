"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENT_CHAT_QUICK_PROMPTS,
  CANVAS_VIEW_LABELS,
  evidenceChipLabel,
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

export type AgentCanvasActionNotice = {
  view: string;
  reason?: string;
  at: number;
};

type Props = {
  projectId: string;
  matterId?: string | null;
  busy?: boolean;
  /** Send Owner question through dual-memory chat path (and canvas NL). */
  onSend: (text: string) => Promise<void>;
  /** Optional external refresh token (e.g. after analysis). */
  refreshKey?: string | number;
  /**
   * When false, full Agent answer needs folder grant.
   * Canvas morphology via NL still works.
   */
  canSend?: boolean;
  /** Shown under header / empty state when canSend is false. */
  blockedHint?: string | null;
  /** Opens the real folder picker + preflight confirmation flow. */
  onAuthorize?: () => void;
  /** Bump to scroll this panel into view and focus the input. */
  focusKey?: number;
  /** Last canvas morphology change driven by NL (center canvas). */
  canvasAction?: AgentCanvasActionNotice | null;
  /** Live center canvas view id (now | by_kind | decision | evidence). */
  canvasView?: string | null;
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

      {parsed.judgment ? (
        <section className={styles.agentChatJudgmentBlock}>
          <h4>当前判断</h4>
          <p>{parsed.judgment}</p>
        </section>
      ) : null}

      {parsed.evidence && parsed.evidence.length > 0 ? (
        <section className={styles.agentChatEvidenceBlock}>
          <h4>依据</h4>
          <ul className={styles.agentChatEvidenceList}>
            {parsed.evidence.map((chip, i) => (
              <li key={`${chip.path}-${i}`}>
                <span
                  className={styles.agentChatEvidenceChip}
                  title={chip.raw}
                >
                  <span className={styles.agentChatEvidenceIcon} aria-hidden>
                    ▣
                  </span>
                  <span className={styles.agentChatEvidencePath}>
                    {evidenceChipLabel(chip.path)}
                  </span>
                  {chip.rev ? (
                    <span className={styles.agentChatEvidenceRev}>
                      {chip.rev}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {parsed.decision ? (
        <section className={styles.agentChatDecisionBlock}>
          <h4>你现在只要决定</h4>
          <p className={styles.agentChatDecision}>{parsed.decision}</p>
        </section>
      ) : null}

      {parsed.showCandidateFooter ? (
        <p className={styles.agentChatCandidateNote}>
          候选判断 · 未写入项目事实
        </p>
      ) : null}
    </div>
  );
}

/**
 * Right-rail chat entry: Owner NL → Agent answer + center canvas morphology.
 * Canvas control does not require folder grant; full Agent answers do.
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
  canvasAction = null,
  canvasView = null,
}: Props) {
  const [turns, setTurns] = useState<AgentChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localHint, setLocalHint] = useState<string | null>(null);
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
  }, [turns, loading, canvasAction?.at, localHint]);

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || loading) return;
    setLoading(true);
    setError(null);
    setLocalHint(null);
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
    if (busy || loading) {
      setDraft(text);
      inputRef.current?.focus();
      return;
    }
    void sendText(text);
  };

  const liveViewId = canvasAction?.view ?? canvasView ?? null;
  const liveViewLabel = liveViewId
    ? CANVAS_VIEW_LABELS[liveViewId] ?? liveViewId
    : null;

  const statusLabel = canSend
    ? "已授权 · 可查材料并改画布"
    : "可改画布 · 查材料需授权文件夹";

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
            <div className={styles.agentChatMark} aria-hidden>
              <span className={styles.agentChatMarkDot} />
            </div>
            <div className={styles.agentChatTitleBlock}>
              <h3>问 Agent</h3>
              <p
                className={styles.agentChatStatus}
                data-online={canSend ? "true" : "false"}
                data-testid="agent-chat-status"
              >
                <span className={styles.agentChatStatusDot} aria-hidden />
                {statusLabel}
              </p>
            </div>
            {canSend ? (
              <span className={styles.agentChatBadgeLive}>画布可控</span>
            ) : (
              <span
                className={styles.agentChatBadge}
                data-testid="agent-chat-blocked-badge"
              >
                待授权材料
              </span>
            )}
          </div>
          <p className={styles.agentChatSubtitle}>
            用自然语言指挥中央画布形态，并追问项目态势
          </p>
        </div>
      </header>

      <div
        className={styles.agentChatCanvasStrip}
        data-testid="agent-chat-canvas-strip"
        data-active={liveViewLabel ? "true" : "false"}
      >
        <span className={styles.agentChatCanvasStripKey}>中央画布</span>
        <span className={styles.agentChatCanvasStripValue}>
          {liveViewLabel ? liveViewLabel : "未切换 · 说「只看决策」即可改形态"}
        </span>
        {canvasAction?.reason ? (
          <span className={styles.agentChatCanvasStripReason}>
            {canvasAction.reason}
          </span>
        ) : null}
      </div>

      {canvasAction && liveViewLabel ? (
        <div
          className={styles.agentChatCanvasNotice}
          data-testid="agent-chat-canvas-notice"
          role="status"
        >
          <span className={styles.agentChatCanvasNoticeLabel}>已切换</span>
          <span>
            画布形态 →「{liveViewLabel}」
            {canvasAction.reason ? ` · ${canvasAction.reason}` : ""}
          </span>
        </div>
      ) : null}

      <div
        ref={logRef}
        className={styles.agentChatLog}
        data-testid="agent-chat-log"
      >
        {turns.length === 0 ? (
          <div className={styles.agentChatEmpty} data-testid="agent-chat-empty">
            <p className={styles.agentChatEmptyLead}>
              {canSend
                ? "直接说局面，或点下方动作。Agent 会查授权夹依据，并立刻改中央画布。"
                : blockedHint ||
                  "先点下方动作改画布形态。授权文件夹后，Agent 才能结合材料回答。"}
            </p>
            <ul className={styles.agentChatEmptyExamples}>
              {AGENT_CHAT_QUICK_PROMPTS.slice(0, 4).map((q) => (
                <li key={`ex-${q.id}`}>
                  <button
                    type="button"
                    className={styles.agentChatEmptyExample}
                    disabled={busy || loading}
                    onClick={() => handleQuick(q.text)}
                  >
                    <span className={styles.agentChatEmptyExampleText}>
                      「{q.text}」
                    </span>
                    <span className={styles.agentChatEmptyExampleHint}>
                      {q.canvasHint ?? "改画布"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
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
                data-structured={
                  parsed.kind === "structured" ? "true" : "false"
                }
              >
                <div className={styles.agentChatAgentCard}>
                  <span className={styles.agentChatRole}>知几</span>
                  {parsed.kind === "structured" ? (
                    <AgentStructuredBody parsed={parsed} />
                  ) : (
                    <div className={styles.agentChatStructured}>
                      <p className={styles.agentChatLead}>{parsed.lead}</p>
                      {parsed.showCandidateFooter ? (
                        <p className={styles.agentChatCandidateNote}>
                          候选判断 · 未写入项目事实
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {loading || busy ? (
          <p
            className={styles.agentChatThinking}
            data-testid="agent-chat-thinking"
          >
            {canSend ? "检索证据 · 调整画布…" : "调整画布形态…"}
          </p>
        ) : null}
        {localHint ? (
          <p className={styles.agentChatSystemLine}>{localHint}</p>
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
          授权文件夹以查材料
        </button>
      ) : null}

      {error ? (
        <p className={styles.agentChatError} data-testid="agent-chat-error">
          {error}
        </p>
      ) : null}

      <div className={styles.agentChatQuickSection}>
        <p className={styles.agentChatQuickLabel}>快捷 · 立即改中央画布</p>
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
              title={q.canvasHint ?? q.text}
              data-testid={`agent-chat-quick-${q.id}`}
              data-active={
                liveViewId &&
                q.canvasHint?.includes(
                  CANVAS_VIEW_LABELS[liveViewId] ?? "",
                )
                  ? "true"
                  : "false"
              }
              onClick={() => handleQuick(q.text)}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.agentChatComposer}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="例如：只看决策 / 证据链 / 把画布切到关系类型…"
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
        <div className={styles.agentChatComposerBar}>
          <span className={styles.agentChatComposerHint}>
            Enter 发送 · 自然语言改画布
          </span>
          <button
            type="button"
            className={styles.agentChatSend}
            disabled={busy || loading || !draft.trim()}
            data-testid="agent-chat-send"
            onClick={() => void handleSubmit()}
          >
            {loading || busy ? "…" : "发送"}
          </button>
        </div>
      </div>
    </section>
  );
}
