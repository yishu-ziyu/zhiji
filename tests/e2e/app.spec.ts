import { expect, test } from "@playwright/test";

test("home only offers knowledge workbench", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("知识工作台").first()).toBeVisible();
  await expect(page.getByText("客户变化处理")).toHaveCount(0);
  await expect(page.getByText("电商经营")).toHaveCount(0);
  await page.getByRole("link", { name: /打开知识工作台/ }).click();
  await expect(page).toHaveURL(/\/track\/knowledge/);
});

test("knowledge demo: search source cards then advance a task", async ({
  page,
}) => {
  await page.goto("/track/knowledge");
  await expect(page.getByText("问一句，从已有知识里找").first()).toBeVisible();

  await page.getByLabel("知识检索").fill("检索 来源");
  await page.getByRole("button", { name: "检索" }).click();

  const cards = page.getByTestId("knowledge-card");
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText(/Meeting|Doc|Note|Chat|Email|会议|文档|手记/i).first(),
  ).toBeVisible();

  const action = page.getByTestId("action-item").first();
  await expect(action).toBeVisible({ timeout: 15000 });
  const description = (await action.locator("p").first().innerText()).trim();
  expect(description.length).toBeGreaterThan(0);

  const advance = action.getByRole("button").first();
  await expect(advance).toBeVisible();
  const labelBefore = (await advance.innerText()).replace(/\s+/g, " ").trim();
  await advance.click();

  const same = page
    .getByTestId("action-item")
    .filter({ hasText: description })
    .first();
  await expect(same).toBeVisible({ timeout: 10000 });

  const advanceAfter = same.getByRole("button");
  if ((await advanceAfter.count()) === 0) {
    // advanced to done — no next button
    await expect(same.getByText(/Done|完成|已完成/i)).toBeVisible();
  } else {
    const labelAfter = (await advanceAfter.first().innerText())
      .replace(/\s+/g, " ")
      .trim();
    expect(labelAfter).not.toEqual(labelBefore);
  }
});
