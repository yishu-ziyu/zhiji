import { NextRequest, NextResponse } from "next/server";
import {
  getOwnerDecisionWriter,
  getProjectMemoryReader,
  OwnerOnlyResolutionError,
  ResolveValidationError,
  resolveUnderstanding,
} from "@/shared/project-memory/reconstruct";
import type { UnderstandingBody } from "@/shared/project-memory/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Owner resolve: OwnerDecisionWriter only + Reader for scope validation.
 * Requires projectId + matterId (+ path candidateId); edit_accept needs editedBody.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: candidateRevisionId } = await ctx.params;
  try {
    const body = (await req.json()) as {
      decision?: "accept" | "edit_accept" | "reject";
      editedBody?: UnderstandingBody;
      actor?: string;
      projectId?: string;
      matterId?: string;
    };
    if (
      !body.decision ||
      !["accept", "edit_accept", "reject"].includes(body.decision)
    ) {
      return NextResponse.json({ error: "decision 无效" }, { status: 400 });
    }
    const actor = body.actor?.trim() || "";
    if (actor !== "owner") {
      return NextResponse.json(
        { error: "仅 Owner 可决议理解候选" },
        { status: 403 },
      );
    }
    if (!body.projectId?.trim() || !body.matterId?.trim()) {
      return NextResponse.json(
        { error: "projectId 与 matterId 必填" },
        { status: 400 },
      );
    }
    if (body.decision === "edit_accept" && !body.editedBody) {
      return NextResponse.json(
        { error: "edit_accept 必须提供 editedBody" },
        { status: 400 },
      );
    }
    const writer = getOwnerDecisionWriter();
    const reader = getProjectMemoryReader();
    const result = await resolveUnderstanding(writer, reader, {
      projectId: body.projectId.trim(),
      matterId: body.matterId.trim(),
      candidateRevisionId,
      decision: body.decision,
      editedBody: body.editedBody,
      actor: "owner",
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerOnlyResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ResolveValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "决议失败";
    const status =
      message.includes("不存在") || message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
