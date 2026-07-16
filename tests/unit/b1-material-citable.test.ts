import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as createProjectPost } from "@/app/api/knowledge/projects/route";
import {
  GET as materialsGet,
  POST as materialsPost,
} from "@/app/api/knowledge/projects/[id]/materials/route";
import {
  assertMaterialCitationFresh,
  ensureMaterialCitationCard,
  getCardBySourceFileId,
  listCards,
  resetKnowledgeStoreForTests,
  searchProjectRecords,
} from "@/shared/knowledge/repository";
import { materialContentHash } from "@/shared/knowledge/materials";

/** B-1: import real material → stable id + citable KnowledgeCard, searchable, openable. */
let tmpDir = "";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-b1-"));
  process.env.KNOWLEDGE_DATA_DIR = tmpDir;
  delete process.env.SEED_DEMO;
  resetKnowledgeStoreForTests();
});

afterEach(() => {
  delete process.env.KNOWLEDGE_DATA_DIR;
  delete process.env.SEED_DEMO;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

it("import creates stable material id linked to a citation card", async () => {
  const created = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name: "B1 引用项目" }),
    }),
  );
  const { project } = (await created.json()) as { project: { id: string } };

  const upload = await materialsPost(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/materials`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "spec-note.md",
          content: "# 规格\n\n可引用 token-b1-cite",
        }),
      },
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  expect(upload.status).toBe(201);
  const body = (await upload.json()) as {
    material: {
      id: string;
      citationCardId?: string;
      citationTitle?: string;
      contentHash?: string;
    };
    card: {
      id: string;
      sourceFileId?: string;
      title?: string;
      sourceContentHash?: string;
    };
    citationCardId: string;
    sourceContentHash?: string;
    citationFreshness?: string;
  };
  expect(body.material.id).toBe("spec-note.md");
  expect(body.citationCardId).toBeTruthy();
  expect(body.material.citationCardId).toBe(body.citationCardId);
  expect(body.card.sourceFileId).toBe("spec-note.md");
  expect(body.card.id).toBe(body.citationCardId);
  const expectedHash = materialContentHash("# 规格\n\n可引用 token-b1-cite");
  expect(body.material.contentHash).toBe(expectedHash);
  expect(body.card.sourceContentHash).toBe(expectedHash);
  expect(body.sourceContentHash).toBe(expectedHash);
  expect(body.citationFreshness).toBe("fresh");

  const linked = getCardBySourceFileId(project.id, "spec-note.md");
  expect(linked?.id).toBe(body.citationCardId);
  expect(linked?.sourceContentHash).toBe(expectedHash);

  // Idempotent ensure: same material → same card; stamp not rewritten
  const again = ensureMaterialCitationCard({
    projectId: project.id,
    materialId: "spec-note.md",
    title: "spec-note.md",
    contentSummary: "again",
    contentHash: materialContentHash("different-bytes-must-not-restamp"),
  });
  expect(again.id).toBe(body.citationCardId);
  expect(again.sourceContentHash).toBe(expectedHash);
  expect(
    listCards({ projectId: project.id }).filter(
      (c) => c.sourceFileId === "spec-note.md",
    ),
  ).toHaveLength(1);
  expect(
    assertMaterialCitationFresh({
      sourceContentHash: again.sourceContentHash,
      currentContentHash: materialContentHash("different-bytes-must-not-restamp"),
      materialExists: true,
    }),
  ).toBe("stale");

  const hits = searchProjectRecords(project.id, "token-b1-cite", 8);
  expect(hits.some((h) => h.ref.kind === "card" && h.ref.id === body.card.id)).toBe(
    true,
  );

  const listed = await materialsGet(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/materials`,
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  const listBody = (await listed.json()) as {
    materials: Array<{
      id: string;
      citationCardId?: string;
      citationTitle?: string;
    }>;
  };
  expect(listBody.materials[0]?.id).toBe("spec-note.md");
  expect(listBody.materials[0]?.citationCardId).toBe(body.citationCardId);

  const opened = await materialsGet(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/materials?file=spec-note.md`,
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  expect(opened.status).toBe(200);
  const openBody = (await opened.json()) as {
    content: string;
    citationCardId?: string;
  };
  expect(openBody.content).toContain("token-b1-cite");
  expect(openBody.citationCardId).toBe(body.citationCardId);

  // Disk file is real (no fake material without file)
  expect(
    fs.existsSync(path.join(tmpDir, "files", project.id, "spec-note.md")),
  ).toBe(true);
});
