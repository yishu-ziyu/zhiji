import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/shared/knowledge/repository";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";
import {
  hydrateClaimBundleFromCandidateBody,
  loadRevisionTextsFromCas,
  resolveClaimDecision,
} from "@/shared/project-memory/claims/resolve-claim";
import {
  getOwnerDecisionWriter,
  getProjectMemoryReader,
} from "@/shared/project-memory/reconstruct";
import { getSharedProjectMemoryStore } from "@/shared/project-memory/runtime";
import {
  checkLocalTrustFromRequest,
} from "@/shared/security/local-session";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ClaimReview API — Project Memory is truth.
 *
 * GET  ?matterId=&candidateRevisionId=
 *   → audit resolutions + server-hydrated claims (from candidate body + CAS)
 *
 * POST { matterId, candidateRevisionId, claimId, decision }
 *   → validates claimId against candidate; resolveUnderstanding accept|reject
 *   → does NOT trust client claimText/status
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(id);
    if (!getProject(projectId)) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const matterId = req.nextUrl.searchParams.get("matterId")?.trim();
    const candidateRevisionId = req.nextUrl.searchParams
      .get("candidateRevisionId")
      ?.trim();

    const decisionStore = getSharedProjectMemoryStore();
    const resolutions = decisionStore.listClaimResolutionRecords(projectId, {
      candidateRevisionId: candidateRevisionId || undefined,
    });

    let bundle: ReturnType<typeof hydrateClaimBundleFromCandidateBody> | undefined;
    let candidateId: string | undefined;

    if (matterId && candidateRevisionId) {
      const reader = getProjectMemoryReader();
      try {
        const state = await reader.getMatterState(projectId, matterId);
        const candidate = state.candidate;
        if (candidate && candidate.id === candidateRevisionId) {
          candidateId = candidate.id;
          const revisionTexts = await loadRevisionTextsFromCas(
            reader,
            candidate.body,
          );
          bundle = hydrateClaimBundleFromCandidateBody({
            projectId,
            matterId,
            candidateRevisionId,
            body: candidate.body,
            revisionTexts,
          });
        }
      } catch {
        // matter missing — still return audit list
      }
    }

    return NextResponse.json({
      projectId,
      matterId: matterId ?? null,
      candidateRevisionId: candidateId ?? candidateRevisionId ?? null,
      resolutions,
      claims: bundle?.claims ?? null,
      anchors: bundle?.anchors ?? [],
      links: bundle?.links ?? [],
    });
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
      claimId?: string;
      decision?: "accept" | "accept_edited" | "reject" | "defer";
      matterId?: string;
      candidateRevisionId?: string;
      note?: string;
      editedText?: string;
      // Explicitly ignored if present — not trusted as truth:
      claimText?: string;
      claimStatus?: string;
    };

    if (!body.matterId?.trim()) {
      return NextResponse.json({ error: "matterId 必填" }, { status: 400 });
    }
    if (!body.candidateRevisionId?.trim()) {
      return NextResponse.json(
        { error: "candidateRevisionId 必填" },
        { status: 400 },
      );
    }
    if (!body.claimId?.trim()) {
      return NextResponse.json({ error: "claimId 必填" }, { status: 400 });
    }
    const allowed = ["accept", "accept_edited", "reject", "defer"] as const;
    if (!body.decision || !allowed.includes(body.decision)) {
      return NextResponse.json(
        {
          error:
            "decision 仅支持 accept | accept_edited | reject | defer",
        },
        { status: 400 },
      );
    }

    try {
      const result = await resolveClaimDecision({
        projectId,
        matterId: body.matterId.trim(),
        candidateRevisionId: body.candidateRevisionId.trim(),
        claimId: body.claimId.trim(),
        decision: body.decision,
        reader: getProjectMemoryReader(),
        writer: getOwnerDecisionWriter(),
        decisionStore: getSharedProjectMemoryStore(),
        note: body.note,
        editedText: body.editedText,
      });

      return NextResponse.json(
        {
          projectId,
          // Server-derived claim only
          claim: result.claim,
          resolution: result.audit,
          finalized: result.finalized,
          remaining: result.remaining,
          understanding: result.understanding
            ? {
                resolution: result.understanding.resolution,
                accepted: result.understanding.accepted ?? null,
                head: result.understanding.head,
              }
            : null,
        },
        { status: 201 },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存决议失败";
      const status =
        message.includes("不存在") || message.includes("不匹配")
          ? 404
          : 400;
      return NextResponse.json({ error: message }, { status });
    }
  } catch (err) {
    if (err instanceof ProjectScopeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
