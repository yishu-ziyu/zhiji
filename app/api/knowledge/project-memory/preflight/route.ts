import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  buildPreflightReport,
  DEFAULT_GRANT_POLICY,
} from "@/shared/project-memory/grant-policy";
import { getFolderSelectionStore } from "@/shared/project-memory/native-folder-picker";
import { SourceGrantStateError } from "@/shared/project-memory/grants";
import {
  checkLocalTrust,
  CSRF_HEADER,
} from "@/shared/security/local-session";

/**
 * Metadata-only preflight (PR-03). Never reads file bodies.
 * Accepts selectionId only — never a client-invented rootPath.
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
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }

  try {
    const body = (await req.json()) as {
      selectionId?: string;
      rootPath?: string;
      action?: "inspect" | "confirm";
    };

    if (typeof body.rootPath === "string" && body.rootPath.trim()) {
      return NextResponse.json(
        {
          error:
            "禁止客户端提交 rootPath。请使用 folder-picker 的 selectionId 做预检。",
        },
        { status: 400 },
      );
    }

    const selectionId = body.selectionId?.trim();
    if (!selectionId) {
      return NextResponse.json(
        { error: "selectionId required" },
        { status: 400 },
      );
    }
    const action = body.action ?? "inspect";
    if (action !== "inspect" && action !== "confirm") {
      return NextResponse.json({ error: "action invalid" }, { status: 400 });
    }

    let root: string;
    let folderName: string;
    try {
      const peeked = getFolderSelectionStore().peek(selectionId);
      root = path.resolve(peeked.canonicalRoot);
      folderName = peeked.folderName;
    } catch (e) {
      const message =
        e instanceof SourceGrantStateError
          ? e.message
          : e instanceof Error
            ? e.message
            : "selection invalid";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return NextResponse.json({ error: "selection root not a directory" }, { status: 400 });
    }

    const entries: Array<{ relativePath: string; sizeBytes: number; isFile: boolean }> = [];
    const walk = (abs: string, rel: string, depth: number) => {
      if (depth > 8 || entries.length > 20_000) return;
      let dirents: fs.Dirent[];
      try {
        dirents = fs.readdirSync(abs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of dirents) {
        const childRel = rel ? `${rel}/${ent.name}` : ent.name;
        const childAbs = path.join(abs, ent.name);
        if (ent.isDirectory()) {
          if (
            ent.name === "node_modules" ||
            ent.name === ".git" ||
            ent.name === ".next" ||
            ent.name === "dist"
          ) {
            entries.push({ relativePath: childRel, sizeBytes: 0, isFile: false });
            entries.push({
              relativePath: `${childRel}/…`,
              sizeBytes: 0,
              isFile: true,
            });
            continue;
          }
          walk(childAbs, childRel, depth + 1);
        } else if (ent.isFile()) {
          let size = 0;
          try {
            size = fs.statSync(childAbs).size;
          } catch {
            size = 0;
          }
          entries.push({ relativePath: childRel, sizeBytes: size, isFile: true });
        }
      }
    };
    walk(root, "", 0);

    const report = buildPreflightReport(entries, DEFAULT_GRANT_POLICY);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(report))
      .digest("hex");

    if (action === "inspect") {
      getFolderSelectionStore().markPreflight(selectionId, {
        policyVersion: DEFAULT_GRANT_POLICY.version,
        fingerprint,
      });
      return NextResponse.json({
        preflight: report,
        policy: {
          version: DEFAULT_GRANT_POLICY.version,
          maxFileBytes: DEFAULT_GRANT_POLICY.maxFileBytes,
          maxFiles: DEFAULT_GRANT_POLICY.maxFiles,
        },
        policyVersion: DEFAULT_GRANT_POLICY.version,
        folderName,
        selectionId,
        confirmationRequired: true,
      });
    }

    // The second, explicit Owner action mints the one-use connect token.
    let confirmToken: string;
    try {
      const confirmed = getFolderSelectionStore().confirmPreflight(
        selectionId,
        DEFAULT_GRANT_POLICY.version,
        fingerprint,
      );
      confirmToken = confirmed.confirmToken;
    } catch (e) {
      const message =
        e instanceof SourceGrantStateError
          ? e.message
          : e instanceof Error
            ? e.message
            : "confirm failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({
      confirmToken,
      policy: {
        version: DEFAULT_GRANT_POLICY.version,
        maxFileBytes: DEFAULT_GRANT_POLICY.maxFileBytes,
        maxFiles: DEFAULT_GRANT_POLICY.maxFiles,
      },
      policyVersion: DEFAULT_GRANT_POLICY.version,
      folderName,
      selectionId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "preflight failed" },
      { status: 500 },
    );
  }
}
