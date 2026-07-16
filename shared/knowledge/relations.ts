/**
 * Knowledge relation domain: validation, neighbors, path, rule extract.
 * Pure helpers; repository owns persistence.
 */

import type {
  KnowledgeCard,
  KnowledgeRelation,
  NeighborView,
  PathView,
  RelationNeighborEdge,
  RelationSource,
  RelationStatus,
  RelationType,
} from "@/shared/types/knowledge";
import {
  EVIDENCE_SENTENCE_MAX,
  RELATION_SOURCES,
  RELATION_TYPES,
  RELATION_TYPE_LABELS,
  UNDIRECTED_RELATION_TYPES,
} from "@/shared/types/knowledge";

export class RelationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelationValidationError";
  }
}

export type CreateRelationInput = {
  id?: string;
  fromCardId: string;
  toCardId: string;
  relationType: RelationType;
  evidenceSentence: string;
  anchorCardId?: string;
  status?: RelationStatus;
  directed?: boolean;
  confidence?: number;
  source?: RelationSource;
  createdBy?: string;
  workItemId?: string;
  meta?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export function isDirectedType(type: RelationType): boolean {
  return !UNDIRECTED_RELATION_TYPES.includes(type);
}

export function normalizeEvidenceSentence(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, EVIDENCE_SENTENCE_MAX);
}

export function relationDedupKey(rel: {
  fromCardId: string;
  toCardId: string;
  relationType: RelationType;
  evidenceSentence: string;
}): string {
  const sentence = normalizeEvidenceSentence(rel.evidenceSentence).toLowerCase();
  if (!isDirectedType(rel.relationType)) {
    const [a, b] = [rel.fromCardId, rel.toCardId].sort();
    return `${a}|${b}|${rel.relationType}|${sentence}`;
  }
  return `${rel.fromCardId}|${rel.toCardId}|${rel.relationType}|${sentence}`;
}

export function assertRelationShape(
  input: CreateRelationInput,
  cardIds: Set<string>,
): {
  fromCardId: string;
  toCardId: string;
  relationType: RelationType;
  evidenceSentence: string;
  directed: boolean;
  status: RelationStatus;
  source: RelationSource;
} {
  const fromCardId = input.fromCardId?.trim();
  const toCardId = input.toCardId?.trim();
  if (!fromCardId || !toCardId) {
    throw new RelationValidationError("起点与终点卡必填");
  }
  if (fromCardId === toCardId) {
    throw new RelationValidationError("不能连接同一张卡");
  }
  if (!cardIds.has(fromCardId) || !cardIds.has(toCardId)) {
    throw new RelationValidationError("起点或终点卡不存在");
  }
  if (!RELATION_TYPES.includes(input.relationType)) {
    throw new RelationValidationError("关系类型无效");
  }
  const evidenceSentence = normalizeEvidenceSentence(
    input.evidenceSentence ?? "",
  );
  if (!evidenceSentence) {
    throw new RelationValidationError("来源句不能为空");
  }
  const directed =
    input.directed !== undefined
      ? input.directed
      : isDirectedType(input.relationType);
  const status = input.status ?? "confirmed";
  if (
    status !== "confirmed" &&
    status !== "suggested" &&
    status !== "rejected"
  ) {
    throw new RelationValidationError("关系状态无效");
  }
  const source = input.source ?? "manual";
  if (!RELATION_SOURCES.includes(source)) {
    throw new RelationValidationError("关系来源无效");
  }
  return {
    fromCardId,
    toCardId,
    relationType: input.relationType,
    evidenceSentence,
    directed,
    status,
    source,
  };
}

export function endpointMatches(
  rel: KnowledgeRelation,
  cardId: string,
): boolean {
  if (rel.fromCardId === cardId || rel.toCardId === cardId) return true;
  return false;
}

export function otherCardId(rel: KnowledgeRelation, cardId: string): string {
  if (rel.fromCardId === cardId) return rel.toCardId;
  return rel.fromCardId;
}

export function edgeDirection(
  rel: KnowledgeRelation,
  centerCardId: string,
): "out" | "in" | "both" {
  if (!rel.directed) return "both";
  if (rel.fromCardId === centerCardId) return "out";
  return "in";
}

export function filterRelationsForQuery(
  relations: KnowledgeRelation[],
  options?: {
    cardId?: string;
    status?: RelationStatus | RelationStatus[];
    type?: RelationType | RelationType[];
    workItemId?: string;
    includeRejected?: boolean;
  },
): KnowledgeRelation[] {
  let list = [...relations];
  if (!options?.includeRejected) {
    list = list.filter((r) => r.status !== "rejected");
  }
  if (options?.cardId) {
    list = list.filter((r) => endpointMatches(r, options.cardId!));
  }
  if (options?.status) {
    const set = new Set(
      Array.isArray(options.status) ? options.status : [options.status],
    );
    list = list.filter((r) => set.has(r.status));
  }
  if (options?.type) {
    const set = new Set(
      Array.isArray(options.type) ? options.type : [options.type],
    );
    list = list.filter((r) => set.has(r.relationType));
  }
  if (options?.workItemId) {
    list = list.filter((r) => r.workItemId === options.workItemId);
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function buildNeighborView(
  cardId: string,
  relations: KnowledgeRelation[],
  cards: Map<string, KnowledgeCard>,
  options?: { status?: RelationStatus | RelationStatus[] },
): NeighborView {
  const filtered = filterRelationsForQuery(relations, {
    cardId,
    status: options?.status ?? ["confirmed", "suggested"],
  });
  const edges: RelationNeighborEdge[] = [];
  for (const rel of filtered) {
    const otherId = otherCardId(rel, cardId);
    const other = cards.get(otherId);
    if (!other) continue;
    edges.push({
      id: rel.id,
      relationType: rel.relationType,
      direction: edgeDirection(rel, cardId),
      evidenceSentence: rel.evidenceSentence,
      status: rel.status,
      otherCard: {
        id: other.id,
        title: other.title || other.content.slice(0, 40),
        source: other.source,
      },
    });
  }
  return { cardId, edges };
}

/**
 * BFS shortest path on undirected projection of edges
 * (undirected types + both directions of directed for reachability).
 * Only includes relations whose status is in `status` (default confirmed).
 */
export function findPath(
  fromCardId: string,
  toCardId: string,
  relations: KnowledgeRelation[],
  options?: {
    maxDepth?: number;
    status?: RelationStatus | RelationStatus[];
  },
): PathView | null {
  if (fromCardId === toCardId) {
    return { nodes: [fromCardId], edges: [], length: 0 };
  }
  const maxDepth = options?.maxDepth ?? 3;
  const statusSet = new Set(
    Array.isArray(options?.status)
      ? options!.status!
      : options?.status
        ? [options.status]
        : (["confirmed"] as RelationStatus[]),
  );

  // adjacency: cardId -> list of { other, relationId }
  const adj = new Map<string, { other: string; relationId: string }[]>();
  for (const rel of relations) {
    if (!statusSet.has(rel.status)) continue;
    if (!adj.has(rel.fromCardId)) adj.set(rel.fromCardId, []);
    if (!adj.has(rel.toCardId)) adj.set(rel.toCardId, []);
    adj.get(rel.fromCardId)!.push({
      other: rel.toCardId,
      relationId: rel.id,
    });
    // Always allow reverse walk for path discovery (reachability).
    adj.get(rel.toCardId)!.push({
      other: rel.fromCardId,
      relationId: rel.id,
    });
  }

  type Step = {
    node: string;
    edgeId: string | null;
    parent: number;
    depth: number;
  };
  const queue: Step[] = [
    { node: fromCardId, edgeId: null, parent: -1, depth: 0 },
  ];
  const visited = new Set<string>([fromCardId]);
  let head = 0;
  let foundAt = -1;

  while (head < queue.length) {
    const cur = queue[head];
    if (cur.depth >= maxDepth) {
      head += 1;
      continue;
    }
    for (const next of adj.get(cur.node) ?? []) {
      if (visited.has(next.other)) continue;
      visited.add(next.other);
      const idx = queue.length;
      queue.push({
        node: next.other,
        edgeId: next.relationId,
        parent: head,
        depth: cur.depth + 1,
      });
      if (next.other === toCardId) {
        foundAt = idx;
        break;
      }
    }
    if (foundAt >= 0) break;
    head += 1;
  }

  if (foundAt < 0) return null;

  const nodes: string[] = [];
  const edges: string[] = [];
  let i = foundAt;
  while (i >= 0) {
    nodes.unshift(queue[i].node);
    if (queue[i].edgeId) edges.unshift(queue[i].edgeId!);
    i = queue[i].parent;
  }
  return { nodes, edges, length: edges.length };
}

/** Subgraph edges whose both ends are in cardId set. */
export function islandEdges(
  cardIds: string[],
  relations: KnowledgeRelation[],
  options?: { status?: RelationStatus | RelationStatus[] },
): KnowledgeRelation[] {
  const set = new Set(cardIds);
  return filterRelationsForQuery(relations, {
    status: options?.status ?? ["confirmed", "suggested"],
  }).filter((r) => set.has(r.fromCardId) && set.has(r.toCardId));
}

// --- Rule extract (deterministic) ---

const SUPPORT_CUES =
  /因此|所以|依据|说明|带来源|必须带来源|可复用|下一步|验收/;

/**
 * Extract candidate relations from cards using deterministic rules.
 * Does not assign ids; caller persists.
 */
export function extractRelationCandidates(
  cards: KnowledgeCard[],
  existing: KnowledgeRelation[],
): CreateRelationInput[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const existingKeys = new Set(
    existing
      .filter((r) => r.status !== "rejected")
      .map((r) => relationDedupKey(r)),
  );
  const out: CreateRelationInput[] = [];

  const push = (input: CreateRelationInput) => {
    try {
      const shape = assertRelationShape(input, new Set(byId.keys()));
      const key = relationDedupKey(shape);
      if (existingKeys.has(key)) return;
      // also check against candidates in this batch
      if (
        out.some(
          (c) =>
            relationDedupKey({
              fromCardId: c.fromCardId,
              toCardId: c.toCardId,
              relationType: c.relationType,
              evidenceSentence: c.evidenceSentence,
            }) === key,
        )
      ) {
        return;
      }
      out.push({
        ...input,
        status: "suggested",
        source: "rule",
        createdBy: input.createdBy ?? "system:rule",
      });
    } catch {
      // skip invalid
    }
  };

  // R-explicit-ref: body contains another card id or full title
  for (const card of cards) {
    for (const other of cards) {
      if (other.id === card.id) continue;
      const title = other.title?.trim();
      if (card.content.includes(other.id)) {
        const sentence =
          card.content
            .split(/[。！？\n]/)
            .map((s) => s.trim())
            .find((s) => s.includes(other.id)) ||
          `正文引用 ${other.id}`;
        push({
          fromCardId: card.id,
          toCardId: other.id,
          relationType: "mentions",
          evidenceSentence: sentence,
          source: "rule",
          meta: { rule: "R-explicit-ref", kind: "id" },
        });
      }
      if (title && title.length >= 4 && card.content.includes(title)) {
        const sentence =
          card.content
            .split(/[。！？\n]/)
            .map((s) => s.trim())
            .find((s) => s.includes(title)) || title;
        push({
          fromCardId: card.id,
          toCardId: other.id,
          relationType: "derived_from",
          evidenceSentence: sentence,
          source: "rule",
          meta: { rule: "R-explicit-ref", kind: "title" },
        });
      }
    }
  }

  // R-support-cue: shared tags ≥2 and support cue in one body
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      const tagsA = new Set(a.tags);
      const shared = b.tags.filter((t) => tagsA.has(t));
      if (shared.length < 2) continue;
      const from = SUPPORT_CUES.test(a.content)
        ? a
        : SUPPORT_CUES.test(b.content)
          ? b
          : null;
      const to = from?.id === a.id ? b : from?.id === b.id ? a : null;
      if (!from || !to) continue;
      const sentence =
        from.content
          .split(/[。！？\n]/)
          .map((s) => s.trim())
          .find((s) => SUPPORT_CUES.test(s)) || from.content.slice(0, 80);
      push({
        fromCardId: from.id,
        toCardId: to.id,
        relationType: "supports",
        evidenceSentence: sentence,
        source: "rule",
        meta: { rule: "R-support-cue", sharedTags: shared },
      });
    }
  }

  // B-3: material-backed cards (sourceFileId) — only evidence-backed links.
  for (const candidate of extractMaterialRelationCandidates(cards, existing)) {
    push(candidate);
  }

  return out;
}

/** Tokenize for material overlap; skip short / noise tokens. */
export function significantMaterialTokens(text: string): string[] {
  const raw = text ?? "";
  const tokens = new Set<string>();
  for (const m of raw.match(/[\u4e00-\u9fff]{2,12}/g) ?? []) {
    tokens.add(m);
  }
  for (const m of raw.match(/[A-Za-z][A-Za-z0-9_-]{3,24}/g) ?? []) {
    tokens.add(m.toLowerCase());
  }
  // Drop ultra-common Chinese fillers that would cause random links.
  for (const noise of [
    "因此",
    "所以",
    "我们",
    "你们",
    "他们",
    "这个",
    "那个",
    "可以",
    "没有",
    "一个",
    "进行",
    "通过",
    "如果",
    "已经",
    "需要",
    "项目",
    "材料",
    "文件",
    "内容",
  ]) {
    tokens.delete(noise);
  }
  return [...tokens];
}

function materialLabel(card: KnowledgeCard): string {
  const fromFile = card.sourceFileId?.split("/").pop()?.trim() ?? "";
  const title = card.title?.trim() ?? "";
  return fromFile || title;
}

/**
 * B-3 soft: propose relations among material-backed cards (sourceFileId).
 * Id alignment (pending G3-B1-done): material.id = relativePath; card.sourceFileId = material.id;
 * endpoints remain card ids so existing relation graph works.
 *
 * Only runs pairing when a project has ≥3 material cards.
 * Never invents links without a quotable evidence sentence.
 */
export function extractMaterialRelationCandidates(
  cards: KnowledgeCard[],
  existing: KnowledgeRelation[],
): CreateRelationInput[] {
  const byProject = new Map<string, KnowledgeCard[]>();
  for (const card of cards) {
    if (!card.sourceFileId?.trim()) continue;
    const list = byProject.get(card.projectId) ?? [];
    list.push(card);
    byProject.set(card.projectId, list);
  }

  const existingKeys = new Set(
    existing
      .filter((r) => r.status !== "rejected")
      .map((r) => relationDedupKey(r)),
  );
  const out: CreateRelationInput[] = [];
  const push = (input: CreateRelationInput) => {
    try {
      const cardIds = new Set(cards.map((c) => c.id));
      const shape = assertRelationShape(input, cardIds);
      const key = relationDedupKey(shape);
      if (existingKeys.has(key)) return;
      if (
        out.some(
          (c) =>
            relationDedupKey({
              fromCardId: c.fromCardId,
              toCardId: c.toCardId,
              relationType: c.relationType,
              evidenceSentence: c.evidenceSentence,
            }) === key,
        )
      ) {
        return;
      }
      out.push({
        ...input,
        status: "suggested",
        source: "rule",
        createdBy: input.createdBy ?? "system:rule:material",
      });
    } catch {
      // skip
    }
  };

  for (const [, materialCards] of byProject) {
    if (materialCards.length < 3) continue;

    // R-material-label-ref: body quotes another material's file/title (length≥2).
    for (const card of materialCards) {
      for (const other of materialCards) {
        if (other.id === card.id) continue;
        const label = materialLabel(other);
        if (!label || label.length < 2) continue;
        if (!card.content.includes(label) && !card.content.includes(other.id)) {
          continue;
        }
        const sentence =
          card.content
            .split(/[。！？\n]/)
            .map((s) => s.trim())
            .find((s) => s.includes(label) || s.includes(other.id)) ||
          `正文提到材料「${label}」`;
        push({
          fromCardId: card.id,
          toCardId: other.id,
          relationType: "mentions",
          evidenceSentence: sentence,
          source: "rule",
          meta: {
            rule: "R-material-label-ref",
            fromMaterialId: card.sourceFileId,
            toMaterialId: other.sourceFileId,
          },
        });
      }
    }

    // R-material-shared-token: both bodies share a significant token; quote both sides.
    for (let i = 0; i < materialCards.length; i++) {
      for (let j = i + 1; j < materialCards.length; j++) {
        const a = materialCards[i];
        const b = materialCards[j];
        const tokensA = new Set(significantMaterialTokens(a.content));
        const shared = significantMaterialTokens(b.content).filter((t) =>
          tokensA.has(t),
        );
        if (shared.length === 0) continue;
        // Prefer longer tokens (more specific evidence).
        shared.sort((x, y) => y.length - x.length);
        const token = shared[0];
        if (!token || token.length < 2) continue;
        const sentenceA =
          a.content
            .split(/[。！？\n]/)
            .map((s) => s.trim())
            .find((s) => s.toLowerCase().includes(token.toLowerCase())) ||
          a.content.slice(0, 80);
        const sentenceB =
          b.content
            .split(/[。！？\n]/)
            .map((s) => s.trim())
            .find((s) => s.toLowerCase().includes(token.toLowerCase())) ||
          b.content.slice(0, 80);
        if (!sentenceA.includes(token) && !sentenceA.toLowerCase().includes(token)) {
          // token may be lowercased English; still require presence in at least one original sentence path
        }
        const evidence = normalizeEvidenceSentence(
          `双方均出现「${token}」：${sentenceA} ｜ ${sentenceB}`,
        );
        if (!evidence.includes(token) && !evidence.toLowerCase().includes(token)) {
          continue;
        }
        push({
          fromCardId: a.id,
          toCardId: b.id,
          relationType: "same_topic",
          evidenceSentence: evidence,
          source: "rule",
          meta: {
            rule: "R-material-shared-token",
            token,
            fromMaterialId: a.sourceFileId,
            toMaterialId: b.sourceFileId,
          },
        });
      }
    }
  }

  return out;
}

export function relationTypeLabel(type: RelationType): string {
  return RELATION_TYPE_LABELS[type] ?? type;
}
