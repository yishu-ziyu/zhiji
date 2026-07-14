import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("home only offers knowledge workbench", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("知识工作台").first()).toBeVisible();
  await expect(page.getByText("客户变化处理")).toHaveCount(0);
  await expect(page.getByText("电商经营")).toHaveCount(0);
  await page.getByRole("link", { name: /打开知识工作台/ }).click();
  await expect(page).toHaveURL(/\/track\/knowledge/);
});

test("knowledge demo: search, work item timeline, advance", async ({
  page,
}) => {
  await page.goto("/track/knowledge");
  await expect(page.getByText("问一句，从已有知识里找").first()).toBeVisible();

  await page.getByLabel("知识检索").fill("检索 来源");
  await page.getByRole("button", { name: "检索", exact: true }).click();

  const cards = page.getByTestId("knowledge-card");
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText(/Meeting|Doc|Note|Chat|Email|会议|文档|手记/i).first(),
  ).toBeVisible();

  await expect(page.getByTestId("knowledge-footprint")).toBeVisible();
  const litNodes = page.locator('[data-testid="footprint-node"][data-lit="1"]');
  await expect(litNodes.first()).toBeVisible({ timeout: 10000 });
  const litCount = await litNodes.count();
  const cardCount = await cards.count();
  expect(litCount).toBe(cardCount);

  await expect(page.getByTestId("work-items-panel")).toBeVisible();

  // Create a clean work item for deterministic advance
  await page.getByLabel("工作项标题", { exact: true }).fill("e2e 验收工作项");
  await page.getByLabel("下一步", { exact: true }).fill("点状态推进");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByTestId("work-item-detail")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("work-item-detail")).toContainText(
    "e2e 验收工作项",
  );

  // Comment on timeline
  await page.getByLabel("工作项评论").fill("演示：写回时间线");
  await page.getByRole("button", { name: "评论", exact: true }).click();
  await expect(page.getByTestId("work-item-timeline")).toContainText(
    "演示：写回时间线",
    { timeout: 10000 },
  );

  // Advance todo → doing (has assignee + nextStep)
  const action = page
    .getByTestId("action-item")
    .filter({ hasText: "e2e 验收工作项" })
    .first();
  await expect(action).toBeVisible();
  const advance = action.getByRole("button").first();
  const labelBefore = (await advance.innerText()).replace(/\s+/g, " ").trim();
  const updateResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/api/knowledge/work-items/") &&
      r.request().method() === "PATCH" &&
      r.ok(),
  );
  await advance.click();
  await updateResponse;

  await expect
    .poll(
      async () => {
        const btn = action.getByRole("button");
        if ((await btn.count()) === 0) return "__done__";
        return (await btn.first().innerText()).replace(/\s+/g, " ").trim();
      },
      { timeout: 15000 },
    )
    .not.toBe(labelBefore);

  await expect(page.getByTestId("work-item-timeline")).toContainText(/状态|进行中|doing/i);
});

test("knowledge relations: type + evidence sentence visible", async ({
  page,
}) => {
  await page.goto("/track/knowledge");
  await expect(page.getByTestId("card-relations")).toBeVisible({
    timeout: 15000,
  });

  // Seed selects first hit; relations panel should show at least one edge
  const edges = page.getByTestId("relation-edge");
  await expect(edges.first()).toBeVisible({ timeout: 10000 });
  await expect(edges.first()).toContainText(/支持|依赖|同题|出自|后续|矛盾/);
  // Source sentence from seed (must not be empty decoration)
  await expect(edges.first()).toContainText(/来源|材料|状态|检索|卡片|下一步/);

  // Open add form and require sentence
  await page.getByRole("button", { name: "添加关系" }).click();
  await expect(page.getByTestId("relation-form")).toBeVisible();
  await expect(page.getByLabel("来源句")).toBeVisible();

  // Work item with multi evidence shows island when detail open
  const island = page.getByTestId("evidence-island");
  if ((await island.count()) > 0) {
    await expect(island.first()).toBeVisible();
    await expect(page.getByTestId("island-edge").first()).toContainText(
      /支持|依赖/,
    );
  }
});
