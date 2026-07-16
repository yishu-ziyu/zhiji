"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ChevronDown,
  Circle,
  Clock3,
  FolderOpen,
  Inbox,
  ListChecks,
  Layers3,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
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
};

const referenceSources = [
  { name: "SignalGraph", color: "green" },
  { name: "Canvasight", color: "black" },
  { name: "Multica", color: "orange" },
  { name: "mindwalk", color: "blue" },
] as const;

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
}: Props) {
  const [panel, setPanel] = useState<"work" | "footprint" | null>(
    footprintMode === "window" ? null : "footprint",
  );

  const footprintByCard = new Map(
    footprint.map((entry) => [entry.cardId, entry]),
  );
  const litCount = projectCards.filter(
    (card) => (footprintByCard.get(card.id)?.depth ?? 0) > 0,
  ).length;
  const eventCount = snapshot
    ? snapshot.timeline.now.length + snapshot.timeline.history.length
    : 0;
  const workCount = snapshot?.nodes.filter(
    (node) => node.ref.kind === "work_item",
  ).length ?? 0;
  const cardCount = snapshot?.nodes.filter(
    (node) => node.ref.kind === "card",
  ).length ?? 0;

  return (
    <aside className={styles.navigator} data-testid="project-navigator">
      <div className={styles.windowDots} aria-hidden="true">
        <Circle className={styles.dotRed} fill="currentColor" />
        <Circle className={styles.dotYellow} fill="currentColor" />
        <Circle className={styles.dotGreen} fill="currentColor" />
      </div>

      <div className={styles.profileRow}>
        <Image
          src="/project-canvas/avatar-source.png"
          alt="Yishu Ziyu"
          width={38}
          height={38}
          className={styles.avatar}
          priority
        />
        <strong>Yishu Ziyu</strong>
        <ChevronDown className={styles.profileChevron} size={15} />
      </div>

      <button className={styles.sidebarSearch} type="button" onClick={onOpenSearch}>
        <Search size={16} />
        <span>搜索</span>
        <kbd>⌘K</kbd>
      </button>

      <div className={styles.sidebarSectionTitle}>
        <span>项目</span>
        <button type="button" aria-label="新增工作项" onClick={onCreateWork}><Plus size={16} /></button>
      </div>
      <div className={styles.projectList}>
        {projects.map((project) => {
          const active = project.id === projectId;
          return (
            <button
              key={project.id}
              type="button"
              className={`${styles.projectButton} ${active ? styles.projectButtonActive : ""}`}
              onClick={() => onSelectProject(project.id)}
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
          onClick={() => setPanel((value) => value === "work" ? null : "work")}
        >
          <Inbox size={17} /><span>我的未完成</span><b>{myOpenWork.length}</b>
        </button>
        <button type="button" onClick={onFocusAttention}><Target size={17} /><span>当前重点</span></button>
        <button
          type="button"
          data-testid="open-project-materials"
          onClick={onOpenMaterials}
        >
          <FolderOpen size={17} /><span>本项目材料</span>
        </button>
        <button
          type="button"
          data-active={panel === "footprint"}
          onClick={() => setPanel((value) => value === "footprint" ? null : "footprint")}
        >
          <Clock3 size={17} /><span>知识使用记录</span><b>{litCount}</b>
        </button>
        <button type="button" disabled><Star size={17} /><span>收藏</span></button>
        <button type="button" disabled><Layers3 size={17} /><span>模板</span></button>
      </nav>

      {panel === "work" ? (
        <section className={styles.navigatorPanel} data-testid="my-open-work">
          <header><strong>我的未完成</strong><span>{myOpenWork.length}</span></header>
          {myOpenWork.length === 0 ? <p>当前没有未完成工作。</p> : (
            <div className={styles.navigatorPanelList}>
              {myOpenWork.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => { onFocus({ kind: "work_item", id: item.id }); setPanel(null); }}
                >
                  <ListChecks size={15} />
                  <span><strong>{item.title}</strong><small>{STATUS_LABELS[item.status]} · {item.nextStep}</small></span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {panel === "footprint" ? (
        <section className={styles.navigatorPanel} data-testid="project-footprint">
          <header>
            <strong>知识使用记录</strong>
            <span>{footprintMode === "current_query" ? "本次检索" : footprintMode === "work_item" ? "当前工作" : "最近 7 天"}</span>
          </header>
          <p><i data-lit="true" />亮色表示已检索或使用，灰色表示当前未用到。</p>
          <div className={styles.footprintGroups}>
            {SOURCE_CLUSTER_ORDER.map((source) => {
              const cards = projectCards.filter((card) => card.source === source);
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
                        onClick={() => { onFocus({ kind: "card", id: card.id }); setPanel(null); }}
                      >
                        <i />
                        <span>{card.title || card.content.slice(0, 28)}</span>
                        <small>{depth >= 3 ? "已关联" : depth === 2 ? "已查看" : depth === 1 ? "命中" : "未用"}</small>
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
          <div><dt>节点</dt><dd>{snapshot?.nodes.length ?? 0}</dd></div>
          <div><dt>关系</dt><dd>{snapshot?.edges.length ?? 0}</dd></div>
          <div><dt>材料</dt><dd>{cardCount}</dd></div>
          <div><dt>工作项</dt><dd>{workCount}</dd></div>
          <div><dt>记录</dt><dd>{eventCount}</dd></div>
        </dl>
      </section>

      <div className={styles.referenceBlock}>
        <span>设计与实现参考</span>
        <div>
          {referenceSources.map((source) => (
            <span key={source.name} className={styles.referenceSource}>
              <Circle data-color={source.color} fill="currentColor" />
              {source.name}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
