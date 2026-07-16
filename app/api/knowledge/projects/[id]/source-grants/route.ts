import { NextRequest, NextResponse } from "next/server";
import {
  createProjectSourceGrant,
  disableProjectSourceGrant,
  listProjectSourceGrants,
  revokeProjectSourceGrant,
  ProjectAccessError,
  ProjectScopeError,
} from "@/shared/knowledge/repository";
import { requireProjectId } from "@/shared/knowledge/project-scope";
import {
  getDefaultSourceGrantManager,
  SourceGrantStateError,
} from "@/shared/project-memory/grants";
import {
  connectFromSelectionId,
  getFolderSelectionStore,
} from "@/shared/project-memory/native-folder-picker";
import {
  checkLocalTrust,
  CSRF_HEADER,
} from "@/shared/security/local-session";

type Ctx = { params: Promise<{ id: string }> };

type LocalGrantBody = {
  /** @deprecated Rejected: clients must not supply filesystem roots. */
  rootPath?: string;
  selectionId?: string;
  /** Issued by preflight POST; required with selectionId. */
  confirmToken?: string;
  kind?: "local_folder" | "local_git";
  includePathPrefixes?: string[];
  excludePathPrefixes?: string[];
  projectId?: string;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(
      req.nextUrl.searchParams.get("projectId") ?? id,
    );
    if (projectId !== id) {
      return NextResponse.json(
        { error: "projectId 与路径项目不一致" },
        { status: 400 },
      );
    }
    const localGrants = getDefaultSourceGrantManager().list(projectId);
    const legacyGrants = listProjectSourceGrants(projectId);
    return NextResponse.json({ grants: [...localGrants, ...legacyGrants], projectId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const trust = checkLocalTrust({
    method: "POST",
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    cookieHeader: req.headers.get("cookie"),
    csrfHeader: req.headers.get(CSRF_HEADER),
  });
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(id);
    const body = (await req.json()) as LocalGrantBody & {
      sourceProjectId?: string;
      approvedBy?: string;
      expiresAt?: string | null;
    };
    if (body.projectId !== undefined && requireProjectId(body.projectId) !== projectId) {
      return NextResponse.json(
        { error: "projectId 与路径项目不一致" },
        { status: 400 },
      );
    }

    // P0: never accept client-supplied rootPath as a live grant root.
    if (typeof body.rootPath === "string" && body.rootPath.trim()) {
      return NextResponse.json(
        {
          error:
            "禁止客户端直接提交 rootPath。请先 folder-picker 取得 selectionId，再 connect。",
        },
        { status: 400 },
      );
    }

    if (body.selectionId?.trim()) {
      const confirmToken = body.confirmToken?.trim();
      if (!confirmToken) {
        return NextResponse.json(
          {
            error:
              "connect 需要 preflight 返回的 confirmToken（请先完成预检确认）",
          },
          { status: 400 },
        );
      }
      // selectionId → server-derived project identity only (never client rootPath).
      // Path projectId is the page host; first connect derives id from canonical root.
      const connection = await connectFromSelectionId(body.selectionId.trim(), {
        store: getFolderSelectionStore(),
        manager: getDefaultSourceGrantManager(),
        confirmToken,
      });
      return NextResponse.json(
        { ...connection, requestedPathProjectId: projectId },
        { status: 201 },
      );
    }

    // Preserve the pre-existing T-19 cross-project grant surface. It is not
    // used by the local observer and never widens a local root grant.
    if (!body.approvedBy?.trim()) {
      return NextResponse.json(
        {
          error:
            "本地授权需要 selectionId；跨项目授权需要 Owner 确认（approvedBy 必填）",
        },
        { status: 400 },
      );
    }
    const grant = createProjectSourceGrant({
      hostProjectId: projectId,
      sourceProjectId: requireProjectId(body.sourceProjectId),
      approvedBy: body.approvedBy,
      expiresAt: body.expiresAt ?? null,
    });
    return NextResponse.json({ grant }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建失败";
    const status =
      error instanceof ProjectAccessError
        ? 404
        : error instanceof ProjectScopeError
          ? 400
          : error instanceof SourceGrantStateError
            ? 400
            : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Preserve T-19 disable/revoke for the legacy cross-project grant surface. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const trust = checkLocalTrust({
    method: "PATCH",
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    cookieHeader: req.headers.get("cookie"),
    csrfHeader: req.headers.get(CSRF_HEADER),
  });
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
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
    if (body.projectId !== undefined && requireProjectId(body.projectId) !== hostProjectId) {
      return NextResponse.json(
        { error: "projectId 与路径项目不一致" },
        { status: 400 },
      );
    }
    const grantId = body.grantId?.trim();
    if (!grantId) return NextResponse.json({ error: "grantId 必填" }, { status: 400 });
    if (body.action !== "disable" && body.action !== "revoke") {
      return NextResponse.json(
        { error: "action 须为 disable 或 revoke" },
        { status: 400 },
      );
    }
    const grant =
      body.action === "disable"
        ? disableProjectSourceGrant(hostProjectId, grantId, { disabledBy: body.disabledBy })
        : revokeProjectSourceGrant(hostProjectId, grantId, {
            revokedBy: body.revokedBy,
            reason: body.reason,
          });
    return NextResponse.json({ grant, projectId: hostProjectId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    const status = error instanceof ProjectAccessError ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
