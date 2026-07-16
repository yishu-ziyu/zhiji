import { NextResponse } from "next/server";
import { openFolderPickerForReview } from "@/shared/project-memory/native-folder-picker";
import { SourceGrantStateError } from "@/shared/project-memory/grants";

/**
 * POST /api/knowledge/project-memory/folder-picker
 * Opens the native macOS folder chooser on the self-hosted Next server.
 * Cancel → { status: "cancelled" } with no selection/grant residue.
 * Selected → { status: "selected", selectionId, folderName, displayPath, expiresAt }
 * Does not accept upload bytes or webkitdirectory.
 */
export async function POST() {
  try {
    const result = await openFolderPickerForReview();
    if (result.status === "cancelled") {
      return NextResponse.json({ status: "cancelled" as const });
    }
    if (result.status === "error") {
      return NextResponse.json(
        { status: "error" as const, error: result.message },
        { status: 500 },
      );
    }
    return NextResponse.json({
      status: "selected" as const,
      selectionId: result.selectionId,
      folderName: result.folderName,
      displayPath: result.displayPath,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "folder picker failed";
    const status = error instanceof SourceGrantStateError ? 400 : 500;
    return NextResponse.json({ status: "error" as const, error: message }, { status });
  }
}
