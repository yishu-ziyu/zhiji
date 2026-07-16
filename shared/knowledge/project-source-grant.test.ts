/**
 * T-19 S2: Owner project/source grants + redacted zero-leak hint (G3 focused).
 * Aligns with frozen contract + G5 RED@6d224c4c route names.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ProjectAccessError, ProjectScopeError } from "./project-scope";
import {
  REDACTED_CROSS_PROJECT_HINT_MESSAGE,
} from "@/shared/types/knowledge";
import {
  ensureLocalSession,
  sessionCookieHeader,
} from "@/shared/security/local-session";

function authedJsonRequest(
  url: string,
  method: string,
  body: unknown,
): NextRequest {
  const session = ensureLocalSession();
  const cookies = sessionCookieHeader(session)
    .map((c) => c.split(";")[0])
    .join("; ");
  return new NextRequest(url, {
    method,
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

describe("T-19 S2 project source grant + redacted hint", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;
  let previousSeedDemo: string | undefined;
  let repo: typeof import("./repository");

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-t19-s2-"));
    previousDataDir = process.env.KNOWLEDGE_DATA_DIR;
    previousSeedDemo = process.env.SEED_DEMO;
    process.env.KNOWLEDGE_DATA_DIR = tmpDir;
    delete process.env.SEED_DEMO;
    repo = await import("./repository");
    repo.resetKnowledgeStoreForTests();
  });

  afterEach(() => {
    if (previousDataDir === undefined) delete process.env.KNOWLEDGE_DATA_DIR;
    else process.env.KNOWLEDGE_DATA_DIR = previousDataDir;
    if (previousSeedDemo === undefined) delete process.env.SEED_DEMO;
    else process.env.SEED_DEMO = previousSeedDemo;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("no grant → zero redacted hints", () => {
    const host = repo.addProject({ name: "宿主A" });
    expect(repo.getRedactedCrossProjectHint(host.id)).toBeNull();
    expect(repo.listRedactedCrossProjectHints(host.id)).toEqual([]);
  });

  it("active Owner grant to non-sensitive source → one generic zero-leak hint", () => {
    const host = repo.addProject({ name: "宿主A" });
    const source = repo.addProject({ name: "源B-机密名不应出现" });
    expect(() =>
      repo.createProjectSourceGrant({
        hostProjectId: host.id,
        sourceProjectId: source.id,
        approvedBy: "agent:project-reviewer",
      }),
    ).toThrow(ProjectScopeError);

    const grant = repo.createProjectSourceGrant({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      approvedBy: "自己",
    });
    expect(grant.hostProjectId).toBe(host.id);
    expect(grant.sourceProjectId).toBe(source.id);
    expect(grant.expiresAt).toBeNull();
    expect(grant.disabledAt).toBeUndefined();
    expect(grant.revokedAt).toBeUndefined();
    expect(grant).not.toHaveProperty("credentials");
    expect(grant).not.toHaveProperty("status");

    const hint = repo.getRedactedCrossProjectHint(host.id);
    expect(hint).toEqual({
      kind: "approved_source_may_be_relevant",
      message: REDACTED_CROSS_PROJECT_HINT_MESSAGE,
    });
    const text = JSON.stringify(hint);
    expect(text).not.toContain(source.id);
    expect(text).not.toContain(host.id);
    expect(text).not.toContain("源B");
    expect(text).not.toContain("机密");
    expect(text).not.toMatch(/revision|contentHash|title|hit/i);
  });

  it("sensitive source → create rejected; no hint path", () => {
    const host = repo.addProject({ name: "宿主" });
    const source = repo.addProject({ name: "敏感源" });
    repo.setProjectSensitive(source.id, true);
    expect(() =>
      repo.createProjectSourceGrant({
        hostProjectId: host.id,
        sourceProjectId: source.id,
        approvedBy: "自己",
      }),
    ).toThrow(ProjectScopeError);
    expect(repo.getRedactedCrossProjectHint(host.id)).toBeNull();
  });

  it("expired, disabled, revoked grants → zero hint", () => {
    const host = repo.addProject({ name: "宿主" });
    const source = repo.addProject({ name: "源" });
    const now = "2026-07-16T12:00:00.000Z";
    const expired = repo.createProjectSourceGrant({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      approvedBy: "自己",
      expiresAt: "2026-07-16T13:00:00.000Z",
      now,
    });
    expect(
      repo.isEffectiveProjectSourceGrant(expired, "2026-07-16T14:00:00.000Z"),
    ).toBe(false);
    expect(
      repo.getRedactedCrossProjectHint(host.id, "2026-07-16T14:00:00.000Z"),
    ).toBeNull();
    expect(repo.getRedactedCrossProjectHint(host.id, now)).not.toBeNull();

    const later = "2026-07-16T15:00:00.000Z";
    const g2 = repo.createProjectSourceGrant({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      approvedBy: "自己",
      now: later,
    });
    repo.disableProjectSourceGrant(host.id, g2.id, { now: later });
    expect(repo.getRedactedCrossProjectHint(host.id, later)).toBeNull();

    const g3 = repo.createProjectSourceGrant({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      approvedBy: "自己",
      now: later,
    });
    expect(repo.getRedactedCrossProjectHint(host.id, later)).not.toBeNull();
    repo.revokeProjectSourceGrant(host.id, g3.id, {
      now: later,
      reason: "test",
    });
    expect(repo.getRedactedCrossProjectHint(host.id, later)).toBeNull();
    // expired grant still inspectable (expiry gates hint only)
    expect(repo.getProjectSourceGrant(host.id, expired.id)?.expiresAt).toBe(
      "2026-07-16T13:00:00.000Z",
    );
  });

  it("foreign host cannot inspect or control another project's grant", () => {
    const a = repo.addProject({ name: "A" });
    const b = repo.addProject({ name: "B" });
    const source = repo.addProject({ name: "S" });
    const grant = repo.createProjectSourceGrant({
      hostProjectId: a.id,
      sourceProjectId: source.id,
      approvedBy: "自己",
    });
    expect(repo.listProjectSourceGrants(b.id)).toEqual([]);
    expect(repo.getProjectSourceGrant(b.id, grant.id)).toBeNull();
    expect(() =>
      repo.disableProjectSourceGrant(b.id, grant.id),
    ).toThrow(ProjectAccessError);
    expect(() =>
      repo.revokeProjectSourceGrant(b.id, grant.id),
    ).toThrow(ProjectAccessError);
    expect(repo.getProjectSourceGrant(a.id, grant.id)?.revokedAt).toBeUndefined();
  });

  it("hint path does not create xref; object use still needs separate Owner ref", () => {
    const host = repo.addProject({ name: "宿主" });
    const source = repo.addProject({ name: "源" });
    const card = repo.addCard({
      projectId: source.id,
      content: "不可通过 hint 打开的正文",
      title: "秘密卡",
    });
    repo.createProjectSourceGrant({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      approvedBy: "自己",
    });
    expect(repo.getRedactedCrossProjectHint(host.id)).not.toBeNull();
    expect(repo.listCrossProjectReferences(host.id)).toEqual([]);

    expect(() =>
      repo.createCrossProjectReference({
        hostProjectId: host.id,
        sourceProjectId: source.id,
        sourceKind: "card",
        sourceObjectId: card.id,
        approvedBy: "agent:forged",
      }),
    ).toThrow(/Owner|Agent/);

    const ref = repo.createCrossProjectReference({
      hostProjectId: host.id,
      sourceProjectId: source.id,
      sourceKind: "card",
      sourceObjectId: card.id,
      approvedBy: "自己",
      sourceRevision: "card:pin:v1",
    });
    expect(ref.sourceObjectId).toBe(card.id);
    expect(ref.sourceContentHash).toBe("card:pin:v1");
  });

  it("API: redacted-hints + source-grants GET/POST/PATCH host-scoped zero-leak", async () => {
    const host = repo.addProject({ name: "API宿主" });
    const source = repo.addProject({ name: "API源项目名泄漏探针" });
    const foreign = repo.addProject({ name: "外宿主" });

    const grantsRoute = await import(
      "@/app/api/knowledge/projects/[id]/source-grants/route"
    );
    const { GET: hintGet } = await import(
      "@/app/api/knowledge/projects/[id]/redacted-hints/route"
    );

    const emptyHint = await hintGet(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(emptyHint.status).toBe(200);
    const emptyBody = await emptyHint.json();
    expect(emptyBody.hints).toEqual([]);
    expect(emptyBody.hint).toBeNull();

    const created = await grantsRoute.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "POST",
        { sourceProjectId: source.id, approvedBy: "自己" },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(created.status).toBe(201);
    const { grant } = (await created.json()) as {
      grant: { id: string; sourceProjectId: string };
    };

    const hint = await hintGet(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(hint.status).toBe(200);
    const hintBody = await hint.json();
    expect(hintBody.hints).toHaveLength(1);
    expect(hintBody.hints[0]).toEqual({
      kind: "approved_source_may_be_relevant",
      message: REDACTED_CROSS_PROJECT_HINT_MESSAGE,
    });
    expect(hintBody.hint).toEqual(hintBody.hints[0]);
    const hintText = JSON.stringify(hintBody.hints);
    expect(hintText).not.toContain(source.id);
    expect(hintText).not.toContain("泄漏探针");
    expect(hintText).not.toContain(grant.id);

    const foreignList = await grantsRoute.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${foreign.id}/source-grants`,
      ),
      { params: Promise.resolve({ id: foreign.id }) },
    );
    expect((await foreignList.json()).grants).toEqual([]);

    const denied = await grantsRoute.PATCH(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${foreign.id}/source-grants`,
        "PATCH",
        {
          grantId: grant.id,
          action: "disable",
        },
      ),
      { params: Promise.resolve({ id: foreign.id }) },
    );
    expect([403, 404]).toContain(denied.status);

    const disabled = await grantsRoute.PATCH(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "PATCH",
        {
          grantId: grant.id,
          action: "disable",
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(disabled.status).toBe(200);
    const after = await hintGet(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect((await after.json()).hints).toEqual([]);
  });
});
