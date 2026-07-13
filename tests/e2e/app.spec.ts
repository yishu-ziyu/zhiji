import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

test("home presents the efficiency-only product", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/FC-OPC|交付/);
  await expect(page.getByText("交付运营助手").first()).toBeVisible();
  await expect(page.getByText("电商经营 Agent")).toHaveCount(0);
});

test("golden path keeps client confirmation and acceptance client-owned", async ({
  page,
  context,
}) => {
  await page.goto(`${BASE_URL}/track/efficiency`);
  await page.getByRole("button", { name: "载入演示对话" }).click();
  await expect(page.getByText("服务方审阅草稿")).toBeVisible();
  await expect(
    page.locator('input[value="输出落地页改版原型"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: "生成承诺单" }).click();
  const draftCard = page.locator("article").filter({
    has: page.locator('input[value="输出落地页改版原型"]'),
  });
  await expect(draftCard).toBeVisible();
  await draftCard.getByRole("button", { name: "发送给客户" }).click();
  const providerCard = page.locator("article").filter({
    hasText: "输出落地页改版原型",
  });
  await expect(
    providerCard.getByText("待客户确认", { exact: true }),
  ).toBeVisible();
  const clientLink = await providerCard.locator("code").textContent();
  expect(clientLink).toMatch(/\/c\/[a-f0-9-]{36}$/);

  const clientPage = await context.newPage();
  await clientPage.goto(clientLink!);
  await expect(clientPage.getByRole("heading", { name: "输出落地页改版原型" })).toBeVisible();
  await clientPage.getByRole("button", { name: "确认承诺" }).click();
  await expect(clientPage.getByText("承诺已确认，等待服务方交付。")).toBeVisible();

  await expect(providerCard.getByText("客户已确认")).toBeVisible({ timeout: 5000 });
  await providerCard.getByRole("button", { name: "标记已交付" }).click();
  await expect(clientPage.getByRole("button", { name: "确认验收" })).toBeVisible({ timeout: 5000 });
  await clientPage.getByRole("button", { name: "确认验收" }).click();

  await expect(clientPage.getByText("验收完成，这张承诺单已闭环。")).toBeVisible();
  await expect(providerCard.getByText("客户已验收")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("50%").first()).toBeVisible();
});

test("provider API cannot fake a client confirmation", async ({ request }) => {
  const created = await request.post(`${BASE_URL}/api/efficiency/slips`, {
    data: { action: "create", slips: [{ title: "权限边界测试承诺" }] },
  });
  expect(created.status()).toBe(201);
  const createdBody = await created.json();
  const id = createdBody.slips[0].id as string;

  const sent = await request.post(`${BASE_URL}/api/efficiency/slips`, {
    data: { action: "send", id },
  });
  expect(sent.ok()).toBe(true);

  const forged = await request.post(`${BASE_URL}/api/efficiency/slips`, {
    data: { action: "confirm", id },
  });
  expect(forged.status()).toBe(400);
  await expect(forged.json()).resolves.toMatchObject({
    error: "服务方无权执行该动作",
  });
});

test("commitments API validates input and has a deterministic fixture", async ({
  request,
}) => {
  const invalid = await request.post(
    `${BASE_URL}/api/efficiency/commitments`,
    { data: {} },
  );
  expect(invalid.status()).toBe(400);

  const fixture = await request.post(
    `${BASE_URL}/api/efficiency/commitments`,
    { data: { fixture: "dialog-01" } },
  );
  expect(fixture.ok()).toBe(true);
  const body = await fixture.json();
  expect(body._mock).toBe(true);
  expect(body.commitments.length).toBeGreaterThanOrEqual(2);
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/llm/health`);
  expect(response.ok()).toBe(true);
});
