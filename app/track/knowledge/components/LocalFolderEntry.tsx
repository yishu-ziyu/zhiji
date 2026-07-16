"use client";

import { FileText, Folder, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentProcessPanel } from "./AgentProcessPanel";
import { EntryPreview } from "./EntryPreview";
import {
  createMvpApi,
  type AgentToolReceiptSummary,
  type RecentConnectionResponse,
} from "../lib/folder-connection-api";
import {
  resolveProcessStatuses,
  type AgentPipelinePhase,
} from "../lib/agent-process";
import {
  DEFAULT_PERMISSION_COPY,
  connectPayloadForContinue,
  connectPayloadForNewSelection,
  fixtureModeFromSearch,
  folderNameFromPath,
  matchedEventIdsFromBootstrap,
  phaseAfterPickerCancel,
  phaseAfterPickerSelected,
  shouldRunInitialAnalysis,
  type FolderSelection,
  type OnboardingPhase,
} from "../lib/onboarding-folder-choice";
import { eventIdsForMatterAnalysis } from "../lib/event-revision-open";
import type { Project } from "@/shared/types/knowledge";
import styles from "../workbench-entry.module.css";

type RecentConnection = NonNullable<RecentConnectionResponse["connection"]>;

export type FolderAuthorizeSession = {
  matterId: string;
  grantId: string;
  folderName: string;
  memory: import("../lib/folder-connection-api").MemoryResponse | null;
  toolReceipts: import("../lib/folder-connection-api").AgentToolReceiptSummary[];
  run?: {
    id?: string;
    status?: string;
    progressSummary?: string;
  } | null;
};

type Props = {
  /** After folder connect + knowledge ensure, enter this project in the workbench. */
  onAuthorized: (
    project: Project,
    session?: FolderAuthorizeSession,
  ) => void | Promise<void>;
  /** Optional: surface errors to parent toast. */
  onError?: (message: string) => void;
};

/**
 * Value-first entry + local folder authorize (MVP business path)
 * embedded in the unified knowledge workbench shell.
 */
export function LocalFolderEntry({ onAuthorized, onError }: Props) {
  const [api] = useState(() => {
    if (typeof window === "undefined") return createMvpApi("http");
    const search = new URL(window.location.href).searchParams;
    return createMvpApi(fixtureModeFromSearch(search) ? "contract-fixture" : "http");
  });
  const isFixture =
    typeof window !== "undefined" &&
    fixtureModeFromSearch(new URL(window.location.href).searchParams);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingPhase, setOnboardingPhase] = useState<OnboardingPhase>("entry");
  const [pendingSelection, setPendingSelection] = useState<FolderSelection | null>(null);
  const [recentConnection, setRecentConnection] = useState<RecentConnection | null>(null);
  const [pipelinePhase, setPipelinePhase] = useState<AgentPipelinePhase | null>(null);
  const [progressFolderName, setProgressFolderName] = useState("");
  const [toolReceipts, setToolReceipts] = useState<AgentToolReceiptSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api
      .getRecentConnection()
      .then((c) => {
        if (!cancelled) setRecentConnection(c);
      })
      .catch(() => {
        /* empty workbench still ok without recent */
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const [liveRun, setLiveRun] = useState<{
    id?: string;
    status?: string;
    progressSummary?: string;
  } | null>(null);

  const processView = useMemo(
    () =>
      resolveProcessStatuses({
        pipelinePhase,
        memory: null,
        connected: false,
        run: liveRun,
        toolNames: toolReceipts.map((r) => r.tool),
      }),
    [pipelinePhase, liveRun, toolReceipts],
  );

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError],
  );

  async function runPipeline(options: {
    kind: "fresh" | "continue";
    body: ReturnType<typeof connectPayloadForNewSelection> | ReturnType<typeof connectPayloadForContinue>;
    folderHint?: string;
  }) {
    setPipelinePhase("observe");
    setProgressFolderName(options.folderHint || "");
    setToolReceipts([]);
    setLiveRun(null);
    const bootstrap = await api.connectConnection(options.body);
    const folderLabel =
      bootstrap.folderName ||
      options.folderHint ||
      folderNameFromPath(bootstrap.grant.rootPath);
    setProgressFolderName(folderLabel);
    setPipelinePhase("map");

    let eventIds = matchedEventIdsFromBootstrap(bootstrap);
    if (eventIds.length === 0) {
      const reconciled = await api.reconcileGrant(
        bootstrap.projectId,
        bootstrap.grant.id,
      );
      eventIds = matchedEventIdsFromBootstrap({
        matchedEventIds: reconciled.matchedEventIds,
        eventIds: reconciled.eventIds,
        events: reconciled.events,
      });
    }

    let nextMemory = await api.getMemory(bootstrap.projectId, bootstrap.matter.id);
    let analysisRun: FolderAuthorizeSession["run"] = null;
    let receipts: typeof toolReceipts = [];
    if (shouldRunInitialAnalysis(nextMemory)) {
      if (eventIds.length === 0) {
        eventIds = eventIdsForMatterAnalysis(nextMemory);
      }
      setPipelinePhase("tools");
      try {
        const analysis = await api.runAnalysis(
          bootstrap.projectId,
          bootstrap.matter.id,
          eventIds,
        );
        receipts = analysis.toolReceipts ?? [];
        setToolReceipts(receipts);
        analysisRun = analysis.run ?? null;
        setLiveRun(analysisRun);
        if (analysis.candidate) {
          setPipelinePhase("owner");
        } else if (analysis.run?.status === "confirmation_required") {
          setPipelinePhase("owner");
        } else {
          setPipelinePhase("candidate");
        }
      } catch {
        /* analysis may fail without LLM; still enter workbench */
      }
      try {
        nextMemory = await api.getMemory(bootstrap.projectId, bootstrap.matter.id);
      } catch {
        /* keep prior */
      }
    }

    setPipelinePhase("persist");
    // Knowledge project is ensured server-side on connect (same id).
    await onAuthorized(
      {
        id: bootstrap.projectId,
        name: folderLabel,
        summary: "已授权本地文件夹（只读边界内）",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        matterId: bootstrap.matter.id,
        grantId: bootstrap.grant.id,
        folderName: folderLabel,
        memory: nextMemory,
        toolReceipts: receipts,
        run: analysisRun,
      },
    );
    setPipelinePhase(null);
    setLiveRun(null);
    setPendingSelection(null);
    setOnboardingPhase("entry");
  }

  async function chooseProjectFolder() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.openFolderPicker();
      if ("cancelled" in result && result.cancelled) {
        setPendingSelection(null);
        setOnboardingPhase(phaseAfterPickerCancel());
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
      reportError(
        nextError instanceof Error ? nextError.message : "打开文件夹选择失败",
      );
    } finally {
      setBusy(false);
    }
  }

  async function connectWithSelection() {
    if (!pendingSelection) return;
    setBusy(true);
    setError(null);
    try {
      await runPipeline({
        kind: "fresh",
        body: connectPayloadForNewSelection(pendingSelection.selectionId),
        folderHint: pendingSelection.folderName,
      });
    } catch (nextError) {
      setPipelinePhase(null);
      reportError(nextError instanceof Error ? nextError.message : "接不上，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function continueRecent() {
    if (!recentConnection) return;
    setBusy(true);
    setError(null);
    try {
      await runPipeline({
        kind: "continue",
        body: connectPayloadForContinue(recentConnection),
        folderHint: recentConnection.folderName,
      });
    } catch (nextError) {
      setPipelinePhase(null);
      reportError(
        nextError instanceof Error ? nextError.message : "接不上上次项目",
      );
    } finally {
      setBusy(false);
    }
  }

  function cancelSelectionReview() {
    setPendingSelection(null);
    setOnboardingPhase(phaseAfterPickerCancel());
    setError(null);
  }

  const showReview = onboardingPhase === "review" && pendingSelection;
  const showPipeline = pipelinePhase !== null;

  return (
    <div
      className={styles.shellEntry}
      data-testid="local-folder-entry"
      style={{
        display: "block",
        minHeight: 0,
        background: "transparent",
        fontFamily: "inherit",
      }}
    >
      <section aria-label="授权本地项目" style={{ display: "block", padding: 0 }}>
        <div className={styles.entryStage} style={{ width: "min(520px, 100%)" }}>
          {showPipeline ? (
            <div className={styles.entryCard}>
              <div className={styles.entryCardBody}>
                <div className={styles.entryFolderGlyph} aria-hidden>
                  <Folder size={36} strokeWidth={1.5} />
                </div>
                <p className={styles.entryEyebrow}>正在连接</p>
                <h1 className={styles.entryTitle}>{progressFolderName || "项目"}</h1>
                <AgentProcessPanel
                  statuses={processView.statuses}
                  active={processView.active}
                  caption={processView.caption}
                  folderName={progressFolderName}
                  toolReceipts={toolReceipts}
                  compact
                />
              </div>
            </div>
          ) : showReview && pendingSelection ? (
            <div className={styles.entryCard} data-testid="folder-selection-review">
              <div className={styles.entryCardBody}>
                <div className={styles.entryFolderGlyph} aria-hidden>
                  <Folder size={36} strokeWidth={1.5} />
                </div>
                <p className={styles.entryEyebrow}>已选择项目文件夹</p>
                <h1 className={styles.entryTitle}>{pendingSelection.folderName}</h1>
                <p className={styles.entryLead}>
                  连接后，系统只会在 {pendingSelection.folderName}{" "}
                  文件夹内部读取目录结构、项目材料和版本信息，不会访问其他位置。
                </p>
                <p className={styles.entryLead} style={{ marginTop: 8 }}>
                  {DEFAULT_PERMISSION_COPY}
                </p>
                <ul className={styles.entryPromiseList}>
                  <li>
                    <Folder size={16} strokeWidth={1.75} />
                    <span>仅限这个文件夹</span>
                  </li>
                  <li>
                    <FileText size={16} strokeWidth={1.75} />
                    <span>读取材料，不执行项目代码</span>
                  </li>
                  <li>
                    <Shield size={16} strokeWidth={1.75} />
                    <span>候选理解仍需你确认</span>
                  </li>
                </ul>
              </div>
              <div className={styles.entryCardFooter}>
                <button
                  type="button"
                  className={styles.entryTextLink}
                  onClick={() => void chooseProjectFolder()}
                  disabled={busy}
                >
                  重新选择
                </button>
                <div className={styles.entryFooterActions}>
                  <button
                    type="button"
                    className={styles.entryGhostButton}
                    onClick={cancelSelectionReview}
                    disabled={busy}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className={styles.entryPrimaryButton}
                    onClick={() => void connectWithSelection()}
                    disabled={busy}
                  >
                    {busy ? "连接中…" : "用这个文件夹"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.entryCard} data-testid="folder-choice-entry">
              <div className={styles.entryCardBody}>
                <p className={styles.entryEyebrow}>项目理解</p>
                <h1 className={styles.entryTitle}>回到项目现状</h1>
                <p className={styles.entryLead}>
                  在你授权的文件夹里，重建有依据的当前理解。也可拖入材料（下方工作台仍支持）。
                </p>
                <EntryPreview />
                {recentConnection && !isFixture ? (
                  <div className={styles.entryRecent} data-testid="recent-connection">
                    <div>
                      <span className={styles.entryEyebrow}>上次</span>
                      <strong>{recentConnection.folderName}</strong>
                    </div>
                    <button
                      type="button"
                      className={styles.entryGhostButton}
                      onClick={() => void continueRecent()}
                      disabled={busy}
                    >
                      {busy ? "连接中…" : "继续上次"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className={styles.entryCardFooter}>
                <span className={styles.entryFooterHint}>
                  {isFixture ? "演示模式" : "只读你选的目录 · 不扫全机 · 理解需你确认"}
                </span>
                <button
                  type="button"
                  className={styles.entryPrimaryButton}
                  onClick={() => void chooseProjectFolder()}
                  disabled={busy}
                  data-testid="choose-project-folder"
                >
                  {busy ? "打开中…" : isFixture ? "用演示文件夹" : "选择项目文件夹"}
                </button>
              </div>
            </div>
          )}
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
        </div>
      </section>
    </div>
  );
}
