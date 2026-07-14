import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as addCardPost } from "@/app/api/knowledge/add/route";
import { POST as createProjectPost } from "@/app/api/knowledge/projects/route";
import { GET as canvasGet } from "@/app/api/knowledge/projects/[id]/canvas/route";
import { POST as checkpointPost } from "@/app/api/knowledge/projects/[id]/checkpoints/route";
import { POST as addWorkItemPost } from "@/app/api/knowledge/work-items/route";
import { POST as agentRunPost } from "@/app/api/knowledge/work-items/[id]/agent-run/route";
import {
  getWorkItemDetail,
  listActions,
  listCards,
  resetKnowledgeStoreForTests,
} from "@/shared/knowledge/repository";

let tmpDir = "";

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-opc-project-api-"));
  process.env.KNOWLEDGE_DATA_DIR = tmpDir;
  process.env.AGENT_RUN_MODE = "deterministic";
  resetKnowledgeStoreForTests();
});

afterEach(() => {
  delete process.env.KNOWLEDGE_DATA_DIR;
  delete process.env.AGENT_RUN_MODE;
  delete process.env.LLM_BASE_URL;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

it("creates a project, saves its checkpoint, and reads one canvas response", async () => {
  const created = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name: "画布测试", summary: "接口验收" }),
    }),
  );
  expect(created.status).toBe(201);
  const { project } = (await created.json()) as { project: { id: string } };

  const checkpoint = await checkpointPost(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/checkpoints`,
      {
        method: "POST",
        body: JSON.stringify({
          goal: "完成画布",
          completed: [],
          unresolved: ["交互"],
          nextStep: "确认交互",
          confirmedBy: "自己",
        }),
      },
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  expect(checkpoint.status).toBe(201);

  const response = await canvasGet(
    new NextRequest(
      `http://test/api/knowledge/projects/${project.id}/canvas`,
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.snapshot).toEqual(
    expect.objectContaining({
      project: expect.objectContaining({ id: project.id }),
      nodes: expect.any(Array),
      inspector: expect.any(Object),
      timeline: expect.any(Object),
      attention: expect.any(Array),
    }),
  );
});

it("writes new cards and work items into the selected project", async () => {
  const projectResponse = await createProjectPost(
    new NextRequest("http://test/api/knowledge/projects", {
      method: "POST",
      body: JSON.stringify({ name: "隔离项目" }),
    }),
  );
  const { project } = (await projectResponse.json()) as {
    project: { id: string };
  };

  await addCardPost(
    new NextRequest("http://test/api/knowledge/add", {
      method: "POST",
      body: JSON.stringify({
        content: "指定项目材料",
        source: "manual",
        projectId: project.id,
      }),
    }),
  );
  await addWorkItemPost(
    new NextRequest("http://test/api/knowledge/work-items", {
      method: "POST",
      body: JSON.stringify({
        title: "指定项目工作",
        nextStep: "继续",
        projectId: project.id,
      }),
    }),
  );

  expect(listCards({ projectId: project.id }).map((card) => card.content))
    .toEqual(["指定项目材料"]);
  expect(listActions({ projectId: project.id }).map((item) => item.title))
    .toEqual(["指定项目工作"]);
});

it("writes Agent start, result, and awaiting-confirmation state", async () => {
  const response = await agentRunPost(
    new NextRequest(
      "http://test/api/knowledge/work-items/ka-seed-1/agent-run",
      { method: "POST", body: JSON.stringify({ actor: "自己" }) },
    ),
    { params: Promise.resolve({ id: "ka-seed-1" }) },
  );
  expect(response.status).toBe(200);
  const detail = getWorkItemDetail("ka-seed-1")!;
  expect(detail.item.status).toBe("confirmed");
  const resultEvent = detail.events.find(
    (event) =>
      event.type === "result" && event.actor === "agent:project-reviewer",
  );
  expect(resultEvent?.meta?.review).toEqual(
    expect.objectContaining({
      judgment: expect.any(String),
      gaps: expect.any(Array),
      nextStep: expect.any(String),
      evidenceIds: expect.any(Array),
      mode: "deterministic",
    }),
  );
});

it("records a block instead of a result when the Agent fails", async () => {
  process.env.AGENT_RUN_MODE = "model";
  process.env.LLM_BASE_URL = "http://127.0.0.1:1";
  const response = await agentRunPost(
    new NextRequest(
      "http://test/api/knowledge/work-items/ka-seed-1/agent-run",
      { method: "POST", body: JSON.stringify({ actor: "自己" }) },
    ),
    { params: Promise.resolve({ id: "ka-seed-1" }) },
  );
  expect(response.status).toBe(502);
  const detail = getWorkItemDetail("ka-seed-1")!;
  expect(detail.item.status).toBe("blocked");
  expect(detail.events.some((event) => event.type === "block")).toBe(true);
  expect(detail.events.some((event) => event.type === "result")).toBe(false);
});
