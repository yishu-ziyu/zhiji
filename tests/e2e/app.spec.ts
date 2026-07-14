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

test("knowledge demo: search source cards then advance a task", async ({
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

  // Prefer a Todo row (button → Doing); else first row with a next-status button
  let action = page
    .getByTestId("action-item")
    .filter({ has: page.getByRole("button", { name: "Doing", exact: true }) })
    .first();
  if (!(await action.isVisible().catch(() => false))) {
    action = page.getByTestId("action-item").first();
  }
  await expect(action).toBeVisible({ timeout: 15000 });

  const description = (await action.locator("p").first().innerText()).trim();
  expect(description.length).toBeGreaterThan(0);

  const advance = action.getByRole("button").first();
  await expect(advance).toBeVisible();
  const labelBefore = (await advance.innerText()).replace(/\s+/g, " ").trim();

  const updateResponse = page.waitForResponse(
    (r) =>
      r.url().includes("/api/knowledge/state") &&
      r.request().method() === "POST" &&
      r.ok(),
  );
  await advance.click();
  await updateResponse;

  const same = page
    .getByTestId("action-item")
    .filter({ hasText: description })
    .first();
  await expect(same).toBeVisible({ timeout: 10000 });

  await expect
    .poll(
      async () => {
        const btn = same.getByRole("button");
        if ((await btn.count()) === 0) return "__done__";
        return (await btn.first().innerText()).replace(/\s+/g, " ").trim();
      },
      { timeout: 15000 },
    )
    .not.toBe(labelBefore);
});
