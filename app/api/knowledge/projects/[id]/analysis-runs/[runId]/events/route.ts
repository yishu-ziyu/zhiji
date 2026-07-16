import { NextRequest } from "next/server";
import { getSharedProjectMemoryStore } from "@/shared/project-memory/runtime";
import { runViewEventFingerprint } from "@/shared/project-memory/agent-run-events";

type Ctx = { params: Promise<{ id: string; runId: string }> };

/**
 * PR-10 SSE: stream coarse run status changes via poll-in-stream.
 * Real step events come from tool receipts + run progressSummary.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: projectId, runId } = await ctx.params;
  const store = getSharedProjectMemoryStore();
  const encoder = new TextEncoder();

  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("ready", { projectId, runId });

      let lastFingerprint = "";
      let ticks = 0;
      while (!closed && ticks < 120) {
        ticks += 1;
        try {
          const view = await store.getRunView(projectId, runId);
          if (!view) {
            send("error", { error: "run not found" });
            break;
          }
          const status = view.run.status;
          const fingerprint = runViewEventFingerprint(view);
          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            send("run", {
              run: view.run,
              toolReceiptCount: view.toolReceipts.length,
              toolReceipts: view.toolReceipts,
              latestToolReceipt: view.toolReceipts.at(-1) ?? null,
              candidateId: view.candidate?.id ?? null,
            });
          }
          if (
            status === "completed" ||
            status === "failed" ||
            status === "interrupted" ||
            status === "awaiting_owner"
          ) {
            send("end", { status });
            break;
          }
        } catch (e) {
          send("error", {
            error: e instanceof Error ? e.message : String(e),
          });
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!closed) controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
