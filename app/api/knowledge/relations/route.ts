import { NextRequest, NextResponse } from "next/server";
import {
  createRelation,
  listRelations,
  RelationValidationError,
} from "@/shared/knowledge/repository";
import type { RelationStatus, RelationType } from "@/shared/types/knowledge";
import {
  DEFAULT_ACTOR,
  RELATION_STATUSES,
  RELATION_TYPES,
} from "@/shared/types/knowledge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId") ?? undefined;
  const workItemId = searchParams.get("workItemId") ?? undefined;
  const includeRejected = searchParams.get("includeRejected") === "1";
  const statusParam = searchParams.get("status");
  const typeParam = searchParams.get("type");

  let status: RelationStatus | RelationStatus[] | undefined;
  if (statusParam) {
    const parts = statusParam
      .split(",")
      .filter((s): s is RelationStatus =>
        RELATION_STATUSES.includes(s as RelationStatus),
      );
    status = parts.length === 1 ? parts[0] : parts.length ? parts : undefined;
  }

  let type: RelationType | RelationType[] | undefined;
  if (typeParam) {
    const parts = typeParam
      .split(",")
      .filter((t): t is RelationType =>
        RELATION_TYPES.includes(t as RelationType),
      );
    type = parts.length === 1 ? parts[0] : parts.length ? parts : undefined;
  }

  const items = listRelations({
    cardId,
    workItemId,
    status,
    type,
    includeRejected,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fromCardId?: string;
      toCardId?: string;
      relationType?: RelationType;
      evidenceSentence?: string;
      status?: RelationStatus;
      source?: "manual" | "rule" | "import" | "model";
      createdBy?: string;
      workItemId?: string;
      anchorCardId?: string;
    };

    if (!body.fromCardId || !body.toCardId) {
      return NextResponse.json(
        { error: "fromCardId 与 toCardId 必填" },
        { status: 400 },
      );
    }
    if (!body.relationType || !RELATION_TYPES.includes(body.relationType)) {
      return NextResponse.json({ error: "relationType 无效" }, { status: 400 });
    }
    if (!body.evidenceSentence?.trim()) {
      return NextResponse.json({ error: "来源句不能为空" }, { status: 400 });
    }

    const item = createRelation(
      {
        fromCardId: body.fromCardId,
        toCardId: body.toCardId,
        relationType: body.relationType,
        evidenceSentence: body.evidenceSentence,
        status: body.status ?? "confirmed",
        source: body.source ?? "manual",
        createdBy: body.createdBy ?? DEFAULT_ACTOR,
        workItemId: body.workItemId,
        anchorCardId: body.anchorCardId,
      },
      body.createdBy ?? DEFAULT_ACTOR,
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const status = error instanceof RelationValidationError ? 400 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建失败" },
      { status },
    );
  }
}
