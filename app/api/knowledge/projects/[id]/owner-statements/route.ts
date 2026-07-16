import { NextRequest, NextResponse } from "next/server";
import {
  confirmOwnerProjectStatement,
  listOwnerProjectStatements,
  proposeOwnerProjectStatement,
  withdrawOwnerProjectStatement,
} from "@/shared/agent-memory/owner-statements";
import { getProject } from "@/shared/knowledge/repository";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";
import { checkLocalTrustFromRequest } from "@/shared/security/local-session";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Explicit Owner statement lifecycle (PR-06).
 * Chat never auto-writes here; UI must call propose/confirm.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(id);
    if (!getProject(projectId)) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    const includeCandidates =
      req.nextUrl.searchParams.get("includeCandidates") === "1";
    const statements = listOwnerProjectStatements(projectId, {
      includeCandidates,
      includeInactive: req.nextUrl.searchParams.get("includeInactive") === "1",
    });
    return NextResponse.json({ projectId, statements });
  } catch (err) {
    if (err instanceof ProjectScopeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const trust = checkLocalTrustFromRequest(req);
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(id);
    if (!getProject(projectId)) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    const body = (await req.json()) as {
      action?: "propose" | "confirm" | "withdraw";
      text?: string;
      matterId?: string;
      statementId?: string;
      dialogueMessageId?: string;
    };
    const action = body.action ?? "propose";

    if (action === "propose") {
      const row = proposeOwnerProjectStatement({
        projectId,
        matterId: body.matterId,
        text: body.text ?? "",
        source: "manual",
        dialogueMessageId: body.dialogueMessageId,
      });
      if (!row) {
        return NextResponse.json({ error: "text required" }, { status: 400 });
      }
      return NextResponse.json({ statement: row });
    }

    if (action === "confirm") {
      if (!body.statementId) {
        return NextResponse.json({ error: "statementId required" }, { status: 400 });
      }
      const row = confirmOwnerProjectStatement(body.statementId);
      if (!row || row.projectId !== projectId) {
        return NextResponse.json({ error: "陈述不存在" }, { status: 404 });
      }
      return NextResponse.json({ statement: row });
    }

    if (action === "withdraw") {
      if (!body.statementId) {
        return NextResponse.json({ error: "statementId required" }, { status: 400 });
      }
      const row = withdrawOwnerProjectStatement(body.statementId);
      if (!row || row.projectId !== projectId) {
        return NextResponse.json({ error: "陈述不存在" }, { status: 404 });
      }
      return NextResponse.json({ statement: row });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof ProjectScopeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
