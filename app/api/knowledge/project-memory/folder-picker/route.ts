import { NextRequest, NextResponse } from "next/server";
import { openFolderPickerForReview } from "@/shared/project-memory/native-folder-picker";
import { SourceGrantStateError } from "@/shared/project-memory/grants";
import {
  checkLocalTrust,
  CSRF_HEADER,
  sessionCookieHeader,
} from "@/shared/security/local-session";

/**
 * POST /api/knowledge/project-memory/folder-picker
 * Opens the native macOS folder chooser on the self-hosted Next server.
 * Cancel → { status: "cancelled" } with no selection/grant residue.
 * Selected → { status: "selected", selectionId, folderName, displayPath, expiresAt }
 * Does not accept upload bytes or webkitdirectory.
 * PR-08: requires local session + CSRF so remote pages cannot trigger the dialog.
 */
export async function POST(req: NextRequest) {
  const trust = checkLocalTrust({
    method: "POST",
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    cookieHeader: req.headers.get("cookie"),
    csrfHeader: req.headers.get(CSRF_HEADER),
  });
  if (!trust.ok) {
    return NextResponse.json({ status: "error" as const, error: trust.error }, {
      status: trust.status,
    });
  }
  try {
    const result = await openFolderPickerForReview();
    if (result.status === "cancelled") {
      const res = NextResponse.json({ status: "cancelled" as const });
      for (const c of sessionCookieHeader(trust.session)) res.headers.append("Set-Cookie", c);
      return res;
    }
    if (result.status === "error") {
      return NextResponse.json(
        { status: "error" as const, error: result.message },
        { status: 500 },
      );
    }
    const res = NextResponse.json({
      status: "selected" as const,
      selectionId: result.selectionId,
      folderName: result.folderName,
      displayPath: result.displayPath,
      expiresAt: result.expiresAt,
    });
    for (const c of sessionCookieHeader(trust.session)) res.headers.append("Set-Cookie", c);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "folder picker failed";
    const status = error instanceof SourceGrantStateError ? 400 : 500;
    return NextResponse.json({ status: "error" as const, error: message }, { status });
  }
}
