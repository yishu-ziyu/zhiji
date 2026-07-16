import { NextResponse } from "next/server";
import { matterIdForLocalGrant } from "@/shared/project-memory/grants";
import {
  getMemoryView,
  getProjectMemoryReader,
} from "@/shared/project-memory/reconstruct";
import { createProjectAgentRuntime } from "@/shared/project-memory/agent-runtime";
import { getSharedProjectMemoryStore } from "@/shared/project-memory/runtime";
import path from "node:path";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Restore folder-Agent session for a knowledge project that already has an
 * active local grant — so reopening the project still shows process + candidate.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  try {
    const store = getSharedProjectMemoryStore();
    const grants = store
      .listActiveLocalFolderGrants()
      .filter((g) => g.projectId === projectId);
    const grant = grants[0];
    if (!grant) {
      return NextResponse.json({ session: null, projectId });
    }

    const matterId = matterIdForLocalGrant(projectId, grant.id);
    const reader = getProjectMemoryReader();
    const view = await getMemoryView(reader, projectId, matterId, {
      isCandidateResolved: (id) => store.isCandidateResolved(id),
    });
    if (!view) {
      return NextResponse.json({
        session: {
          projectId,
          matterId,
          grantId: grant.id,
          folderName: path.basename(grant.rootPath) || grant.rootPath,
          memory: null,
          toolReceipts: [],
          run: null,
        },
        projectId,
      });
    }

    const runs = await store.listRuns(projectId, matterId);
    const latest = runs[0] ?? null;
    let toolReceipts: Array<{
      sequence: number;
      tool: string;
      summary: string;
      outcome: string;
    }> = [];
    let runSummary: {
      id: string;
      status: string;
      progressSummary?: string;
    } | null = null;

    if (latest) {
      runSummary = {
        id: latest.id,
        status: latest.status,
        progressSummary: latest.progressSummary,
      };
      try {
        const runtime = createProjectAgentRuntime();
        const runView = await runtime.get(projectId, latest.id);
        if (runView?.toolReceipts?.length) {
          toolReceipts = runView.toolReceipts.map((r) => ({
            sequence: r.sequence,
            tool: r.tool,
            summary: r.summary,
            outcome: r.outcome,
          }));
        } else {
          const listed = await store.listToolReceipts(latest.id);
          toolReceipts = listed.map((r) => ({
            sequence: r.sequence,
            tool: r.tool,
            summary: r.summary,
            outcome: r.outcome,
          }));
        }
      } catch {
        /* best-effort */
      }
    }

    return NextResponse.json({
      session: {
        projectId,
        matterId,
        grantId: grant.id,
        folderName: path.basename(grant.rootPath) || grant.rootPath,
        memory: {
          matter: view.matter,
          head: view.head,
          accepted: view.accepted,
          candidate: view.candidate,
          events: view.events,
          six: view.six,
          watchSet: null,
        },
        toolReceipts,
        run: runSummary,
      },
      projectId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
