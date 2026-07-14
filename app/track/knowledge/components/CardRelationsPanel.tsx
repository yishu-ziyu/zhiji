"use client";

import { useMemo, useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  KnowledgeCard,
  KnowledgeRelation,
  RelationNeighborEdge,
  RelationType,
} from "@/shared/types/knowledge";
import {
  RELATION_TYPE_LABELS,
  RELATION_TYPES_P0,
} from "@/shared/types/knowledge";

type Props = {
  cardId: string | null;
  edges: RelationNeighborEdge[];
  linkableCards: KnowledgeCard[];
  loading?: boolean;
  onSelectCard: (cardId: string) => void;
  onCreate: (input: {
    fromCardId: string;
    toCardId: string;
    relationType: RelationType;
    evidenceSentence: string;
  }) => void;
  onConfirm: (relationId: string) => void;
  onReject: (relationId: string) => void;
  pathHint?: { nodes: string[]; length: number } | null;
  pathTargetTitle?: string | null;
};

export function CardRelationsPanel({
  cardId,
  edges,
  linkableCards,
  loading,
  onSelectCard,
  onCreate,
  onConfirm,
  onReject,
  pathHint,
  pathTargetTitle,
}: Props) {
  const [openForm, setOpenForm] = useState(false);
  const [toId, setToId] = useState("");
  const [type, setType] = useState<RelationType>("supports");
  const [sentence, setSentence] = useState("");

  const targets = useMemo(
    () => linkableCards.filter((c) => c.id !== cardId),
    [linkableCards, cardId],
  );

  if (!cardId) {
    return (
      <div
        className="rounded-[16px] border border-dashed border-border p-4"
        data-testid="card-relations-empty"
      >
        <p className="mono-label mb-1">相关依据</p>
        <p className="font-serif-cn text-xs text-muted-foreground">
          点选一张卡片，查看它和哪些依据有关。
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-[16px] border border-border bg-card/40 p-4 space-y-3"
      data-testid="card-relations"
      data-card-id={cardId}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="mono-label">相关依据</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            边 = 可解释的连接 · 必带来源句
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          disabled={loading}
          onClick={() => setOpenForm((v) => !v)}
        >
          <Link2 className="w-3 h-3" />
          {openForm ? "取消" : "添加关系"}
        </Button>
      </div>

      {pathHint && pathHint.length > 0 && (
        <div
          className="rounded-[10px] border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px]"
          data-testid="relation-path-hint"
        >
          <span className="mono-label text-primary">路径 </span>
          {pathHint.length} 跳
          {pathTargetTitle ? ` → ${pathTargetTitle}` : ""} ·{" "}
          {pathHint.nodes.length} 张卡
        </div>
      )}

      {openForm && (
        <div
          className="space-y-2 rounded-[12px] border border-border p-3"
          data-testid="relation-form"
        >
          <label className="block space-y-1">
            <span className="mono-label">对端卡</span>
            <select
              aria-label="对端卡"
              className="w-full rounded-[10px] border border-border bg-background px-2 py-1.5 text-sm"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              <option value="">选择…</option>
              {targets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.content.slice(0, 28)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="mono-label">关系类型</span>
            <select
              aria-label="关系类型"
              className="w-full rounded-[10px] border border-border bg-background px-2 py-1.5 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as RelationType)}
            >
              {RELATION_TYPES_P0.map((t) => (
                <option key={t} value={t}>
                  {RELATION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="mono-label">来源句（必填）</span>
            <textarea
              aria-label="来源句"
              className="w-full min-h-[64px] rounded-[10px] border border-border bg-background px-2 py-1.5 text-sm font-serif-cn"
              placeholder="写一句能指回原文的依据…"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={loading || !toId || !sentence.trim()}
            onClick={() => {
              onCreate({
                fromCardId: cardId,
                toCardId: toId,
                relationType: type,
                evidenceSentence: sentence.trim(),
              });
              setSentence("");
              setToId("");
              setOpenForm(false);
            }}
          >
            保存关系
          </Button>
        </div>
      )}

      {edges.length === 0 && (
        <p className="font-serif-cn text-xs text-muted-foreground">
          还没有连到其他依据。添加一条，或等规则扫描建议。
        </p>
      )}

      <ul className="space-y-2">
        {edges.map((edge) => (
          <li
            key={edge.id}
            className={cn(
              "rounded-[12px] border px-3 py-2 space-y-1",
              edge.status === "suggested"
                ? "border-dashed border-muted-foreground/40 bg-muted/20"
                : "border-border",
            )}
            data-testid="relation-edge"
            data-relation-id={edge.id}
            data-status={edge.status}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex rounded-[60px] border border-primary/40 px-2 py-0.5 mono-label text-primary">
                {RELATION_TYPE_LABELS[edge.relationType]}
              </span>
              <span className="mono-label text-muted-foreground">
                {edge.direction === "out"
                  ? "→"
                  : edge.direction === "in"
                    ? "←"
                    : "↔"}
              </span>
              <button
                type="button"
                className="text-[13px] font-medium text-foreground hover:text-primary underline-offset-2 hover:underline text-left"
                onClick={() => onSelectCard(edge.otherCard.id)}
              >
                {edge.otherCard.title}
              </button>
              {edge.status === "suggested" && (
                <span className="mono-label text-muted-foreground">建议</span>
              )}
            </div>
            <p className="font-serif-cn text-[12px] text-foreground/85 leading-relaxed">
              {edge.evidenceSentence}
            </p>
            {edge.status === "suggested" && (
              <div className="flex gap-1.5 pt-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-[10px]"
                  disabled={loading}
                  onClick={() => onConfirm(edge.id)}
                >
                  <Check className="w-3 h-3" />
                  确认
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  disabled={loading}
                  onClick={() => onReject(edge.id)}
                >
                  <X className="w-3 h-3" />
                  否决
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact list for work-item evidence island */
export function EvidenceIslandList({
  edges,
  cards,
}: {
  edges: KnowledgeRelation[];
  cards: KnowledgeCard[];
}) {
  const titleOf = (id: string) => {
    const c = cards.find((x) => x.id === id);
    return c?.title || c?.content.slice(0, 24) || id.slice(0, 8);
  };

  if (edges.length === 0) {
    return (
      <p
        className="text-[11px] text-muted-foreground"
        data-testid="evidence-island-empty"
      >
        这些依据之间还没有显式关系。
      </p>
    );
  }

  return (
    <ul className="space-y-1.5" data-testid="evidence-island">
      {edges.map((e) => (
        <li
          key={e.id}
          className="text-[11px] rounded-[8px] border border-border px-2 py-1.5"
          data-testid="island-edge"
        >
          <span className="mono-label text-primary mr-1">
            {RELATION_TYPE_LABELS[e.relationType]}
          </span>
          {titleOf(e.fromCardId)} → {titleOf(e.toCardId)}
          <p className="text-muted-foreground mt-0.5 leading-snug font-serif-cn">
            {e.evidenceSentence}
          </p>
        </li>
      ))}
    </ul>
  );
}
