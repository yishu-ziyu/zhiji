import { NextRequest, NextResponse } from "next/server";
import {
  getOwnerDecisionWriter,
  OwnerOnlyResolutionError,
  resolveUnderstanding,
} from "@/shared/project-memory/reconstruct";
import type { UnderstandingBody } from "@/shared/project-memory/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Owner resolve path: OwnerDecisionWriter only.
 * Does not use AgentMemoryService / CandidateWriter container.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: candidateRevisionId } = await ctx.params;
  try {
    const body = (await req.json()) as {
      decision?: "accept" | "edit_accept" | "reject";
      editedBody?: UnderstandingBody;
      actor?: string;
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
    const writer = getOwnerDecisionWriter();
    const result = await resolveUnderstanding(writer, {
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
    const message = error instanceof Error ? error.message : "决议失败";
    const status =
      message.includes("不存在") || message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
