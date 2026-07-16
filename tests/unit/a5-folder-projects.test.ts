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
import { classifyWebkitRelativeFiles } from "@/shared/knowledge/folder-import";
import {
  listProjects,
  resetKnowledgeStoreForTests,
} from "@/shared/knowledge/repository";

/**
 * A5 empty-env: multi top-level folders → multi projects; nested files owned;
 * single-level folder of files → one project; reload still present.
 */
let tmpDir = "";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-a5-"));
  process.env.KNOWLEDGE_DATA_DIR = tmpDir;
  delete process.env.SEED_DEMO;
  resetKnowledgeStoreForTests();
});

afterEach(() => {
  delete process.env.KNOWLEDGE_DATA_DIR;
  delete process.env.SEED_DEMO;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function createProject(name: string) {
  const response = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { project: { id: string; name: string } };
}

async function addMaterial(
  projectId: string,
  name: string,
  content: string,
) {
  const response = await materialsPost(
    new NextRequest(
      `http://test/api/knowledge/projects/${projectId}/materials`,
      {
        method: "POST",
        body: JSON.stringify({ name, content }),
      },
    ),
    { params: Promise.resolve({ id: projectId }) },
  );
  expect(response.status).toBe(201);
  return response.json();
}

it("A5: two top-level folders become two projects with owned materials", async () => {
  const classified = classifyWebkitRelativeFiles([
    {
      name: "a.md",
      content: "from-alpha",
      webkitRelativePath: "AlphaProj/a.md",
    },
    {
      name: "deep.md",
      content: "nested-alpha",
      webkitRelativePath: "AlphaProj/docs/deep.md",
    },
    {
      name: "b.md",
      content: "from-beta",
      webkitRelativePath: "BetaProj/b.md",
    },
  ]);
  expect(classified.folderProjects.map((p) => p.projectName).sort()).toEqual([
    "AlphaProj",
    "BetaProj",
  ]);

  const created: Array<{ id: string; name: string }> = [];
  for (const folder of classified.folderProjects) {
    const { project } = await createProject(folder.projectName);
    created.push(project);
    for (const file of folder.files) {
      await addMaterial(project.id, file.relativePath, file.content);
    }
  }

  expect(listProjects()).toHaveLength(2);
  expect(created.map((p) => p.name).sort()).toEqual(["AlphaProj", "BetaProj"]);

  const alpha = created.find((p) => p.name === "AlphaProj")!;
  const beta = created.find((p) => p.name === "BetaProj")!;

  const alphaList = await materialsGet(
    new NextRequest(
      `http://test/api/knowledge/projects/${alpha.id}/materials`,
    ),
    { params: Promise.resolve({ id: alpha.id }) },
  );
  const alphaBody = (await alphaList.json()) as {
    materials: Array<{ id: string; projectId: string }>;
  };
  expect(alphaBody.materials.map((m) => m.id).sort()).toEqual([
    "a.md",
    "docs/deep.md",
  ]);
  expect(alphaBody.materials.every((m) => m.projectId === alpha.id)).toBe(true);
  expect(
    fs.existsSync(path.join(tmpDir, "files", alpha.id, "docs", "deep.md")),
  ).toBe(true);
  expect(fs.readFileSync(path.join(tmpDir, "files", alpha.id, "a.md"), "utf8")).toBe(
    "from-alpha",
  );

  const betaList = await materialsGet(
    new NextRequest(`http://test/api/knowledge/projects/${beta.id}/materials`),
    { params: Promise.resolve({ id: beta.id }) },
  );
  const betaBody = (await betaList.json()) as {
    materials: Array<{ id: string }>;
  };
  expect(betaBody.materials.map((m) => m.id)).toEqual(["b.md"]);
  // Cross-project isolation
  expect(
    fs.existsSync(path.join(tmpDir, "files", beta.id, "a.md")),
  ).toBe(false);
});

it("A5: single-level folder of only files is still one project", async () => {
  const classified = classifyWebkitRelativeFiles([
    {
      name: "1.md",
      content: "one",
      webkitRelativePath: "FlatPack/1.md",
    },
    {
      name: "2.md",
      content: "two",
      webkitRelativePath: "FlatPack/2.md",
    },
  ]);
  expect(classified.folderProjects).toHaveLength(1);
  expect(classified.folderProjects[0].projectName).toBe("FlatPack");

  const { project } = await createProject(
    classified.folderProjects[0].projectName,
  );
  for (const file of classified.folderProjects[0].files) {
    await addMaterial(project.id, file.relativePath, file.content);
  }

  expect(listProjects()).toHaveLength(1);
  expect(listProjects()[0].name).toBe("FlatPack");
  const listed = await materialsGet(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/materials`,
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  const body = (await listed.json()) as { materials: Array<{ id: string }> };
  expect(body.materials.map((m) => m.id).sort()).toEqual(["1.md", "2.md"]);
});
