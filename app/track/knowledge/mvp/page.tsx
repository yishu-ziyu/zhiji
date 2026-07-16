"use client";

import {
  ArrowRight,
  Bot,
  ChevronRight,
  CircleDot,
  FolderGit2,
  LayoutGrid,
  MessageCircleQuestion,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentProcessPanel } from "./components/AgentProcessPanel";
import { InitialUnderstandingLead } from "./components/InitialUnderstandingLead";
import { MatterFocusCanvas, type FocusNode } from "./components/MatterFocusCanvas";
import { RevisionViewer } from "./components/RevisionViewer";
import { SourceGrantPanel } from "./components/SourceGrantPanel";
import { StateReconstructionPanel } from "./components/StateReconstructionPanel";
import { UnderstandingReviewCard } from "./components/UnderstandingReviewCard";
import {
  createMvpApi,
  type Matter,
  type MemoryResponse,
  type MvpBootstrap,
  type RecentConnectionResponse,
  type RevisionResponse,
  type SourceGrant,
  type UnderstandingBody,
  type WatchSetUpdate,
} from "./lib/api";
import {
  resolveProcessStatuses,
  type AgentPipelinePhase,
} from "./lib/agent-process";
import { eventIdsForMatterAnalysis } from "./lib/event-revision-open";
import {
  DEFAULT_PERMISSION_COPY,
  connectPayloadForContinue,
  connectPayloadForNewSelection,
  fixtureModeFromSearch,
  folderNameFromPath,
  matchedEventIdsFromBootstrap,
  shouldRunInitialAnalysis,
  phaseAfterPickerCancel,
  phaseAfterPickerSelected,
  type FolderSelection,
  type OnboardingPhase,
} from "./lib/onboarding-folder-choice";
import styles from "./mvp-workbench.module.css";

type AdapterMode = "contract-fixture" | "http";
type RecentConnection = NonNullable<RecentConnectionResponse["connection"]>;

export default function MvpKnowledgeWorkbenchPage() {
  const [adapterMode, setAdapterMode] = useState<AdapterMode>("http");
  const isFixture = adapterMode === "contract-fixture";
  const [api, setApi] = useState(() => createMvpApi("http"));
  const [modeReady, setModeReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [grant, setGrant] = useState<SourceGrant | null>(null);
  const [matter, setMatter] = useState<Matter | null>(null);
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [projectId, setProjectId] = useState("");
  const [matterId, setMatterId] = useState("");
  const [focusId, setFocusId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<RevisionResponse | null>(null);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [resolutionMessage, setResolutionMessage] = useState<string | null>(null);
  const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>("entry");
  const [recentConnection, setRecentConnection] = useState<RecentConnection | null>(null);
  const [pendingSelection, setPendingSelection] = useState<FolderSelection | null>(null);
  /** Live phase while first-use pipeline runs; null when idle (derive from memory). */
  const [pipelinePhase, setPipelinePhase] = useState<AgentPipelinePhase | null>(null);
  const [progressFolderName, setProgressFolderName] = useState<string>("");

  useEffect(() => {
    const search = new URL(window.location.href).searchParams;
    const nextMode: AdapterMode = fixtureModeFromSearch(search)
      ? "contract-fixture"
      : "http";
    queueMicrotask(() => {
      setAdapterMode(nextMode);
      setApi(createMvpApi(nextMode));
      setModeReady(true);
    });
  }, []);

  const loadMemory = useCallback(async (nextProjectId = projectId, nextMatterId = matterId) => {
    if (!nextProjectId || !nextMatterId) return;
    const nextMemory = await api.getMemory(nextProjectId, nextMatterId);
    setMemory(nextMemory);
    setMatter(nextMemory.matter);
  }, [api, matterId, projectId]);

  useEffect(() => {
    if (!modeReady || isFixture || connected) return;
    let cancelled = false;
    void api
      .getRecentConnection()
      .then((connection) => {
        if (cancelled) return;
        setRecentConnection(connection);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "读取最近连接失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, connected, isFixture, modeReady]);

  /**
   * First-use chain maps onto the Owner-visible 8-step Agent process.
   * Progress advances only after each real API returns - never a timer fake.
   */
  async function runFirstUsePipeline(options: {
    kind: "fresh" | "continue";
    body: ReturnType<typeof connectPayloadForNewSelection> | ReturnType<typeof connectPayloadForContinue>;
    folderHint?: string;
    successNotice: string;
  }) {
    setPipelinePhase("observe");
    setProgressFolderName(options.folderHint || "");
    const bootstrap: MvpBootstrap = await api.connectConnection(options.body);
    const resolvedProjectId = bootstrap.projectId;
    const resolvedMatterId = bootstrap.matter.id;
    const folderLabel =
      bootstrap.folderName ||
      options.folderHint ||
      folderNameFromPath(bootstrap.grant.rootPath);
    setProgressFolderName(folderLabel);
    setGrant(bootstrap.grant);
    setMatter(bootstrap.matter);
    setProjectId(resolvedProjectId);
    setMatterId(resolvedMatterId);

    // Prefer server bootstrap matched ids (backend already reconciled on connect).
    let eventIds = matchedEventIdsFromBootstrap(bootstrap);

    setPipelinePhase("map");
    if (eventIds.length === 0) {
      const reconciled = await api.reconcileGrant(
        resolvedProjectId,
        bootstrap.grant.id,
      );
      eventIds = matchedEventIdsFromBootstrap({
        matchedEventIds: reconciled.matchedEventIds,
        eventIds: reconciled.eventIds,
        events: reconciled.events,
      });
    }

    let nextMemory = await api.getMemory(resolvedProjectId, resolvedMatterId);

    // Only call analysis when memory has no accepted/candidate yet.
    if (shouldRunInitialAnalysis(nextMemory)) {
      if (eventIds.length === 0) {
        eventIds = eventIdsForMatterAnalysis(nextMemory);
      }
      setPipelinePhase("tools");
      await api.runAnalysis(resolvedProjectId, resolvedMatterId, eventIds);
      setPipelinePhase("candidate");
      nextMemory = await api.getMemory(resolvedProjectId, resolvedMatterId);
    }

    setMemory(nextMemory);
    setFocusId(resolvedMatterId);
    setConnected(true);
    setPendingSelection(null);
    setOnboardingPhase("entry");
    setPipelinePhase(null);
    setNotice(options.successNotice);
  }

  const processView = useMemo(
    () =>
      resolveProcessStatuses({
        pipelinePhase,
        memory,
        connected,
      }),
    [pipelinePhase, memory, connected],
  );

  async function chooseProjectFolder() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.openFolderPicker();
      if ("cancelled" in result && result.cancelled) {
        setPendingSelection(null);
        setOnboardingPhase(phaseAfterPickerCancel());
        setNotice(null);
        return;
      }
      if (!("selectionId" in result) || !result.selectionId) {
        throw new Error("文件夹选择未返回有效 selectionId");
      }
      setPendingSelection({
        selectionId: result.selectionId,
        folderName: result.folderName || folderNameFromPath(result.rootPath),
        rootPath: result.rootPath,
        permissionBoundary: result.permissionBoundary || result.rootPath,
      });
      setOnboardingPhase(phaseAfterPickerSelected());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "打开文件夹选择失败");
    } finally {
      setBusy(false);
    }
  }

  async function connectWithSelection() {
    if (!pendingSelection) return;
    setBusy(true);
    setError(null);
    try {
      await runFirstUsePipeline({
        kind: "fresh",
        body: connectPayloadForNewSelection(pendingSelection.selectionId),
        folderHint: pendingSelection.folderName,
        successNotice: isFixture
          ? "演示数据已就绪，可以开始看理解。"
          : "已接上项目。请看右侧「下一步」，确认这段理解是否对。",
      });
    } catch (nextError) {
      setPipelinePhase(null);
      setError(nextError instanceof Error ? nextError.message : "接不上，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function continueRecent() {
    if (!recentConnection) return;
    setBusy(true);
    setError(null);
    try {
      await runFirstUsePipeline({
        kind: "continue",
        body: connectPayloadForContinue(recentConnection),
        folderHint: recentConnection.folderName,
        successNotice: "已回到上次项目。",
      });
    } catch (nextError) {
      setPipelinePhase(null);
      setError(nextError instanceof Error ? nextError.message : "接不上上次项目");
    } finally {
      setBusy(false);
    }
  }

  function cancelSelectionReview() {
    setPendingSelection(null);
    setOnboardingPhase(phaseAfterPickerCancel());
    setNotice(null);
    setError(null);
  }

  async function runAnalysis() {
    if (!memory || !grant) return;
    setBusy(true);
    setError(null);
    setResolutionMessage(null);
    try {
      // 真的再读磁盘：先对账，再决定是否重建。禁止「用旧事件复述 + 假成功」。
      setPipelinePhase("map");
      await api.reconcileGrant(projectId, grant.id);
      const afterReconcile = await api.getMemory(projectId, matterId);
      setMemory(afterReconcile);
      setMatter(afterReconcile.matter);

      const eventIds = eventIdsForMatterAnalysis(afterReconcile);
      if (eventIds.length === 0) {
        setPipelinePhase(null);
        setNotice(
          "没发现可核对的文件变化。只新建空文件夹不会记成变化；放入或修改文件后再试。",
        );
        return;
      }

      setPipelinePhase("reason");
      await api.runAnalysis(projectId, matterId, eventIds);
      await loadMemory();
      setPipelinePhase(null);
      setNotice("已根据文件夹里的文件变化更新理解，请你确认是否准确。");
    } catch (nextError) {
      setPipelinePhase(null);
      setError(nextError instanceof Error ? nextError.message : "再读失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveWatchSet(input: WatchSetUpdate) {
    if (!memory) return;
    setBusy(true);
    try {
      const watchSet = await api.updateWatchSet(projectId, matterId, input);
      setMemory((current) => (current ? { ...current, watchSet } : current));
      setNotice("关注范围已更新。");
    } finally {
      setBusy(false);
    }
  }

  async function stopWatch() {
    await saveWatchSet({
      grantId: memory?.watchSet.grantId || "",
      includePathPrefixes: memory?.watchSet.includePathPrefixes || [],
      excludePathPrefixes: memory?.watchSet.excludePathPrefixes || [],
      status: "disabled",
    });
    setNotice("已暂停关注。之前看过的内容仍可打开。");
  }

  async function openRevision(revisionId: string) {
    setRevisionLoading(true);
    setRevision(null);
    try {
      setRevision(await api.getRevision(projectId, revisionId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "版本读取失败");
    } finally {
      setRevisionLoading(false);
    }
  }

  async function resolveCandidate(
    decision: "accept" | "edit_accept" | "reject",
    editedBody?: UnderstandingBody,
  ) {
    if (!memory?.candidate) return;
    setBusy(true);
    try {
      const result = await api.resolveCandidate(
        projectId,
        matterId,
        memory.candidate.id,
        decision,
        editedBody,
      );
      await loadMemory();
      if (decision === "reject") {
        setResolutionMessage("已放下这段理解。需要时可以再生成。");
      } else if (result.accepted || decision === "accept" || decision === "edit_accept") {
        setResolutionMessage("已确认。当前理解已按你的决定更新。");
      } else {
        setResolutionMessage("已记下你的决定。");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "没能记下你的决定");
    } finally {
      setBusy(false);
    }
  }

  function focusNode(node: FocusNode) {
    setFocusId(node.id);
    const url = new URL(window.location.href);
    url.searchParams.set("focus", node.id);
    window.history.pushState(
      { focus: node.id },
      "",
      `${url.pathname}?${url.searchParams.toString()}`,
    );
  }

  const projectLabel = grant
    ? folderNameFromPath(grant.rootPath)
    : matter?.title || "项目";

  if (!connected || !grant || !matter || !memory) {
    const showReview = onboardingPhase === "review" && pendingSelection;
    const showPipeline = pipelinePhase !== null;
    return (
      <main className={`${styles.shell} ${styles.shellEntry}`}>
        <section className={styles.onboarding} aria-label="选择本地项目">
          <div className={styles.onboardingBody}>
            <span className={styles.onboardingIcon} aria-hidden>
              <FolderGit2 size={28} />
            </span>
            <h1>选一个本地项目</h1>
            <p>只读你授权的文件夹，帮你看清现在怎样。</p>

            {showPipeline && (
              <AgentProcessPanel
                statuses={processView.statuses}
                active={processView.active}
                caption={processView.caption}
                folderName={progressFolderName}
                compact
              />
            )}

            {!showPipeline && showReview ? (
              <div className={styles.folderChoiceCard} data-testid="folder-selection-review">
                <span className={styles.stripLabel}>已选</span>
                <strong>{pendingSelection.folderName}</strong>
                <code>{pendingSelection.rootPath}</code>
                <p className={styles.permissionCopy}>{DEFAULT_PERMISSION_COPY}</p>
                <div className={styles.choiceActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={cancelSelectionReview}
                    disabled={busy}
                  >
                    取消
                  </button>
                  <button
                    className={styles.primaryButtonLarge}
                    type="button"
                    onClick={() => void connectWithSelection()}
                    disabled={busy}
                  >
                    {busy ? "接上中…" : "用这个文件夹"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : !showPipeline ? (
              <div className={styles.folderChoiceActions} data-testid="folder-choice-entry">
                {recentConnection && !isFixture && (
                  <div className={styles.folderChoiceCard} data-testid="recent-connection">
                    <span className={styles.stripLabel}>上次</span>
                    <strong>{recentConnection.folderName}</strong>
                    <code>{recentConnection.rootPath}</code>
                    <button
                      className={styles.primaryButtonLarge}
                      type="button"
                      onClick={() => void continueRecent()}
                      disabled={busy}
                    >
                      {busy ? "连接中…" : "继续上次"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}
                <button
                  className={styles.primaryButtonLarge}
                  type="button"
                  onClick={() => void chooseProjectFolder()}
                  disabled={busy}
                  data-testid="choose-project-folder"
                >
                  {busy ? "打开中…" : isFixture ? "用演示文件夹" : "选择项目文件夹"}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : null}

            {isFixture && (
              <span className={styles.fixtureNote}>演示数据，不会写入真实项目记忆。</span>
            )}
            {error && <div className={styles.errorBanner}>{error}</div>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.rail} aria-label="导航">
        <div className={styles.windowDots}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.profileRow}>
          <span className={styles.avatar}>
            <Bot size={18} />
          </span>
          <div>
            <strong>项目理解</strong>
            <small>回到现状</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className={styles.railSection}>
          <span className={styles.railLabel}>项目</span>
          <button className={styles.projectButton} type="button">
            <CircleDot size={14} />
            {projectLabel}
          </button>
        </div>
        <div className={styles.railSection}>
          <span className={styles.railLabel}>现在</span>
          <div className={styles.railItemActive}>
            <LayoutGrid size={15} />
            当前理解
          </div>
          <div className={styles.railItem}>
            <Search size={15} />
            依据
          </div>
          <div className={styles.railItem}>
            <MessageCircleQuestion size={15} />
            细节
          </div>
        </div>
        <div className={styles.railBottom}>
          <span className={styles.statusLight} />
          只读你授权的文件夹
        </div>
      </aside>
      <section className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>{projectLabel}</span>
            <ChevronRight size={13} />
            <strong>{matter.title}</strong>
          </div>
          <div className={styles.topActions}>
            <button
              className={styles.iconButton}
              type="button"
              onClick={() => void loadMemory()}
              aria-label="刷新"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        <div className={styles.pageIntro}>
          <div>
            <span className={styles.kicker}>
              <Sparkles size={13} />
              正在推进
            </span>
            <h1>{matter.title}</h1>
            <p>{matter.goal}</p>
          </div>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={busy}
            onClick={() => void runAnalysis()}
          >
            <Sparkles size={14} />
            再读一遍变化
          </button>
        </div>
        <div className={styles.scrollArea}>
          <AgentProcessPanel
            statuses={processView.statuses}
            active={processView.active}
            caption={processView.caption}
            folderName={projectLabel}
          />
          <InitialUnderstandingLead
            memory={memory}
            onOpenRevision={(revisionId) => void openRevision(revisionId)}
          />
          <MatterFocusCanvas
            memory={memory}
            focusId={focusId}
            onFocus={focusNode}
            onOpenRevision={(revisionId) => void openRevision(revisionId)}
          />
          <SourceGrantPanel
            key={`${memory.watchSet.updatedAt}-${memory.watchSet.status}`}
            grant={grant}
            watchSet={memory.watchSet}
            filteredCount={memory.filteredEvents.length}
            onSave={saveWatchSet}
            onStop={stopWatch}
          />
        </div>
      </section>
      <aside className={styles.inspector} aria-label="理解与下一步">
        <div className={styles.inspectorScroll}>
          <UnderstandingReviewCard
            candidate={memory.candidate}
            accepted={memory.accepted}
            onResolve={resolveCandidate}
            resolutionMessage={resolutionMessage}
          />
          <StateReconstructionPanel
            memory={memory}
            onOpenRevision={(revisionId) => void openRevision(revisionId)}
          />
          <div className={styles.inspectorFooter}>
            <ShieldCheck size={13} />
            <span>最终由你确认。Agent 不会替你拍板。</span>
          </div>
        </div>
      </aside>
      <footer className={styles.footer}>
        <span>
          <span className={styles.statusLight} />
          {projectLabel}
        </span>
        <span>
          {memory.candidate
            ? "有一段理解待你确认"
            : memory.accepted
              ? "理解已确认"
              : "还在准备理解"}
        </span>
        <span>
          {processView.active === "owner"
            ? "请你确认右侧理解"
            : processView.active === "persist" &&
                processView.statuses.persist === "done"
              ? "已就绪"
              : processView.caption}
        </span>
      </footer>
      {notice && (
        <button className={styles.toast} type="button" onClick={() => setNotice(null)}>
          {notice}
        </button>
      )}
      {error && (
        <button
          className={`${styles.toast} ${styles.toastError}`}
          type="button"
          onClick={() => setError(null)}
        >
          {error}
        </button>
      )}
      <RevisionViewer
        revision={revision}
        loading={revisionLoading}
        onClose={() => setRevision(null)}
      />
    </main>
  );
}
