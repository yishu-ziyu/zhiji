/**
 * T-19 S2: host-scoped source grant create / inspect / disable / revoke.
 * Surface matches G5 RED@6d224c4c: GET|POST|PATCH .../source-grants
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createProjectSourceGrant,
  disableProjectSourceGrant,
  listProjectSourceGrants,
  ProjectAccessError,
  ProjectScopeError,
  revokeProjectSourceGrant,
} from "@/shared/knowledge/repository";
import { requireProjectId } from "@/shared/knowledge/project-scope";

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
    const grants = listProjectSourceGrants(hostProjectId);
    return NextResponse.json({ grants, projectId: hostProjectId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const hostProjectId = requireProjectId(id);
    const body = (await req.json()) as {
      sourceProjectId?: string;
      approvedBy?: string;
      expiresAt?: string | null;
      projectId?: string;
    };
    if (body.projectId !== undefined) {
      const claimed = requireProjectId(body.projectId);
      if (claimed !== hostProjectId) {
        return NextResponse.json(
          { error: "projectId 与路径项目不一致" },
          { status: 400 },
        );
      }
    }
    if (!body.approvedBy?.trim()) {
      return NextResponse.json(
        { error: "跨项目授权需要 Owner 确认（approvedBy 必填）" },
        { status: 400 },
      );
    }
    const grant = createProjectSourceGrant({
      hostProjectId,
      sourceProjectId: requireProjectId(body.sourceProjectId),
      approvedBy: body.approvedBy,
      expiresAt: body.expiresAt ?? null,
    });
    return NextResponse.json({ grant }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "创建失败";
    const status =
      error instanceof ProjectAccessError
        ? 404
        : error instanceof ProjectScopeError
          ? 400
          : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * Disable or revoke a host-owned grant.
 * Body: { grantId, action: "disable"|"revoke", reason?, disabledBy?, revokedBy? }
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const hostProjectId = requireProjectId(id);
    const body = (await req.json()) as {
      grantId?: string;
      action?: "disable" | "revoke";
      reason?: string;
      disabledBy?: string;
      revokedBy?: string;
      projectId?: string;
    };
    if (body.projectId !== undefined) {
      const claimed = requireProjectId(body.projectId);
      if (claimed !== hostProjectId) {
        return NextResponse.json(
          { error: "projectId 与路径项目不一致" },
          { status: 400 },
        );
      }
    }
    const grantId = body.grantId?.trim();
    if (!grantId) {
      return NextResponse.json({ error: "grantId 必填" }, { status: 400 });
    }
    if (body.action !== "disable" && body.action !== "revoke") {
      return NextResponse.json(
        { error: "action 须为 disable 或 revoke" },
        { status: 400 },
      );
    }
    const grant =
      body.action === "disable"
        ? disableProjectSourceGrant(hostProjectId, grantId, {
            disabledBy: body.disabledBy,
          })
        : revokeProjectSourceGrant(hostProjectId, grantId, {
            revokedBy: body.revokedBy,
            reason: body.reason,
          });
    return NextResponse.json({ grant, projectId: hostProjectId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "更新失败";
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (error instanceof ProjectScopeError) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
