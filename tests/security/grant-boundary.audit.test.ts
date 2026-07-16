/**
 * Audit fixes: no client rootPath grants; search goes through GrantFS.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as sourceGrantsPost } from "@/app/api/knowledge/projects/[id]/source-grants/route";
import { POST as preflightPost } from "@/app/api/knowledge/project-memory/preflight/route";
import { executeProjectAgentTool } from "@/shared/project-memory/agent-tools";
import type { ProjectMemoryReader, SourceGrant } from "@/shared/project-memory/types";
import { ensureLocalSession, sessionCookieHeader } from "@/shared/security/local-session";

function authedRequest(url: string, body: unknown): NextRequest {
  const session = ensureLocalSession();
  const cookies = sessionCookieHeader(session)
    .map((c) => c.split(";")[0])
    .join("; ");
  return new NextRequest(url, {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookie: cookies,
      "x-csrf-token": session.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("audit: grant / preflight / search boundary", () => {
  it("POST source-grants rejects client rootPath", async () => {
    const res = await sourceGrantsPost(
      authedRequest("http://127.0.0.1:3000/api/knowledge/projects/p1/source-grants", {
        rootPath: "/Users/someone/evil",
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/禁止|rootPath|selectionId/i);
  });

  it("POST preflight rejects client rootPath", async () => {
    const res = await preflightPost(
      authedRequest("http://127.0.0.1:3000/api/knowledge/project-memory/preflight", {
        rootPath: "/tmp/anything",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/禁止|rootPath|selectionId/i);
  });

  it("POST source-grants with selectionId but no confirmToken is rejected", async () => {
    const res = await sourceGrantsPost(
      authedRequest(
        "http://127.0.0.1:3000/api/knowledge/projects/p1/source-grants",
        { selectionId: "sel_fake_skip_preflight" },
      ),
      { params: Promise.resolve({ id: "p1" }) },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/confirmToken|preflight|预检/i);
  });

  it("search_text cannot read symlink escape via GrantFS", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "search-gfs-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "search-out-"));
    fs.writeFileSync(path.join(outside, "secret.txt"), "TOPSECRET");
    fs.writeFileSync(path.join(root, "ok.md"), "hello searchable");
    try {
      fs.symlinkSync(path.join(outside, "secret.txt"), path.join(root, "link.txt"));
    } catch {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
      return;
    }

    const grant: SourceGrant = {
      id: "g1",
      projectId: "p1",
      kind: "local_folder",
      rootPath: root,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const reader = {
      readRevision: async () => null,
      listEvents: async () => [],
      getMatterState: async () => {
        throw new Error("n/a");
      },
    } as unknown as ProjectMemoryReader;

    const result = await executeProjectAgentTool(
      { id: "t1", name: "search_text", input: { query: "TOPSECRET" } },
      { projectId: "p1", grant, reader },
    );
    expect(result.detail).not.toMatch(/TOPSECRET/);
    expect(result.relativePaths.every((p) => !p.includes("link"))).toBe(true);

    const ok = await executeProjectAgentTool(
      { id: "t2", name: "search_text", input: { query: "searchable" } },
      { projectId: "p1", grant, reader },
    );
    expect(ok.detail).toMatch(/searchable|ok\.md/i);

    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
});
