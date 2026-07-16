import { NextRequest, NextResponse } from "next/server";
import {
  appendDialogueMessage,
  closeDialogueSession,
  getDialogueSession,
  listDialogueMessages,
  listDialogueSessions,
  openDialogueSession,
  setOpenToolIntent,
  writeDialogueMilestoneToKnowledge,
} from "@/shared/agent-memory";
import { getProject } from "@/shared/knowledge/repository";
import {
  ProjectScopeError,
  requireProjectId,
} from "@/shared/knowledge/project-scope";
import { checkLocalTrustFromRequest } from "@/shared/security/local-session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const projectId = requireProjectId(id);
    if (!getProject(projectId)) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    const sessions = listDialogueSessions(projectId);
    return NextResponse.json({ projectId, sessions });
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
      action?: string;
      sessionId?: string;
      title?: string;
      matterId?: string;
      role?: "user" | "agent" | "system";
      content?: string;
      milestone?: boolean;
      refRevisionIds?: string[];
      analysisRunId?: string;
      openToolIntent?: {
        toolName: string;
        summary: string;
        startedAt?: string;
      } | null;
    };

    const action = body.action ?? "open";

    if (action === "open") {
      const session = openDialogueSession({
        projectId,
        matterId: body.matterId,
        title: body.title,
      });
      return NextResponse.json({ session });
    }

    if (action === "close") {
      if (!body.sessionId) {
        return NextResponse.json({ error: "sessionId required" }, { status: 400 });
      }
      const existing = getDialogueSession(body.sessionId);
      if (!existing || existing.projectId !== projectId) {
        return NextResponse.json({ error: "会话不属于该项目" }, { status: 403 });
      }
      const session = closeDialogueSession(body.sessionId);
      return NextResponse.json({ session });
    }

    if (action === "message") {
      if (!body.sessionId || !body.content) {
        return NextResponse.json(
          { error: "sessionId, content required" },
          { status: 400 },
        );
      }
      // PR-08: clients may only submit user turns. Agent/system roles are server-authored.
      if (body.role && body.role !== "user") {
        return NextResponse.json(
          {
            error:
              "客户端只能提交 role=user；agent/system 消息由服务端写入",
          },
          { status: 400 },
        );
      }
      const existing = getDialogueSession(body.sessionId);
      if (!existing || existing.projectId !== projectId) {
        return NextResponse.json({ error: "会话不属于该项目" }, { status: 403 });
      }
      const message = appendDialogueMessage({
        sessionId: body.sessionId,
        role: "user",
        content: body.content,
        milestone: body.milestone,
        refRevisionIds: body.refRevisionIds,
        analysisRunId: body.analysisRunId,
      });
      const writeback = writeDialogueMilestoneToKnowledge(message);
      return NextResponse.json({ message, writeback });
    }

    if (action === "list_messages") {
      if (!body.sessionId) {
        return NextResponse.json({ error: "sessionId required" }, { status: 400 });
      }
      const existing = getDialogueSession(body.sessionId);
      if (!existing || existing.projectId !== projectId) {
        return NextResponse.json({ error: "会话不属于该项目" }, { status: 403 });
      }
      const messages = listDialogueMessages(body.sessionId);
      return NextResponse.json({ messages });
    }

    if (action === "set_tool_intent") {
      if (!body.sessionId) {
        return NextResponse.json({ error: "sessionId required" }, { status: 400 });
      }
      const existing = getDialogueSession(body.sessionId);
      if (!existing || existing.projectId !== projectId) {
        return NextResponse.json({ error: "会话不属于该项目" }, { status: 403 });
      }
      const intent =
        body.openToolIntent === null || body.openToolIntent === undefined
          ? null
          : {
              toolName: body.openToolIntent.toolName,
              summary: body.openToolIntent.summary,
              startedAt:
                body.openToolIntent.startedAt ?? new Date().toISOString(),
            };
      const session = setOpenToolIntent(body.sessionId, intent);
      return NextResponse.json({ session });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    if (err instanceof ProjectScopeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
