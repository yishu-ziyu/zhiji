import { expect, test } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

test("home presents the customer-change product", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/FC-OPC|交付/);
  await expect(page.getByText("客户变化处理").first()).toBeVisible();
  await expect(page.getByText("电商经营 Agent")).toHaveCount(0);
});

test("客户变化从原消息变成新的交付日期和尾款", async ({
  page,
  context,
  request,
}) => {
  await page.goto(`${BASE_URL}/track/efficiency`);
  await page.getByRole("button", { name: "载入演示项目" }).click();
  await expect(page.getByText("当前版本 v1")).toBeVisible();
  await expect(page.getByText("尾款 ¥4,000")).toBeVisible();

  await page.getByRole("button", { name: "载入演示消息" }).click();
  await page.getByRole("button", { name: "分析这条消息" }).click();
  await expect(page.getByText("增加一组 A/B 测试").first()).toBeVisible();
  await expect(page.getByText("需要服务方决定")).toHaveCount(2);
  await expect(page.getByText("价格先按之前的").first()).toBeVisible();

  await page
    .getByRole("textbox", { name: "新的工作范围" })
    .fill("单版本落地页，增加一组 A/B 测试");
  await page.getByLabel("新的交付日期").fill("2026-07-20");
  await page.getByLabel("新的总价（元）").fill("10000");
  await page.getByRole("button", { name: "发送给客户确认" }).click();

  const clientLink = await page.getByTestId("client-link").textContent();
  expect(clientLink).toMatch(/\/c\/[a-f0-9-]{36}$/);

  const clientPage = await context.newPage();
  await clientPage.setViewportSize({ width: 390, height: 844 });
  await clientPage.goto(clientLink!);
  await expect(
    clientPage.getByRole("heading", { name: "落地页改版：新方案" }),
  ).toBeVisible();
  await expect(clientPage.getByText("身份未验证")).toBeVisible();
  await expect(clientPage.getByText("2026-07-17 → 2026-07-20")).toBeVisible();
  await expect(clientPage.getByText("¥4,000 → ¥6,000")).toBeVisible();
  expect(
    await clientPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await clientPage.getByRole("button", { name: "确认新方案" }).click();
  await expect(clientPage.getByText("新方案已生效")).toBeVisible();

  await expect(page.getByText("当前版本 v2")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("尾款 ¥6,000")).toBeVisible();
  await expect(page.getByText("交付日期和尾款已同时更新")).toBeVisible();

  const token = clientLink!.split("/").at(-1)!;
  const replay = await request.post(
    `${BASE_URL}/api/efficiency/changes/${token}`,
    { data: { action: "confirm" } },
  );
  expect(replay.status()).toBe(409);
});

test("服务方接口不能执行客户确认", async ({ request }) => {
  const seeded = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: { action: "seed" },
  });
  expect(seeded.status()).toBe(201);
  const body = await seeded.json();

  const wrongSecret = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "get",
      projectId: body.project.id,
      providerSecret: "wrong-secret",
    },
  });
  expect(wrongSecret.status()).toBe(403);

  const forged = await request.post(`${BASE_URL}/api/efficiency/changes`, {
    data: {
      action: "confirm",
      projectId: body.project.id,
      providerSecret: body.providerSecret,
    },
  });
  expect(forged.status()).toBe(400);
  await expect(forged.json()).resolves.toMatchObject({
    error: "服务方接口不能执行客户确认",
  });
});

test("health endpoint responds", async ({ request }) => {
  const response = await request.get(`${BASE_URL}/api/llm/health`);
  expect(response.ok()).toBe(true);
});
