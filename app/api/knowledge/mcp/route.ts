import { NextRequest, NextResponse } from "next/server";
import {
  invokeKnowledgeMcpTool,
  listKnowledgeMcpTools,
} from "@/shared/knowledge/mcp-tools";

/** MCP-style tool surface for the knowledge loop (list + invoke). */
export async function GET() {
  return NextResponse.json({
    tools: listKnowledgeMcpTools(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tool?: string;
      name?: string;
      arguments?: Record<string, unknown>;
      args?: Record<string, unknown>;
    };

    const tool = body.tool || body.name;
    if (!tool) {
      return NextResponse.json({ error: "tool 名称必填" }, { status: 400 });
    }

    const result = invokeKnowledgeMcpTool(
      tool,
      body.arguments ?? body.args ?? {},
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "MCP 调用失败",
      },
      { status: 500 },
    );
  }
}
