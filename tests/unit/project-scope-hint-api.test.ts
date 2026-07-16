/**
 * T-19 S2 — Privacy-safe redacted cross-project hint RED gates (G5, test-only).
 *
 * Authority: D-27 + D-38 option A · ASSIGN-G5-T19-S2-redacted-hint-tests.md
 * Base: d715b64d. Freeze this file on RED; G3 implements; G5 reruns unchanged.
 *
 * Frozen product rule (G2):
 * - Hints only inside active Owner-preauthorized project/source grant.
 * - Hint is generic/redacted: no project title/id, object id, content, hit, revision.
 * - Sensitive / ungranted / expired / revoked → zero hint.
 * - Opening/using an object still needs separate T-19 Owner-approved revision-pinned ref.
 * - No global discovery/search; hint is not evidence/knowledge.
 *
 * Expected surfaces (G3 may land equivalent under frozen G2 names):
 * - POST/GET/PATCH .../projects/[id]/source-grants
 * - GET .../projects/[id]/redacted-hints
 * - POST .../projects/[id]/cross-project-references (T-19 object use)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as addCardPost } from "@/app/api/knowledge/add/route";
import {
  POST as createProjectPost,
} from "@/app/api/knowledge/projects/route";
import { GET as searchGet } from "@/app/api/knowledge/search/route";
import {
  listCards,
  listProjects,
  resetKnowledgeStoreForTests,
} from "@/shared/knowledge/repository";
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

let tmpDir = "";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-t19-s2-hint-"));
  process.env.KNOWLEDGE_DATA_DIR = tmpDir;
  delete process.env.SEED_DEMO;
  resetKnowledgeStoreForTests();
});

afterEach(() => {
  delete process.env.KNOWLEDGE_DATA_DIR;
  delete process.env.SEED_DEMO;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

type ProjectBody = { project: { id: string; name: string } };

async function createProject(
  name: string,
  extra: Record<string, unknown> = {},
): Promise<{ id: string; name: string }> {
  const res = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name, summary: `${name}-summary`, ...extra }),
    }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as ProjectBody;
  return body.project;
}

async function addCard(
  projectId: string,
  content: string,
  title: string,
): Promise<{ id: string; projectId: string }> {
  const res = await addCardPost(
    new NextRequest("http://test/api/knowledge/add", {
      method: "POST",
      body: JSON.stringify({
        content,
        title,
        source: "manual",
        projectId,
      }),
    }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as {
    card: { id: string; projectId: string };
  };
  return body.card;
}

async function loadGrantRoute() {
  return import(
    "@/app/api/knowledge/projects/[id]/source-grants/route"
  ).catch(() => null);
}

async function loadHintRoute() {
  return import(
    "@/app/api/knowledge/projects/[id]/redacted-hints/route"
  ).catch(() => null);
}

async function loadXrefRoute() {
  return import(
    "@/app/api/knowledge/projects/[id]/cross-project-references/route"
  ).catch(() => null);
}

type GrantRoute = {
  POST: (
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
  ) => Promise<Response>;
  GET: (
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
  ) => Promise<Response>;
  PATCH?: (
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
  ) => Promise<Response>;
};

type HintRoute = {
  GET: (
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
  ) => Promise<Response>;
};

function assertNoSensitiveLeak(
  payload: unknown,
  banned: string[],
  label: string,
) {
  const text = JSON.stringify(payload);
  for (const token of banned) {
    expect(text, `${label} must not contain ${token}`).not.toContain(token);
  }
}

function assertGenericHintShape(hint: Record<string, unknown>) {
  // Exactly one generic hint: may say "authorized related source exists" style only.
  expect(hint).toBeTruthy();
  const text = JSON.stringify(hint);
  // Forbidden disclosure fields / values patterns
  expect(hint).not.toHaveProperty("sourceProjectId");
  expect(hint).not.toHaveProperty("sourceProjectTitle");
  expect(hint).not.toHaveProperty("sourceProjectName");
  expect(hint).not.toHaveProperty("objectId");
  expect(hint).not.toHaveProperty("cardId");
  expect(hint).not.toHaveProperty("content");
  expect(hint).not.toHaveProperty("hit");
  expect(hint).not.toHaveProperty("hits");
  expect(hint).not.toHaveProperty("revision");
  expect(hint).not.toHaveProperty("sourceRevision");
  // No UUID-looking project/object smuggling in free text if present
  if (typeof hint.message === "string") {
    expect(hint.message).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  }
  expect(text).not.toMatch(/revision/i);
}

describe("T-19 S2 redacted hint privacy RED gates", () => {
  it("1) no grant → zero hints", async () => {
    const host = await createProject("宿主A-无授权");
    const source = await createProject("来源B-有材料");
    const card = await addCard(source.id, "secret-body-no-grant", "秘密标题B");

    const hintRoute = (await loadHintRoute()) as HintRoute | null;
    expect(
      hintRoute,
      "missing GET /api/knowledge/projects/[id]/redacted-hints",
    ).toBeTruthy();

    const res = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hints?: unknown[]; items?: unknown[] };
    const hints = body.hints ?? body.items ?? null;
    expect(Array.isArray(hints)).toBe(true);
    expect(hints).toHaveLength(0);
    assertNoSensitiveLeak(
      body,
      [source.id, source.name, card.id, "secret-body-no-grant", "秘密标题B"],
      "no-grant hints",
    );
  });

  it("2) active Owner grant to non-sensitive source → exactly one generic redacted hint", async () => {
    const host = await createProject("宿主A-授权读");
    const source = await createProject("来源B-非敏感", {
      sensitive: false,
    });
    const card = await addCard(
      source.id,
      "granted-source-unique-payload",
      "来源B卡片标题",
    );

    const grantRoute = (await loadGrantRoute()) as GrantRoute | null;
    const hintRoute = (await loadHintRoute()) as HintRoute | null;
    expect(
      grantRoute,
      "missing POST /api/knowledge/projects/[id]/source-grants",
    ).toBeTruthy();
    expect(hintRoute).toBeTruthy();

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const created = await grantRoute!.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "POST",
        { sourceProjectId: source.id, approvedBy: "自己", expiresAt },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(created.status).toBe(201);
    const grantBody = (await created.json()) as {
      grant: Record<string, unknown>;
    };
    expect(grantBody.grant).toBeTruthy();
    // Grant receipt must not embed source content
    assertNoSensitiveLeak(
      grantBody,
      ["granted-source-unique-payload", "来源B卡片标题", card.id],
      "grant create",
    );

    const hintsRes = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(hintsRes.status).toBe(200);
    const hintsBody = (await hintsRes.json()) as {
      hints?: Record<string, unknown>[];
      items?: Record<string, unknown>[];
    };
    const hints = hintsBody.hints ?? hintsBody.items ?? [];
    expect(hints).toHaveLength(1);
    assertGenericHintShape(hints[0]!);
    assertNoSensitiveLeak(
      hintsBody,
      [
        source.id,
        source.name,
        "来源B-非敏感",
        card.id,
        "granted-source-unique-payload",
        "来源B卡片标题",
      ],
      "active-grant hint",
    );
  });

  it("3) sensitive source → zero hint even when granted", async () => {
    const host = await createProject("宿主A-敏感源");
    const sensitive = await createProject("绝密来源玄鸟", {
      sensitive: true,
      sensitivity: "sensitive",
      visibility: "sensitive",
    });
    await addCard(sensitive.id, "sensitive-unique-payload-玄鸟", "绝密标题");

    const grantRoute = (await loadGrantRoute()) as GrantRoute | null;
    const hintRoute = (await loadHintRoute()) as HintRoute | null;
    expect(grantRoute).toBeTruthy();
    expect(hintRoute).toBeTruthy();

    // Grant may be rejected (400) or accepted but still yield zero hints — either is ok for privacy.
    const created = await grantRoute!.POST(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/source-grants`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceProjectId: sensitive.id,
            approvedBy: "自己",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          }),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect([201, 400, 403]).toContain(created.status);

    const hintsRes = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(hintsRes.status).toBe(200);
    const hintsBody = (await hintsRes.json()) as {
      hints?: unknown[];
      items?: unknown[];
    };
    const hints = hintsBody.hints ?? hintsBody.items ?? [];
    expect(hints).toHaveLength(0);
    assertNoSensitiveLeak(
      hintsBody,
      [
        sensitive.id,
        "绝密",
        "玄鸟",
        "sensitive-unique-payload",
        "绝密标题",
      ],
      "sensitive-source hints",
    );
  });

  it("4) expired, disabled, or revoked grant → zero hint", async () => {
    const host = await createProject("宿主A-失效授权");
    const source = await createProject("来源B-失效");
    await addCard(source.id, "expire-payload", "失效源卡");

    const grantRoute = (await loadGrantRoute()) as GrantRoute | null;
    const hintRoute = (await loadHintRoute()) as HintRoute | null;
    expect(grantRoute).toBeTruthy();
    expect(hintRoute).toBeTruthy();

    const expired = await grantRoute!.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "POST",
        {
          sourceProjectId: source.id,
          approvedBy: "自己",
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    // Accept create of already-expired grant or reject; hints must be zero either way.
    expect([201, 400]).toContain(expired.status);

    let hintsRes = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(hintsRes.status).toBe(200);
    const expiredBody = (await hintsRes.json()) as {
      hints?: unknown[];
      items?: unknown[];
    };
    expect(expiredBody.hints ?? expiredBody.items ?? []).toHaveLength(0);

    // Active grant then disable + revoke
    const active = await grantRoute!.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "POST",
        {
          sourceProjectId: source.id,
          approvedBy: "自己",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(active.status).toBe(201);
    const { grant } = (await active.json()) as {
      grant: { id: string };
    };

    expect(
      grantRoute!.PATCH,
      "source-grants PATCH for disable/revoke required",
    ).toBeTruthy();

    const disabled = await grantRoute!.PATCH!(
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
    expect([200, 204]).toContain(disabled.status);

    hintsRes = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    const disabledBody = (await hintsRes.json()) as {
      hints?: unknown[];
      items?: unknown[];
    };
    expect(disabledBody.hints ?? disabledBody.items ?? []).toHaveLength(0);

    // Re-enable path not required; create fresh then revoke
    const active2 = await grantRoute!.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "POST",
        {
          sourceProjectId: source.id,
          approvedBy: "自己",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(active2.status).toBe(201);
    const grant2 = ((await active2.json()) as { grant: { id: string } }).grant;

    const revoked = await grantRoute!.PATCH!(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "PATCH",
        {
          grantId: grant2.id,
          action: "revoke",
          reason: "test-revoke",
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect([200, 204]).toContain(revoked.status);

    hintsRes = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    const revokedBody = (await hintsRes.json()) as {
      hints?: unknown[];
      items?: unknown[];
    };
    expect(revokedBody.hints ?? revokedBody.items ?? []).toHaveLength(0);
    assertNoSensitiveLeak(
      revokedBody,
      [source.id, source.name, "expire-payload", "失效源卡"],
      "revoked hints",
    );
  });

  it("5) foreign host cannot inspect/control another project's grant", async () => {
    const hostA = await createProject("宿主A-授权主人");
    const hostB = await createProject("宿主B-外人");
    const source = await createProject("来源C");

    const grantRoute = (await loadGrantRoute()) as GrantRoute | null;
    expect(grantRoute).toBeTruthy();

    const created = await grantRoute!.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${hostA.id}/source-grants`,
        "POST",
        {
          sourceProjectId: source.id,
          approvedBy: "自己",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ),
      { params: Promise.resolve({ id: hostA.id }) },
    );
    expect(created.status).toBe(201);
    const { grant } = (await created.json()) as { grant: { id: string } };

    // B must not list/control A's grants via B's project path.
    const listAsB = await grantRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${hostB.id}/source-grants`,
      ),
      { params: Promise.resolve({ id: hostB.id }) },
    );
    expect(listAsB.status).toBe(200);
    const listBBody = (await listAsB.json()) as {
      grants?: Array<{ id: string }>;
      items?: Array<{ id: string }>;
    };
    const bGrants = listBBody.grants ?? listBBody.items ?? [];
    expect(bGrants.some((g) => g.id === grant.id)).toBe(false);
    assertNoSensitiveLeak(
      listBBody,
      [grant.id, source.id, source.name, hostA.id],
      "foreign host grant list",
    );

    // B must not inspect A's grant collection by using A's path as a foreign caller.
    // Path is host-scoped: reading A is allowed only as host A (no session yet).
    // Control separation is enforced by denying B's revoke of A's grantId below.

    // Explicit: B tries PATCH on A's grant via B's project path
    expect(grantRoute!.PATCH).toBeTruthy();
    const foreignPatch = await grantRoute!.PATCH!(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${hostB.id}/source-grants`,
        "PATCH",
        {
          grantId: grant.id,
          action: "revoke",
          reason: "foreign-attempt",
        },
      ),
      { params: Promise.resolve({ id: hostB.id }) },
    );
    expect([403, 404]).toContain(foreignPatch.status);

    // A's grant still intact
    const listA = await grantRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${hostA.id}/source-grants`,
      ),
      { params: Promise.resolve({ id: hostA.id }) },
    );
    expect(listA.status).toBe(200);
    const listABody = (await listA.json()) as {
      grants?: Array<{ id: string }>;
      items?: Array<{ id: string }>;
    };
    const grants = listABody.grants ?? listABody.items ?? [];
    expect(grants.some((g) => g.id === grant.id)).toBe(true);
  });

  it("6) hint path performs no global search and cannot create/open a cross-project reference", async () => {
    const host = await createProject("宿主A-无全局扫");
    const source = await createProject("来源B-扫描禁");
    const card = await addCard(source.id, "no-global-scan-payload", "扫描禁标题");

    const grantRoute = (await loadGrantRoute()) as GrantRoute | null;
    const hintRoute = (await loadHintRoute()) as HintRoute | null;
    expect(grantRoute).toBeTruthy();
    expect(hintRoute).toBeTruthy();

    await grantRoute!.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "POST",
        {
          sourceProjectId: source.id,
          approvedBy: "自己",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );

    // Redacted hints must not require or perform host-scoped search that returns B content
    const searchHost = await searchGet(
      new NextRequest(
        `http://test/api/knowledge/search?q=${encodeURIComponent("no-global-scan-payload")}&projectId=${host.id}`,
      ),
    );
    expect(searchHost.status).toBe(200);
    const searchBody = await searchHost.json();
    assertNoSensitiveLeak(
      searchBody,
      [card.id, "no-global-scan-payload", "扫描禁标题", source.id],
      "host search must not become global discovery",
    );

    const hintsRes = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(hintsRes.status).toBe(200);
    const hintsBody = (await hintsRes.json()) as {
      hints?: Record<string, unknown>[];
      items?: Record<string, unknown>[];
    };
    const hints = hintsBody.hints ?? hintsBody.items ?? [];
    expect(hints.length).toBeLessThanOrEqual(1);
    if (hints.length === 1) {
      assertGenericHintShape(hints[0]!);
    }
    // Hint payload must not embed openable reference or object locator
    assertNoSensitiveLeak(
      hintsBody,
      [card.id, source.id, "no-global-scan-payload", "扫描禁标题"],
      "hint must not open source objects",
    );
    for (const h of hints) {
      expect(h).not.toHaveProperty("referenceId");
      expect(h).not.toHaveProperty("crossProjectReferenceId");
      expect(h).not.toHaveProperty("objectLocator");
    }

    // Creating xref still not free via hint side-effect: list cards on host unchanged
    expect(listCards({ projectId: host.id })).toHaveLength(0);
  });

  it("7) object use still requires separate Owner-approved revision-pinned T-19 reference", async () => {
    const host = await createProject("宿主A-引用分离");
    const source = await createProject("来源B-引用分离");
    const card = await addCard(source.id, "needs-pinned-ref-body", "需钉修订");

    const grantRoute = (await loadGrantRoute()) as GrantRoute | null;
    const hintRoute = (await loadHintRoute()) as HintRoute | null;
    const xrefRoute = await loadXrefRoute();
    expect(grantRoute).toBeTruthy();
    expect(hintRoute).toBeTruthy();
    expect(
      xrefRoute,
      "T-19 cross-project-references route required for object use",
    ).toBeTruthy();

    await grantRoute!.POST(
      authedJsonRequest(
        `http://127.0.0.1:3000/api/knowledge/projects/${host.id}/source-grants`,
        "POST",
        {
          sourceProjectId: source.id,
          approvedBy: "自己",
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );

    // Grant+hint must not substitute for object reference
    const unapprovedUse = await xrefRoute!.POST(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/cross-project-references`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceProjectId: source.id,
            sourceObjectKind: "card",
            sourceObjectId: card.id,
            sourceRevision: `card:${card.id}:v1`,
            // missing approvedBy
          }),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect([400, 403]).toContain(unapprovedUse.status);

    const approved = await xrefRoute!.POST(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/cross-project-references`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceProjectId: source.id,
            sourceObjectKind: "card",
            sourceObjectId: card.id,
            sourceRevision: `card:${card.id}:v1`,
            approvedBy: "自己",
          }),
        },
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    expect(approved.status).toBe(201);
    const receipt = (await approved.json()) as {
      reference: {
        sourceObjectId: string;
        sourceRevision: string;
        approvedBy: string;
      };
    };
    expect(receipt.reference.sourceObjectId).toBe(card.id);
    expect(receipt.reference.sourceRevision).toBe(`card:${card.id}:v1`);
    expect(receipt.reference.approvedBy).toBe("自己");

    // Hints remain redacted even after object ref exists
    const hintsRes = await hintRoute!.GET(
      new NextRequest(
        `http://test/api/knowledge/projects/${host.id}/redacted-hints`,
      ),
      { params: Promise.resolve({ id: host.id }) },
    );
    const hintsBody = await hintsRes.json();
    assertNoSensitiveLeak(
      hintsBody,
      ["needs-pinned-ref-body", "需钉修订"],
      "hints after object ref still redacted of content",
    );
    expect(listProjects().length).toBeGreaterThanOrEqual(2);
  });
});
