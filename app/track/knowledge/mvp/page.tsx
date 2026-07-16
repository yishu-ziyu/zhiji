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
import { useCallback, useEffect, useState } from "react";
import { FirstUseProgress } from "./components/FirstUseProgress";
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
  type FirstUseProgressStep,
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
  const [progressStep, setProgressStep] = useState<FirstUseProgressStep | null>(null);
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
   * First-use chain: authorize → reconcile → reconstruct (only if needed).
   * Progress advances only after each real API returns — never a timer fake.
   * - Consume bootstrap matchedEventIds/eventIds from backend connect.
   * - Fresh: if no accepted/candidate, analysis with matched ids → await candidate → reload.
   * - Continue with existing accepted/candidate: enter workbench immediately.
   */
  async function runFirstUsePipeline(options: {
    kind: "fresh" | "continue";
    body: ReturnType<typeof connectPayloadForNewSelection> | ReturnType<typeof connectPayloadForContinue>;
    folderHint?: string;
    successNotice: string;
  }) {
    setProgressStep("authorize");
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

    setProgressStep("reconcile");
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
      setProgressStep("reconstruct");
      await api.runAnalysis(resolvedProjectId, resolvedMatterId, eventIds);
      nextMemory = await api.getMemory(resolvedProjectId, resolvedMatterId);
    }

    setMemory(nextMemory);
    setFocusId(resolvedMatterId);
    setConnected(true);
    setPendingSelection(null);
    setOnboardingPhase("entry");
    setProgressStep(null);
    setNotice(options.successNotice);
  }

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
          ? "已连接显式 contract fixture，并生成有依据的 candidate 理解。"
          : "已授权文件夹并完成对账与状态重建；请审阅当前理解与未知项。",
      });
    } catch (nextError) {
      setProgressStep(null);
      setError(nextError instanceof Error ? nextError.message : "连接失败");
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
        successNotice: "已继续上次项目；先展示已有理解，仅在需要时重建。",
      });
    } catch (nextError) {
      setProgressStep(null);
      setError(nextError instanceof Error ? nextError.message : "继续连接失败");
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
    if (!memory) return;
    setBusy(true);
    setError(null);
    try {
      const eventIds = eventIdsForMatterAnalysis(memory);
      await api.runAnalysis(projectId, matterId, eventIds);
      await loadMemory();
      setNotice("已按匹配变化运行一次状态重建；结果仍是 candidate。");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "状态重建失败");
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
      setNotice("当前 matter 的 watch set 已更新；未匹配变化不会进入中心。");
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
    setNotice("watch 已停止；历史 revision 保持可读。");
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
        setResolutionMessage(
          `已写入 Owner resolution：reject。candidate ${result.resolution.candidateRevisionId} 保持不变。`,
        );
      } else {
        setResolutionMessage(
          `已新建 accepted revision ${result.accepted?.id}；candidate ${result.resolution.candidateRevisionId} 未被原地改写。`,
        );
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Owner 决议失败");
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
    const showProgress = progressStep !== null;
    return (
      <main className={styles.shell}>
        <aside className={styles.rail} aria-label="MVP 知识工作台导航">
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
              <strong>知识工作台</strong>
              <small>Owner 视角</small>
            </div>
            <ChevronRight size={15} />
          </div>
          <div className={styles.railSection}>
            <span className={styles.railLabel}>MVP-V0</span>
            <div className={styles.railItemActive}>
              <LayoutGrid size={15} />
              非线性工作台
            </div>
          </div>
          <div className={styles.railSection}>
            <span className={styles.railLabel}>状态</span>
            <div className={styles.railItem}>
              <ShieldCheck size={15} />
              {showProgress ? "正在建立理解" : "等待选择本地项目"}
            </div>
          </div>
        </aside>
        <section className={styles.onboarding}>
          <div className={styles.onboardingTop}>
            <span className={styles.readOnly}>
              <span />
              Task 5 · {isFixture ? "explicit fixture" : "HTTP adapter"}
            </span>
            <span>Owner 授权 · 不扫全机</span>
          </div>
          <div className={styles.onboardingBody}>
            <span className={styles.onboardingIcon}>
              <FolderGit2 size={25} />
            </span>
            <span className={styles.kicker}>
              <ShieldCheck size={13} />
              Owner 明确授权
            </span>
            <h1>选择一个本地项目，开始重建当前理解</h1>
            <p>
              你只负责指出授权文件夹；Agent 在边界内对账与重建有依据的当前理解。不需要项目 UUID、绝对路径语法或关注路径前缀。
            </p>
            <div className={styles.promiseList}>
              <div>
                <span>01</span>
                <strong>授权边界</strong>
                <small>Continue 或系统文件夹选择；仅所选目录可读。</small>
              </div>
              <div>
                <span>02</span>
                <strong>真实进度</strong>
                <small>授权 → 对账 → 重建，每步跟真实接口，不用假计时。</small>
              </div>
              <div>
                <span>03</span>
                <strong>理解优先</strong>
                <small>先看有依据的现状与明确未知；Owner 只纠正/确认。</small>
              </div>
            </div>

            {showProgress && progressStep && (
              <FirstUseProgress step={progressStep} folderName={progressFolderName} />
            )}

            {!showProgress && showReview ? (
              <div className={styles.folderChoiceCard} data-testid="folder-selection-review">
                <span className={styles.stripLabel}>已选文件夹</span>
                <strong>{pendingSelection.folderName}</strong>
                <code>{pendingSelection.rootPath}</code>
                <p className={styles.permissionCopy}>{DEFAULT_PERMISSION_COPY}</p>
                <small>授权边界：{pendingSelection.permissionBoundary}</small>
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
                    <FolderGit2 size={17} />
                    {busy ? "连接中…" : "连接"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : !showProgress ? (
              <div className={styles.folderChoiceActions} data-testid="folder-choice-entry">
                {recentConnection && !isFixture && (
                  <div className={styles.folderChoiceCard} data-testid="recent-connection">
                    <span className={styles.stripLabel}>最近项目</span>
                    <strong>{recentConnection.folderName}</strong>
                    <code>{recentConnection.rootPath}</code>
                    <button
                      className={styles.primaryButtonLarge}
                      type="button"
                      onClick={() => void continueRecent()}
                      disabled={busy}
                    >
                      <FolderGit2 size={17} />
                      {busy ? "连接中…" : "继续"}
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
                  <FolderGit2 size={17} />
                  {busy
                    ? "打开中…"
                    : isFixture
                      ? "选择显式 fixture 文件夹"
                      : "选择项目文件夹"}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : null}

            <span className={styles.fixtureNote}>
              {isFixture
                ? "仅 ?fixture=1 启用；fixture 不作为生产事实或持久化真相。"
                : "默认路径为真实 HTTP API；后端负责 native picker、source grant 与默认 matter/watch。"}
            </span>
            {error && <div className={styles.errorBanner}>{error}</div>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.rail} aria-label="MVP 知识工作台导航">
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
            <strong>知识工作台</strong>
            <small>Owner 视角</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className={styles.railSection}>
          <span className={styles.railLabel}>项目</span>
          <button className={styles.projectButton} type="button">
            <CircleDot size={14} />
            {projectLabel} <small>MVP</small>
          </button>
        </div>
        <div className={styles.railSection}>
          <span className={styles.railLabel}>工作对象</span>
          <div className={styles.railItemActive}>
            <LayoutGrid size={15} />
            一件事项
          </div>
          <div className={styles.railItem}>
            <Search size={15} />
            来源与依据
          </div>
          <div className={styles.railItem}>
            <MessageCircleQuestion size={15} />
            六问重建
          </div>
        </div>
        <div className={styles.railBottom}>
          <span className={styles.statusLight} />
          {isFixture ? "explicit fixture" : "HTTP adapter"}
          <br />
          <small>{isFixture ? "test switch only" : "persisted API"}</small>
        </div>
      </aside>
      <section className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>项目</span>
            <ChevronRight size={13} />
            <span>{projectLabel}</span>
            <ChevronRight size={13} />
            <strong>{matter.title}</strong>
          </div>
          <div className={styles.topActions}>
            <span className={styles.readOnly}>
              <span />
              {isFixture ? "只读 explicit fixture" : "只读 HTTP memory"}
            </span>
            <button
              className={styles.iconButton}
              type="button"
              onClick={() => void loadMemory()}
              aria-label="刷新 memory"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        <div className={styles.pageIntro}>
          <div>
            <span className={styles.kicker}>
              <Sparkles size={13} />
              当前事项
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
            运行一次状态重建
          </button>
        </div>
        <div className={styles.scrollArea}>
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
      <aside className={styles.inspector} aria-label="事项状态与 Owner 决议">
        <div className={styles.inspectorScroll}>
          <StateReconstructionPanel
            memory={memory}
            onOpenRevision={(revisionId) => void openRevision(revisionId)}
          />
          <UnderstandingReviewCard
            candidate={memory.candidate}
            accepted={memory.accepted}
            onResolve={resolveCandidate}
            resolutionMessage={resolutionMessage}
          />
          <div className={styles.inspectorFooter}>
            <ShieldCheck size={13} />
            <span>所有决议都通过 OwnerDecisionWriter 边界；Agent 不能自我确认。</span>
          </div>
        </div>
      </aside>
      <footer className={styles.footer}>
        <span>
          <span className={styles.statusLight} />
          事项：{matter.title}
        </span>
        <span>focus：{focusId === matter.id ? "matter" : "one-hop relation"}</span>
        <span>accepted：{memory.head.acceptedRevisionId || "none"}</span>
        <span>review：{memory.head.reviewState}</span>
        <span>{isFixture ? "fixture=1" : "HTTP persisted"}</span>
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
