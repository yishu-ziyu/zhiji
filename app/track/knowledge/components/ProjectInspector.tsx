"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Circle,
  CircleAlert,
  Clock3,
  FileText,
  Link2,
  MessageSquarePlus,
  Save,
  Star,
  UserCheck,
} from "lucide-react";
import type {
  ActionStatus,
  CanvasNodeRef,
  KnowledgeCard,
  ProjectCanvasSnapshot,
  RelationType,
} from "@/shared/types/knowledge";
import {
  ACTION_STATUSES,
  RELATION_TYPE_LABELS,
  RELATION_TYPES_P0,
  SOURCE_CLUSTER_LABELS,
  STATUS_LABELS,
} from "@/shared/types/knowledge";
import { actorLabel } from "./actor-label";
import { MarkdownBody } from "./MarkdownBody";
import {
  AgentPresenceRail,
  type AgentSession,
} from "./AgentPresenceRail";
import type { UnderstandingBody } from "../lib/folder-connection-api";
import styles from "../project-canvas.module.css";

type InspectorTab = "overview" | "context" | "tasks" | "activity";

type Props = {
  snapshot: ProjectCanvasSnapshot | null;
  projectCards: KnowledgeCard[];
  busy: boolean;
  checkpointOpen: boolean;
  onFocus: (ref: CanvasNodeRef) => void;
  onUpdateNextStep: (value: string) => Promise<void>;
  onLinkEvidence: (cardId: string) => Promise<void>;
  onUpdateWork: (input: {
    status: ActionStatus;
    blockedReason?: string;
    assignee?: string;
  }) => Promise<void>;
  onAddComment: (body: string) => Promise<void>;
  onCreateRelation: (input: {
    toCardId: string;
    relationType: RelationType;
    evidenceSentence: string;
  }) => Promise<void>;
  onReviewRelation: (
    relationId: string,
    status: "confirmed" | "rejected",
  ) => Promise<void>;
  /** B-3: propose material relations for current project (rule extract). */
  onProposeMaterialRelations?: () => Promise<void>;
  onRunAgent: () => Promise<void>;
  onCheckpoint: (input: {
    goal: string;
    completed: string[];
    unresolved: string[];
    nextStep: string;
  }) => Promise<void>;
  /** Folder-backed Agent presence (process + confirm). */
  agentSession?: AgentSession | null;
  agentResolutionMessage?: string | null;
  onResolveUnderstanding?: (
    decision: "accept" | "edit_accept" | "reject",
    editedBody?: UnderstandingBody,
  ) => Promise<void>;
  onRerunAgent?: () => Promise<void>;
  /** Right-rail chat → dual memory + model loop. */
  onAgentChatSend?: (text: string) => Promise<void>;
  /** Bump to focus the always-visible chat (topbar AI Copilot). */
  agentChatFocusKey?: number;
};

const tabLabels: Array<{ id: InspectorTab; label: string }> = [
  { id: "overview", label: "概览" },
  { id: "context", label: "依据" },
  { id: "tasks", label: "影响" },
  { id: "activity", label: "动态" },
];

const assessmentCopy = {
  continue: { title: "原计划可以继续", tone: "green" },
  adjust: { title: "原计划需要调整", tone: "orange" },
  insufficient: { title: "信息不足，先核对", tone: "blue" },
} as const;

function shortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ProjectInspector({
  snapshot,
  projectCards,
  busy,
  checkpointOpen,
  onFocus,
  onUpdateNextStep,
  onLinkEvidence,
  onUpdateWork,
  onAddComment,
  onCreateRelation,
  onReviewRelation,
  onProposeMaterialRelations,
  onRunAgent,
  onCheckpoint,
  agentSession = null,
  agentResolutionMessage = null,
  onResolveUnderstanding,
  onRerunAgent,
  onAgentChatSend,
  agentChatFocusKey = 0,
}: Props) {
  const [tab, setTab] = useState<InspectorTab>("overview");

  // E7: when project has Agent activity, open 动态 so process + feed are visible.
  useEffect(() => {
    if (!snapshot) return;
    if (
      snapshot.focus.kind === "project" &&
      snapshot.agentActivity?.hasAgentEvents
    ) {
      setTab("activity");
      return;
    }
    if (snapshot.focus.kind === "agent") {
      setTab("activity");
      return;
    }
    setTab("overview");
  }, [
    snapshot?.focus.kind,
    snapshot?.focus.id,
    snapshot?.agentActivity?.hasAgentEvents,
  ]);
  const [editingNextStep, setEditingNextStep] = useState(false);
  const [nextStep, setNextStep] = useState("");
  const [editingCheckpoint, setEditingCheckpoint] = useState(checkpointOpen);
  const [goal, setGoal] = useState(
    snapshot?.checkpoint?.goal ?? snapshot?.project.summary ?? "",
  );
  const [checkpointNextStep, setCheckpointNextStep] = useState(
    snapshot?.checkpoint?.nextStep ?? "",
  );
  const [completedText, setCompletedText] = useState(
    snapshot?.checkpoint?.completed.join("，") ?? "",
  );
  const [unresolvedText, setUnresolvedText] = useState(
    snapshot?.checkpoint?.unresolved.join("，") ?? "",
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [selfExecuting, setSelfExecuting] = useState(false);
  const [workStatus, setWorkStatus] = useState<ActionStatus>(
    snapshot?.inspector.workItem?.status ?? "doing",
  );
  const [assignee, setAssignee] = useState(
    snapshot?.inspector.workItem?.assignee ?? "自己",
  );
  const [blockedReason, setBlockedReason] = useState("");
  const [comment, setComment] = useState("");
  const [relationTargetId, setRelationTargetId] = useState("");
  const [relationType, setRelationType] = useState<RelationType>("supports");
  const [relationEvidence, setRelationEvidence] = useState("");

  const activity = useMemo(
    () =>
      snapshot
        ? [...snapshot.timeline.now, ...snapshot.timeline.history]
        : [],
    [snapshot],
  );

  if (!snapshot) {
    return <aside className={styles.inspector} data-testid="project-inspector" />;
  }

  const assessment = assessmentCopy[snapshot.planAssessment.status];
  const canEditWork = snapshot.inspector.availableActions.includes("update_next_step");
  const canRunAgent = snapshot.inspector.availableActions.includes("run_agent");
  const canLinkEvidence = snapshot.inspector.availableActions.includes("link_evidence");
  const canUpdateWork = snapshot.inspector.availableActions.includes("update_work");
  const canComment = snapshot.inspector.availableActions.includes("comment");
  const canCreateRelation = snapshot.inspector.availableActions.includes("create_relation");
  const canCheckpoint = snapshot.focus.kind === "project";
  const relationEdges = [...snapshot.edges, ...snapshot.foldedEdges].filter(
    (edge) => edge.relationId && edge.evidenceSentence,
  );

  async function saveNextStep() {
    if (!nextStep.trim()) return;
    await onUpdateNextStep(nextStep.trim());
    setNextStep("");
    setEditingNextStep(false);
  }

  async function saveCheckpoint() {
    if (!goal.trim() || !checkpointNextStep.trim()) return;
    await onCheckpoint({
      goal: goal.trim(),
      completed: completedText.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean),
      unresolved: unresolvedText.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean),
      nextStep: checkpointNextStep.trim(),
    });
    setEditingCheckpoint(false);
  }

  async function saveWorkUpdate() {
    if (!assignee.trim()) return;
    if (workStatus === "blocked" && !blockedReason.trim()) return;
    await onUpdateWork({
      status: workStatus,
      assignee: assignee.trim(),
      blockedReason: workStatus === "blocked" ? blockedReason.trim() : undefined,
    });
    setBlockedReason("");
    setSelfExecuting(false);
  }

  async function saveComment() {
    if (!comment.trim()) return;
    await onAddComment(comment.trim());
    setComment("");
  }

  async function saveRelation() {
    if (!relationTargetId || !relationEvidence.trim()) return;
    await onCreateRelation({
      toCardId: relationTargetId,
      relationType,
      evidenceSentence: relationEvidence.trim(),
    });
    setRelationTargetId("");
    setRelationEvidence("");
  }

  const focusKindLabel =
    snapshot.focus.kind === "project"
      ? "当前项目"
      : snapshot.focus.kind === "work_item"
        ? "工作项"
        : snapshot.focus.kind === "card"
          ? "材料依据"
          : snapshot.focus.kind === "event"
            ? "时间记录"
            : snapshot.focus.kind === "agent"
              ? "Agent"
              : "当前焦点";

  return (
    <aside className={styles.inspector} data-testid="project-inspector">
      <header className={styles.inspectorHeader}>
        <Image
          src="/project-canvas/logo-source.png"
          alt=""
          width={48}
          height={48}
          className={styles.inspectorLogo}
        />
        <div>
          <h2 data-testid="inspector-focus-title">{snapshot.inspector.title}</h2>
          <p data-testid="inspector-focus-kind">
            {focusKindLabel}
            {snapshot.focus.kind === "project" ? (
              <>
                {" "}
                <Star size={14} fill="currentColor" />
              </>
            ) : (
              <span className={styles.inspectorProjectHint}>
                {" "}
                · {snapshot.project.name}
              </span>
            )}
          </p>
        </div>
      </header>
      <p className={styles.inspectorSummary} data-testid="inspector-lead">
        {snapshot.focus.kind === "project"
          ? snapshot.project.summary || snapshot.inspector.summary
          : snapshot.inspector.whyImportant}
      </p>

      <nav className={styles.inspectorTabs} aria-label="详情分类">
        {tabLabels.map((item) => (
          <button
            key={item.id}
            type="button"
            data-active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "context" && snapshot.inspector.evidence.length > 0 ? (
              <span>{snapshot.inspector.evidence.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className={styles.inspectorBody}>
        {/* Always-visible Agent chat for open project (§2b); process only when session. */}
        {onAgentChatSend ? (
          <AgentPresenceRail
            projectId={snapshot.project.id}
            session={
              agentSession && agentSession.projectId === snapshot.project.id
                ? agentSession
                : null
            }
            resolutionMessage={agentResolutionMessage}
            onResolve={
              agentSession && agentSession.projectId === snapshot.project.id
                ? onResolveUnderstanding
                : undefined
            }
            onRerun={
              agentSession && agentSession.projectId === snapshot.project.id
                ? onRerunAgent
                : undefined
            }
            onChatSend={onAgentChatSend}
            busy={busy}
            chatFocusKey={agentChatFocusKey}
          />
        ) : null}
        {tab === "overview" ? (
          <>
            <section className={styles.focusSummary}>
              <span className={styles.sectionEyebrow}>当前关注</span>
              <h3>{snapshot.inspector.title}</h3>
              <MarkdownBody
                source={snapshot.inspector.summary}
                hintName={snapshot.inspector.title}
                data-testid="inspector-overview-summary"
              />
              <div className={styles.whyImportant}>
                <CircleAlert size={16} />
                <span>{snapshot.inspector.whyImportant}</span>
              </div>
              {snapshot.inspector.workItem ? (
                <dl className={styles.workFacts}>
                  <div><dt>负责人</dt><dd>{snapshot.inspector.workItem.assignee}</dd></div>
                  <div><dt>状态</dt><dd>{STATUS_LABELS[snapshot.inspector.workItem.status]}</dd></div>
                  <div><dt>下一步</dt><dd>{snapshot.inspector.workItem.nextStep}</dd></div>
                  <div><dt>截止时间</dt><dd>{snapshot.inspector.workItem.deadline || "未设置"}</dd></div>
                </dl>
              ) : null}
            </section>

            {canLinkEvidence ? (
              <section className={styles.inlineForm}>
                <label>
                  <span>关联项目依据</span>
                  <select
                    value={selectedEvidenceId}
                    onChange={(event) => setSelectedEvidenceId(event.target.value)}
                  >
                    <option value="">选择一条项目材料</option>
                    {projectCards
                      .filter((card) => !snapshot.inspector.evidence.some((ref) => ref.id === card.id))
                      .map((card) => (
                        <option key={card.id} value={card.id}>{card.title || card.content.slice(0, 36)}</option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !selectedEvidenceId}
                  onClick={async () => {
                    await onLinkEvidence(selectedEvidenceId);
                    setSelectedEvidenceId("");
                  }}
                >
                  <FileText size={15} />关联依据
                </button>
              </section>
            ) : null}

            {canCheckpoint ? (
              <section className={styles.planCard} data-tone={assessment.tone}>
                <div>
                  <span className={styles.sectionEyebrow}>
                    {snapshot.checkpointSource === "confirmed"
                      ? "你离开时确认的状态"
                      : "根据现有事件整理"}
                  </span>
                  <h3>{assessment.title}</h3>
                </div>
                <p>{snapshot.planAssessment.reason}</p>
                {snapshot.planAssessment.evidence.length > 0 ? (
                  <div className={styles.evidenceChips}>
                    {snapshot.planAssessment.evidence.map((ref) => (
                      <button
                        type="button"
                        key={`${ref.kind}:${ref.id}`}
                        onClick={() => onFocus(ref)}
                      >
                        <FileText size={13} />查看判断依据
                      </button>
                    ))}
                  </div>
                ) : null}
                {snapshot.checkpoint ? (
                  <dl>
                    <div><dt>目标</dt><dd>{snapshot.checkpoint.goal}</dd></div>
                    <div><dt>原下一步</dt><dd>{snapshot.checkpoint.nextStep}</dd></div>
                  </dl>
                ) : null}
              </section>
            ) : null}

            {canCheckpoint && snapshot.changesSinceCheckpoint.length > 0 ? (
              <section className={styles.changeList}>
                <div className={styles.listHeading}>
                  <h3>离开后发生的变化</h3>
                  <span>{snapshot.changesSinceCheckpoint.length}</span>
                </div>
                {snapshot.changesSinceCheckpoint.slice(0, 4).map((event) => (
                  <button type="button" key={event.id} onClick={() => onFocus(event.ref)}>
                    <Circle data-type={event.type} fill="currentColor" />
                    <span>{event.body}</span>
                    <time>{shortTime(event.createdAt)}</time>
                  </button>
                ))}
              </section>
            ) : null}

            {snapshot.attention.length > 0 && canCheckpoint ? (
              <section className={styles.attentionList}>
                <div className={styles.listHeading}>
                  <h3>现在先看这些</h3>
                  <span>{snapshot.attention.length}</span>
                </div>
                {snapshot.attention.map((item) => (
                  <button
                    type="button"
                    key={`${item.target.kind}:${item.target.id}`}
                    onClick={() =>
                      onFocus(
                        item.evidenceEventIds[0]
                          ? { kind: "event", id: item.evidenceEventIds[0] }
                          : item.target,
                      )
                    }
                  >
                    <Circle data-reason={item.reasonCode} fill="currentColor" />
                    <span>{item.reason}</span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </section>
            ) : null}

            {editingCheckpoint && canCheckpoint ? (
              <section className={styles.inlineForm} data-testid="checkpoint-form">
                <label>
                  <span>离开时的目标</span>
                  <input value={goal} onChange={(event) => setGoal(event.target.value)} />
                </label>
                <label>
                  <span>已经完成（逗号分隔）</span>
                  <input value={completedText} onChange={(event) => setCompletedText(event.target.value)} />
                </label>
                <label>
                  <span>尚未解决（逗号分隔）</span>
                  <input value={unresolvedText} onChange={(event) => setUnresolvedText(event.target.value)} />
                </label>
                <label>
                  <span>确认的下一步</span>
                  <input
                    value={checkpointNextStep}
                    onChange={(event) => setCheckpointNextStep(event.target.value)}
                    placeholder="例如：完成中央画布交互"
                  />
                </label>
                <button type="button" disabled={busy} onClick={saveCheckpoint}>
                  <Save size={15} />保存当前状态
                </button>
              </section>
            ) : null}

            {editingNextStep && canEditWork ? (
              <section className={styles.inlineForm} data-testid="next-step-form">
                <label>
                  <span>新的下一步</span>
                  <input
                    value={nextStep}
                    onChange={(event) => setNextStep(event.target.value)}
                    placeholder="输入可以立刻执行的一步"
                    autoFocus
                  />
                </label>
                <button type="button" disabled={busy} onClick={saveNextStep}>
                  <Check size={15} />写入时间线
                </button>
              </section>
            ) : null}

            {selfExecuting && canUpdateWork ? (
              <section className={styles.inlineForm} data-testid="self-execution-form">
                <label>
                  <span>负责人</span>
                  <input
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    placeholder="自己或 Agent 名称"
                  />
                </label>
                <label>
                  <span>执行后的状态</span>
                  <select value={workStatus} onChange={(event) => setWorkStatus(event.target.value as ActionStatus)}>
                    {ACTION_STATUSES.map((status) => (
                      <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                </label>
                {workStatus === "blocked" ? (
                  <label>
                    <span>为什么被阻塞</span>
                    <input value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} />
                  </label>
                ) : null}
                <button type="button" disabled={busy || !assignee.trim() || (workStatus === "blocked" && !blockedReason.trim())} onClick={saveWorkUpdate}>
                  <UserCheck size={15} />写入执行结果
                </button>
              </section>
            ) : null}

            {canComment ? (
              <section className={styles.inlineForm} data-testid="comment-form">
                <label>
                  <span>补充一条执行记录</span>
                  <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="记录进展、问题或判断" />
                </label>
                <button type="button" disabled={busy || !comment.trim()} onClick={saveComment}>
                  <MessageSquarePlus size={15} />写入时间线
                </button>
              </section>
            ) : null}

            {canCreateRelation && snapshot.focus.kind === "card" ? (
              <section className={styles.inlineForm} data-testid="relation-form">
                <label>
                  <span>关联另一条项目材料</span>
                  <select data-testid="relation-target" value={relationTargetId} onChange={(event) => setRelationTargetId(event.target.value)}>
                    <option value="">选择材料</option>
                    {projectCards.filter((card) => card.id !== snapshot.focus.id).map((card) => (
                      <option key={card.id} value={card.id}>{card.title || card.content.slice(0, 36)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>关系</span>
                  <select data-testid="relation-type" value={relationType} onChange={(event) => setRelationType(event.target.value as RelationType)}>
                    {RELATION_TYPES_P0.map((type) => (
                      <option key={type} value={type}>{RELATION_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>建立关系的原文依据</span>
                  <input data-testid="relation-evidence" value={relationEvidence} onChange={(event) => setRelationEvidence(event.target.value)} />
                </label>
                <button type="button" disabled={busy || !relationTargetId || !relationEvidence.trim()} onClick={saveRelation}>
                  <Link2 size={15} />建立关系
                </button>
              </section>
            ) : null}
          </>
        ) : null}

        {tab === "context" ? (
          <section className={styles.referenceList}>
            <div className={styles.listHeading}><h3>直接依据</h3></div>
            {snapshot.inspector.evidence.length === 0 ? (
              <p className={styles.emptyCopy}>当前对象没有直接依据。</p>
            ) : (
              snapshot.inspector.evidence.map((ref) => {
                const card = ref.kind === "card"
                  ? projectCards.find((item) => item.id === ref.id)
                  : undefined;
                return (
                  <button type="button" key={`${ref.kind}:${ref.id}`} onClick={() => onFocus(ref)}>
                    <FileText size={16} />
                    <span>
                      {card ? `项目材料 · 来源：${SOURCE_CLUSTER_LABELS[card.source]}` : "执行记录"}
                    </span>
                    <small>{card?.title || card?.content.slice(0, 28) || ref.id}</small>
                  </button>
                );
              })
            )}
            {onProposeMaterialRelations ? (
              <div style={{ padding: "6px 0 10px" }}>
                <button
                  type="button"
                  data-testid="propose-material-relations"
                  disabled={busy}
                  onClick={() => void onProposeMaterialRelations()}
                  title="仅在有依据时提议；无依据不瞎连"
                >
                  <Link2 size={15} />
                  提议材料关系
                </button>
                <p className={styles.emptyCopy} style={{ marginTop: 6 }}>
                  ≥3 份材料时，按正文/文件名依据提议；可确认或否决。
                </p>
              </div>
            ) : null}
            {relationEdges.length > 0 ? (
              <div className={styles.relationDetails} data-testid="relation-details">
                <div className={styles.listHeading}><h3>材料关系</h3><span>{relationEdges.length}</span></div>
                {relationEdges.map((edge) => (
                  <article key={edge.id} data-status={edge.status} data-testid={`relation-edge-${edge.id}`}>
                    <header><strong>{edge.label}</strong><span>{edge.status === "suggested" ? "待确认" : "已确认"}</span></header>
                    <p>{edge.evidenceSentence}</p>
                    {edge.status === "suggested" && edge.relationId ? (
                      <div>
                        <button
                          type="button"
                          data-testid={`relation-confirm-${edge.relationId}`}
                          disabled={busy}
                          onClick={() => onReviewRelation(edge.relationId!, "confirmed")}
                        >
                          确认关系
                        </button>
                        <button
                          type="button"
                          data-testid={`relation-reject-${edge.relationId}`}
                          disabled={busy}
                          onClick={() => onReviewRelation(edge.relationId!, "rejected")}
                        >
                          否决关系
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "tasks" ? (
          <section className={styles.referenceList}>
            <div className={styles.listHeading}><h3>受影响对象</h3></div>
            {snapshot.inspector.impacts.map((ref) => (
              <button type="button" key={`${ref.kind}:${ref.id}`} onClick={() => onFocus(ref)}>
                <ArrowRight size={16} />
                <span>{ref.kind === "work_item" ? "工作项" : "项目对象"}</span>
                <small>{ref.id}</small>
              </button>
            ))}
          </section>
        ) : null}

        {tab === "activity" ? (
          <section className={styles.activityFeed} data-testid="inspector-activity">
            {/* E7: eight-step process (data-backed, not decorative). */}
            <div
              className={styles.agentProcessBlock}
              data-testid="inspector-agent-process-activity"
              data-has-agent={
                snapshot.agentActivity?.hasAgentEvents ||
                (agentSession?.toolReceipts?.length ?? 0) > 0
                  ? "true"
                  : "false"
              }
            >
              <div className={styles.listHeading}>
                <h3>Agent 在做什么</h3>
                <span>{snapshot.agentActivity?.steps.length ?? 8}</span>
              </div>
              <p className={styles.agentProcessCaption} data-testid="inspector-agent-caption">
                {agentSession?.run?.progressSummary ||
                  snapshot.agentActivity?.caption ||
                  "还没有 Agent 执行记录；授权或跑 Agent 后，步骤会跟着推进。"}
              </p>
              <ol className={styles.agentProcessSteps}>
                {(snapshot.agentActivity?.steps ?? []).map((step) => (
                  <li
                    key={step.id}
                    data-step={step.id}
                    data-status={step.status}
                    data-active={step.status === "active" ? "true" : "false"}
                  >
                    <span className={styles.agentProcessDot} aria-hidden="true" />
                    <span>
                      <strong>{step.title}</strong>
                      <small>
                        {step.status === "done"
                          ? "已完成"
                          : step.status === "active"
                            ? "进行中"
                            : "未开始"}
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div
              className={styles.agentFeedBlock}
              data-testid="inspector-agent-feed"
            >
              <div className={styles.listHeading}>
                <h3>Live Feed</h3>
                <span>
                  {(agentSession?.toolReceipts?.length ?? 0) +
                    (snapshot.agentActivity?.feed.length ?? 0)}
                </span>
              </div>
              {(agentSession?.toolReceipts?.length ?? 0) > 0 ? (
                <ul className={styles.liveFeedList} data-testid="inspector-live-tool-feed">
                  {[...(agentSession?.toolReceipts ?? [])]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((r) => (
                      <li key={`tool-${r.sequence}-${r.tool}`}>
                        <Bot size={14} aria-hidden="true" />
                        <span>
                          <strong>{r.tool}</strong>
                          <small>{r.summary}</small>
                        </span>
                      </li>
                    ))}
                </ul>
              ) : null}
              {(snapshot.agentActivity?.feed.length ?? 0) === 0 &&
              (agentSession?.toolReceipts?.length ?? 0) === 0 ? (
                <p className={styles.emptyCopy} data-testid="inspector-agent-feed-empty">
                  还没有 Agent 执行记录。授权夹后点 AI Copilot，或对工作项点「交给 Agent」。
                </p>
              ) : (
                (snapshot.agentActivity?.feed ?? []).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    data-testid={`agent-feed-${item.id}`}
                    onClick={() => onFocus(item.ref)}
                  >
                    <Bot size={14} aria-hidden="true" />
                    <span>
                      <strong>{item.actorLabel}</strong>
                      <small>{item.body}</small>
                    </span>
                    <time>{shortTime(item.createdAt)}</time>
                  </button>
                ))
              )}
            </div>

            <div className={styles.listHeading}>
              <h3>全部执行记录</h3>
              <span>{activity.length}</span>
            </div>
            {activity.length === 0 ? (
              <p className={styles.emptyCopy}>当前焦点下没有时间记录。</p>
            ) : (
              activity.map((event) => (
                <button type="button" key={event.id} onClick={() => onFocus(event.ref)}>
                  <Circle data-type={event.type} fill="currentColor" />
                  <span>
                    <strong>{actorLabel(event.actor)}</strong>
                    <small>{event.body}</small>
                    {event.review ? (
                      <em className={styles.reviewSummary}>
                        {event.review.mode === "model" ? "真实模型" : "确定性模式"}
                        {` · 判断：${event.review.judgment}`}
                        {event.review.gaps.length > 0
                          ? ` · 缺口：${event.review.gaps.join("；")}`
                          : ""}
                        {` · 下一步：${event.review.nextStep} · 引用 ${event.review.evidenceIds.length} 条依据`}
                      </em>
                    ) : null}
                  </span>
                  <time>{shortTime(event.createdAt)}</time>
                </button>
              ))
            )}
          </section>
        ) : null}
      </div>

      <footer className={styles.inspectorActions}>
        {canCheckpoint ? (
          <button type="button" onClick={() => setEditingCheckpoint((value) => !value)}>
            <Clock3 size={16} />确认当前状态
          </button>
        ) : null}
        {canEditWork ? (
          <>
            {canUpdateWork ? (
              <button type="button" onClick={() => setSelfExecuting((value) => !value)}>
                <UserCheck size={16} />自己执行
              </button>
            ) : null}
            <button type="button" onClick={() => setEditingNextStep((value) => !value)}>
              <Save size={16} />修改下一步
            </button>
            {canRunAgent ? <button
              type="button"
              className={styles.primaryAction}
              data-testid="run-agent"
              disabled={busy}
              onClick={onRunAgent}
            >
              <Bot size={16} />交给 Agent
            </button> : null}
          </>
        ) : null}
      </footer>
    </aside>
  );
}
