"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Circle,
  History,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import type {
  CanvasNodeRef,
  CanvasTimelineEvent,
  ProjectCanvasSnapshot,
} from "@/shared/types/knowledge";
import { actorLabel } from "./actor-label";
import styles from "../project-canvas.module.css";

type Filter = "all" | "now" | "history" | "decision" | "agent";

type Props = {
  snapshot: ProjectCanvasSnapshot | null;
  onFocus: (ref: CanvasNodeRef) => void;
};

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "时间线" },
  { id: "now", label: "当前工作" },
  { id: "history", label: "历史" },
  { id: "decision", label: "决定" },
  { id: "agent", label: "Agent 动态" },
];

function eventColor(event: CanvasTimelineEvent) {
  if (event.type === "block") return "red";
  if (event.type === "result") return "green";
  if (event.type === "decision" || event.type === "next_step_change") return "orange";
  if (event.type === "assign" || event.type === "status_change") return "blue";
  return "gray";
}

function timeValue(value: string) {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

function shortTime(value: number, includeDate: boolean) {
  return new Intl.DateTimeFormat("zh-CN", includeDate
    ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function eventLabel(event: CanvasTimelineEvent) {
  if (event.type === "block") return "阻塞";
  if (event.type === "result") return "Agent 结果";
  if (event.type === "decision") return "决定";
  if (event.type === "next_step_change") return "下一步变化";
  if (event.type === "status_change") return "状态变化";
  return "项目记录";
}

type ActorLane = {
  actorKey: string;
  actorName: string;
  isAgent: boolean;
  events: CanvasTimelineEvent[];
};

function buildLanes(events: CanvasTimelineEvent[]): ActorLane[] {
  const map = new Map<string, ActorLane>();
  for (const event of events) {
    const actorKey = event.actor || "自己";
    const existing = map.get(actorKey);
    if (existing) {
      existing.events.push(event);
      continue;
    }
    map.set(actorKey, {
      actorKey,
      actorName: actorLabel(actorKey),
      isAgent: actorKey.startsWith("agent:"),
      events: [event],
    });
  }
  return [...map.values()].sort((a, b) => {
    // Agents first (Canvasight-style multi-agent lanes), then humans, then by latest activity.
    if (a.isAgent !== b.isAgent) return a.isAgent ? -1 : 1;
    const aLatest = Math.max(...a.events.map((e) => timeValue(e.createdAt)), 0);
    const bLatest = Math.max(...b.events.map((e) => timeValue(e.createdAt)), 0);
    return bLatest - aLatest;
  });
}

export function ProjectTimeline({ snapshot, onFocus }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [scale, setScale] = useState(100);
  const events = useMemo(() => {
    if (!snapshot) return [];
    const all = [...snapshot.timeline.now, ...snapshot.timeline.history];
    if (filter === "now") return snapshot.timeline.now;
    if (filter === "history") return snapshot.timeline.history;
    if (filter === "decision") {
      return all.filter((event) => event.type === "decision");
    }
    if (filter === "agent") {
      return all.filter((event) => event.actor.startsWith("agent:"));
    }
    return all;
  }, [filter, snapshot]);

  const lanes = useMemo(() => buildLanes(events), [events]);

  const timeAxis = useMemo(() => {
    const values = events.map((event) => timeValue(event.createdAt)).filter(Boolean);
    const latest = values.length
      ? Math.max(...values)
      : timeValue(snapshot?.project.updatedAt ?? "");
    const rawStart = values.length ? Math.min(...values) : latest - 8 * 60 * 60 * 1000;
    const rawEnd = latest;
    const minimumSpan = 60 * 60 * 1000;
    const span = Math.max(minimumSpan, rawEnd - rawStart);
    const padding = Math.max(15 * 60 * 1000, span * 0.05);
    const start = rawStart - padding;
    const end = rawEnd + padding;
    const includeDate = end - start > 24 * 60 * 60 * 1000;
    const labels = Array.from({ length: 9 }, (_, index) => {
      const value = start + ((end - start) * index) / 8;
      return { value, label: shortTime(value, includeDate) };
    });
    return { start, end, labels, latest };
  }, [events, snapshot?.project.updatedAt]);

  return (
    <section className={styles.timeline} data-testid="project-timeline">
      <header className={styles.timelineHeader}>
        <nav aria-label="时间线筛选（不是对话入口）">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={filter === item.id}
              data-testid={
                item.id === "agent" ? "timeline-filter-agent-activity" : undefined
              }
              title={
                item.id === "agent"
                  ? "只看时间线上的 Agent 记录，不是对话"
                  : undefined
              }
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className={styles.timelineTools}>
          <button type="button" aria-label="适应窗口" onClick={() => setScale(100)}><Maximize2 size={14} /></button>
          <button type="button" aria-label="缩小" onClick={() => setScale((value) => Math.max(80, value - 10))}><Minus size={14} /></button>
          <span>{scale}%</span>
          <button type="button" aria-label="放大" onClick={() => setScale((value) => Math.min(130, value + 10))}><Plus size={14} /></button>
        </div>
      </header>

      <div className={styles.timelineScale} style={{ width: `${scale}%` }}>
        <span>真实时间</span>
        {timeAxis.labels.map((entry) => <time key={entry.value}>{entry.label}</time>)}
      </div>

      <div
        className={styles.timelineRows}
        style={{ width: `${scale}%` }}
        data-testid="timeline-lanes"
        data-lane-count={lanes.length}
      >
        {lanes.length === 0 ? (
          <div className={styles.timelineEmpty}>当前筛选下没有记录</div>
        ) : (
          lanes.map((lane) => (
            <div
              key={lane.actorKey}
              className={styles.timelineLane}
              data-testid="timeline-lane"
              data-actor={lane.actorKey}
              data-agent={lane.isAgent ? "true" : "false"}
            >
              <span className={styles.timelineActor}>
                {lane.isAgent ? (
                  <Bot size={14} />
                ) : lane.events.some((e) => e.phase === "now") ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <History size={14} />
                )}
                <span>{lane.actorName}</span>
                <small>{lane.events.length}</small>
              </span>
              <span className={styles.timelineLaneTrack} aria-hidden="false">
                {lane.events.map((event) => {
                  const color = eventColor(event);
                  const at = timeValue(event.createdAt);
                  const ratio = Math.max(
                    0,
                    Math.min(1, (at - timeAxis.start) / (timeAxis.end - timeAxis.start)),
                  );
                  const left = 4 + ratio * 92;
                  return (
                    <button
                      type="button"
                      key={event.id}
                      className={styles.timelineLaneEvent}
                      data-color={color}
                      data-testid={`timeline-event-${event.id}`}
                      style={{ left: `${left}%` }}
                      title={`${eventLabel(event)} · ${shortTime(at, true)}\n${event.body}`}
                      onClick={() => onFocus(event.ref)}
                    >
                      {event.type === "block" ? (
                        <CircleAlert size={12} />
                      ) : (
                        <Circle size={10} fill="currentColor" />
                      )}
                      <span>{eventLabel(event)}</span>
                    </button>
                  );
                })}
              </span>
            </div>
          ))
        )}
      </div>
      <div
        className={styles.nowMarker}
        aria-hidden="true"
        style={{ left: `${12 + Math.max(0, Math.min(1, (timeAxis.latest - timeAxis.start) / (timeAxis.end - timeAxis.start))) * 84}%` }}
      ><span>最新</span><Circle fill="currentColor" /></div>
    </section>
  );
}
