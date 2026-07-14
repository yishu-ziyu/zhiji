import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("home opens the project canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("知识工作台").first()).toBeVisible();
  await page.getByRole("link", { name: /打开知识工作台/ }).click();
  await expect(page).toHaveURL(/\/track\/knowledge/);
  await expect(page.getByTestId("project-canvas-shell")).toBeVisible();
});

test("project canvas supports focus, decision, Agent execution, and writeback", async ({
  page,
  request,
}) => {
  await page.goto("/track/knowledge");
  await expect(page.getByTestId("project-navigator")).toBeVisible();
  await expect(page.getByTestId("project-canvas")).toBeVisible();
  await expect(page.getByTestId("project-inspector")).toBeVisible();
  await expect(page.getByTestId("project-timeline")).toBeVisible();

  await page.getByRole("button", { name: /新建/ }).click();
  await page
    .getByRole("button", { name: "新增工作项 写入项目和时间线", exact: true })
    .click();
  await page.getByLabel("工作项", { exact: true }).fill("e2e 项目画布复核");
  await page.getByLabel("下一步", { exact: true }).fill("核对当前设计状态");
  await page
    .getByLabel("直接依据（交给 Agent 时必需）")
    .selectOption({ label: "检索验收标准" });
  await page.getByRole("button", { name: "创建并打开" }).click();

  await expect(page).toHaveURL(/focus=work_item%3A/);
  await expect(page.getByTestId("project-inspector")).toContainText(
    "e2e 项目画布复核",
  );
  await expect(page.getByTestId("project-inspector")).toContainText("负责人");
  await page.getByTestId("project-inspector").getByRole("button", { name: "依据1", exact: true }).click();
  await expect(page.getByTestId("project-inspector")).toContainText("来源：会议");
  await page.getByTestId("project-inspector").getByRole("button", { name: "概览" }).click();
  await page.getByRole("button", { name: /我的未完成/ }).click();
  await expect(page.getByTestId("my-open-work")).toContainText("e2e 项目画布复核");
  await page.getByTestId("my-open-work").getByRole("button", { name: /e2e 项目画布复核/ }).click();

  await page.getByRole("button", { name: /修改下一步/ }).click();
  const nextStepForm = page.getByTestId("next-step-form");
  await nextStepForm.getByLabel("新的下一步").fill("交给 Agent 核对证据");
  await nextStepForm.getByRole("button", { name: /写入时间线/ }).click();
  await expect(page.getByText("下一步已写入时间线")).toBeVisible();

  const runAgent = page.getByTestId("run-agent");
  await expect(runAgent).toBeEnabled();
  await runAgent.click();
  await expect(page.getByText(/Agent 已写回复核结果/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("project-timeline")).toContainText(
    "Agent 项目复核",
  );

  const focus = new URL(page.url()).searchParams.get("focus");
  const workItemId = focus?.replace("work_item:", "");
  expect(workItemId).toBeTruthy();
  const externalResult = await request.post(
    `/api/knowledge/work-items/${workItemId}/events`,
    { data: { type: "result", body: "外部 Agent 已完成交叉核对" } },
  );
  expect(externalResult.ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId("project-timeline")).toContainText("外部 Agent");

  const focusedUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(focusedUrl);
  await expect(page.getByTestId("project-inspector")).toContainText(
    "e2e 项目画布复核",
  );
  await expect(page.getByTestId("project-timeline")).toContainText(
    "Agent 项目复核",
  );
});

test("project canvas keeps search evidence and confirmed checkpoint", async ({
  page,
}) => {
  await page.goto("/track/knowledge");
  await expect(page.getByTestId("project-canvas-shell")).toBeVisible();

  await page.getByLabel("搜索内容").fill("检索 来源");
  await page.getByRole("button", { name: "搜索当前项目" }).click();
  const result = page
    .locator('[class*="searchResults"] button')
    .filter({ hasText: "检索验收标准" });
  await expect(result).toBeVisible();
  await expect(result).toContainText("来源：会议");
  const footprint = page.getByTestId("project-footprint");
  await expect(footprint).toBeVisible();
  await expect(footprint).toContainText("本次检索");
  await expect(footprint.locator('button[title="检索验收标准"]')).toHaveAttribute("data-depth", "1");
  await result.click();
  await expect(page).toHaveURL(/focus=card%3A/);
  await expect(page.getByTestId("project-canvas")).toContainText(/支持|依赖/);
  await expect(
    page.getByTestId("project-canvas").locator('[title*="来源"]').first(),
  ).toBeVisible();

  const activeProject = page
    .getByTestId("project-navigator")
    .locator('button[class*="projectButtonActive"]');
  await activeProject.click();
  await expect(page).toHaveURL(/focus=project%3A/);

  await page.getByRole("button", { name: /新建/ }).click();
  await page.getByRole("button", { name: /记录当前状态/ }).click();
  const checkpoint = page.getByTestId("checkpoint-form");
  await checkpoint.getByLabel("离开时的目标").fill("完成项目画布主路径");
  await checkpoint.getByLabel("确认的下一步").fill("运行完整验收");
  await checkpoint.getByRole("button", { name: /保存当前状态/ }).click();
  await expect(page.getByText("已保存你确认的项目状态")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("project-inspector")).toContainText(
    "你离开时确认的状态",
  );
  await expect(page.getByTestId("project-inspector")).toContainText(
    "运行完整验收",
  );
});

test("a user can execute work, record progress, add materials, and create a relation", async ({
  page,
  request,
}) => {
  await page.goto("/track/knowledge");
  await page.getByRole("button", { name: /新建/ }).click();
  await page.getByRole("button", { name: "新增工作项 写入项目和时间线", exact: true }).click();
  await page.getByLabel("工作项", { exact: true }).fill("e2e 自己执行里程碑");
  await page.getByLabel("下一步", { exact: true }).fill("完成本地核对");
  await page.getByRole("button", { name: "创建并打开" }).click();

  await page.getByTestId("project-inspector").getByRole("button", { name: "自己执行", exact: true }).click();
  const execution = page.getByTestId("self-execution-form");
  await execution.getByLabel("负责人").fill("Yishu");
  await execution.getByLabel("执行后的状态").selectOption("doing");
  await execution.getByRole("button", { name: "写入执行结果" }).click();
  await expect(page.getByText("执行结果已写入项目状态和时间线")).toBeVisible();
  await expect(page.getByTestId("project-inspector")).toContainText("Yishu");

  const comment = page.getByTestId("comment-form");
  await comment.getByLabel("补充一条执行记录").fill("里程碑核对已经完成一半");
  await comment.getByRole("button", { name: "写入时间线" }).click();
  await expect(page.getByText("执行记录已写入时间线")).toBeVisible();

  await page.getByLabel("搜索内容").fill("里程碑");
  await page.getByRole("button", { name: "搜索当前项目" }).click();
  await expect(page.locator('[class*="searchResults"]')).toContainText("e2e 自己执行里程碑");
  await expect(page.locator('[class*="searchResults"]')).toContainText("里程碑核对已经完成一半");

  for (const title of ["e2e 关系材料甲", "e2e 关系材料乙"]) {
    await page.getByRole("button", { name: /新建/ }).click();
    await page.getByRole("button", { name: "新增项目材料 加入画布并可被检索", exact: true }).click();
    await page.getByLabel("标题（可选）").fill(title);
    await page.getByLabel("内容", { exact: true }).fill(`${title}的原始内容`);
    await page.getByRole("button", { name: "加入项目" }).click();
    await expect(page.getByTestId("project-inspector")).toContainText(title);
  }

  const relation = page.getByTestId("relation-form");
  await relation.getByTestId("relation-target").selectOption({ label: "e2e 关系材料甲" });
  await relation.getByTestId("relation-type").selectOption("supports");
  await relation.getByTestId("relation-evidence").fill("乙材料明确支持甲材料");
  await relation.getByRole("button", { name: "建立关系" }).click();
  await expect(page.getByText("材料关系已建立")).toBeVisible();
  await expect(page.getByTestId("project-canvas")).toContainText("支持");

  const cardsResponse = await request.get("/api/knowledge/add?projectId=project-fc-opc-ibot");
  const cardsData = await cardsResponse.json() as { cards: Array<{ id: string; title?: string }> };
  const cardA = cardsData.cards.find((card) => card.title === "e2e 关系材料甲")!;
  const cardB = cardsData.cards.find((card) => card.title === "e2e 关系材料乙")!;
  const suggestionResponse = await request.post("/api/knowledge/relations", {
    data: {
      fromCardId: cardB.id,
      toCardId: cardA.id,
      relationType: "contradicts",
      evidenceSentence: "乙材料与甲材料的验收结论冲突",
      status: "suggested",
    },
  });
  expect(suggestionResponse.ok()).toBe(true);
  await page.reload();
  await page.getByTestId("project-inspector").getByRole("button", { name: "依据1", exact: true }).click();
  const relationDetails = page.getByTestId("relation-details");
  await expect(relationDetails).toContainText("乙材料与甲材料的验收结论冲突");
  await relationDetails.getByRole("button", { name: "确认关系" }).click();
  await expect(page.getByText("建议关系已确认")).toBeVisible();
});

test("project history navigation reloads the matching project evidence", async ({ page, request }) => {
  const projectResponse = await request.post("/api/knowledge/projects", {
    data: { name: "e2e 历史项目", summary: "检查前进后退" },
  });
  const { project } = await projectResponse.json() as { project: { id: string } };
  await request.post("/api/knowledge/add", {
    data: { projectId: project.id, title: "只属于历史项目", content: "隔离依据", source: "manual" },
  });

  await page.goto(`/track/knowledge?projectId=${project.id}`);
  await expect(page.getByTestId("project-inspector")).toContainText("e2e 历史项目");
  await page.route("**/api/knowledge/search", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.getByLabel("搜索内容").fill("隔离依据");
  await page.getByRole("button", { name: "搜索当前项目" }).click();
  await page.getByRole("button", { name: "fc-opc-ibot" }).click();
  await expect(page).toHaveURL(/project-fc-opc-ibot/);
  await page.waitForTimeout(600);
  await expect(page.locator('[class*="searchResults"]')).toHaveCount(0);
  await page.unroute("**/api/knowledge/search");
  await page.goBack();
  await expect(page.getByTestId("project-inspector")).toContainText("e2e 历史项目");

  await page.route("**/api/knowledge/footprint", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await route.continue();
  });
  await page
    .getByTestId("project-canvas")
    .getByRole("button", { name: /只属于历史项目/ })
    .click();
  await page.getByRole("button", { name: "fc-opc-ibot" }).click();
  await page.waitForTimeout(600);
  await expect(page.getByTestId("project-inspector")).toContainText("fc-opc-ibot");
  await expect(page).toHaveURL(/project-fc-opc-ibot/);
  await page.unroute("**/api/knowledge/footprint");

  await page.goBack();
  await expect(page.getByTestId("project-inspector")).toContainText("e2e 历史项目");

  await page.getByRole("button", { name: /新建/ }).click();
  await page.getByRole("button", { name: "新增工作项 写入项目和时间线", exact: true }).click();
  const evidence = page.getByLabel("直接依据（交给 Agent 时必需）");
  await expect(evidence.getByRole("option", { name: "只属于历史项目" })).toHaveCount(1);
  await expect(evidence.getByRole("option", { name: "检索验收标准" })).toHaveCount(0);
});

test("desktop breakpoints, keyboard search, and reduced motion remain usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/track/knowledge");
    await expect(page.getByTestId("project-navigator")).toBeVisible();
    await expect(page.getByTestId("project-canvas")).toBeVisible();
    await expect(page.getByTestId("project-inspector")).toBeVisible();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+f" : "Control+f");
    await expect(page.getByLabel("搜索内容")).toBeFocused();
  }
});
