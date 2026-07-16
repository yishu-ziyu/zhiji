"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Clock3,
  FolderOpen,
  Inbox,
  ListChecks,
  Layers3,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import type {
  ActionItem,
  CanvasNodeRef,
  FootprintLitEntry,
  FootprintViewMode,
  KnowledgeCard,
  Project,
  ProjectCanvasSnapshot,
} from "@/shared/types/knowledge";
import {
  SOURCE_CLUSTER_LABELS,
  SOURCE_CLUSTER_ORDER,
  STATUS_LABELS,
} from "@/shared/types/knowledge";
import {
  DEFAULT_WORKSPACE_PROFILE,
  fileToAvatarDataUrl,
  readWorkspaceProfile,
  writeWorkspaceProfile,
  type WorkspaceProfile,
} from "../lib/workspace-profile";
import styles from "../project-canvas.module.css";

type Props = {
  projects: Project[];
  projectId: string;
  snapshot: ProjectCanvasSnapshot | null;
  projectCards: KnowledgeCard[];
  myOpenWork: ActionItem[];
  footprint: FootprintLitEntry[];
  footprintMode: FootprintViewMode;
  onSelectProject: (id: string) => void;
  onOpenSearch: () => void;
  onFocusAttention: () => void;
  onCreateWork: () => void;
  onOpenMaterials: () => void;
  onFocus: (ref: CanvasNodeRef) => void;
  /** Lifted so workspace grid can widen the canvas. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

const NAV_COLLAPSE_KEY = "fc-opc-knowledge-nav-collapsed";

export function readNavCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NAV_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ProjectNavigator({
  projects,
  projectId,
  snapshot,
  projectCards,
  myOpenWork,
  footprint,
  footprintMode,
  onSelectProject,
  onOpenSearch,
  onFocusAttention,
  onCreateWork,
  onOpenMaterials,
  onFocus,
  collapsed,
  onCollapsedChange,
}: Props) {
  const [panel, setPanel] = useState<"work" | "footprint" | null>(
    footprintMode === "window" ? null : "footprint",
  );
  const [profile, setProfile] = useState<WorkspaceProfile>(
    DEFAULT_WORKSPACE_PROFILE,
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [draftName, setDraftName] = useState(DEFAULT_WORKSPACE_PROFILE.displayName);
  const [draftAvatar, setDraftAvatar] = useState(
    DEFAULT_WORKSPACE_PROFILE.avatarUrl,
  );
  const [profileError, setProfileError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readWorkspaceProfile();
    setProfile(saved);
    setDraftName(saved.displayName);
    setDraftAvatar(saved.avatarUrl);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  function openProfileEditor() {
    setDraftName(profile.displayName);
    setDraftAvatar(profile.avatarUrl);
    setProfileError(null);
    setProfileOpen(true);
  }

  function saveProfile() {
    const next: WorkspaceProfile = {
      displayName: draftName.trim() || DEFAULT_WORKSPACE_PROFILE.displayName,
      avatarUrl: draftAvatar.trim() || DEFAULT_WORKSPACE_PROFILE.avatarUrl,
    };
    writeWorkspaceProfile(next);
    setProfile(next);
    setProfileOpen(false);
    setProfileError(null);
  }

  async function onPickAvatar(file: File | null) {
    if (!file) return;
    try {
      const url = await fileToAvatarDataUrl(file);
      setDraftAvatar(url);
      setProfileError(null);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "头像更新失败");
    }
  }

  const footprintByCard = new Map(
    footprint.map((entry) => [entry.cardId, entry]),
  );
  const litCount = projectCards.filter(
    (card) => (footprintByCard.get(card.id)?.depth ?? 0) > 0,
  ).length;
  const eventCount = snapshot
    ? snapshot.timeline.now.length + snapshot.timeline.history.length
    : 0;
  const workCount =
    snapshot?.nodes.filter((node) => node.ref.kind === "work_item").length ?? 0;
  const cardCount =
    snapshot?.nodes.filter((node) => node.ref.kind === "card").length ?? 0;

  if (collapsed) {
    return (
      <aside
        className={`${styles.navigator} ${styles.navigatorCollapsed}`}
        data-testid="project-navigator"
        data-collapsed="true"
        aria-label="项目导航（已收起）"
      >
        <button
          type="button"
          className={styles.navCollapseToggle}
          data-testid="nav-expand"
          aria-label="展开侧栏"
          title="展开侧栏"
          onClick={() => onCollapsedChange(false)}
        >
          <PanelLeft size={18} />
        </button>
        <button
          type="button"
          className={styles.navIconButton}
          aria-label="搜索当前项目"
          title="搜索当前项目"
          onClick={onOpenSearch}
        >
          <Search size={17} />
        </button>
        <button
          type="button"
          className={styles.navIconButton}
          aria-label="查看当前重点"
          title="查看当前重点"
          onClick={onFocusAttention}
        >
          <Target size={17} />
        </button>
        <button
          type="button"
          className={styles.navIconButton}
          aria-label="本项目材料"
          title="本项目材料"
          onClick={onOpenMaterials}
        >
          <FolderOpen size={17} />
        </button>
        <button
          type="button"
          className={styles.navIconButton}
          aria-label="新增工作项"
          title="新增工作项"
          onClick={onCreateWork}
        >
          <Plus size={17} />
        </button>
        <div className={styles.navCollapsedProjects} role="listbox" aria-label="项目（图标）">
          {projects.slice(0, 12).map((project) => {
            const active = project.id === projectId;
            return (
              <button
                key={project.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.navIconButton} ${active ? styles.navIconButtonActive : ""}`}
                title={project.name}
                onClick={() => onSelectProject(project.id)}
              >
                {active ? (
                  <Image
                    src="/project-canvas/logo-source.png"
                    alt=""
                    width={20}
                    height={20}
                  />
                ) : (
                  <Layers3 size={16} />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className={styles.navCollapsedAvatar}
          title={`${profile.displayName} · 展开后可改名换头像`}
          aria-label={`当前身份 ${profile.displayName}`}
          onClick={() => onCollapsedChange(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL avatars */}
          <img src={profile.avatarUrl} alt="" width={28} height={28} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={styles.navigator}
      data-testid="project-navigator"
      data-collapsed="false"
    >
      <div className={styles.navTopBar}>
        <button
          type="button"
          className={styles.profileRow}
          data-testid="workspace-profile-trigger"
          onClick={openProfileEditor}
          title="编辑显示名与头像（本机个性化，不是换账号）"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL avatars */}
          <img
            src={profile.avatarUrl}
            alt=""
            width={38}
            height={38}
            className={styles.avatar}
          />
          <div className={styles.profileText}>
            <strong>{profile.displayName}</strong>
            <small>点此改名 / 换头像</small>
          </div>
          <ChevronDown className={styles.profileChevron} size={15} />
        </button>
        <button
          type="button"
          className={styles.navCollapseToggle}
          data-testid="nav-collapse"
          aria-label="收起侧栏"
          title="收起侧栏，给画布腾空间"
          onClick={() => onCollapsedChange(true)}
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      {profileOpen ? (
        <div
          className={styles.profileEditor}
          data-testid="workspace-profile-editor"
          role="dialog"
          aria-label="编辑个人标识"
        >
          <header>
            <strong>个人标识</strong>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => setProfileOpen(false)}
            >
              <X size={15} />
            </button>
          </header>
          <p className={styles.profileEditorHint}>
            只存在这台电脑上，用来个性化工作区；不是登录账号，也不能换用户。
          </p>
          <div className={styles.profileEditorAvatarRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draftAvatar} alt="" width={56} height={56} />
            <div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={14} />
                换头像
              </button>
              <button
                type="button"
                className={styles.profileEditorGhost}
                onClick={() =>
                  setDraftAvatar(DEFAULT_WORKSPACE_PROFILE.avatarUrl)
                }
              >
                恢复默认
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  void onPickAvatar(file);
                }}
              />
            </div>
          </div>
          <label className={styles.profileEditorField}>
            <span>显示名</span>
            <input
              value={draftName}
              maxLength={32}
              placeholder="怎么称呼你"
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
          {profileError ? (
            <p className={styles.profileEditorError}>{profileError}</p>
          ) : null}
          <footer>
            <button type="button" onClick={() => setProfileOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className={styles.profileEditorPrimary}
              onClick={saveProfile}
            >
              <Check size={14} />
              保存
            </button>
          </footer>
        </div>
      ) : null}

      <button
        className={styles.sidebarSearch}
        type="button"
        onClick={onOpenSearch}
        title="聚焦顶部搜索框（本项目内材料 / 任务 / 记录）"
      >
        <Search size={16} />
        <span>搜索本项目</span>
        <kbd>⌘K</kbd>
      </button>

      <div className={styles.sidebarSectionTitle}>
        <span>项目{projects.length > 0 ? ` · ${projects.length}` : ""}</span>
        <button type="button" aria-label="新增工作项" onClick={onCreateWork}>
          <Plus size={16} />
        </button>
      </div>
      <div
        className={styles.projectList}
        data-testid="project-switcher-list"
        role="listbox"
        aria-label="项目列表，可切换"
      >
        {projects.length === 0 ? (
          <p
            data-testid="project-switcher-empty"
            style={{
              margin: "4px 8px 8px",
              color: "#81848a",
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            尚无项目。拖入文件夹可一次建多个。
          </p>
        ) : null}
        {projects.map((project) => {
          const active = project.id === projectId;
          return (
            <button
              key={project.id}
              type="button"
              role="option"
              aria-selected={active}
              data-testid={`project-nav-${project.id}`}
              data-project-name={project.name}
              className={`${styles.projectButton} ${active ? styles.projectButtonActive : ""}`}
              onClick={() => onSelectProject(project.id)}
              title={
                active ? `当前项目：${project.name}` : `切换到：${project.name}`
              }
            >
              <span className={styles.projectIcon}>
                {active ? (
                  <Image
                    src="/project-canvas/logo-source.png"
                    alt=""
                    width={24}
                    height={24}
                  />
                ) : (
                  <Layers3 size={16} />
                )}
              </span>
              <span>{project.name}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.navDivider} />
      <nav className={styles.sidebarNav} aria-label="工作区导航">
        <button
          type="button"
          data-active={panel === "work"}
          onClick={() =>
            setPanel((value) => (value === "work" ? null : "work"))
          }
        >
          <Inbox size={17} />
          <span>我的未完成</span>
          <b>{myOpenWork.length}</b>
        </button>
        <button type="button" onClick={onFocusAttention}>
          <Target size={17} />
          <span>当前重点</span>
        </button>
        <button
          type="button"
          data-testid="open-project-materials"
          onClick={onOpenMaterials}
        >
          <FolderOpen size={17} />
          <span>本项目材料</span>
        </button>
        <button
          type="button"
          data-active={panel === "footprint"}
          onClick={() =>
            setPanel((value) => (value === "footprint" ? null : "footprint"))
          }
        >
          <Clock3 size={17} />
          <span>知识使用记录</span>
          <b>{litCount}</b>
        </button>
        <button type="button" disabled title="尚未实现">
          <Star size={17} />
          <span>收藏</span>
        </button>
        <button type="button" disabled title="尚未实现">
          <Layers3 size={17} />
          <span>模板</span>
        </button>
      </nav>

      {panel === "work" ? (
        <section className={styles.navigatorPanel} data-testid="my-open-work">
          <header>
            <strong>我的未完成</strong>
            <span>{myOpenWork.length}</span>
          </header>
          {myOpenWork.length === 0 ? (
            <p>当前没有未完成工作。</p>
          ) : (
            <div className={styles.navigatorPanelList}>
              {myOpenWork.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    onFocus({ kind: "work_item", id: item.id });
                    setPanel(null);
                  }}
                >
                  <ListChecks size={15} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {STATUS_LABELS[item.status]} · {item.nextStep}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {panel === "footprint" ? (
        <section
          className={styles.navigatorPanel}
          data-testid="project-footprint"
        >
          <header>
            <strong>知识使用记录</strong>
            <span>
              {footprintMode === "current_query"
                ? "本次检索"
                : footprintMode === "work_item"
                  ? "当前工作"
                  : "最近 7 天"}
            </span>
          </header>
          <p>
            <i data-lit="true" />
            亮色表示已检索或使用，灰色表示当前未用到。
          </p>
          <div className={styles.footprintGroups}>
            {SOURCE_CLUSTER_ORDER.map((source) => {
              const cards = projectCards.filter(
                (card) => card.source === source,
              );
              if (cards.length === 0) return null;
              return (
                <div key={source}>
                  <span>{SOURCE_CLUSTER_LABELS[source]}</span>
                  {cards.map((card) => {
                    const depth = footprintByCard.get(card.id)?.depth ?? 0;
                    return (
                      <button
                        type="button"
                        key={card.id}
                        data-lit={depth > 0}
                        data-depth={depth}
                        title={card.title || card.content}
                        onClick={() => {
                          onFocus({ kind: "card", id: card.id });
                          setPanel(null);
                        }}
                      >
                        <i />
                        <span>
                          {card.title || card.content.slice(0, 28)}
                        </span>
                        <small>
                          {depth >= 3
                            ? "已关联"
                            : depth === 2
                              ? "已查看"
                              : depth === 1
                                ? "命中"
                                : "未用"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={styles.copilotCard}>
        <div className={styles.copilotTitle}>
          <span>AI Copilot</span>
          <em>Beta</em>
        </div>
        <p>从项目材料、关系和执行记录中找到当前重点。</p>
        <button type="button" onClick={onFocusAttention}>
          <span>查看当前重点</span>
          <Sparkles size={15} />
        </button>
      </section>

      <section className={styles.statsCard}>
        <h3>当前视图</h3>
        <dl>
          <div>
            <dt>节点</dt>
            <dd>{snapshot?.nodes.length ?? 0}</dd>
          </div>
          <div>
            <dt>关系</dt>
            <dd>{snapshot?.edges.length ?? 0}</dd>
          </div>
          <div>
            <dt>材料</dt>
            <dd>{cardCount}</dd>
          </div>
          <div>
            <dt>工作项</dt>
            <dd>{workCount}</dd>
          </div>
          <div>
            <dt>记录</dt>
            <dd>{eventCount}</dd>
          </div>
        </dl>
      </section>

    </aside>
  );
}
