import {
  applyProviderAction,
  createSlips,
  listSlips,
  updateSlip,
} from "@/shared/delivery/repository";
import { computeMetrics } from "@/shared/delivery/metrics";
import { toPublicSlip } from "@/shared/delivery/public-slip";
import type { Priority } from "@/shared/delivery/types";

const priorities = new Set<Priority>(["高", "中", "低"]);

function errorResponse(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "承诺单操作失败" },
    { status: 400 },
  );
}

export async function GET() {
  const slips = listSlips();
  return Response.json({ slips: slips.map(toPublicSlip), metrics: computeMetrics(slips) });
}

function editablePatch(body: Record<string, unknown>) {
  return {
    title: typeof body.title === "string" ? body.title : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    acceptanceCriteria:
      typeof body.acceptanceCriteria === "string"
        ? body.acceptanceCriteria
        : undefined,
    dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
    priority: priorities.has(body.priority as Priority)
      ? (body.priority as Priority)
      : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "create") {
      if (!Array.isArray(body.slips) || body.slips.length === 0) {
        throw new Error("请至少提交一张承诺单");
      }
      const input = body.slips.map((raw) => {
        if (!raw || typeof raw !== "object") throw new Error("承诺单格式错误");
        const item = raw as Record<string, unknown>;
        if (typeof item.title !== "string" || !item.title.trim()) {
          throw new Error("承诺标题不能为空");
        }
        return {
          title: item.title,
          description:
            typeof item.description === "string" ? item.description : undefined,
          acceptanceCriteria:
            typeof item.acceptanceCriteria === "string"
              ? item.acceptanceCriteria
              : undefined,
          dueAt: typeof item.dueAt === "string" ? item.dueAt : undefined,
          priority: priorities.has(item.priority as Priority)
            ? (item.priority as Priority)
            : undefined,
          sourceExcerpt:
            typeof item.sourceExcerpt === "string"
              ? item.sourceExcerpt
              : undefined,
        };
      });
      return Response.json({ slips: createSlips(input) }, { status: 201 });
    }

    if (typeof body.id !== "string") throw new Error("缺少承诺单 ID");
    if (body.action === "update") {
      return Response.json({
        slip: updateSlip(body.id, editablePatch(body)),
      });
    }
    if (body.action !== "send" && body.action !== "deliver") {
      throw new Error("服务方无权执行该动作");
    }
    if (body.action === "send") {
      updateSlip(body.id, editablePatch(body));
    }
    const slip = applyProviderAction(body.id, body.action);
    const clientUrl = slip.clientToken
      ? `${new URL(request.url).origin}/c/${slip.clientToken}`
      : undefined;
    return Response.json({ slip, clientUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
