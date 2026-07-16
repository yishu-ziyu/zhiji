import { NextRequest, NextResponse } from "next/server";
import {
  connectFromSelectionId,
  continuePersistedConnection,
  listRecentFolderConnections,
  toConnectionsPostPayload,
} from "@/shared/project-memory/native-folder-picker";
import { SourceGrantStateError } from "@/shared/project-memory/grants";

/**
 * GET /api/knowledge/project-memory/connections
 * Minimal recent active local folder connection for Continue.
 */
export async function GET() {
  try {
    const recent = listRecentFolderConnections(1);
    return NextResponse.json({
      recent,
      connection: recent[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取失败" },
      { status: 500 },
    );
  }
}

type ConnectBody = {
  mode?: string;
  action?: string;
  selectionId?: string;
  projectId?: string;
  grantId?: string;
  /** Rejected: must never be accepted for new connect. */
  rootPath?: string;
};

/**
 * POST /api/knowledge/project-memory/connections
 *
 * Contract (D-50 deepened):
 * - mode=connect + selectionId → authorize folder, bootstrap default matter/watch,
 *   reconcile, return MATCHED/relevant eventIds (selectMatterEvents) for analysis.
 * - mode=continue + projectId + grantId → load persisted bootstrap, reconcile when
 *   needed, return same shape with relevant eventIds.
 * - eventIds / matchedEventIds are never the full observed reconcile list.
 * - Fresh UI calls existing analysis-runs with these ids; no Agent pipeline here.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConnectBody;
    const mode = (body.mode ?? body.action ?? "").trim().toLowerCase();

    // Hard reject client-supplied roots for this surface (D-50).
    if (typeof body.rootPath === "string" && body.rootPath.trim()) {
      return NextResponse.json(
        { error: "connections API does not accept rootPath; use selectionId or continue" },
        { status: 400 },
      );
    }

    if (mode === "connect" || mode === "new" || mode === "selection") {
      const selectionId = body.selectionId?.trim();
      if (!selectionId) {
        return NextResponse.json(
          { error: "selectionId required for connect" },
          { status: 400 },
        );
      }
      if (typeof body.projectId === "string" && body.projectId.trim()) {
        return NextResponse.json(
          {
            error:
              "connect does not accept client projectId; system derives it from folder identity",
          },
          { status: 400 },
        );
      }
      const connection = await connectFromSelectionId(selectionId);
      return NextResponse.json(toConnectionsPostPayload("connect", connection), {
        status: 201,
      });
    }

    if (mode === "continue" || mode === "resume") {
      const projectId = body.projectId?.trim();
      const grantId = body.grantId?.trim();
      if (!projectId || !grantId) {
        return NextResponse.json(
          { error: "continue requires projectId and grantId" },
          { status: 400 },
        );
      }
      const connection = await continuePersistedConnection({ projectId, grantId });
      return NextResponse.json(toConnectionsPostPayload("continue", connection));
    }

    return NextResponse.json(
      { error: "mode must be connect or continue" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "连接失败";
    const status = error instanceof SourceGrantStateError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
