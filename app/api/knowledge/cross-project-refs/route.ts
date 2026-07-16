import { NextRequest, NextResponse } from "next/server";
import {
  createCrossProjectReference,
  listCrossProjectReferences,
  verifyCrossProjectReference,
} from "@/shared/knowledge/repository";
import { DEFAULT_ACTOR } from "@/shared/types/knowledge";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";

/** GET ?hostProjectId= — list Owner-approved refs hosted by project */
export async function GET(req: NextRequest) {
  try {
    const hostProjectId = requireProjectId(
      req.nextUrl.searchParams.get("hostProjectId") ??
        req.nextUrl.searchParams.get("projectId"),
    );
    const refs = listCrossProjectReferences(hostProjectId);
    return NextResponse.json({ refs, hostProjectId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 400 },
    );
  }
}

/**
 * POST create or verify.
 * action: "create" | "verify"
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: "create" | "verify";
      hostProjectId?: string;
      sourceProjectId?: string;
      sourceKind?: "card" | "material";
      sourceObjectId?: string;
      approvedBy?: string;
      refId?: string;
    };

    const action = body.action ?? "create";
    if (action === "verify") {
      if (!body.refId?.trim()) {
        return NextResponse.json({ error: "refId 必填" }, { status: 400 });
      }
      const ref = verifyCrossProjectReference(body.refId.trim());
      return NextResponse.json({ ref });
    }

    const hostProjectId = requireProjectId(body.hostProjectId);
    const sourceProjectId = requireProjectId(body.sourceProjectId);
    if (!body.sourceObjectId?.trim()) {
      return NextResponse.json(
        { error: "sourceObjectId 必填" },
        { status: 400 },
      );
    }
    const ref = createCrossProjectReference({
      hostProjectId,
      sourceProjectId,
      sourceKind: body.sourceKind === "material" ? "material" : "card",
      sourceObjectId: body.sourceObjectId,
      approvedBy: body.approvedBy ?? DEFAULT_ACTOR,
    });
    return NextResponse.json({ ref }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "创建失败",
      },
      { status: error instanceof ProjectScopeError ? 400 : 400 },
    );
  }
}
