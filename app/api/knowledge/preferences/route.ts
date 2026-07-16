import { NextRequest, NextResponse } from "next/server";
import {
  getUserPreferences,
  patchUserPreferences,
} from "@/shared/agent-memory";

export async function GET() {
  return NextResponse.json({ preferences: getUserPreferences() });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      writingStyle?: "concise" | "detailed";
      confirmStyle?: "always" | "auto_low_risk";
      favoritePathPrefixes?: string[];
    };
    const preferences = patchUserPreferences({
      writingStyle: body.writingStyle,
      confirmStyle: body.confirmStyle,
      favoritePathPrefixes: body.favoritePathPrefixes,
    });
    return NextResponse.json({ preferences });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
