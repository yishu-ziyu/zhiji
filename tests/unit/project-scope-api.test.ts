/**
 * T-19 / D-27 — Project-hard scope RED gates (G5, test-only).
 *
 * Contract for G3 integration. These assertions describe Owner-approved
 * product behavior; they are expected RED on base 2130ea0f and must go GREEN
 * without editing this file after G3 lands.
 *
 * Gates:
 * 1. Missing projectId → error (not all-projects, not silent default)
 * 2. Project A never returns B cards/actions/relations
 * 3. Foreign card/work-item id cannot be read or mutated under A
 * 4. Add card/action without scope cannot land in demo DEFAULT_PROJECT_ID
 * 5. Explicit cross-project reference needs Owner approval + pinned revision
 * 6. Changed source revision marks the reference for review
 * 7. Sensitive project yields zero cross-project title or hit
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as listCardsGet, POST as addCardPost } from "@/app/api/knowledge/add/route";
import { GET as footprintGet } from "@/app/api/knowledge/footprint/route";
import { GET as libraryMapGet } from "@/app/api/knowledge/library-map/route";
import {
  GET as listProjectsGet,
  POST as createProjectPost,
} from "@/app/api/knowledge/projects/route";
import {
  GET as listRelationsGet,
  POST as createRelationPost,
} from "@/app/api/knowledge/relations/route";
import {
  GET as searchGet,
  POST as searchPost,
} from "@/app/api/knowledge/search/route";
import {
  GET as stateGet,
  POST as statePost,
} from "@/app/api/knowledge/state/route";
import {
  GET as listWorkItemsGet,
  POST as addWorkItemPost,
} from "@/app/api/knowledge/work-items/route";
import {
  GET as workItemGet,
  PATCH as workItemPatch,
} from "@/app/api/knowledge/work-items/[id]/route";
import { POST as linkEvidencePost } from "@/app/api/knowledge/work-items/[id]/evidence/route";
import {
  DEFAULT_PROJECT_ID,
  listActions,
  listCards,
  listProjects,
  resetKnowledgeStoreForTests,
} from "@/shared/knowledge/repository";

let tmpDir = "";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-t19-scope-"));
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
type CardBody = { card: { id: string; projectId: string; content: string; title?: string } };
type ItemBody = {
  item: { id: string; projectId: string; title: string; evidenceIds?: string[] };
};

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
  title?: string,
): Promise<{ id: string; projectId: string; content: string }> {
  const res = await addCardPost(
    new NextRequest("http://test/api/knowledge/add", {
      method: "POST",
      body: JSON.stringify({
        content,
        title: title ?? content.slice(0, 24),
        source: "manual",
        projectId,
      }),
    }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as CardBody;
  return body.card;
}

async function addWorkItem(
  projectId: string,
  title: string,
): Promise<{ id: string; projectId: string; title: string }> {
  const res = await addWorkItemPost(
    new NextRequest("http://test/api/knowledge/work-items", {
      method: "POST",
      body: JSON.stringify({
        title,
        nextStep: "推进",
        projectId,
      }),
    }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as ItemBody;
  return body.item;
}

function expectMissingProjectScope(status: number, body: unknown) {
  expect(status).toBe(400);
  const text = JSON.stringify(body);
  expect(text).toMatch(/projectId|项目|scope|范围/i);
  expect(text).not.toMatch(/project-fc-opc-ibot/);
}

describe("T-19 project scope RED gates", () => {
  describe("1) missing projectId cannot fall back to all projects", () => {
    it("rejects search/list/state/library/footprint without projectId", async () => {
      const projectA = await createProject("范围A");
      const projectB = await createProject("范围B");
      await addCard(projectA.id, "alpha-unique-token-A");
      await addCard(projectB.id, "beta-unique-token-B");

      const searchNoScope = await searchGet(
        new NextRequest("http://test/api/knowledge/search?q=token"),
      );
      expectMissingProjectScope(
        searchNoScope.status,
        await searchNoScope.json(),
      );

      const searchPostNoScope = await searchPost(
        new NextRequest("http://test/api/knowledge/search", {
          method: "POST",
          body: JSON.stringify({ query: "token" }),
        }),
      );
      expectMissingProjectScope(
        searchPostNoScope.status,
        await searchPostNoScope.json(),
      );

      const listCardsNoScope = await listCardsGet(
        new NextRequest("http://test/api/knowledge/add"),
      );
      expectMissingProjectScope(
        listCardsNoScope.status,
        await listCardsNoScope.json(),
      );

      const listWorkNoScope = await listWorkItemsGet(
        new NextRequest("http://test/api/knowledge/work-items"),
      );
      expectMissingProjectScope(
        listWorkNoScope.status,
        await listWorkNoScope.json(),
      );

      const stateNoScope = await stateGet();
      expectMissingProjectScope(stateNoScope.status, await stateNoScope.json());

      const stateListNoScope = await statePost(
        new NextRequest("http://test/api/knowledge/state", {
          method: "POST",
          body: JSON.stringify({ action: "list" }),
        }),
      );
      expectMissingProjectScope(
        stateListNoScope.status,
        await stateListNoScope.json(),
      );

      const libraryNoScope = await libraryMapGet();
      expectMissingProjectScope(
        libraryNoScope.status,
        await libraryNoScope.json(),
      );

      const footprintNoScope = await footprintGet(
        new NextRequest("http://test/api/knowledge/footprint?mode=window"),
      );
      expectMissingProjectScope(
        footprintNoScope.status,
        await footprintNoScope.json(),
      );

      // Must not have leaked both projects via soft global reads before erroring.
      expect(listProjects().map((p) => p.id).sort()).toEqual(
        [projectA.id, projectB.id].sort(),
      );
    });
  });

  describe("2) project A never returns B objects", () => {
    it("keeps search/list/relations hard to the named project", async () => {
      const projectA = await createProject("隔离甲");
      const projectB = await createProject("隔离乙");
      const cardA = await addCard(projectA.id, "甲项目独有材料 secret-A-marker");
      const cardB = await addCard(projectB.id, "乙项目独有材料 secret-B-marker");
      const workA = await addWorkItem(projectA.id, "甲工作");
      const workB = await addWorkItem(projectB.id, "乙工作");

      const cardA2 = await addCard(projectA.id, "甲第二张卡");
      const cardB2 = await addCard(projectB.id, "乙第二张卡");
      const relA = await createRelationPost(
        new NextRequest("http://test/api/knowledge/relations", {
          method: "POST",
          body: JSON.stringify({
            fromCardId: cardA.id,
            toCardId: cardA2.id,
            relationType: "supports",
            evidenceSentence: "甲内关系",
          }),
        }),
      );
      expect(relA.status).toBe(201);
      const relB = await createRelationPost(
        new NextRequest("http://test/api/knowledge/relations", {
          method: "POST",
          body: JSON.stringify({
            fromCardId: cardB.id,
            toCardId: cardB2.id,
            relationType: "supports",
            evidenceSentence: "乙内关系",
          }),
        }),
      );
      expect(relB.status).toBe(201);

      const searchA = await searchGet(
        new NextRequest(
          `http://test/api/knowledge/search?q=secret&projectId=${projectA.id}`,
        ),
      );
      expect(searchA.status).toBe(200);
      const searchBody = (await searchA.json()) as {
        hits: Array<{ id: string; projectId?: string; content?: string }>;
        projectHits?: Array<{ title?: string; summary?: string }>;
      };
      const hitIds = searchBody.hits.map((h) => h.id);
      expect(hitIds).toContain(cardA.id);
      expect(hitIds).not.toContain(cardB.id);
      expect(
        searchBody.hits.every(
          (h) => !h.projectId || h.projectId === projectA.id,
        ),
      ).toBe(true);
      const blob = JSON.stringify(searchBody);
      expect(blob).not.toContain("secret-B-marker");
      expect(blob).not.toContain(cardB.id);
      expect(blob).not.toContain(workB.id);

      const cardsA = await listCardsGet(
        new NextRequest(
          `http://test/api/knowledge/add?projectId=${projectA.id}`,
        ),
      );
      expect(cardsA.status).toBe(200);
      const cardsBody = (await cardsA.json()) as {
        cards: Array<{ id: string; projectId: string }>;
      };
      expect(cardsBody.cards.map((c) => c.id).sort()).toEqual(
        [cardA.id, cardA2.id].sort(),
      );
      expect(cardsBody.cards.every((c) => c.projectId === projectA.id)).toBe(
        true,
      );

      const workAList = await listWorkItemsGet(
        new NextRequest(
          `http://test/api/knowledge/work-items?projectId=${projectA.id}`,
        ),
      );
      expect(workAList.status).toBe(200);
      const workBody = (await workAList.json()) as {
        items: Array<{ id: string; projectId: string }>;
      };
      expect(workBody.items.map((i) => i.id)).toEqual([workA.id]);
      expect(workBody.items.every((i) => i.projectId === projectA.id)).toBe(
        true,
      );

      // Relations listed under A must not include B endpoints.
      const relListA = await listRelationsGet(
        new NextRequest(
          `http://test/api/knowledge/relations?projectId=${projectA.id}`,
        ),
      );
      expect(relListA.status).toBe(200);
      const relBody = (await relListA.json()) as {
        items: Array<{ fromCardId: string; toCardId: string }>;
      };
      const aCardIds = new Set([cardA.id, cardA2.id]);
      const bCardIds = new Set([cardB.id, cardB2.id]);
      expect(relBody.items.length).toBeGreaterThan(0);
      for (const rel of relBody.items) {
        expect(aCardIds.has(rel.fromCardId)).toBe(true);
        expect(aCardIds.has(rel.toCardId)).toBe(true);
        expect(bCardIds.has(rel.fromCardId)).toBe(false);
        expect(bCardIds.has(rel.toCardId)).toBe(false);
      }

      // Library map / state with A scope must not surface B titles or ids.
      const { GET: libraryGet } = await import(
        "@/app/api/knowledge/library-map/route"
      );
      const mapA = await libraryGet(
        new NextRequest(
          `http://test/api/knowledge/library-map?projectId=${projectA.id}`,
        ) as never,
      );
      expect(mapA.status).toBe(200);
      const mapText = JSON.stringify(await mapA.json());
      expect(mapText).not.toContain(cardB.id);
      expect(mapText).not.toContain("secret-B-marker");
      expect(mapText).not.toContain(workB.id);

      const stateA = await statePost(
        new NextRequest(
          `http://test/api/knowledge/state?projectId=${projectA.id}`,
          {
            method: "POST",
            body: JSON.stringify({ action: "list", projectId: projectA.id }),
          },
        ),
      );
      expect(stateA.status).toBe(200);
      const stateText = JSON.stringify(await stateA.json());
      expect(stateText).not.toContain(workB.id);
      expect(stateText).not.toContain("乙工作");
    });
  });

  describe("3) foreign id cannot be read or mutated under A", () => {
    it("denies get/patch/evidence for B ids when scoped to A", async () => {
      const projectA = await createProject("读隔离A");
      const projectB = await createProject("读隔离B");
      const cardB = await addCard(projectB.id, "B卡内容 foreign-card-marker");
      const workB = await addWorkItem(projectB.id, "B工作项");
      const workA = await addWorkItem(projectA.id, "A工作项");

      const getForeign = await workItemGet(
        new NextRequest(
          `http://test/api/knowledge/work-items/${workB.id}?projectId=${projectA.id}`,
        ),
        { params: Promise.resolve({ id: workB.id }) },
      );
      expect([403, 404]).toContain(getForeign.status);
      const getBody = await getForeign.json();
      expect(JSON.stringify(getBody)).not.toContain("B工作项");
      expect(JSON.stringify(getBody)).not.toContain("foreign-card-marker");

      const patchForeign = await workItemPatch(
        new NextRequest(
          `http://test/api/knowledge/work-items/${workB.id}?projectId=${projectA.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ title: "被A篡改", nextStep: "坏" }),
          },
        ),
        { params: Promise.resolve({ id: workB.id }) },
      );
      expect([403, 404]).toContain(patchForeign.status);

      // Unscoped get-by-id must also not be a free global escape when A is the caller scope.
      // After T-19, product reads require project scope; bare id without matching project is deny.
      const getBare = await workItemGet(
        new NextRequest(
          `http://test/api/knowledge/work-items/${workB.id}`,
        ),
        { params: Promise.resolve({ id: workB.id }) },
      );
      expect([400, 403, 404]).toContain(getBare.status);

      const linkForeignCard = await linkEvidencePost(
        new NextRequest(
          `http://test/api/knowledge/work-items/${workA.id}/evidence?projectId=${projectA.id}`,
          {
            method: "POST",
            body: JSON.stringify({ cardId: cardB.id }),
          },
        ),
        { params: Promise.resolve({ id: workA.id }) },
      );
      expect([400, 403, 404]).toContain(linkForeignCard.status);
      const still = listActions({ projectId: projectA.id }).find(
        (i) => i.id === workA.id,
      );
      expect(still?.evidenceIds ?? []).not.toContain(cardB.id);
    });
  });

  describe("4) silent default write into demo project is banned", () => {
    it("rejects add card/action without projectId even when demo DEFAULT project exists", async () => {
      // With demo seed present, silent `?? DEFAULT_PROJECT_ID` is the real failure mode.
      process.env.SEED_DEMO = "1";
      resetKnowledgeStoreForTests();
      expect(listProjects().some((p) => p.id === DEFAULT_PROJECT_ID)).toBe(true);
      const cardsBefore = listCards({ projectId: DEFAULT_PROJECT_ID }).length;
      const actionsBefore = listActions({ projectId: DEFAULT_PROJECT_ID }).length;

      const cardNoScope = await addCardPost(
        new NextRequest("http://test/api/knowledge/add", {
          method: "POST",
          body: JSON.stringify({
            content: "无范围写入卡-t19-marker",
            source: "manual",
          }),
        }),
      );
      expectMissingProjectScope(cardNoScope.status, await cardNoScope.json());

      const workNoScope = await addWorkItemPost(
        new NextRequest("http://test/api/knowledge/work-items", {
          method: "POST",
          body: JSON.stringify({
            title: "无范围写入工作-t19-marker",
            nextStep: "不该落地",
          }),
        }),
      );
      expectMissingProjectScope(workNoScope.status, await workNoScope.json());

      expect(listCards({ projectId: DEFAULT_PROJECT_ID })).toHaveLength(
        cardsBefore,
      );
      expect(listActions({ projectId: DEFAULT_PROJECT_ID })).toHaveLength(
        actionsBefore,
      );
      expect(
        listCards({ projectId: DEFAULT_PROJECT_ID }).some(
          (c) => c.content === "无范围写入卡-t19-marker",
        ),
      ).toBe(false);
      expect(
        listActions({ projectId: DEFAULT_PROJECT_ID }).some(
          (a) => a.title === "无范围写入工作-t19-marker",
        ),
      ).toBe(false);
    });
  });

  describe("5) explicit cross-project reference requires Owner approval and pins revision", () => {
    it("denies unapproved cross-project ref and pins approved revision receipt", async () => {
      const projectA = await createProject("引用方A");
      const projectB = await createProject("来源方B");
      const sourceCard = await addCard(
        projectB.id,
        "来源修订正文 rev-pin-body",
        "来源卡B",
      );

      // Unapproved / missing Owner approval must fail (same-project relation still blocked across projects).
      const unapprovedRelation = await createRelationPost(
        new NextRequest("http://test/api/knowledge/relations", {
          method: "POST",
          body: JSON.stringify({
            fromCardId: (await addCard(projectA.id, "A侧锚点")).id,
            toCardId: sourceCard.id,
            relationType: "supports",
            evidenceSentence: "跨项目未批准",
          }),
        }),
      );
      expect([400, 403]).toContain(unapprovedRelation.status);

      const refRoute = await import(
        "@/app/api/knowledge/projects/[id]/cross-project-references/route"
      ).catch(() => null);
      expect(
        refRoute,
        "missing POST /api/knowledge/projects/[id]/cross-project-references (T-19 explicit ref surface)",
      ).toBeTruthy();

      const sourceRevision =
        (listCards({ projectId: projectB.id }).find((c) => c.id === sourceCard.id)
          ?.sourceContentHash as string | undefined) ||
        `card:${sourceCard.id}:v1`;

      const denied = await refRoute!.POST(
        new NextRequest(
          `http://test/api/knowledge/projects/${projectA.id}/cross-project-references`,
          {
            method: "POST",
            body: JSON.stringify({
              sourceProjectId: projectB.id,
              sourceObjectKind: "card",
              sourceObjectId: sourceCard.id,
              sourceRevision,
              // no approvedBy
            }),
          },
        ),
        { params: Promise.resolve({ id: projectA.id }) },
      );
      expect([400, 403]).toContain(denied.status);

      const approved = await refRoute!.POST(
        new NextRequest(
          `http://test/api/knowledge/projects/${projectA.id}/cross-project-references`,
          {
            method: "POST",
            body: JSON.stringify({
              sourceProjectId: projectB.id,
              sourceObjectKind: "card",
              sourceObjectId: sourceCard.id,
              sourceRevision,
              approvedBy: "自己",
            }),
          },
        ),
        { params: Promise.resolve({ id: projectA.id }) },
      );
      expect(approved.status).toBe(201);
      const receipt = (await approved.json()) as {
        reference: {
          projectId: string;
          sourceProjectId: string;
          sourceObjectId: string;
          sourceRevision: string;
          approvedBy: string;
          reviewStatus?: string;
          verifiedAt?: string;
        };
      };
      expect(receipt.reference.projectId).toBe(projectA.id);
      expect(receipt.reference.sourceProjectId).toBe(projectB.id);
      expect(receipt.reference.sourceObjectId).toBe(sourceCard.id);
      expect(receipt.reference.sourceRevision).toBe(sourceRevision);
      expect(receipt.reference.approvedBy).toBe("自己");
      expect(receipt.reference.verifiedAt).toBeTruthy();
      expect(["current", "ok", "verified", undefined]).toContain(
        receipt.reference.reviewStatus ?? "current",
      );
    });
  });

  describe("6) changed source revision marks reference for review", () => {
    it("flips approved reference to needs_review when source revision changes", async () => {
      const projectA = await createProject("复查方A");
      const projectB = await createProject("变动方B");
      const sourceCard = await addCard(
        projectB.id,
        "初始正文 stable-body",
        "变动源",
      );

      const refRoute = await import(
        "@/app/api/knowledge/projects/[id]/cross-project-references/route"
      ).catch(() => null);
      expect(
        refRoute,
        "missing cross-project-references route for source-change recheck",
      ).toBeTruthy();

      const initialRevision = `card:${sourceCard.id}:v1`;
      const created = await refRoute!.POST(
        new NextRequest(
          `http://test/api/knowledge/projects/${projectA.id}/cross-project-references`,
          {
            method: "POST",
            body: JSON.stringify({
              sourceProjectId: projectB.id,
              sourceObjectKind: "card",
              sourceObjectId: sourceCard.id,
              sourceRevision: initialRevision,
              approvedBy: "自己",
            }),
          },
        ),
        { params: Promise.resolve({ id: projectA.id }) },
      );
      expect(created.status).toBe(201);
      const { reference } = (await created.json()) as {
        reference: { id: string; sourceRevision: string };
      };

      // Source change: material/card content hash or explicit revision bump.
      const bump =
        typeof refRoute!.notifySourceChanged === "function"
          ? await refRoute!.notifySourceChanged({
              sourceProjectId: projectB.id,
              sourceObjectId: sourceCard.id,
              newRevision: `card:${sourceCard.id}:v2`,
            })
          : await refRoute!.POST(
              new NextRequest(
                `http://test/api/knowledge/projects/${projectA.id}/cross-project-references`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    action: "source_changed",
                    sourceProjectId: projectB.id,
                    sourceObjectId: sourceCard.id,
                    newRevision: `card:${sourceCard.id}:v2`,
                  }),
                },
              ),
              { params: Promise.resolve({ id: projectA.id }) },
            );

      // Accept either dedicated helper success or POST action response.
      if (bump && typeof bump === "object" && "status" in bump) {
        expect((bump as Response).status).toBeLessThan(500);
      }

      const listed = await refRoute!.GET(
        new NextRequest(
          `http://test/api/knowledge/projects/${projectA.id}/cross-project-references?projectId=${projectA.id}`,
        ),
        { params: Promise.resolve({ id: projectA.id }) },
      );
      expect(listed.status).toBe(200);
      const listBody = (await listed.json()) as {
        items: Array<{
          id: string;
          sourceObjectId: string;
          sourceRevision: string;
          reviewStatus: string;
        }>;
      };
      const row =
        listBody.items.find((i) => i.id === reference.id) ??
        listBody.items.find((i) => i.sourceObjectId === sourceCard.id);
      expect(row).toBeTruthy();
      expect(row!.reviewStatus).toMatch(/review|recheck|stale|needs/i);
      // Pinned revision must remain the approved one until re-verified.
      expect(row!.sourceRevision).toBe(initialRevision);
    });
  });

  describe("7) sensitive project zero disclosure", () => {
    it("never leaks sensitive project title or hit into another project search", async () => {
      const projectA = await createProject("公开工作台");
      const sensitive = await createProject("绝密项目代号玄鸟", {
        sensitive: true,
        sensitivity: "sensitive",
        visibility: "sensitive",
      });

      // If create ignored the flag, repository/project must still expose sensitivity for T-19.
      const projectsAfter = await listProjectsGet();
      expect(projectsAfter.status).toBe(200);
      const { projects } = (await projectsAfter.json()) as {
        projects: Array<Record<string, unknown>>;
      };
      const sensitiveRow = projects.find((p) => p.id === sensitive.id);
      expect(sensitiveRow).toBeTruthy();
      const sensitiveFlag =
        sensitiveRow?.sensitive === true ||
        sensitiveRow?.sensitivity === "sensitive" ||
        sensitiveRow?.visibility === "sensitive";
      expect(
        sensitiveFlag,
        "project create must persist a sensitive marker (sensitive|sensitivity|visibility)",
      ).toBe(true);

      await addCard(
        sensitive.id,
        "绝密正文 sensitive-unique-payload-玄鸟",
        "绝密标题不可外泄",
      );
      await addCard(projectA.id, "公开材料 ordinary-payload");

      const searchFromA = await searchGet(
        new NextRequest(
          `http://test/api/knowledge/search?q=${encodeURIComponent("玄鸟")}&projectId=${projectA.id}`,
        ),
      );
      expect(searchFromA.status).toBe(200);
      const body = (await searchFromA.json()) as {
        hits: unknown[];
        projectHits?: unknown[];
        count?: number;
      };
      const text = JSON.stringify(body);
      expect(body.hits ?? []).toEqual([]);
      expect(body.projectHits ?? []).toEqual([]);
      expect(text).not.toContain("绝密");
      expect(text).not.toContain("玄鸟");
      expect(text).not.toContain("sensitive-unique-payload");
      expect(text).not.toContain(sensitive.id);
      expect(text).not.toContain("绝密项目代号玄鸟");

      // Library map scoped to A must also zero-disclose sensitive titles.
      const mapA = await libraryMapGet();
      // Prefer scoped call once G3 requires projectId; if unscoped is still 400, that is gate 1.
      const mapScoped = await (async () => {
        try {
          // library-map may accept projectId query after T-19.
          const { GET } = await import(
            "@/app/api/knowledge/library-map/route"
          );
          return GET(
            new NextRequest(
              `http://test/api/knowledge/library-map?projectId=${projectA.id}`,
            ) as never,
          );
        } catch {
          return mapA;
        }
      })();
      if (mapScoped.status === 200) {
        const mapText = JSON.stringify(await mapScoped.json());
        expect(mapText).not.toContain("绝密项目代号玄鸟");
        expect(mapText).not.toContain("sensitive-unique-payload");
        expect(mapText).not.toContain(sensitive.id);
      }
    });
  });
});
