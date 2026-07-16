/**
 * T-19 / D-27: Owner-approved revision-pinned cross-project references.
 * Nested under /projects/[id] to match G5 RED acceptance surface.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createCrossProjectReference,
  listCrossProjectReferences,
  markCrossProjectSourceChanged,
  toCrossProjectReferenceView,
  verifyCrossProjectReference,
} from "@/shared/knowledge/repository";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const hostProjectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId") ?? id,
    );
    if (hostProjectId !== id) {
      return NextResponse.json(
        { error: "projectId 与路径项目不一致" },
        { status: 400 },
      );
    }
    const items = listCrossProjectReferences(hostProjectId).map(
      toCrossProjectReferenceView,
    );
    return NextResponse.json({ items, projectId: hostProjectId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 400 },
    );
  }
}

/**
 * Create approved ref, verify, or mark source_changed.
 * Body.action: "create" | "verify" | "source_changed" (default create).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: hostFromPath } = await ctx.params;
    const body = (await req.json()) as {
      action?: "create" | "verify" | "source_changed";
      sourceProjectId?: string;
      sourceObjectKind?: "card" | "material";
      sourceKind?: "card" | "material";
      sourceObjectId?: string;
      sourceRevision?: string;
      approvedBy?: string;
      refId?: string;
      newRevision?: string;
    };

    const action = body.action ?? "create";

    if (action === "verify") {
      if (!body.refId?.trim()) {
        return NextResponse.json({ error: "refId 必填" }, { status: 400 });
      }
      const reference = toCrossProjectReferenceView(
        verifyCrossProjectReference(body.refId.trim()),
      );
      return NextResponse.json({ reference });
    }

    if (action === "source_changed") {
      const sourceProjectId = requireProjectId(body.sourceProjectId);
      if (!body.sourceObjectId?.trim()) {
        return NextResponse.json(
          { error: "sourceObjectId 必填" },
          { status: 400 },
        );
      }
      const items = markCrossProjectSourceChanged({
        sourceProjectId,
        sourceObjectId: body.sourceObjectId,
        newRevision: body.newRevision,
      }).map(toCrossProjectReferenceView);
      return NextResponse.json({ items, updated: items.length });
    }

    // create
    const hostProjectId = requireProjectId(hostFromPath);
    const sourceProjectId = requireProjectId(body.sourceProjectId);
    if (!body.sourceObjectId?.trim()) {
      return NextResponse.json(
        { error: "sourceObjectId 必填" },
        { status: 400 },
      );
    }
    if (!body.approvedBy?.trim()) {
      return NextResponse.json(
        { error: "跨项目引用需要 Owner 确认（approvedBy 必填）" },
        { status: 400 },
      );
    }
    const sourceKind =
      body.sourceObjectKind === "material" || body.sourceKind === "material"
        ? "material"
        : "card";
    const ref = createCrossProjectReference({
      hostProjectId,
      sourceProjectId,
      sourceKind,
      sourceObjectId: body.sourceObjectId,
      approvedBy: body.approvedBy,
      sourceRevision: body.sourceRevision,
    });
    return NextResponse.json(
      { reference: toCrossProjectReferenceView(ref) },
      { status: 201 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建失败";
    const status =
      error instanceof ProjectScopeError ||
      msg.includes("Owner") ||
      msg.includes("批准")
        ? 400
        : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

/** Optional helper for G5 gate 6 (source revision bump). */
export async function notifySourceChanged(input: {
  sourceProjectId: string;
  sourceObjectId: string;
  newRevision?: string;
}) {
  return markCrossProjectSourceChanged(input).map(toCrossProjectReferenceView);
}
