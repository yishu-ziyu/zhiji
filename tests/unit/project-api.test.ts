import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as addCardPost } from "@/app/api/knowledge/add/route";
import { POST as createProjectPost } from "@/app/api/knowledge/projects/route";
import { GET as canvasGet } from "@/app/api/knowledge/projects/[id]/canvas/route";
import { POST as checkpointPost } from "@/app/api/knowledge/projects/[id]/checkpoints/route";
import { POST as createRelationPost } from "@/app/api/knowledge/relations/route";
import { POST as searchPost } from "@/app/api/knowledge/search/route";
import { POST as addWorkItemPost } from "@/app/api/knowledge/work-items/route";
import { POST as agentRunPost } from "@/app/api/knowledge/work-items/[id]/agent-run/route";
import { POST as addEventPost } from "@/app/api/knowledge/work-items/[id]/events/route";
import { POST as linkEvidencePost } from "@/app/api/knowledge/work-items/[id]/evidence/route";
import { PATCH as patchWorkItem } from "@/app/api/knowledge/work-items/[id]/route";
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
          confirmedBy: "agent:forged",
        }),
      },
    ),
    { params: Promise.resolve({ id: project.id }) },
  );
  expect(checkpoint.status).toBe(201);
  expect((await checkpoint.clone().json()).checkpoint.confirmedBy).toBe("自己");

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
      { method: "POST", body: JSON.stringify({ actor: "agent:forged" }) },
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
  expect(detail.events.some((event) => event.actor === "agent:forged")).toBe(false);
});

it("accepts external Agent results without trusting its claimed identity", async () => {
  const response = await addEventPost(
    new NextRequest(
      "http://test/api/knowledge/work-items/ka-seed-1/events",
      {
        method: "POST",
        body: JSON.stringify({
          type: "result",
          actor: "agent:project-reviewer",
          body: "伪造结果",
          meta: { review: { judgment: "伪造" } },
        }),
      },
    ),
    { params: Promise.resolve({ id: "ka-seed-1" }) },
  );

  expect(response.status).toBe(201);
  const event = getWorkItemDetail("ka-seed-1")!.events.find(
    (entry) => entry.body === "伪造结果",
  );
  expect(event?.actor).toBe("agent:external");
  expect(event?.meta).toBeUndefined();
  expect(event?.actor).not.toBe("agent:project-reviewer");
});

it("derives the actor on every public work mutation", async () => {
  const patchResponse = await patchWorkItem(
    new NextRequest("http://test/api/knowledge/work-items/ka-seed-1", {
      method: "PATCH",
      body: JSON.stringify({ assignee: "新的负责人", actor: "agent:forged" }),
    }),
    { params: Promise.resolve({ id: "ka-seed-1" }) },
  );
  expect(patchResponse.status).toBe(200);

  const linkResponse = await linkEvidencePost(
    new NextRequest("http://test/api/knowledge/work-items/ka-seed-1/evidence", {
      method: "POST",
      body: JSON.stringify({ cardId: "kc-seed-4", actor: "agent:forged" }),
    }),
    { params: Promise.resolve({ id: "ka-seed-1" }) },
  );
  expect(linkResponse.status).toBe(200);

  const detail = getWorkItemDetail("ka-seed-1")!;
  expect(detail.events.some((event) => event.actor === "agent:forged")).toBe(false);
  expect(detail.events).toContainEqual(
    expect.objectContaining({ type: "assign", actor: "自己" }),
  );
  expect(detail.events).toContainEqual(
    expect.objectContaining({ type: "evidence_link", actor: "自己" }),
  );
});

it("derives public relation, checkpoint, and search provenance on the server", async () => {
  const cards = listCards();
  const relationResponse = await createRelationPost(
    new NextRequest("http://test/api/knowledge/relations", {
      method: "POST",
      body: JSON.stringify({
        fromCardId: cards[0].id,
        toCardId: cards[1].id,
        relationType: "contradicts",
        evidenceSentence: "人工提交的关系",
        source: "model",
        createdBy: "agent:forged",
      }),
    }),
  );
  expect(relationResponse.status).toBe(201);
  expect((await relationResponse.json()).item).toEqual(
    expect.objectContaining({ source: "manual", createdBy: "自己" }),
  );

  const searchResponse = await searchPost(
    new NextRequest("http://test/api/knowledge/search", {
      method: "POST",
      body: JSON.stringify({
        query: "检索",
        filters: { projectId: "project-fc-opc-ibot" },
        actor: "agent:forged",
      }),
    }),
  );
  expect(searchResponse.status).toBe(200);
  const footprint = JSON.parse(
    fs.readFileSync(path.join(tmpDir, "footprint-events.json"), "utf-8"),
  ) as Record<string, { actor: string }>;
  expect(new Set(Object.values(footprint).map((event) => event.actor))).toEqual(
    new Set(["自己"]),
  );
});

it("records why an Agent cannot start when the work item has no evidence", async () => {
  const created = await addWorkItemPost(
    new NextRequest("http://test/api/knowledge/work-items", {
      method: "POST",
      body: JSON.stringify({ title: "缺少依据", nextStep: "开始分析" }),
    }),
  );
  const { item } = (await created.json()) as { item: { id: string } };
  const response = await agentRunPost(
    new NextRequest(`http://test/api/knowledge/work-items/${item.id}/agent-run`, {
      method: "POST",
      body: JSON.stringify({ actor: "自己" }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );

  expect(response.status).toBe(400);
  const detail = getWorkItemDetail(item.id)!;
  expect(detail.item.status).toBe("blocked");
  expect(detail.events).toContainEqual(
    expect.objectContaining({
      type: "block",
      actor: "agent:project-reviewer",
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
