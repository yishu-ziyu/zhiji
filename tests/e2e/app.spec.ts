import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

test("home only offers knowledge loop", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.getByText("知识闭环").first()).toBeVisible();
  await expect(page.getByText("客户变化处理")).toHaveCount(0);
  await expect(page.getByText("电商经营")).toHaveCount(0);
  await page.getByRole("link", { name: /打开知识库工作台/ }).click();
  await expect(page).toHaveURL(/\/track\/knowledge/);
});

test("knowledge gold path: search, source cards, advance action", async ({
  page,
}) => {
  await page.goto(`${BASE_URL}/track/knowledge`);
  await expect(page.getByText("问一句，从已有知识里找").first()).toBeVisible();

  await page.getByLabel("知识检索").fill("检索 来源");
  await page.getByRole("button", { name: "检索" }).click();

  const cards = page.getByTestId("knowledge-card");
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Meeting|Doc|Note|Chat|Email|会议|文档|手记/i).first()).toBeVisible();

  const action = page.getByTestId("action-item").first();
  await expect(action).toBeVisible();
  const advance = action.getByRole("button").first();
  if (await advance.isVisible()) {
    await advance.click();
  }
});
