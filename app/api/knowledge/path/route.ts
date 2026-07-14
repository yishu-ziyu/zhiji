import { NextRequest, NextResponse } from "next/server";
import {
  getPathBetween,
  RelationValidationError,
} from "@/shared/knowledge/repository";
import type { RelationStatus } from "@/shared/types/knowledge";
import { RELATION_STATUSES } from "@/shared/types/knowledge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json(
        { error: "from 与 to 必填" },
        { status: 400 },
      );
    }
    const maxDepth = Number(searchParams.get("maxDepth") ?? "3");
    const statusParam = searchParams.get("status");
    let status: RelationStatus | RelationStatus[] | undefined;
    if (statusParam) {
      const parts = statusParam
        .split(",")
        .filter((s): s is RelationStatus =>
          RELATION_STATUSES.includes(s as RelationStatus),
        );
      status = parts.length === 1 ? parts[0] : parts.length ? parts : undefined;
    }

    const path = getPathBetween(from, to, {
      maxDepth: Number.isFinite(maxDepth) ? maxDepth : 3,
      status,
    });
    if (!path) {
      return NextResponse.json({
        path: null,
        message: "指定跳数内没有路径",
      });
    }
    return NextResponse.json({ path });
  } catch (error) {
    const code = error instanceof RelationValidationError ? 400 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "路径查询失败" },
      { status: code },
    );
  }
}
