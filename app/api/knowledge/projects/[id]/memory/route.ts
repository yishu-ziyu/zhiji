import { NextRequest, NextResponse } from "next/server";
import {
  getMemoryView,
  getProjectMemoryReader,
} from "@/shared/project-memory/reconstruct";
import { getSharedProjectMemoryStore } from "@/shared/project-memory/runtime";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  const matterId = req.nextUrl.searchParams.get("matterId");
  if (!matterId?.trim()) {
    return NextResponse.json({ error: "matterId 必填" }, { status: 400 });
  }
  const reader = getProjectMemoryReader();
  const store = getSharedProjectMemoryStore();
  const view = await getMemoryView(reader, projectId, matterId.trim(), {
    isCandidateResolved: (id) => store.isCandidateResolved(id),
  });
  if (!view) {
    return NextResponse.json({ error: "事项不存在" }, { status: 404 });
  }
  return NextResponse.json({
    matter: view.matter,
    head: view.head,
    accepted: view.accepted,
    candidate: view.candidate,
    events: view.events,
    six: view.six,
  });
}
