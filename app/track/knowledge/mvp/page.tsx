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
import { useCallback, useEffect, useRef, useState } from "react";
import { MatterFocusCanvas, type FocusNode } from "./components/MatterFocusCanvas";
import { RevisionViewer } from "./components/RevisionViewer";
import { SourceGrantPanel } from "./components/SourceGrantPanel";
import { StateReconstructionPanel } from "./components/StateReconstructionPanel";
import { UnderstandingReviewCard } from "./components/UnderstandingReviewCard";
import {
  createMvpApi,
  type Matter,
  type MemoryResponse,
  type RevisionResponse,
  type SourceGrant,
  type UnderstandingBody,
  type WatchSetUpdate,
} from "./lib/api";
import styles from "./mvp-workbench.module.css";

type AdapterMode = "contract-fixture" | "http";

function initialRootPath(mode: AdapterMode): string {
  return mode === "contract-fixture" ? "/Users/owner/projects/product-exploration" : "";
}

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
  const [rootPath, setRootPath] = useState(() => initialRootPath(adapterMode));
  const [watchPrefixes, setWatchPrefixes] = useState("app, shared, docs");
  const [focusId, setFocusId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<RevisionResponse | null>(null);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [resolutionMessage, setResolutionMessage] = useState<string | null>(null);
  const bootstrapStarted = useRef(false);

  useEffect(() => {
    const search = new URL(window.location.href).searchParams;
    const nextMode: AdapterMode = search.get("fixture") === "1" ? "contract-fixture" : "http";
    queueMicrotask(() => {
      setAdapterMode(nextMode);
      setApi(createMvpApi(nextMode));
      setProjectId(search.get("projectId") || "");
      if (nextMode === "contract-fixture") setRootPath(initialRootPath(nextMode));
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
    if (!modeReady || isFixture || connected || bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    let cancelled = false;
    setBusy(true);
    void api.bootstrapExisting(projectId || undefined)
      .then(async (bootstrap) => {
        if (!bootstrap || cancelled) return;
        const nextMemory = await api.getMemory(bootstrap.projectId, bootstrap.matter.id);
        if (cancelled) return;
        setProjectId(bootstrap.projectId);
        setMatterId(bootstrap.matter.id);
        setRootPath(bootstrap.grant.rootPath);
        setGrant(bootstrap.grant);
        setMatter(bootstrap.matter);
        setMemory(nextMemory);
        setFocusId(bootstrap.matter.id);
        setConnected(true);
        setNotice("已从持久化 source grant 重新连接，并读取默认 matter/watch memory。");
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "读取已有授权失败");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, [api, connected, isFixture, modeReady, projectId]);

  async function connectProject() {
    const nextProjectId = projectId.trim();
    const nextRootPath = rootPath.trim();
    const includePathPrefixes = watchPrefixes.split(",").map((item) => item.trim()).filter(Boolean);
    if ((!isFixture && !nextProjectId) || !nextRootPath || includePathPrefixes.length === 0) {
      setError(isFixture ? "请填写 rootPath 和至少一个关注路径" : "请填写项目 ID、rootPath 和至少一个关注路径");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const connectedData = await api.connectGrant(nextProjectId, nextRootPath, includePathPrefixes);
      const resolvedProjectId = connectedData.matter.projectId;
      const resolvedMatterId = connectedData.matter.id;
      setGrant(connectedData.grant);
      setMatter(connectedData.matter);
      setProjectId(resolvedProjectId);
      setMatterId(resolvedMatterId);
      setFocusId(resolvedMatterId);
      setConnected(true);
      await loadMemory(resolvedProjectId, resolvedMatterId);
      setNotice(isFixture ? "已连接显式 contract fixture；UI 不把 fixture 当作生产事实。" : "已通过 HTTP adapter 连接 source grant，并读取默认 matter/watch bootstrap。");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "连接失败");
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    if (!memory) return;
    setBusy(true);
    setError(null);
    try {
      await api.runAnalysis(projectId, matterId, memory.events.map((event) => event.id));
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
      setMemory((current) => current ? { ...current, watchSet } : current);
      setNotice("当前 matter 的 watch set 已更新；未匹配变化不会进入中心。");
    } finally {
      setBusy(false);
    }
  }

  async function stopWatch() {
    await saveWatchSet({ grantId: memory?.watchSet.grantId || "", includePathPrefixes: memory?.watchSet.includePathPrefixes || [], excludePathPrefixes: memory?.watchSet.excludePathPrefixes || [], status: "disabled" });
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

  async function resolveCandidate(decision: "accept" | "edit_accept" | "reject", editedBody?: UnderstandingBody) {
    if (!memory?.candidate) return;
    setBusy(true);
    try {
      const result = await api.resolveCandidate(memory.candidate.id, decision, editedBody);
      await loadMemory();
      if (decision === "reject") {
        setResolutionMessage(`已写入 Owner resolution：reject。candidate ${result.resolution.candidateRevisionId} 保持不变。`);
      } else {
        setResolutionMessage(`已新建 accepted revision ${result.accepted?.id}；candidate ${result.resolution.candidateRevisionId} 未被原地改写。`);
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
    window.history.pushState({ focus: node.id }, "", `${url.pathname}?${url.searchParams.toString()}`);
  }

  if (!connected || !grant || !matter || !memory) {
    return (
      <main className={styles.shell}>
        <aside className={styles.rail} aria-label="MVP 知识工作台导航">
          <div className={styles.windowDots}><span /><span /><span /></div>
          <div className={styles.profileRow}><span className={styles.avatar}><Bot size={18} /></span><div><strong>知识工作台</strong><small>Owner 视角</small></div><ChevronRight size={15} /></div>
          <div className={styles.railSection}><span className={styles.railLabel}>MVP-V0</span><div className={styles.railItemActive}><LayoutGrid size={15} />非线性工作台</div></div>
          <div className={styles.railSection}><span className={styles.railLabel}>状态</span><div className={styles.railItem}><ShieldCheck size={15} />等待本地项目授权</div></div>
        </aside>
        <section className={styles.onboarding}>
          <div className={styles.onboardingTop}><span className={styles.readOnly}><span />Task 5 · {isFixture ? "explicit fixture" : "HTTP adapter"}</span><span>Owner 授权 · 不扫全机</span></div>
          <div className={styles.onboardingBody}>
            <span className={styles.onboardingIcon}><FolderGit2 size={25} /></span>
            <span className={styles.kicker}><ShieldCheck size={13} />Owner 明确授权</span>
            <h1>选择一个本地项目，开始重建当前理解</h1>
            <p>先由 Owner 输入项目 ID、真实 rootPath 与关注路径，再读取后端返回的默认 matter/watch。MVP 不默认扫描全 root；变化、依据和 Owner 决议都通过 PRD contract API。</p>
            <div className={styles.promiseList}>
              <div><span>01</span><strong>一件事项居中</strong><small>只展开一层直接关系，非匹配变化不进入中心。</small></div>
              <div><span>02</span><strong>六问逐条有据</strong><small>why 显示 supported / unknown / conflicted 与 exact quote。</small></div>
              <div><span>03</span><strong>Owner 决议成新版本</strong><small>accept / edit_accept 新建 accepted revision，不改 candidate。</small></div>
            </div>
            <div className={styles.connectionForm}>
              {!isFixture && <label><span>项目 ID</span><input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="输入已有项目 ID" autoComplete="off" /></label>}
              <label><span>本地 rootPath</span><input value={rootPath} onChange={(event) => setRootPath(event.target.value)} placeholder="/Users/you/projects/your-project" autoComplete="off" /></label>
              <label><span>关注路径（逗号分隔）</span><input value={watchPrefixes} onChange={(event) => setWatchPrefixes(event.target.value)} placeholder="app, shared, docs" autoComplete="off" /></label>
            </div>
            <button className={styles.primaryButtonLarge} type="button" onClick={() => void connectProject()} disabled={busy || !rootPath.trim() || !watchPrefixes.trim() || (!isFixture && !projectId.trim())}><FolderGit2 size={17} />{busy ? "连接中…" : isFixture ? "使用显式 contract fixture" : "连接项目并读取默认事项"}<ArrowRight size={16} /></button>
            <span className={styles.fixtureNote}>{isFixture ? "仅 ?fixture=1 启用；fixture 不作为生产事实或持久化真相。" : "默认路径为真实 HTTP API；后端负责 source grant、matter/watch bootstrap 与持久化。"}</span>
            {error && <div className={styles.errorBanner}>{error}</div>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.rail} aria-label="MVP 知识工作台导航">
        <div className={styles.windowDots}><span /><span /><span /></div>
        <div className={styles.profileRow}><span className={styles.avatar}><Bot size={18} /></span><div><strong>知识工作台</strong><small>Owner 视角</small></div><ChevronRight size={15} /></div>
        <div className={styles.railSection}><span className={styles.railLabel}>项目</span><button className={styles.projectButton} type="button"><CircleDot size={14} />产品探索 <small>MVP</small></button></div>
        <div className={styles.railSection}><span className={styles.railLabel}>工作对象</span><div className={styles.railItemActive}><LayoutGrid size={15} />一件事项</div><div className={styles.railItem}><Search size={15} />来源与依据</div><div className={styles.railItem}><MessageCircleQuestion size={15} />六问重建</div></div>
        <div className={styles.railBottom}><span className={styles.statusLight} />{isFixture ? "explicit fixture" : "HTTP adapter"}<br /><small>{isFixture ? "test switch only" : "persisted API"}</small></div>
      </aside>
      <section className={styles.mainColumn}>
        <header className={styles.topbar}><div className={styles.breadcrumb}><span>项目</span><ChevronRight size={13} /><span>{projectId}</span><ChevronRight size={13} /><strong>{matter.title}</strong></div><div className={styles.topActions}><span className={styles.readOnly}><span />{isFixture ? "只读 explicit fixture" : "只读 HTTP memory"}</span><button className={styles.iconButton} type="button" onClick={() => void loadMemory()} aria-label="刷新 memory"><RefreshCw size={15} /></button></div></header>
        <div className={styles.pageIntro}><div><span className={styles.kicker}><Sparkles size={13} />当前事项</span><h1>{matter.title}</h1><p>{matter.goal}</p></div><button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void runAnalysis()}><Sparkles size={14} />运行一次状态重建</button></div>
        <div className={styles.scrollArea}>
          <MatterFocusCanvas memory={memory} focusId={focusId} onFocus={focusNode} onOpenRevision={(revisionId) => void openRevision(revisionId)} />
          <SourceGrantPanel key={`${memory.watchSet.updatedAt}-${memory.watchSet.status}`} grant={grant} watchSet={memory.watchSet} filteredCount={memory.filteredEvents.length} onSave={saveWatchSet} onStop={stopWatch} />
        </div>
      </section>
      <aside className={styles.inspector} aria-label="事项状态与 Owner 决议">
        <div className={styles.inspectorScroll}>
          <StateReconstructionPanel memory={memory} onOpenRevision={(revisionId) => void openRevision(revisionId)} />
          <UnderstandingReviewCard candidate={memory.candidate} accepted={memory.accepted} onResolve={resolveCandidate} resolutionMessage={resolutionMessage} />
          <div className={styles.inspectorFooter}><ShieldCheck size={13} /><span>所有决议都通过 OwnerDecisionWriter 边界；Agent 不能自我确认。</span></div>
        </div>
      </aside>
      <footer className={styles.footer}><span><span className={styles.statusLight} />事项：{matter.title}</span><span>focus：{focusId === matter.id ? "matter" : "one-hop relation"}</span><span>accepted：{memory.head.acceptedRevisionId || "none"}</span><span>review：{memory.head.reviewState}</span><span>{isFixture ? "fixture=1" : "HTTP persisted"}</span></footer>
      {notice && <button className={styles.toast} type="button" onClick={() => setNotice(null)}>{notice}</button>}
      {error && <button className={`${styles.toast} ${styles.toastError}`} type="button" onClick={() => setError(null)}>{error}</button>}
      <RevisionViewer revision={revision} loading={revisionLoading} onClose={() => setRevision(null)} />
    </main>
  );
}
