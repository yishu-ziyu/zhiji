import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as listProjectsGet, POST as createProjectPost } from "@/app/api/knowledge/projects/route";
import {
  GET as materialsGet,
  POST as materialsPost,
} from "@/app/api/knowledge/projects/[id]/materials/route";
import {
  listActions,
  listCards,
  listProjects,
  resetKnowledgeStoreForTests,
} from "@/shared/knowledge/repository";

/**
 * Contract 015: empty data dir, no SEED_DEMO.
 * Path: empty → create project → add one real file → still there after reload.
 */
let tmpDir = "";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-first-user-"));
  process.env.KNOWLEDGE_DATA_DIR = tmpDir;
  delete process.env.SEED_DEMO;
  resetKnowledgeStoreForTests();
});

afterEach(() => {
  delete process.env.KNOWLEDGE_DATA_DIR;
  delete process.env.SEED_DEMO;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

it("empty environment stays empty without demo seed", async () => {
  const response = await listProjectsGet();
  expect(response.status).toBe(200);
  const body = (await response.json()) as { projects: unknown[] };
  expect(body.projects).toEqual([]);
  expect(listProjects()).toEqual([]);
  expect(listCards()).toEqual([]);
  expect(listActions()).toEqual([]);
});

it("rejects empty project name", async () => {
  const response = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name: "  " }),
    }),
  );
  expect(response.status).toBe(400);
  expect(listProjects()).toEqual([]);
});

it("A3=甲 then A1/A2/A4: create named project, attach file to that id, reload still owns it", async () => {
  const created = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name: "首用户项目", summary: "空 data 真接入" }),
    }),
  );
  expect(created.status).toBe(201);
  const { project } = (await created.json()) as {
    project: { id: string; name: string };
  };
  expect(project.name).toBe("首用户项目");
  expect(project.id).not.toBe("project-fc-opc-ibot");

  const upload = await materialsPost(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/materials`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "brief.md",
          content: "# Brief\n\nuser-file-token-015",
        }),
      },
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  expect(upload.status).toBe(201);
  const uploaded = (await upload.json()) as {
    material: { id: string; projectId: string; name: string };
    card: { projectId: string; sourceFileId?: string };
  };
  expect(uploaded.material.projectId).toBe(project.id);
  expect(uploaded.material.name).toBe("brief.md");
  expect(uploaded.card.projectId).toBe(project.id);
  expect(uploaded.card.sourceFileId).toBe("brief.md");

  const onDisk = path.join(tmpDir, "files", project.id, "brief.md");
  expect(fs.existsSync(onDisk)).toBe(true);
  expect(fs.readFileSync(onDisk, "utf8")).toContain("user-file-token-015");

  // Reload maps from disk (same process, files authoritative).
  const listed = await materialsGet(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/materials`,
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  const listBody = (await listed.json()) as {
    materials: Array<{ id: string; projectId: string }>;
  };
  expect(listBody.materials).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "brief.md", projectId: project.id }),
    ]),
  );

  const opened = await materialsGet(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/materials?file=brief.md`,
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  expect(opened.status).toBe(200);
  const openBody = (await opened.json()) as { content: string };
  expect(openBody.content).toContain("user-file-token-015");

  expect(
    listCards({ projectId: project.id }).some(
      (card) => card.sourceFileId === "brief.md",
    ),
  ).toBe(true);

  // B1: empty env still has no default seed project masquerading as user work.
  expect(listProjects().every((p) => p.id !== "project-fc-opc-ibot" || p.name.includes("示例"))).toBe(
    true,
  );
  expect(listProjects()).toHaveLength(1);
});

it("A1 with current project: second file stays under same projectId", async () => {
  const created = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name: "进行中项目" }),
    }),
  );
  const { project } = (await created.json()) as { project: { id: string } };

  await materialsPost(
    new NextRequest(`http://test/api/knowledge/projects/${project.id}/materials`, {
      method: "POST",
      body: JSON.stringify({ name: "a.md", content: "alpha-file" }),
    }),
    { params: Promise.resolve({ id: project.id }) },
  );
  await materialsPost(
    new NextRequest(`http://test/api/knowledge/projects/${project.id}/materials`, {
      method: "POST",
      body: JSON.stringify({ name: "b.md", content: "beta-file" }),
    }),
    { params: Promise.resolve({ id: project.id }) },
  );

  const listed = await materialsGet(
    new NextRequest(`http://test/api/knowledge/projects/${project.id}/materials`),
    { params: Promise.resolve({ id: project.id }) },
  );
  const body = (await listed.json()) as {
    materials: Array<{ id: string; projectId: string }>;
  };
  expect(body.materials).toHaveLength(2);
  expect(body.materials.every((m) => m.projectId === project.id)).toBe(true);
  expect(fs.existsSync(path.join(tmpDir, "files", project.id, "a.md"))).toBe(true);
  expect(fs.existsSync(path.join(tmpDir, "files", project.id, "b.md"))).toBe(true);
});
